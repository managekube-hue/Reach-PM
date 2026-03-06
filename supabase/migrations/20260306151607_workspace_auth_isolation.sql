create extension if not exists pgcrypto;

do $$
begin
	if not exists (
		select 1
		from pg_type t
		join pg_namespace n on n.oid = t.typnamespace
		where t.typname = 'workspace_role'
			and n.nspname = 'public'
	) then
		create type public.workspace_role as enum ('owner', 'admin', 'employee');
	end if;
end
$$;

create table if not exists public.workspaces (
	id uuid primary key default gen_random_uuid(),
	slug text not null unique,
	name text not null,
	owner_user_id uuid not null references auth.users(id) on delete cascade,
	settings jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
	workspace_id uuid not null references public.workspaces(id) on delete cascade,
	user_id uuid not null references auth.users(id) on delete cascade,
	role public.workspace_role not null default 'employee',
	joined_at timestamptz not null default now(),
	primary key (workspace_id, user_id)
);

create index if not exists idx_workspace_members_user_id on public.workspace_members(user_id);

create table if not exists public.profiles (
	id uuid primary key references auth.users(id) on delete cascade,
	email text,
	display_name text,
	signature text not null default '',
	default_workspace_id uuid references public.workspaces(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create unique index if not exists idx_profiles_email_unique on public.profiles(email) where email is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end
$$;

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_workspaces_set_updated_at on public.workspaces;
create trigger trg_workspaces_set_updated_at
before update on public.workspaces
for each row
execute function public.set_updated_at();

create or replace function public.create_default_workspace_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	workspace_uuid uuid;
	workspace_slug text;
	workspace_name text;
	display_name text;
begin
	workspace_uuid := gen_random_uuid();
	workspace_slug := 'ws-' || substr(new.id::text, 1, 12);
	display_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
	workspace_name := coalesce(display_name, 'Workspace') || '''s Workspace';

	insert into public.workspaces (id, slug, name, owner_user_id)
	values (workspace_uuid, workspace_slug, workspace_name, new.id)
	on conflict (slug) do nothing;

	insert into public.workspace_members (workspace_id, user_id, role)
	select w.id, new.id, 'owner'
	from public.workspaces w
	where w.slug = workspace_slug
	on conflict (workspace_id, user_id) do nothing;

	insert into public.profiles (id, email, display_name, default_workspace_id)
	select new.id, new.email, display_name, w.id
	from public.workspaces w
	where w.slug = workspace_slug
	on conflict (id) do update
		set email = excluded.email,
				display_name = coalesce(public.profiles.display_name, excluded.display_name),
				default_workspace_id = coalesce(public.profiles.default_workspace_id, excluded.default_workspace_id);

	return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.create_default_workspace_for_user();

do $$
declare
	u record;
	workspace_uuid uuid;
	workspace_slug text;
	display_name text;
begin
	for u in select id, email, raw_user_meta_data from auth.users loop
		workspace_slug := 'ws-' || substr(u.id::text, 1, 12);
		display_name := coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1));

		if not exists (select 1 from public.workspaces where slug = workspace_slug) then
			workspace_uuid := gen_random_uuid();
			insert into public.workspaces (id, slug, name, owner_user_id)
			values (workspace_uuid, workspace_slug, coalesce(display_name, 'Workspace') || '''s Workspace', u.id)
			on conflict (slug) do nothing;
		end if;

		insert into public.workspace_members (workspace_id, user_id, role)
		select w.id, u.id, 'owner'
		from public.workspaces w
		where w.slug = workspace_slug
		on conflict (workspace_id, user_id) do nothing;

		insert into public.profiles (id, email, display_name, default_workspace_id)
		select u.id, u.email, display_name, w.id
		from public.workspaces w
		where w.slug = workspace_slug
		on conflict (id) do update
			set email = excluded.email,
					display_name = coalesce(public.profiles.display_name, excluded.display_name),
					default_workspace_id = coalesce(public.profiles.default_workspace_id, excluded.default_workspace_id);
	end loop;
end
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
with check (id = auth.uid());

drop policy if exists workspaces_select_member on public.workspaces;
create policy workspaces_select_member
on public.workspaces
for select
using (
	exists (
		select 1
		from public.workspace_members wm
		where wm.workspace_id = public.workspaces.id
			and wm.user_id = auth.uid()
	)
);

drop policy if exists workspaces_insert_owner on public.workspaces;
create policy workspaces_insert_owner
on public.workspaces
for insert
with check (owner_user_id = auth.uid());

drop policy if exists workspaces_update_admin on public.workspaces;
create policy workspaces_update_admin
on public.workspaces
for update
using (
	exists (
		select 1
		from public.workspace_members wm
		where wm.workspace_id = public.workspaces.id
			and wm.user_id = auth.uid()
			and wm.role in ('owner', 'admin')
	)
)
with check (
	exists (
		select 1
		from public.workspace_members wm
		where wm.workspace_id = public.workspaces.id
			and wm.user_id = auth.uid()
			and wm.role in ('owner', 'admin')
	)
);

drop policy if exists workspace_members_select_member on public.workspace_members;
create policy workspace_members_select_member
on public.workspace_members
for select
using (
	exists (
		select 1
		from public.workspace_members self
		where self.workspace_id = public.workspace_members.workspace_id
			and self.user_id = auth.uid()
	)
);

drop policy if exists workspace_members_insert_admin on public.workspace_members;
create policy workspace_members_insert_admin
on public.workspace_members
for insert
with check (
	exists (
		select 1
		from public.workspace_members self
		where self.workspace_id = public.workspace_members.workspace_id
			and self.user_id = auth.uid()
			and self.role in ('owner', 'admin')
	)
);

drop policy if exists workspace_members_update_admin on public.workspace_members;
create policy workspace_members_update_admin
on public.workspace_members
for update
using (
	exists (
		select 1
		from public.workspace_members self
		where self.workspace_id = public.workspace_members.workspace_id
			and self.user_id = auth.uid()
			and self.role in ('owner', 'admin')
	)
)
with check (
	exists (
		select 1
		from public.workspace_members self
		where self.workspace_id = public.workspace_members.workspace_id
			and self.user_id = auth.uid()
			and self.role in ('owner', 'admin')
	)
);

drop policy if exists workspace_members_delete_admin on public.workspace_members;
create policy workspace_members_delete_admin
on public.workspace_members
for delete
using (
	exists (
		select 1
		from public.workspace_members self
		where self.workspace_id = public.workspace_members.workspace_id
			and self.user_id = auth.uid()
			and self.role in ('owner', 'admin')
	)
);
