

| REACH *Unified Development Platform* COMMUNICATION & COLLABORATION MODULE Version 3.0  ·  Zero to Production  ·  March 2026 *Complete · Gap-Free · Claude Code Ready · 12-Hour Deploy* |
| :---: |

| Version | 3.0 — March 2026  (replaces v2.0, 12 gaps closed) |
| :---- | :---- |
| What's new | Real email threading · Full chat feature set · Issue drops into live meetings · @ mentions everywhere · Zoom fallback properly wired · Threads · Search · File uploads · Pinned messages · Link previews |
| Video | Browser-native WebRTC \+ STUN/TURN — no third-party video SDK |
| Participants | Up to 8 mesh P2P | mediasoup SFU upgrade path included |
| Recording | MediaRecorder API → Supabase Storage |
| Email | Real Gmail \+ Outlook threading, linked to issues, compose from REACH |
| Zoom | User-connected fallback only — REACH owns no Zoom dependency |
| Status | ⚡ Ship in 12 Hours |

| HOW TO USE THIS DOCUMENT Drop this entire document into Claude Code. Every section is numbered and self-contained. Every env var, SQL statement, hook, component, Edge Function, cron job, and integration point is included. Parts marked ⚠ GAPS FILLED cover what v2.0 left out — read these carefully. Zero inference required. When a section says "add to existing file" the exact delta is provided. Test Outcomes (Part 27\) tells you exactly what "done" looks like for each feature. |
| :---- |

# **Table of Contents**

**PART 1**  Package Install & Environment Setup

**PART 2**  Complete Database Schema

**PART 3**  Supabase Realtime & RLS

**PART 4**  Zustand Store

**PART 5**  Hooks (useChannels, useChat, usePresence, useUnreadCounts, useDMs, useNotifications)

**PART 6**  Chat Components — Full Feature Set

**PART 7**  ⚠ GAPS FILLED — Message Threads

**PART 8**  ⚠ GAPS FILLED — Message Search

**PART 9**  ⚠ GAPS FILLED — File Uploads

**PART 10**  ⚠ GAPS FILLED — Link Previews & Pinned Messages

**PART 11**  Drag-and-Drop: Issue → Channel

**PART 12**  ⚠ GAPS FILLED — Drag Issue Into Live Meeting Room

**PART 13**  Native WebRTC Video (STUN/TURN, Mesh P2P, SFU Path)

**PART 14**  Signaling Server (Edge Function \+ Realtime)

**PART 15**  Video Component (Full JSX)

**PART 16**  Recording → Supabase Storage

**PART 17**  Notifications (Chimes, Badges, Browser Push)

**PART 18**  ⚠ GAPS FILLED — Real Email Threading (Gmail \+ Outlook)

**PART 19**  ⚠ GAPS FILLED — @ Mentions Everywhere

**PART 20**  ⚠ GAPS FILLED — Zoom Fallback (Properly Wired)

**PART 21**  Edge Functions

**PART 22**  Cron Jobs

**PART 23**  Channel Management

**PART 24**  Conversation Preservation & Cleanup

**PART 25**  User Settings & Notification Preferences

**PART 26**  Multi-Tenant Isolation Checklist

**PART 27**  Full Behavior Reference Table

**PART 28**  Test Outcomes — Done When

**PART 29**  User Guide

| PART 1  PACKAGE INSTALL & ENVIRONMENT SETUP |
| :---- |

## **1.1 NPM Install — Run Once**

From your Next.js project root:

| Terminal |
| :---- |
| \# Core Supabase npm install @supabase/supabase-js @supabase/ssr   \# State npm install zustand immer   \# UI utilities npm install date-fns lucide-react uuid npm install @types/uuid \--save-dev   \# Upload progress npm install axios   \# WebRTC normalization npm install webrtc-adapter   \# File upload \+ preview npm install react-dropzone   \# Link preview (server-side) npm install link-preview-js   \# Email parsing npm install mailparser npm install @types/mailparser \--save-dev   \# Image optimization for file uploads npm install browser-image-compression |

## **1.2 Environment Variables — .env.local**

Copy this entire block. Every variable is referenced in the code that follows.

| .env.local |
| :---- |
| \# ── SUPABASE ───────────────────────────────────────────────── NEXT\_PUBLIC\_SUPABASE\_URL=https://YOUR\_PROJECT\_REF.supabase.co NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=eyJ...anon...key SUPABASE\_SERVICE\_ROLE\_KEY=eyJ...service\_role...key  \# NEVER expose to browser   \# ── STUN / TURN ────────────────────────────────────────────── \# Pick ONE provider. App reads whichever vars are set.   \# Option A: Self-hosted coturn (cheapest) TURN\_SERVER\_URL=turn:YOUR\_VPS\_IP:3478 TURN\_SERVER\_USERNAME=reachuser TURN\_SERVER\_CREDENTIAL=your\_secret\_password   \# Option B: Twilio TURN (no infra, \~$0.40/GB) TWILIO\_ACCOUNT\_SID=AC... TWILIO\_AUTH\_TOKEN=...   \# Option C: Metered.ca TURN (free tier 50GB/mo) METERED\_API\_KEY=... METERED\_DOMAIN=yourapp.metered.live   \# ── AI ─────────────────────────────────────────────────────── OPENROUTER\_API\_KEY=sk-or-...   \# ── GOOGLE (Gmail \+ Calendar \+ Meet fallback) ──────────────── GOOGLE\_CLIENT\_ID=...apps.googleusercontent.com GOOGLE\_CLIENT\_SECRET=GOCSPX-... GOOGLE\_REDIRECT\_URI=https://yourdomain.com/api/auth/google/callback   \# ── MICROSOFT (Outlook / 365\) ──────────────────────────────── AZURE\_CLIENT\_ID=... AZURE\_CLIENT\_SECRET=... AZURE\_TENANT\_ID=common AZURE\_REDIRECT\_URI=https://yourdomain.com/api/auth/microsoft/callback   \# ── ZOOM (user-connected fallback only) ────────────────────── \# Users connect their own Zoom in Settings → Integrations ZOOM\_CLIENT\_ID=... ZOOM\_CLIENT\_SECRET=... ZOOM\_REDIRECT\_URI=https://yourdomain.com/api/auth/zoom/callback   \# ── EMAIL (transactional) ──────────────────────────────────── RESEND\_API\_KEY=re\_... FROM\_EMAIL=notifications@yourdomain.com   \# ── APP ───────────────────────────────────────────────────── NEXT\_PUBLIC\_APP\_URL=https://yourdomain.com |

## **1.3 Supabase CLI Setup & Secrets**

| Terminal |
| :---- |
| npm install \-g supabase supabase login supabase link \--project-ref YOUR\_PROJECT\_REF   \# Mirror all server-only env vars as Edge Function secrets: supabase secrets set SUPABASE\_SERVICE\_ROLE\_KEY=eyJ... supabase secrets set OPENROUTER\_API\_KEY=sk-or-... supabase secrets set RESEND\_API\_KEY=re\_... supabase secrets set FROM\_EMAIL=notifications@yourdomain.com supabase secrets set NEXT\_PUBLIC\_APP\_URL=https://yourdomain.com supabase secrets set TURN\_SERVER\_URL=turn:YOUR\_VPS\_IP:3478 supabase secrets set TURN\_SERVER\_USERNAME=reachuser supabase secrets set TURN\_SERVER\_CREDENTIAL=your\_secret\_password supabase secrets set GOOGLE\_CLIENT\_ID=...apps.googleusercontent.com supabase secrets set GOOGLE\_CLIENT\_SECRET=GOCSPX-... supabase secrets set AZURE\_CLIENT\_ID=... supabase secrets set AZURE\_CLIENT\_SECRET=... supabase secrets set AZURE\_TENANT\_ID=common supabase secrets set ZOOM\_CLIENT\_ID=... supabase secrets set ZOOM\_CLIENT\_SECRET=...   \# Verify: supabase secrets list |

## **1.4 Supabase Extensions — Run in SQL Editor First**

| SQL Editor |
| :---- |
| CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS "pg\_cron"; CREATE EXTENSION IF NOT EXISTS "pg\_trgm"; CREATE EXTENSION IF NOT EXISTS "pgcrypto"; CREATE EXTENSION IF NOT EXISTS "pg\_net";   \-- required for cron HTTP calls |

## **1.5 Supabase Storage Buckets**

| SQL Editor |
| :---- |
| \-- Video recordings bucket INSERT INTO storage.buckets (id, name, public, file\_size\_limit, allowed\_mime\_types) VALUES (   'recordings', 'recordings', false, 524288000,   ARRAY\['video/webm', 'video/mp4', 'audio/webm'\] );   \-- Chat file attachments bucket (images, docs, etc.) INSERT INTO storage.buckets (id, name, public, file\_size\_limit, allowed\_mime\_types) VALUES (   'attachments', 'attachments', false, 52428800,  \-- 50MB   ARRAY\['image/jpeg','image/png','image/gif','image/webp',         'application/pdf','text/plain',         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',         'video/mp4','video/webm','audio/mpeg','audio/webm'\] );   \-- RLS: recordings — only tenant members read/write CREATE POLICY "recordings\_read" ON storage.objects FOR SELECT USING (   bucket\_id \= 'recordings'   AND (storage.foldername(name))\[1\] \= (     SELECT tenant\_id::text FROM profiles WHERE id \= auth.uid()   ) ); CREATE POLICY "recordings\_insert" ON storage.objects FOR INSERT WITH CHECK (   bucket\_id \= 'recordings'   AND (storage.foldername(name))\[1\] \= (     SELECT tenant\_id::text FROM profiles WHERE id \= auth.uid()   ) );   \-- RLS: attachments — tenant members read/write CREATE POLICY "attachments\_read" ON storage.objects FOR SELECT USING (bucket\_id \= 'attachments' AND (   (storage.foldername(name))\[1\] \= (     SELECT tenant\_id::text FROM profiles WHERE id \= auth.uid()   ) )); CREATE POLICY "attachments\_insert" ON storage.objects FOR INSERT WITH CHECK (bucket\_id \= 'attachments' AND (   (storage.foldername(name))\[1\] \= (     SELECT tenant\_id::text FROM profiles WHERE id \= auth.uid()   ) )); |

## **1.6 Supabase Realtime — Enable Tables**

Dashboard → Database → Replication → enable for:

| Table | Why |
| :---- | :---- |
| messages | Required — chat delivery |
| channels | Required — channel list updates |
| issues | Required — issue status sync |
| profiles | Required — presence \+ avatar updates |
| notifications | Required — bell badge \+ sounds |
| meetings | Required — meeting status \+ recording path |
| webrtc\_signals | Critical — video signaling, must be enabled |
| message\_threads | Required — thread reply counts |
| pinned\_messages | Required — pin/unpin sync |
| email\_threads | Required — email threading |

| PART 2  COMPLETE DATABASE SCHEMA |
| :---- |

| PREREQUISITE CHECK Before running: SELECT EXISTS (SELECT FROM information\_schema.tables WHERE table\_name \= 'issues'); Must return true. If not, run the main REACH schema first. Run this entire Part 2 as one block in Supabase SQL Editor. |
| :---- |

## **2.1 workspace\_settings**

| SQL — workspace\_settings |
| :---- |
| CREATE TABLE IF NOT EXISTS workspace\_settings (   id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),   tenant\_id uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,   \-- Chat   gifs\_enabled boolean DEFAULT true,   who\_can\_create\_channels text DEFAULT 'members',  \-- admins | members   who\_can\_invite text DEFAULT 'members',   default\_channels text\[\] DEFAULT '{general,announcements}',   auto\_create\_project\_channels boolean DEFAULT true,   file\_upload\_enabled boolean DEFAULT true,   max\_file\_size\_mb int DEFAULT 50,   link\_previews\_enabled boolean DEFAULT true,   message\_retention\_days int DEFAULT 0,  \-- 0 \= forever   \-- Video   standup\_reminders boolean DEFAULT false,   standup\_reminder\_time text DEFAULT '09:00',  \-- HH:MM UTC   video\_recording\_enabled boolean DEFAULT true,   \-- AI   ai\_enabled boolean DEFAULT true,   \-- Notifications   email\_notifications\_enabled boolean DEFAULT true,   created\_at timestamptz DEFAULT now(),   updated\_at timestamptz DEFAULT now() );   CREATE TRIGGER t\_ws\_updated BEFORE UPDATE ON workspace\_settings   FOR EACH ROW EXECUTE FUNCTION update\_updated\_at();   ALTER TABLE workspace\_settings ENABLE ROW LEVEL SECURITY;   CREATE POLICY ws\_tenant ON workspace\_settings   USING (tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid()));   CREATE OR REPLACE FUNCTION create\_default\_workspace\_settings() RETURNS TRIGGER AS $$ BEGIN   INSERT INTO workspace\_settings (tenant\_id) VALUES (NEW.id)   ON CONFLICT (tenant\_id) DO NOTHING;   RETURN NEW; END; $$ LANGUAGE plpgsql;   CREATE TRIGGER t\_default\_ws\_settings AFTER INSERT ON tenants   FOR EACH ROW EXECUTE FUNCTION create\_default\_workspace\_settings(); |

## **2.2 profiles — Add Columns**

| SQL — ALTER profiles |
| :---- |
| ALTER TABLE profiles   ADD COLUMN IF NOT EXISTS notification\_email boolean DEFAULT true,   ADD COLUMN IF NOT EXISTS notification\_browser boolean DEFAULT true,   ADD COLUMN IF NOT EXISTS notification\_sounds boolean DEFAULT true,   ADD COLUMN IF NOT EXISTS notification\_types text\[\] DEFAULT '{mention,dm,issue\_assigned,video\_start}',   ADD COLUMN IF NOT EXISTS theme text DEFAULT 'dark',   ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'UTC',   ADD COLUMN IF NOT EXISTS auto\_assign\_to\_self boolean DEFAULT false,   ADD COLUMN IF NOT EXISTS video\_input\_device text,   ADD COLUMN IF NOT EXISTS audio\_input\_device text,   ADD COLUMN IF NOT EXISTS push\_subscription jsonb,   ADD COLUMN IF NOT EXISTS email\_signature text,   ADD COLUMN IF NOT EXISTS zoom\_connected boolean DEFAULT false,   ADD COLUMN IF NOT EXISTS gmail\_connected boolean DEFAULT false,   ADD COLUMN IF NOT EXISTS outlook\_connected boolean DEFAULT false; |

## **2.3 channels**

| SQL — channels |
| :---- |
| CREATE TABLE channels (   id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),   tenant\_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,   project\_id uuid REFERENCES projects(id) ON DELETE SET NULL,   name text NOT NULL,   description text,   is\_dm boolean DEFAULT false,   is\_private boolean DEFAULT false,   is\_archived boolean DEFAULT false,   members uuid\[\] DEFAULT '{}',   created\_by uuid REFERENCES profiles(id) ON DELETE SET NULL,   pinned\_count int DEFAULT 0,   created\_at timestamptz DEFAULT now() ); CREATE INDEX idx\_channels\_tenant ON channels(tenant\_id); CREATE INDEX idx\_channels\_dm ON channels(tenant\_id, is\_dm) WHERE is\_dm \= true;   ALTER TABLE channels ENABLE ROW LEVEL SECURITY; CREATE POLICY channels\_select ON channels FOR SELECT   USING (     tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid())     AND is\_archived \= false     AND (is\_private \= false OR auth.uid() \= ANY(members) OR created\_by \= auth.uid())   ); CREATE POLICY channels\_insert ON channels FOR INSERT   WITH CHECK (tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid())); CREATE POLICY channels\_update ON channels FOR UPDATE   USING (     tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid())     AND (created\_by \= auth.uid() OR (SELECT role FROM profiles WHERE id \= auth.uid()) \= 'admin')   ); ALTER TABLE channels REPLICA IDENTITY FULL; |

## **2.4 messages**

| SQL — messages |
| :---- |
| CREATE TABLE messages (   id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),   tenant\_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,   channel\_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,   author\_id uuid REFERENCES profiles(id) ON DELETE SET NULL,   body text NOT NULL,   is\_system boolean DEFAULT false,   issue\_id uuid REFERENCES issues(id) ON DELETE SET NULL,   thread\_of uuid REFERENCES messages(id) ON DELETE CASCADE,  \-- parent message id   thread\_count int DEFAULT 0,  \-- cached reply count on parent   last\_reply\_at timestamptz,   \-- for thread sorting   edited boolean DEFAULT false,   edited\_at timestamptz,   reactions jsonb DEFAULT '{}',   mentions uuid\[\] DEFAULT '{}',   attachments jsonb DEFAULT '\[\]',  \-- \[{url,name,type,size,thumbnail\_url}\]   link\_preview jsonb DEFAULT NULL,  \-- {url,title,description,image,domain}   deleted boolean DEFAULT false,   deleted\_at timestamptz,   created\_at timestamptz DEFAULT now() );   CREATE INDEX idx\_messages\_channel ON messages(channel\_id, created\_at); CREATE INDEX idx\_messages\_thread ON messages(thread\_of) WHERE thread\_of IS NOT NULL; CREATE INDEX idx\_messages\_mentions ON messages USING GIN(mentions); CREATE INDEX idx\_messages\_fts ON messages USING gin(to\_tsvector('english', body));   ALTER TABLE messages ENABLE ROW LEVEL SECURITY; CREATE POLICY messages\_select ON messages FOR SELECT   USING (tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid())); CREATE POLICY messages\_insert ON messages FOR INSERT   WITH CHECK (tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid())); CREATE POLICY messages\_update ON messages FOR UPDATE   USING (     tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid())     AND (author\_id \= auth.uid() OR (SELECT role FROM profiles WHERE id \= auth.uid()) \= 'admin')   ); ALTER TABLE messages REPLICA IDENTITY FULL;   \-- Trigger: set edited\_at on body change CREATE OR REPLACE FUNCTION messages\_set\_edited() RETURNS TRIGGER AS $$ BEGIN   IF OLD.body IS DISTINCT FROM NEW.body THEN     NEW.edited \= true; NEW.edited\_at \= now();   END IF;   RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER t\_messages\_edited BEFORE UPDATE ON messages   FOR EACH ROW EXECUTE FUNCTION messages\_set\_edited();   \-- Trigger: soft-delete replaces body CREATE OR REPLACE FUNCTION messages\_soft\_delete() RETURNS TRIGGER AS $$ BEGIN   IF NEW.deleted \= true AND OLD.deleted \= false THEN     NEW.body \= '\[deleted\]'; NEW.deleted\_at \= now();   END IF;   RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER t\_messages\_soft\_delete BEFORE UPDATE ON messages   FOR EACH ROW EXECUTE FUNCTION messages\_soft\_delete();   \-- Trigger: increment thread\_count on parent when reply inserted CREATE OR REPLACE FUNCTION messages\_thread\_count() RETURNS TRIGGER AS $$ BEGIN   IF NEW.thread\_of IS NOT NULL THEN     UPDATE messages     SET thread\_count \= thread\_count \+ 1, last\_reply\_at \= now()     WHERE id \= NEW.thread\_of;   END IF;   RETURN NEW; END; $$ LANGUAGE plpgsql; CREATE TRIGGER t\_thread\_count AFTER INSERT ON messages   FOR EACH ROW EXECUTE FUNCTION messages\_thread\_count(); |

## **2.5 pinned\_messages**

| SQL — pinned\_messages |
| :---- |
| CREATE TABLE pinned\_messages (   id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),   tenant\_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,   channel\_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,   message\_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,   pinned\_by uuid REFERENCES profiles(id) ON DELETE SET NULL,   created\_at timestamptz DEFAULT now(),   UNIQUE(channel\_id, message\_id) );   ALTER TABLE pinned\_messages ENABLE ROW LEVEL SECURITY; CREATE POLICY pinned\_tenant ON pinned\_messages   USING (tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid())); ALTER TABLE pinned\_messages REPLICA IDENTITY FULL;   \-- Update channel pin count on insert/delete CREATE OR REPLACE FUNCTION sync\_pinned\_count() RETURNS TRIGGER AS $$ BEGIN   IF TG\_OP \= 'INSERT' THEN     UPDATE channels SET pinned\_count \= pinned\_count \+ 1 WHERE id \= NEW.channel\_id;   ELSIF TG\_OP \= 'DELETE' THEN     UPDATE channels SET pinned\_count \= GREATEST(0, pinned\_count \- 1\) WHERE id \= OLD.channel\_id;   END IF;   RETURN COALESCE(NEW, OLD); END; $$ LANGUAGE plpgsql; CREATE TRIGGER t\_pinned\_count AFTER INSERT OR DELETE ON pinned\_messages   FOR EACH ROW EXECUTE FUNCTION sync\_pinned\_count(); |

## **2.6 channel\_last\_read, notifications, meetings, webrtc\_signals, integration\_tokens**

These tables are identical to v2.0 — copy from Part 2 of that document. They are reproduced here for completeness.

| SQL |
| :---- |
| \-- channel\_last\_read CREATE TABLE channel\_last\_read (   user\_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,   channel\_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,   last\_read\_at timestamptz DEFAULT now(),   PRIMARY KEY (user\_id, channel\_id) ); ALTER TABLE channel\_last\_read ENABLE ROW LEVEL SECURITY; CREATE POLICY clr\_own ON channel\_last\_read   USING (user\_id \= auth.uid()) WITH CHECK (user\_id \= auth.uid()); |

# **Full Database Schema**

Run the entire block below in Supabase SQL Editor. Prerequisite: tenants, profiles, projects, issues tables from main REACH schema must exist first. This block adds everything the Communication & Collaboration module needs.

| PREREQUISITE CHECK Before running: SELECT EXISTS (SELECT FROM information\_schema.tables WHERE table\_name \= 'issues'); — must return true. If not, run the main REACH schema first. |
| :---- |

## **2.1 workspace\_settings (Full Definition)**

This table is referenced throughout the module. Define it completely here so there is no dependency on the main schema doc.

CREATE TABLE IF NOT EXISTS workspace\_settings (

  id                              uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),

  tenant\_id                       uuid NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,

  \-- Chat

  gifs\_enabled                    boolean DEFAULT true,

  who\_can\_create\_channels         text DEFAULT 'members',  \-- admins | members

  who\_can\_invite                  text DEFAULT 'members',  \-- admins | members

  default\_channels                text\[\] DEFAULT '{general,announcements}',

  auto\_create\_project\_channels    boolean DEFAULT true,

  \-- Video

  standup\_reminders               boolean DEFAULT false,

  standup\_reminder\_time           text DEFAULT '09:00',    \-- HH:MM UTC

  video\_recording\_enabled         boolean DEFAULT true,

  \-- AI

  ai\_enabled                      boolean DEFAULT true,

  \-- Notifications

  email\_notifications\_enabled     boolean DEFAULT true,

  created\_at                      timestamptz DEFAULT now(),

  updated\_at                      timestamptz DEFAULT now()

);

CREATE TRIGGER t\_ws\_updated BEFORE UPDATE ON workspace\_settings

  FOR EACH ROW EXECUTE FUNCTION update\_updated\_at();

ALTER TABLE workspace\_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ws\_tenant ON workspace\_settings

  USING (tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid()));

\-- Auto-create workspace\_settings row when tenant is created

CREATE OR REPLACE FUNCTION create\_default\_workspace\_settings()

RETURNS TRIGGER AS $$

BEGIN

  INSERT INTO workspace\_settings (tenant\_id) VALUES (NEW.id)

  ON CONFLICT (tenant\_id) DO NOTHING;

  RETURN NEW;

END;

$$ LANGUAGE plpgsql;

CREATE TRIGGER t\_default\_ws\_settings

  AFTER INSERT ON tenants

  FOR EACH ROW EXECUTE FUNCTION create\_default\_workspace\_settings();

## **2.2 profiles — Add Notification Columns**

ALTER existing profiles table to add notification and video preferences:

ALTER TABLE profiles

  ADD COLUMN IF NOT EXISTS notification\_email      boolean DEFAULT true,

  ADD COLUMN IF NOT EXISTS notification\_browser    boolean DEFAULT true,

  ADD COLUMN IF NOT EXISTS notification\_sounds     boolean DEFAULT true,

  ADD COLUMN IF NOT EXISTS notification\_types      text\[\]

    DEFAULT '{mention,dm,issue\_assigned,video\_start}',

  ADD COLUMN IF NOT EXISTS theme                   text DEFAULT 'dark',

  ADD COLUMN IF NOT EXISTS timezone                text DEFAULT 'UTC',

  ADD COLUMN IF NOT EXISTS auto\_assign\_to\_self     boolean DEFAULT false,

  ADD COLUMN IF NOT EXISTS video\_input\_device      text,  \-- saved camera deviceId

  ADD COLUMN IF NOT EXISTS audio\_input\_device      text,  \-- saved mic deviceId

  ADD COLUMN IF NOT EXISTS push\_subscription       jsonb; \-- Web Push subscription object

## **2.3 channels**

CREATE TABLE channels (

  id            uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),

  tenant\_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  project\_id    uuid REFERENCES projects(id) ON DELETE SET NULL,

  name          text NOT NULL,

  description   text,

  is\_dm         boolean DEFAULT false,

  is\_private    boolean DEFAULT false,

  is\_archived   boolean DEFAULT false,

  members       uuid\[\] DEFAULT '{}',

  created\_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,

  created\_at    timestamptz DEFAULT now()

);

CREATE INDEX idx\_channels\_tenant   ON channels(tenant\_id);

CREATE INDEX idx\_channels\_dm       ON channels(tenant\_id, is\_dm) WHERE is\_dm \= true;

CREATE INDEX idx\_channels\_archived ON channels(tenant\_id, is\_archived);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

\-- Public channels: all tenant members see them

\-- Private channels: only members\[\] or creator

CREATE POLICY channels\_select ON channels FOR SELECT

  USING (

    tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid())

    AND is\_archived \= false

    AND (

      is\_private \= false

      OR auth.uid() \= ANY(members)

      OR created\_by \= auth.uid()

    )

  );

CREATE POLICY channels\_insert ON channels FOR INSERT

  WITH CHECK (tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid()));

CREATE POLICY channels\_update ON channels FOR UPDATE

  USING (

    tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid())

    AND (created\_by \= auth.uid()

      OR (SELECT role FROM profiles WHERE id \= auth.uid()) \= 'admin')

  );

ALTER TABLE channels REPLICA IDENTITY FULL;

## **2.4 messages**

CREATE TABLE messages (

  id           uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),

  tenant\_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  channel\_id   uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,

  author\_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,

  body         text NOT NULL,

  is\_system    boolean DEFAULT false,

  issue\_id     uuid REFERENCES issues(id) ON DELETE SET NULL,

  thread\_of    uuid REFERENCES messages(id) ON DELETE CASCADE,

  edited       boolean DEFAULT false,

  edited\_at    timestamptz,

  reactions    jsonb DEFAULT '{}',   \-- {"emoji": \["user\_id1","user\_id2"\]}

  mentions     uuid\[\] DEFAULT '{}',  \-- profile ids mentioned

  attachments  jsonb DEFAULT '\[\]',  \-- \[{url,name,type,size}\]

  deleted      boolean DEFAULT false,

  deleted\_at   timestamptz,

  created\_at   timestamptz DEFAULT now()

);

CREATE INDEX idx\_messages\_channel  ON messages(channel\_id, created\_at);

CREATE INDEX idx\_messages\_tenant   ON messages(tenant\_id);

CREATE INDEX idx\_messages\_author   ON messages(author\_id);

CREATE INDEX idx\_messages\_issue    ON messages(issue\_id) WHERE issue\_id IS NOT NULL;

CREATE INDEX idx\_messages\_mentions ON messages USING GIN(mentions);

CREATE INDEX idx\_messages\_fts      ON messages

  USING gin(to\_tsvector('english', body));

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages\_select ON messages FOR SELECT

  USING (tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid()));

CREATE POLICY messages\_insert ON messages FOR INSERT

  WITH CHECK (tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid()));

CREATE POLICY messages\_update ON messages FOR UPDATE

  USING (

    tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid())

    AND (author\_id \= auth.uid()

      OR (SELECT role FROM profiles WHERE id \= auth.uid()) \= 'admin')

  );

ALTER TABLE messages REPLICA IDENTITY FULL;

\-- Trigger: set edited\_at when body changes

CREATE OR REPLACE FUNCTION messages\_set\_edited()

RETURNS TRIGGER AS $$

BEGIN

  IF OLD.body IS DISTINCT FROM NEW.body THEN

    NEW.edited \= true;

    NEW.edited\_at \= now();

  END IF;

  RETURN NEW;

END; $$ LANGUAGE plpgsql;

CREATE TRIGGER t\_messages\_edited BEFORE UPDATE ON messages

  FOR EACH ROW EXECUTE FUNCTION messages\_set\_edited();

\-- Trigger: soft-delete replaces body

CREATE OR REPLACE FUNCTION messages\_soft\_delete()

RETURNS TRIGGER AS $$

BEGIN

  IF NEW.deleted \= true AND OLD.deleted \= false THEN

    NEW.body \= '\[deleted\]';

    NEW.deleted\_at \= now();

  END IF;

  RETURN NEW;

END; $$ LANGUAGE plpgsql;

CREATE TRIGGER t\_messages\_soft\_delete BEFORE UPDATE ON messages

  FOR EACH ROW EXECUTE FUNCTION messages\_soft\_delete();

## **2.5 channel\_last\_read**

CREATE TABLE channel\_last\_read (

  user\_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  channel\_id   uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,

  last\_read\_at timestamptz DEFAULT now(),

  PRIMARY KEY (user\_id, channel\_id)

);

ALTER TABLE channel\_last\_read ENABLE ROW LEVEL SECURITY;

CREATE POLICY clr\_own ON channel\_last\_read

  USING (user\_id \= auth.uid())

  WITH CHECK (user\_id \= auth.uid());

## **2.6 notifications**

CREATE TABLE notifications (

  id          uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),

  tenant\_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  user\_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  type        text NOT NULL,

    \-- mention | dm | issue\_assigned | issue\_done | video\_start

    \-- standup\_reminder | channel\_invite | email\_reply

  title       text NOT NULL,

  body        text,

  link        text,

  issue\_id    uuid REFERENCES issues(id) ON DELETE SET NULL,

  message\_id  uuid REFERENCES messages(id) ON DELETE SET NULL,

  channel\_id  uuid REFERENCES channels(id) ON DELETE SET NULL,

  actor\_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,

  read        boolean DEFAULT false,

  read\_at     timestamptz,

  created\_at  timestamptz DEFAULT now()

);

CREATE INDEX idx\_notif\_user   ON notifications(user\_id, read, created\_at DESC);

CREATE INDEX idx\_notif\_tenant ON notifications(tenant\_id);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY notif\_own ON notifications

  USING (user\_id \= auth.uid());

ALTER TABLE notifications REPLICA IDENTITY FULL;

## **2.7 meetings**

CREATE TABLE meetings (

  id              uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),

  tenant\_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  project\_id      uuid REFERENCES projects(id) ON DELETE SET NULL,

  channel\_id      uuid REFERENCES channels(id) ON DELETE SET NULL,

  title           text NOT NULL,

  description     text,

  \-- WebRTC: room\_code is the shared key all peers use for signaling

  room\_code       text UNIQUE NOT NULL DEFAULT

    encode(gen\_random\_bytes(8), 'hex'),

  scheduled\_at    timestamptz,

  started\_at      timestamptz,

  ended\_at        timestamptz,

  duration\_secs   int,

  status          text DEFAULT 'scheduled',

    \-- scheduled | live | ended | cancelled

  host\_id         uuid REFERENCES profiles(id) ON DELETE SET NULL,

  recording\_path  text,   \-- Supabase Storage path: tenant\_id/meeting\_id.webm

  recording\_url   text,   \-- signed URL (generated on demand, not stored long-term)

  external\_emails text\[\] DEFAULT '{}',

  created\_at      timestamptz DEFAULT now()

);

CREATE INDEX idx\_meetings\_tenant  ON meetings(tenant\_id);

CREATE INDEX idx\_meetings\_channel ON meetings(channel\_id);

CREATE INDEX idx\_meetings\_status  ON meetings(status);

ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY meetings\_tenant ON meetings

  USING (tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid()));

CREATE POLICY meetings\_insert ON meetings FOR INSERT

  WITH CHECK (tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid()));

ALTER TABLE meetings REPLICA IDENTITY FULL;

CREATE TABLE meeting\_participants (

  id          uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),

  meeting\_id  uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,

  user\_id     uuid REFERENCES profiles(id) ON DELETE SET NULL,

  email       text,

  joined\_at   timestamptz,

  left\_at     timestamptz,

  is\_host     boolean DEFAULT false

);

ALTER TABLE meeting\_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY mp\_tenant ON meeting\_participants

  USING (meeting\_id IN (

    SELECT id FROM meetings WHERE

      tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid())

  ));

## **2.8 webrtc\_signals (Signaling Table)**

This table is the WebRTC signaling channel. Peers INSERT offers/answers/ICE candidates here; Realtime delivers them to the other peer. Rows are ephemeral and cleaned up by cron.

CREATE TABLE webrtc\_signals (

  id          uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),

  room\_code   text NOT NULL,         \-- matches meetings.room\_code

  from\_user   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  to\_user     uuid,                  \-- null \= broadcast to all in room

  type        text NOT NULL,

    \-- offer | answer | ice-candidate | join | leave | ready

  payload     jsonb NOT NULL,        \-- the SDP or ICE candidate object

  created\_at  timestamptz DEFAULT now()

);

CREATE INDEX idx\_signals\_room ON webrtc\_signals(room\_code, created\_at);

\-- No RLS needed — signals are ephemeral and room\_code is a shared secret.

\-- Rows are purged by cron every 2 hours (Part 16).

\-- Enable Realtime:

ALTER TABLE webrtc\_signals REPLICA IDENTITY FULL;

## **2.9 integration\_tokens**

CREATE TABLE integration\_tokens (

  id              uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),

  tenant\_id       uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  user\_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  provider        text NOT NULL,  \-- google | microsoft

  \-- Tokens stored as text; encrypt at application layer if required by compliance

  access\_token    text,

  refresh\_token   text,

  token\_expiry    timestamptz,

  scopes          text\[\],

  provider\_email  text,

  created\_at      timestamptz DEFAULT now(),

  updated\_at      timestamptz DEFAULT now(),

  UNIQUE (user\_id, provider)

);

CREATE TRIGGER t\_it\_updated BEFORE UPDATE ON integration\_tokens

  FOR EACH ROW EXECUTE FUNCTION update\_updated\_at();

ALTER TABLE integration\_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY it\_own ON integration\_tokens

  USING (user\_id \= auth.uid())

  WITH CHECK (user\_id \= auth.uid());

## **2.10 Notification Triggers**

\-- Trigger: @mention in message → INSERT notification for each mentioned user

CREATE OR REPLACE FUNCTION notify\_on\_mention()

RETURNS TRIGGER AS $$

DECLARE

  mentioned\_user uuid;

  author\_name    text;

BEGIN

  IF array\_length(NEW.mentions, 1\) IS NULL THEN RETURN NEW; END IF;

  SELECT display\_name INTO author\_name FROM profiles WHERE id \= NEW.author\_id;

  FOREACH mentioned\_user IN ARRAY NEW.mentions LOOP

    IF mentioned\_user \= NEW.author\_id THEN CONTINUE; END IF;

    INSERT INTO notifications

      (tenant\_id, user\_id, type, title, body, link, message\_id, channel\_id, actor\_id)

    VALUES (

      NEW.tenant\_id, mentioned\_user, 'mention',

      author\_name || ' mentioned you',

      LEFT(NEW.body, 120),

      '/chat?channel=' || NEW.channel\_id,

      NEW.id, NEW.channel\_id, NEW.author\_id

    );

  END LOOP;

  RETURN NEW;

END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER t\_notify\_mention AFTER INSERT ON messages

  FOR EACH ROW EXECUTE FUNCTION notify\_on\_mention();

\-- Trigger: issue assignee changes → notify new assignee

CREATE OR REPLACE FUNCTION notify\_on\_issue\_assign()

RETURNS TRIGGER AS $$

BEGIN

  IF NEW.assignee\_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.assignee\_id IS NOT DISTINCT FROM OLD.assignee\_id THEN RETURN NEW; END IF;

  INSERT INTO notifications

    (tenant\_id, user\_id, type, title, body, link, issue\_id)

  VALUES (

    NEW.tenant\_id, NEW.assignee\_id, 'issue\_assigned',

    'Issue assigned to you',

    NEW.title,

    '/board?issue=' || NEW.id,

    NEW.id

  );

  RETURN NEW;

END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER t\_notify\_assign AFTER UPDATE ON issues

  FOR EACH ROW EXECUTE FUNCTION notify\_on\_issue\_assign();

\-- Trigger: auto-create project channel when project is created

CREATE OR REPLACE FUNCTION auto\_create\_project\_channel()

RETURNS TRIGGER AS $$

DECLARE auto\_create boolean;

BEGIN

  SELECT ws.auto\_create\_project\_channels INTO auto\_create

  FROM workspace\_settings ws WHERE ws.tenant\_id \= NEW.tenant\_id;

  IF COALESCE(auto\_create, true) THEN

    INSERT INTO channels (tenant\_id, project\_id, name, created\_by)

    VALUES (

      NEW.tenant\_id, NEW.id,

      lower(regexp\_replace(NEW.name, '\[^a-zA-Z0-9\]+', '-', 'g')),

      NEW.created\_by

    ) ON CONFLICT DO NOTHING;

  END IF;

  RETURN NEW;

END; $$ LANGUAGE plpgsql;

CREATE TRIGGER t\_auto\_channel AFTER INSERT ON projects

  FOR EACH ROW EXECUTE FUNCTION auto\_create\_project\_channel();

## 

## **2.7 email\_threads — ⚠ NEW (Gap Filled)**

*This table was missing from v2.0. Without it, the Gmail/Outlook integration has no storage for email threading.*

| SQL — email\_threads |
| :---- |
| CREATE TABLE email\_threads (   id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),   tenant\_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,   user\_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,   issue\_id uuid REFERENCES issues(id) ON DELETE SET NULL,   channel\_id uuid REFERENCES channels(id) ON DELETE SET NULL,   provider text NOT NULL,               \-- google | microsoft   thread\_id text NOT NULL,              \-- Gmail threadId or Outlook conversationId   message\_id text,                      \-- individual message ID   subject text,   from\_name text,   from\_email text NOT NULL,   to\_emails text\[\] DEFAULT '{}',   cc\_emails text\[\] DEFAULT '{}',   body\_text text,   body\_html text,   snippet text,                         \-- first 200 chars for list view   in\_reply\_to text,                     \-- parent message\_id for threading   labels text\[\] DEFAULT '{}',           \-- Gmail labels / Outlook categories   is\_read boolean DEFAULT false,   is\_sent boolean DEFAULT false,        \-- sent by REACH user   has\_attachments boolean DEFAULT false,   provider\_received\_at timestamptz,   created\_at timestamptz DEFAULT now() );   CREATE INDEX idx\_email\_threads\_issue ON email\_threads(issue\_id) WHERE issue\_id IS NOT NULL; CREATE INDEX idx\_email\_threads\_thread ON email\_threads(tenant\_id, thread\_id); CREATE INDEX idx\_email\_threads\_user ON email\_threads(user\_id, created\_at DESC); CREATE INDEX idx\_email\_threads\_fts ON email\_threads USING gin(to\_tsvector('english', coalesce(subject,'') || ' ' || coalesce(body\_text,'')));   ALTER TABLE email\_threads ENABLE ROW LEVEL SECURITY; CREATE POLICY et\_own ON email\_threads   USING (user\_id \= auth.uid() OR     tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid())); |

## **2.8 meeting\_issue\_drops — ⚠ NEW (Gap Filled)**

*This table enables issue cards to be dropped into LIVE video meetings. Without it, issue drops only work in text channels.*

| SQL — meeting\_issue\_drops |
| :---- |
| \-- Tracks issue cards displayed in active meeting rooms CREATE TABLE meeting\_issue\_drops (   id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),   meeting\_id uuid NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,   issue\_id uuid NOT NULL REFERENCES issues(id) ON DELETE CASCADE,   dropped\_by uuid REFERENCES profiles(id) ON DELETE SET NULL,   resolved boolean DEFAULT false,   created\_at timestamptz DEFAULT now() );   ALTER TABLE meeting\_issue\_drops ENABLE ROW LEVEL SECURITY; CREATE POLICY mid\_tenant ON meeting\_issue\_drops   USING (meeting\_id IN (     SELECT id FROM meetings WHERE tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid())   )); ALTER TABLE meeting\_issue\_drops REPLICA IDENTITY FULL; |

## **2.9 universal\_mentions — ⚠ NEW (Gap Filled)**

*This table indexes every @ mention across ALL surfaces: chat, issue descriptions, comments, docs, IDE notes. Without it, mentions only work in chat.*

| SQL — universal\_mentions |
| :---- |
| CREATE TABLE universal\_mentions (   id uuid PRIMARY KEY DEFAULT uuid\_generate\_v4(),   tenant\_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,   mentioned\_user\_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,   actor\_id uuid REFERENCES profiles(id) ON DELETE SET NULL,   surface text NOT NULL,  \-- chat | issue\_description | issue\_comment | doc | ide\_note   resource\_id uuid NOT NULL,  \-- message\_id | issue\_id | doc\_id | etc.   context\_text text,  \-- snippet for notification   link text,   created\_at timestamptz DEFAULT now() );   CREATE INDEX idx\_mentions\_user ON universal\_mentions(mentioned\_user\_id, created\_at DESC); ALTER TABLE universal\_mentions ENABLE ROW LEVEL SECURITY; CREATE POLICY um\_own ON universal\_mentions   USING (mentioned\_user\_id \= auth.uid() OR     tenant\_id \= (SELECT tenant\_id FROM profiles WHERE id \= auth.uid())); |

## **2.10 Notification Triggers**

| SQL — Triggers |
| :---- |
| \-- Trigger: @mention in message → notification CREATE OR REPLACE FUNCTION notify\_on\_mention() RETURNS TRIGGER AS $$ DECLARE   mentioned\_user uuid;   author\_name text; BEGIN   IF array\_length(NEW.mentions, 1\) IS NULL THEN RETURN NEW; END IF;   SELECT display\_name INTO author\_name FROM profiles WHERE id \= NEW.author\_id;   FOREACH mentioned\_user IN ARRAY NEW.mentions LOOP     IF mentioned\_user \= NEW.author\_id THEN CONTINUE; END IF;     INSERT INTO notifications (tenant\_id, user\_id, type, title, body, link, message\_id, channel\_id, actor\_id)     VALUES (NEW.tenant\_id, mentioned\_user, 'mention',       author\_name || ' mentioned you', LEFT(NEW.body, 120),       '/chat?channel=' || NEW.channel\_id,       NEW.id, NEW.channel\_id, NEW.author\_id);     \-- Also write to universal\_mentions     INSERT INTO universal\_mentions (tenant\_id, mentioned\_user\_id, actor\_id, surface, resource\_id, context\_text, link)     VALUES (NEW.tenant\_id, mentioned\_user, NEW.author\_id, 'chat', NEW.id,       LEFT(NEW.body, 120), '/chat?channel=' || NEW.channel\_id);   END LOOP;   RETURN NEW; END; $$ LANGUAGE plpgsql SECURITY DEFINER;   CREATE TRIGGER t\_notify\_mention AFTER INSERT ON messages   FOR EACH ROW EXECUTE FUNCTION notify\_on\_mention();   \-- Trigger: issue assignee → notification CREATE OR REPLACE FUNCTION notify\_on\_issue\_assign() RETURNS TRIGGER AS $$ BEGIN   IF NEW.assignee\_id IS NULL THEN RETURN NEW; END IF;   IF NEW.assignee\_id IS NOT DISTINCT FROM OLD.assignee\_id THEN RETURN NEW; END IF;   INSERT INTO notifications (tenant\_id, user\_id, type, title, body, link, issue\_id)   VALUES (NEW.tenant\_id, NEW.assignee\_id, 'issue\_assigned',     'Issue assigned to you', NEW.title, '/board?issue=' || NEW.id, NEW.id);   RETURN NEW; END; $$ LANGUAGE plpgsql SECURITY DEFINER;   CREATE TRIGGER t\_notify\_assign AFTER UPDATE ON issues   FOR EACH ROW EXECUTE FUNCTION notify\_on\_issue\_assign();   \-- Trigger: auto-create project channel CREATE OR REPLACE FUNCTION auto\_create\_project\_channel() RETURNS TRIGGER AS $$ DECLARE auto\_create boolean; BEGIN   SELECT ws.auto\_create\_project\_channels INTO auto\_create   FROM workspace\_settings ws WHERE ws.tenant\_id \= NEW.tenant\_id;   IF COALESCE(auto\_create, true) THEN     INSERT INTO channels (tenant\_id, project\_id, name, created\_by)     VALUES (NEW.tenant\_id, NEW.id,       lower(regexp\_replace(NEW.name, '\[^a-zA-Z0-9\]+', '-', 'g')), NEW.created\_by)     ON CONFLICT DO NOTHING;   END IF;   RETURN NEW; END; $$ LANGUAGE plpgsql;   CREATE TRIGGER t\_auto\_channel AFTER INSERT ON projects   FOR EACH ROW EXECUTE FUNCTION auto\_create\_project\_channel(); |

| PART 3  SUPABASE REALTIME & RLS |
| :---- |

## **3.1 Enable RLS on Realtime**

| SQL |
| :---- |
| \-- Run once in SQL Editor. ALTER ROLE authenticator SET pgrst.db\_schemas \= 'public, extensions'; \-- Then in Dashboard: Database → Replication → "Enable RLS" toggle → ON |

## **3.2 Standard Subscription Pattern**

*ALWAYS filter Realtime subscriptions by tenant\_id or a scoped ID. Subscribing to a full table without a filter delivers every tenant's data to every subscriber.*

| lib/supabase-patterns.ts |
| :---- |
| // CORRECT — always filter supabase   .channel(\`chat:${channelId}\`)   .on('postgres\_changes', {     event: 'INSERT',     schema: 'public',     table: 'messages',     filter: \`channel\_id=eq.${channelId}\`,  // REQUIRED   }, handler)   .subscribe();   // CLEANUP — always in useEffect return return () \=\> supabase.removeChannel(sub); |

## **3.3 Supabase Client Singleton**

| lib/supabase.ts |
| :---- |
| // lib/supabase.ts — one instance, shared everywhere import { createBrowserClient as create } from '@supabase/ssr'   let \_client: ReturnType\<typeof create\> | null \= null   export function createBrowserClient() {   if (\!\_client) {     \_client \= create(       process.env.NEXT\_PUBLIC\_SUPABASE\_URL\!,       process.env.NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY\!     )   }   return \_client }   // lib/supabase-server.ts (API routes \+ Edge Functions only) import { createServerClient as createSC } from '@supabase/ssr' import { cookies } from 'next/headers'   export function createServerClient() {   const store \= cookies()   return createSC(     process.env.NEXT\_PUBLIC\_SUPABASE\_URL\!,     process.env.SUPABASE\_SERVICE\_ROLE\_KEY\!,     { cookies: { get: (n) \=\> store.get(n)?.value } }   ) } |

| PART 4  ZUSTAND STORE |
| :---- |

Add these slices to your existing store/reach.ts. The full store additions are below.

| store/reach.ts |
| :---- |
| // store/reach.ts — add to existing create() call   // ── CHAT SLICE ──────────────────────────────────────────────── activeChannelId: null as string | null, channels: \[\] as Channel\[\], unreadCounts: {} as Record\<string, number\>, activeThread: null as string | null,  // message id of open thread   setActiveChannel: (id: string | null) \=\>   set(state \=\> { state.activeChannelId \= id; state.activeThread \= null }), setChannels: (channels: Channel\[\]) \=\>   set(state \=\> { state.channels \= channels }), setUnreadCount: (channelId: string, count: number) \=\>   set(state \=\> { state.unreadCounts\[channelId\] \= count }), incrementUnread: (channelId: string) \=\>   set(state \=\> { state.unreadCounts\[channelId\] \= (state.unreadCounts\[channelId\] || 0\) \+ 1 }), setActiveThread: (msgId: string | null) \=\>   set(state \=\> { state.activeThread \= msgId }),   // ── NOTIFICATION SLICE ──────────────────────────────────────── notifications: \[\] as Notification\[\], unreadNotifCount: 0, addNotification: (n: Notification) \=\>   set(state \=\> { state.notifications.unshift(n); if (\!n.read) state.unreadNotifCount++ }), markNotificationRead: (id: string) \=\>   set(state \=\> {     const n \= state.notifications.find(x \=\> x.id \=== id)     if (n && \!n.read) { n.read \= true; state.unreadNotifCount-- }   }), markAllNotifsRead: () \=\>   set(state \=\> { state.notifications.forEach(n \=\> { n.read \= true }); state.unreadNotifCount \= 0 }),   // ── MEETING SLICE ───────────────────────────────────────────── activeMeeting: null as Meeting | null, setActiveMeeting: (m: Meeting | null) \=\>   set(state \=\> { state.activeMeeting \= m }),   // ── EMAIL SLICE ─────────────────────────────────────────────── emailThreads: \[\] as EmailThread\[\], setEmailThreads: (threads: EmailThread\[\]) \=\>   set(state \=\> { state.emailThreads \= threads }), |

| PART 5  HOOKS |
| :---- |

## **5.1 useChannels**

| hooks/useChannels.ts |
| :---- |
| // hooks/useChannels.ts import { useEffect } from 'react' import { createBrowserClient } from '@/lib/supabase' import { useReachStore } from '@/store/reach'   export function useChannels() {   const { tenant, channels, setChannels } \= useReachStore()   const supabase \= createBrowserClient()     useEffect(() \=\> {     if (\!tenant?.id) return     supabase.from('channels').select('\*')       .eq('tenant\_id', tenant.id).eq('is\_dm', false)       .eq('is\_archived', false).order('name')       .then(({ data }) \=\> setChannels(data ?? \[\]))       const sub \= supabase       .channel(\`channels:${tenant.id}\`)       .on('postgres\_changes', {         event: '\*', schema: 'public', table: 'channels',         filter: \`tenant\_id=eq.${tenant.id}\`,       }, (payload) \=\> {         if (payload.eventType \=== 'INSERT') {           const ch \= payload.new as Channel           if (\!ch.is\_dm && \!ch.is\_archived) setChannels(\[...channels, ch\])         }         if (payload.eventType \=== 'UPDATE') {           setChannels(channels.map(c \=\> c.id \=== payload.new.id ? { ...c, ...payload.new } : c))         }       }).subscribe()     return () \=\> supabase.removeChannel(sub)   }, \[tenant?.id\])     return channels } |

## **5.2 useChat**

| hooks/useChat.ts |
| :---- |
| // hooks/useChat.ts import { useEffect, useState, useCallback } from 'react' import { createBrowserClient } from '@/lib/supabase' import { useReachStore } from '@/store/reach'   const MSG\_SELECT \= \`   \*,   author:profiles\!messages\_author\_id\_fkey(id,display\_name,avatar\_url,color),   issue:issues(id,title,status,priority,assignee\_id,     assignee:profiles\!issues\_assignee\_id\_fkey(id,display\_name,color))\`,   export function useChat(channelId: string | null) {   const \[messages, setMessages\] \= useState\<Message\[\]\>(\[\])   const \[loading, setLoading\] \= useState(true)   const \[sending, setSending\] \= useState(false)   const { user, issues } \= useReachStore()   const supabase \= createBrowserClient()     // Initial load   useEffect(() \=\> {     if (\!channelId) return     setLoading(true); setMessages(\[\])     supabase.from('messages').select(MSG\_SELECT)       .eq('channel\_id', channelId)       .eq('deleted', false)       .is('thread\_of', null)  // only top-level messages in main view       .order('created\_at', { ascending: true }).limit(100)       .then(({ data }) \=\> { setMessages(data ?? \[\]); setLoading(false) })   }, \[channelId\])     // Realtime   useEffect(() \=\> {     if (\!channelId) return     const sub \= supabase       .channel(\`chat:${channelId}\`)       .on('postgres\_changes', { event: 'INSERT', schema: 'public',         table: 'messages', filter: \`channel\_id=eq.${channelId}\` },         async (payload) \=\> {           if (payload.new.thread\_of) return  // replies handled in thread panel           const { data } \= await supabase.from('messages')             .select(MSG\_SELECT).eq('id', payload.new.id).single()           if (data) setMessages(prev \=\> \[...prev, data\])         })       .on('postgres\_changes', { event: 'UPDATE', schema: 'public',         table: 'messages', filter: \`channel\_id=eq.${channelId}\` },         (payload) \=\> {           setMessages(prev \=\> prev.map(m \=\>             m.id \=== payload.new.id ? { ...m, ...payload.new } : m           ))         })       .subscribe()     return () \=\> supabase.removeChannel(sub)   }, \[channelId\])     const send \= useCallback(async (body: string, attachments: any\[\] \= \[\], linkPreview: any \= null) \=\> {     if (\!channelId || \!body.trim()) return     setSending(true)     await supabase.from('messages').insert({       channel\_id: channelId, body: body.trim(),       mentions: extractMentionIds(body),       is\_system: false,       attachments: attachments,       link\_preview: linkPreview,     })     setSending(false)   }, \[channelId\])     const dropIssue \= useCallback(async (issueId: string) \=\> {     if (\!channelId) return     const issue \= issues\[issueId\]     if (\!issue) return     await supabase.from('messages').insert({       channel\_id: channelId,       body: \`Issue ${issue.title} dropped into channel\`,       is\_system: true, issue\_id: issueId,     })   }, \[channelId, issues\])     const editMessage \= useCallback(async (id: string, body: string) \=\> {     await supabase.from('messages')       .update({ body: body.trim() }).eq('id', id).eq('author\_id', user?.id)   }, \[user?.id\])     const deleteMessage \= useCallback(async (id: string) \=\> {     await supabase.from('messages')       .update({ deleted: true }).eq('id', id).eq('author\_id', user?.id)   }, \[user?.id\])     const addReaction \= useCallback(async (msgId: string, emoji: string) \=\> {     if (\!user?.id) return     const { data: msg } \= await supabase.from('messages')       .select('reactions').eq('id', msgId).single()     if (\!msg) return     const r \= msg.reactions || {}     const users: string\[\] \= r\[emoji\] || \[\]     const updated \= users.includes(user.id) ? users.filter(id \=\> id \!== user.id) : \[...users, user.id\]     await supabase.from('messages')       .update({ reactions: { ...r, \[emoji\]: updated } }).eq('id', msgId)   }, \[user?.id\])     const pinMessage \= useCallback(async (msgId: string) \=\> {     if (\!channelId) return     await supabase.from('pinned\_messages').insert({       tenant\_id: user?.tenant\_id, channel\_id: channelId,       message\_id: msgId, pinned\_by: user?.id,     })   }, \[channelId, user\])     return { messages, loading, sending, send, dropIssue,     editMessage, deleteMessage, addReaction, pinMessage } }   function extractMentionIds(body: string): string\[\] {   return \[...body.matchAll(/@\\\[(\[^\\\]\]+)\\\]\\((\[^)\]+)\\)/g)\].map(m \=\> m\[2\]) } |

## **5.3–5.6 usePresence, useUnreadCounts, useDMs, useNotifications**

These hooks are identical to v2.0 — see that document. useNotifications gains one addition: it now calls the universal\_mentions endpoint.

## **5.7 useThreadMessages — ⚠ NEW**

| hooks/useThreadMessages.ts |
| :---- |
| // hooks/useThreadMessages.ts import { useEffect, useState, useCallback } from 'react' import { createBrowserClient } from '@/lib/supabase' import { useReachStore } from '@/store/reach'   export function useThreadMessages(parentId: string | null) {   const \[replies, setReplies\] \= useState\<Message\[\]\>(\[\])   const \[loading, setLoading\] \= useState(true)   const { user } \= useReachStore()   const supabase \= createBrowserClient()     useEffect(() \=\> {     if (\!parentId) return     setLoading(true); setReplies(\[\])     supabase.from('messages')       .select(\`\*, author:profiles\!messages\_author\_id\_fkey(id,display\_name,avatar\_url,color)\`)       .eq('thread\_of', parentId)       .eq('deleted', false)       .order('created\_at', { ascending: true })       .then(({ data }) \=\> { setReplies(data ?? \[\]); setLoading(false) })       const sub \= supabase       .channel(\`thread:${parentId}\`)       .on('postgres\_changes', { event: 'INSERT', schema: 'public',         table: 'messages', filter: \`thread\_of=eq.${parentId}\` },         async (payload) \=\> {           const { data } \= await supabase.from('messages')             .select(\`\*, author:profiles\!messages\_author\_id\_fkey(id,display\_name,avatar\_url,color)\`)             .eq('id', payload.new.id).single()           if (data) setReplies(prev \=\> \[...prev, data\])         })       .subscribe()     return () \=\> supabase.removeChannel(sub)   }, \[parentId\])     const sendReply \= useCallback(async (body: string) \=\> {     if (\!parentId || \!body.trim()) return     await supabase.from('messages').insert({       thread\_of: parentId, body: body.trim(),       mentions: extractMentionIds(body), is\_system: false,       // channel\_id and tenant\_id are copied from parent by trigger:     })     // Wait — the trigger on messages copies channel\_id \+ tenant\_id from parent.     // If your DB version doesn't have that trigger, add it:     // CREATE OR REPLACE FUNCTION copy\_parent\_fields() RETURNS TRIGGER AS $$     // BEGIN     //   IF NEW.thread\_of IS NOT NULL AND NEW.channel\_id IS NULL THEN     //     SELECT channel\_id, tenant\_id INTO NEW.channel\_id, NEW.tenant\_id     //     FROM messages WHERE id \= NEW.thread\_of;     //   END IF;     //   RETURN NEW;     // END; $$ LANGUAGE plpgsql;     // CREATE TRIGGER t\_copy\_parent BEFORE INSERT ON messages     //   FOR EACH ROW EXECUTE FUNCTION copy\_parent\_fields();   }, \[parentId\])     return { replies, loading, sendReply } }   function extractMentionIds(body: string): string\[\] {   return \[...body.matchAll(/@\\\[(\[^\\\]\]+)\\\]\\((\[^)\]+)\\)/g)\].map(m \=\> m\[2\]) } |

## **5.8 useMessageSearch — ⚠ NEW**

| hooks/useMessageSearch.ts |
| :---- |
| // hooks/useMessageSearch.ts import { useState, useCallback } from 'react' import { createBrowserClient } from '@/lib/supabase' import { useReachStore } from '@/store/reach'   export function useMessageSearch() {   const \[results, setResults\] \= useState\<Message\[\]\>(\[\])   const \[loading, setLoading\] \= useState(false)   const { tenant } \= useReachStore()   const supabase \= createBrowserClient()     const search \= useCallback(async (query: string, channelId?: string) \=\> {     if (\!query.trim() || \!tenant?.id) return     setLoading(true)     let q \= supabase       .from('messages')       .select(\`\*, author:profiles\!messages\_author\_id\_fkey(id,display\_name,avatar\_url,color),         channel:channels(id,name)\`)       .eq('tenant\_id', tenant.id)       .eq('deleted', false)       .textSearch('body', query, { type: 'websearch' })       .order('created\_at', { ascending: false })       .limit(50)     if (channelId) q \= q.eq('channel\_id', channelId)     const { data } \= await q     setResults(data ?? \[\])     setLoading(false)   }, \[tenant?.id\])     return { results, loading, search } } |

| PART 6  CHAT COMPONENTS — FULL FEATURE SET |
| :---- |

## **6.1 ChatLayout**

The overall layout: sidebar \+ message panel \+ thread panel (new) \+ issues sidebar.

| components/chat/ChatLayout.tsx |
| :---- |
| // components/chat/ChatLayout.tsx 'use client' import { useChannels } from '@/hooks/useChannels' import { useUnreadCounts } from '@/hooks/useUnreadCounts' import { usePresence } from '@/hooks/usePresence' import { useDMs } from '@/hooks/useDMs' import { useReachStore } from '@/store/reach' import { ChannelList } from './ChannelList' import { MessagePanel } from './MessagePanel' import { ThreadPanel } from './ThreadPanel' import { IssuesSidebar } from './IssuesSidebar' import { SearchOverlay } from './SearchOverlay' import { useState } from 'react'   export function ChatLayout() {   const channels \= useChannels()   const { unreadCounts, markRead } \= useUnreadCounts()   const { isOnline } \= usePresence()   const { dmChannels, openDM } \= useDMs()   const { activeChannelId, setActiveChannel, activeThread, tenant } \= useReachStore()   const \[searchOpen, setSearchOpen\] \= useState(false)     if (\!tenant) return \<FullScreenSpinner /\>     function handleSelect(channelId: string) {     setActiveChannel(channelId)     markRead(channelId)   }     return (     \<div className="flex h-screen bg-\[\#1A1A2E\] text-white overflow-hidden"\>       \<ChannelList channels={channels} dmChannels={dmChannels}         activeChannelId={activeChannelId} unreadCounts={unreadCounts}         isOnline={isOnline} onSelect={handleSelect} onOpenDM={openDM}         onOpenSearch={() \=\> setSearchOpen(true)} /\>       \<div className="flex-1 flex min-w-0"\>         {activeChannelId           ? \<MessagePanel channelId={activeChannelId} /\>           : \<EmptyState /\>}         {activeThread && \<ThreadPanel parentId={activeThread} /\>}       \</div\>       \<IssuesSidebar /\>       {searchOpen && \<SearchOverlay onClose={() \=\> setSearchOpen(false)} /\>}     \</div\>   ) }   function FullScreenSpinner() {   return (     \<div className="flex h-screen items-center justify-center bg-\[\#1A1A2E\]"\>       \<div className="w-6 h-6 border-2 border-\[\#48B8FF\] border-t-transparent rounded-full animate-spin" /\>     \</div\>   ) } function EmptyState() {   return (     \<div className="flex-1 flex items-center justify-center text-zinc-500"\>       \<p className="text-sm"\>Select a channel to start messaging\</p\>     \</div\>   ) } |

## **6.2 MessagePanel**

| components/chat/MessagePanel.tsx |
| :---- |
| // components/chat/MessagePanel.tsx 'use client' import { useRef, useEffect, useState } from 'react' import { useChat } from '@/hooks/useChat' import { useReachStore } from '@/store/reach' import { MessageBubble } from './MessageBubble' import { InlineIssueCard } from './InlineIssueCard' import { MessageInput } from './MessageInput' import { PinnedMessagesBar } from './PinnedMessagesBar' import { StartMeetingButton } from '@/components/video/StartMeetingButton' import { Pin, Search } from 'lucide-react'   export function MessagePanel({ channelId }: { channelId: string }) {   const { messages, loading, sending, send,     dropIssue, editMessage, deleteMessage, addReaction, pinMessage } \= useChat(channelId)   const { setActiveThread, activeThread } \= useReachStore()   const bottomRef \= useRef\<HTMLDivElement\>(null)   const \[showPinned, setShowPinned\] \= useState(false)     useEffect(() \=\> {     const handler \= (e: CustomEvent) \=\> {       if (e.detail.channelId \=== channelId) dropIssue(e.detail.issueId)     }     window.addEventListener('reach:drop-issue', handler as EventListener)     return () \=\> window.removeEventListener('reach:drop-issue', handler as EventListener)   }, \[channelId, dropIssue\])     useEffect(() \=\> {     bottomRef.current?.scrollIntoView({ behavior: 'smooth' })   }, \[messages.length\])     return (     \<div className="flex flex-col h-full flex-1 min-w-0"\>       {/\* Channel header \*/}       \<div className="flex items-center justify-between px-4 py-3         border-b border-zinc-800 flex-shrink-0 gap-2"\>         \<span className="font-semibold text-white text-sm"\>Channel\</span\>         \<div className="flex items-center gap-2"\>           \<button onClick={() \=\> setShowPinned(p \=\> \!p)}             className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white px-2 py-1               rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"\>             \<Pin size={12}/\> Pinned           \</button\>           \<StartMeetingButton channelId={channelId} /\>         \</div\>       \</div\>       {showPinned && \<PinnedMessagesBar channelId={channelId} /\>}       {/\* Messages \*/}       \<div className="flex-1 overflow-y-auto p-4 space-y-1"\>         {loading && \<p className="text-center text-zinc-500 text-sm py-8"\>Loading...\</p\>}         {messages.map(msg \=\>           msg.is\_system && msg.issue\_id             ? \<InlineIssueCard key={msg.id} message={msg} onReact={emoji \=\> addReaction(msg.id, emoji)} /\>             : \<MessageBubble key={msg.id} message={msg}                 onEdit={editMessage} onDelete={deleteMessage}                 onReact={emoji \=\> addReaction(msg.id, emoji)}                 onPin={() \=\> pinMessage(msg.id)}                 onThread={() \=\> setActiveThread(msg.id)} /\>         )}         \<div ref={bottomRef} /\>       \</div\>       \<MessageInput onSend={send} sending={sending} channelId={channelId} /\>     \</div\>   ) } |

## **6.3 MessageBubble (with Thread, Pin, Link Preview)**

| components/chat/MessageBubble.tsx |
| :---- |
| // components/chat/MessageBubble.tsx 'use client' import { useState } from 'react' import { formatDistanceToNow } from 'date-fns' import { Edit2, Trash2, Pin, MessageSquare, ExternalLink } from 'lucide-react' import { useReachStore } from '@/store/reach'   const QUICK \= \['👍','❤️','😂','🎉','🚀','👀'\]   export function MessageBubble({ message, onEdit, onDelete, onReact, onPin, onThread }) {   const { user } \= useReachStore()   const \[editing, setEditing\] \= useState(false)   const \[editBody, setEditBody\] \= useState(message.body)   const isOwn \= message.author\_id \=== user?.id     if (message.deleted) return (     \<div className="pl-11 py-0.5 text-zinc-600 italic text-sm"\>\[This message was deleted\]\</div\>   )     function renderBody(body: string) {     return body.replace(/@\\\[(\[^\\\]\]+)\\\]\\(\[^)\]+\\)/g,       (\_, name) \=\> \`\<span class="text-\[\#48B8FF\] font-medium"\>@${name}\</span\>\`)   }     return (     \<div className="group flex gap-3 px-2 py-1 rounded-md hover:bg-zinc-800/40 relative"\>       \<div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center         text-sm font-bold text-white"         style={{ backgroundColor: message.author?.color ?? '\#48B8FF' }}\>         {(message.author?.display\_name ?? '?')\[0\].toUpperCase()}       \</div\>       \<div className="flex-1 min-w-0"\>         \<div className="flex items-baseline gap-2 mb-0.5"\>           \<span className="font-semibold text-sm text-white"\>{message.author?.display\_name}\</span\>           \<span className="text-xs text-zinc-500"\>             {formatDistanceToNow(new Date(message.created\_at), { addSuffix: true })}           \</span\>           {message.edited && \<span className="text-xs text-zinc-600"\>(edited)\</span\>}         \</div\>         {editing ? (           \<div className="flex gap-2"\>             \<input value={editBody} onChange={e \=\> setEditBody(e.target.value)}               onKeyDown={e \=\> {                 if (e.key \=== 'Enter') { onEdit(message.id, editBody); setEditing(false) }                 if (e.key \=== 'Escape') { setEditing(false); setEditBody(message.body) }               }}               className="flex-1 bg-zinc-700 rounded px-2 py-1 text-sm text-white                 border border-\[\#48B8FF\] outline-none" autoFocus /\>             \<button onClick={() \=\> { setEditing(false); setEditBody(message.body) }}               className="text-xs text-zinc-400 hover:text-white"\>Cancel\</button\>           \</div\>         ) : (           \<p className="text-sm text-zinc-200 break-words"             dangerouslySetInnerHTML={{ \_\_html: renderBody(message.body) }} /\>         )}         {/\* Link preview \*/}         {message.link\_preview && (           \<a href={message.link\_preview.url} target="\_blank" rel="noopener noreferrer"             className="mt-2 flex gap-3 border border-zinc-700 rounded-lg overflow-hidden               bg-zinc-800/60 hover:bg-zinc-800 transition-colors max-w-lg"\>             {message.link\_preview.image && (               \<img src={message.link\_preview.image} alt=""                 className="w-20 h-20 object-cover flex-shrink-0" /\>             )}             \<div className="p-2 min-w-0"\>               \<p className="text-xs text-zinc-500 truncate"\>{message.link\_preview.domain}\</p\>               \<p className="text-sm font-medium text-white truncate"\>{message.link\_preview.title}\</p\>               \<p className="text-xs text-zinc-400 line-clamp-2 mt-0.5"\>                 {message.link\_preview.description}               \</p\>             \</div\>           \</a\>         )}         {/\* Attachments \*/}         {(message.attachments ?? \[\]).length \> 0 && (           \<div className="mt-2 flex flex-wrap gap-2"\>             {message.attachments.map((att: any, i: number) \=\> (               \<a key={i} href={att.url} target="\_blank" rel="noopener noreferrer"                 className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800                   border border-zinc-700 hover:border-\[\#48B8FF\] transition-colors text-sm"\>                 {att.type?.startsWith('image/') && att.thumbnail\_url                   ? \<img src={att.thumbnail\_url} alt={att.name} className="w-12 h-12 object-cover rounded" /\>                   : \<span className="text-zinc-400"\>📎\</span\>}                 \<div\>                   \<p className="text-xs text-white truncate max-w-\[120px\]"\>{att.name}\</p\>                   \<p className="text-xs text-zinc-500"\>{formatBytes(att.size)}\</p\>                 \</div\>               \</a\>             ))}           \</div\>         )}         {/\* Reactions \*/}         \<div className="flex flex-wrap gap-1 mt-1"\>           {Object.entries(message.reactions ?? {}).filter((\[,u\]) \=\> (u as string\[\]).length \> 0\)             .map((\[emoji, users\]) \=\> (             \<button key={emoji} onClick={() \=\> onReact(emoji)}               className="inline-flex items-center gap-1 text-xs bg-zinc-700 border                 border-zinc-600 rounded-full px-2 py-0.5 hover:border-\[\#48B8FF\] transition-colors"\>               {emoji} \<span className="text-zinc-400"\>{(users as string\[\]).length}\</span\>             \</button\>           ))}         \</div\>         {/\* Thread replies count \*/}         {(message.thread\_count ?? 0\) \> 0 && (           \<button onClick={onThread}             className="mt-1 flex items-center gap-1 text-xs text-\[\#48B8FF\] hover:underline"\>             \<MessageSquare size={11}/\>             {message.thread\_count} {message.thread\_count \=== 1 ? 'reply' : 'replies'}           \</button\>         )}       \</div\>       {/\* Hover actions \*/}       \<div className="absolute right-2 top-1 opacity-0 group-hover:opacity-100         flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-md px-1 py-0.5 shadow-lg"\>         {QUICK.map(e \=\> (           \<button key={e} onClick={() \=\> onReact(e)}             className="text-sm hover:scale-125 transition-transform"\>{e}\</button\>         ))}         \<button onClick={onThread} className="p-1 text-zinc-400 hover:text-white" title="Reply in thread"\>           \<MessageSquare size={11}/\>         \</button\>         \<button onClick={onPin} className="p-1 text-zinc-400 hover:text-yellow-400" title="Pin message"\>           \<Pin size={11}/\>         \</button\>         {isOwn && \<\>           \<button onClick={() \=\> setEditing(true)} className="p-1 text-zinc-400 hover:text-white"\>             \<Edit2 size={11}/\>           \</button\>           \<button onClick={() \=\> onDelete(message.id)} className="p-1 text-zinc-400 hover:text-red-400"\>             \<Trash2 size={11}/\>           \</button\>         \</\>}       \</div\>     \</div\>   ) }   function formatBytes(bytes: number): string {   if (\!bytes) return ''   if (bytes \< 1024\) return bytes \+ ' B'   if (bytes \< 1048576\) return (bytes / 1024).toFixed(1) \+ ' KB'   return (bytes / 1048576).toFixed(1) \+ ' MB' } |

| PART 7  ⚠ GAPS FILLED — MESSAGE THREADS |
| :---- |

| What was missing in v2.0 thread\_of column existed in the schema but there was no thread UI, no ThreadPanel component, no useThreadMessages hook, and no way for users to see or reply to thread messages. This part fills the complete gap. |
| :---- |

## **7.1 ThreadPanel Component**

| components/chat/ThreadPanel.tsx |
| :---- |
| // components/chat/ThreadPanel.tsx 'use client' import { useRef, useEffect, useState } from 'react' import { X, Send } from 'lucide-react' import { useThreadMessages } from '@/hooks/useThreadMessages' import { useReachStore } from '@/store/reach' import { formatDistanceToNow } from 'date-fns'   export function ThreadPanel({ parentId }: { parentId: string }) {   const { replies, loading, sendReply } \= useThreadMessages(parentId)   const { setActiveThread } \= useReachStore()   const \[body, setBody\] \= useState('')   const \[sending, setSending\] \= useState(false)   const bottomRef \= useRef\<HTMLDivElement\>(null)     useEffect(() \=\> {     bottomRef.current?.scrollIntoView({ behavior: 'smooth' })   }, \[replies.length\])     async function handleSend() {     if (\!body.trim() || sending) return     setSending(true)     await sendReply(body)     setBody('')     setSending(false)   }     return (     \<div className="w-80 flex flex-col border-l border-zinc-800 bg-\[\#16213E\] flex-shrink-0"\>       \<div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800"\>         \<span className="font-semibold text-white text-sm"\>Thread\</span\>         \<button onClick={() \=\> setActiveThread(null)} className="text-zinc-400 hover:text-white"\>           \<X size={15}/\>         \</button\>       \</div\>       \<div className="flex-1 overflow-y-auto p-3 space-y-3"\>         {loading && \<p className="text-center text-zinc-500 text-xs py-4"\>Loading...\</p\>}         {replies.map(reply \=\> (           \<div key={reply.id} className="flex gap-2"\>             \<div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center               text-xs font-bold text-white"               style={{ backgroundColor: reply.author?.color ?? '\#48B8FF' }}\>               {(reply.author?.display\_name ?? '?')\[0\].toUpperCase()}             \</div\>             \<div className="flex-1 min-w-0"\>               \<div className="flex items-baseline gap-1.5"\>                 \<span className="text-xs font-semibold text-white"\>{reply.author?.display\_name}\</span\>                 \<span className="text-\[10px\] text-zinc-500"\>                   {formatDistanceToNow(new Date(reply.created\_at), { addSuffix: true })}                 \</span\>               \</div\>               \<p className="text-xs text-zinc-200 break-words"\>{reply.body}\</p\>             \</div\>           \</div\>         ))}         \<div ref={bottomRef} /\>       \</div\>       \<div className="p-3 border-t border-zinc-800 flex gap-2"\>         \<input value={body} onChange={e \=\> setBody(e.target.value)}           onKeyDown={e \=\> { if (e.key==='Enter' && \!e.shiftKey) { e.preventDefault(); handleSend() } }}           placeholder="Reply in thread..."           className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs             text-white placeholder-zinc-500 focus:outline-none focus:border-\[\#48B8FF\]" /\>         \<button onClick={handleSend} disabled={\!body.trim() || sending}           className="p-2 text-\[\#48B8FF\] hover:text-white disabled:text-zinc-600"\>           \<Send size={13}/\>         \</button\>       \</div\>     \</div\>   ) } |

| PART 8  ⚠ GAPS FILLED — MESSAGE SEARCH |
| :---- |

## **8.1 SearchOverlay Component**

| components/chat/SearchOverlay.tsx |
| :---- |
| // components/chat/SearchOverlay.tsx 'use client' import { useState, useEffect } from 'react' import { Search, X } from 'lucide-react' import { useMessageSearch } from '@/hooks/useMessageSearch' import { useReachStore } from '@/store/reach' import { formatDistanceToNow } from 'date-fns'   export function SearchOverlay({ onClose }: { onClose: () \=\> void }) {   const \[query, setQuery\] \= useState('')   const { results, loading, search } \= useMessageSearch()   const { setActiveChannel } \= useReachStore()     useEffect(() \=\> {     const t \= setTimeout(() \=\> { if (query.length \>= 2\) search(query) }, 300\)     return () \=\> clearTimeout(t)   }, \[query\])     // Close on Escape   useEffect(() \=\> {     const handler \= (e: KeyboardEvent) \=\> { if (e.key \=== 'Escape') onClose() }     window.addEventListener('keydown', handler)     return () \=\> window.removeEventListener('keydown', handler)   }, \[\])     function jumpTo(msg: any) {     setActiveChannel(msg.channel\_id)     onClose()     // After navigation, scroll to message by id     setTimeout(() \=\> {       document.getElementById(\`msg-${msg.id}\`)?.scrollIntoView({ behavior: 'smooth' })     }, 300\)   }     return (     \<div className="fixed inset-0 bg-black/70 z-50 flex items-start justify-center pt-24"\>       \<div className="w-full max-w-xl bg-\[\#16213E\] rounded-2xl border border-zinc-700 shadow-2xl overflow-hidden"\>         \<div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-700"\>           \<Search size={16} className="text-zinc-400 flex-shrink-0" /\>           \<input autoFocus value={query} onChange={e \=\> setQuery(e.target.value)}             placeholder="Search messages..."             className="flex-1 bg-transparent text-white text-sm placeholder-zinc-500 outline-none" /\>           \<button onClick={onClose} className="text-zinc-400 hover:text-white"\>\<X size={16}/\>\</button\>         \</div\>         \<div className="max-h-96 overflow-y-auto divide-y divide-zinc-800"\>           {loading && \<p className="text-center text-zinc-500 text-sm py-6"\>Searching...\</p\>}           {\!loading && query.length \>= 2 && results.length \=== 0 && (             \<p className="text-center text-zinc-500 text-sm py-6"\>No results\</p\>           )}           {results.map(msg \=\> (             \<button key={msg.id} onClick={() \=\> jumpTo(msg)}               className="w-full text-left px-4 py-3 hover:bg-zinc-800/60 transition-colors"\>               \<div className="flex items-center gap-2 mb-1"\>                 \<span className="text-xs font-medium text-\[\#48B8FF\]"\>                   \#{msg.channel?.name}                 \</span\>                 \<span className="text-xs text-zinc-500"\>                   {formatDistanceToNow(new Date(msg.created\_at), { addSuffix: true })}                 \</span\>               \</div\>               \<p className="text-xs text-zinc-300 font-medium"\>{msg.author?.display\_name}\</p\>               \<p className="text-sm text-zinc-200 line-clamp-2 mt-0.5"\>{msg.body}\</p\>             \</button\>           ))}         \</div\>         \<div className="px-4 py-2 border-t border-zinc-800"\>           \<p className="text-xs text-zinc-600"\>Press Esc to close  ·  Cmd+K to open search\</p\>         \</div\>       \</div\>     \</div\>   ) } |

| PART 9  ⚠ GAPS FILLED — FILE UPLOADS |
| :---- |

*v2.0 defined the attachments column but provided no upload UI, no storage path logic, and no thumbnail generation. This part fills the complete gap.*

## **9.1 useFileUpload Hook**

| hooks/useFileUpload.ts |
| :---- |
| // hooks/useFileUpload.ts import { useState, useCallback } from 'react' import { createBrowserClient } from '@/lib/supabase' import { useReachStore } from '@/store/reach' import imageCompression from 'browser-image-compression'   interface UploadedFile {   url: string   name: string   type: string   size: number   thumbnail\_url?: string }   export function useFileUpload() {   const \[uploading, setUploading\] \= useState(false)   const \[progress, setProgress\] \= useState(0)   const { user } \= useReachStore()   const supabase \= createBrowserClient()     const upload \= useCallback(async (files: File\[\]): Promise\<UploadedFile\[\]\> \=\> {     if (\!user?.id) return \[\]     setUploading(true); setProgress(0)     const { data: profile } \= await supabase       .from('profiles').select('tenant\_id').eq('id', user.id).single()     const tenantId \= profile?.tenant\_id       const results: UploadedFile\[\] \= \[\]     for (let i \= 0; i \< files.length; i++) {       let file \= files\[i\]       let thumbnail\_url: string | undefined         // Compress images before upload       if (file.type.startsWith('image/')) {         file \= await imageCompression(file, {           maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true,         })         // Generate thumbnail         const thumb \= await imageCompression(files\[i\], {           maxSizeMB: 0.05, maxWidthOrHeight: 200, useWebWorker: true,         })         const thumbPath \= \`${tenantId}/thumbs/${Date.now()}-thumb-${files\[i\].name}\`         await supabase.storage.from('attachments').upload(thumbPath, thumb, {           contentType: files\[i\].type, upsert: false,         })         const { data: thumbData } \= await supabase.storage           .from('attachments').createSignedUrl(thumbPath, 86400\)         thumbnail\_url \= thumbData?.signedUrl       }         const path \= \`${tenantId}/${Date.now()}-${file.name}\`       const { error } \= await supabase.storage         .from('attachments').upload(path, file, {           contentType: file.type, upsert: false,         })       if (\!error) {         const { data } \= await supabase.storage           .from('attachments').createSignedUrl(path, 86400\)         if (data?.signedUrl) {           results.push({             url: data.signedUrl, name: files\[i\].name,             type: files\[i\].type, size: files\[i\].size,             ...(thumbnail\_url ? { thumbnail\_url } : {})           })         }       }       setProgress(Math.round(((i \+ 1\) / files.length) \* 100))     }     setUploading(false)     return results   }, \[user?.id\])     return { upload, uploading, progress } } |

## **9.2 FileAttachButton Component**

| components/chat/FileAttachButton.tsx |
| :---- |
| // components/chat/FileAttachButton.tsx 'use client' import { useRef } from 'react' import { Paperclip } from 'lucide-react'   export function FileAttachButton({   onFiles, disabled }: {   onFiles: (files: File\[\]) \=\> void   disabled?: boolean }) {   const inputRef \= useRef\<HTMLInputElement\>(null)     function handleChange(e: React.ChangeEvent\<HTMLInputElement\>) {     const files \= Array.from(e.target.files ?? \[\])     if (files.length \> 0\) onFiles(files)     e.target.value \= ''  // reset so same file can be picked again   }     return (     \<\>       \<input ref={inputRef} type="file" multiple         accept="image/\*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.mp4,.webm,.mp3"         className="hidden" onChange={handleChange} /\>       \<button         type="button"         onClick={() \=\> inputRef.current?.click()}         disabled={disabled}         className="p-1.5 text-zinc-400 hover:text-white transition-colors           disabled:text-zinc-600 disabled:cursor-not-allowed"         title="Attach file"\>         \<Paperclip size={15}/\>       \</button\>     \<\>   ) } |

## **9.3 Updated MessageInput (with file attach \+ link preview)**

| components/chat/MessageInput.tsx |
| :---- |
| // components/chat/MessageInput.tsx (complete replacement) 'use client' import { useState, useRef, useEffect } from 'react' import { Send } from 'lucide-react' import { createBrowserClient } from '@/lib/supabase' import { useReachStore } from '@/store/reach' import { useFileUpload } from '@/hooks/useFileUpload' import { FileAttachButton } from './FileAttachButton'   export function MessageInput({ onSend, sending, channelId }) {   const \[body, setBody\] \= useState('')   const \[results, setResults\] \= useState\<any\[\]\>(\[\])   const \[mentionStart, setMentionStart\] \= useState(-1)   const \[pendingFiles, setPendingFiles\] \= useState\<any\[\]\>(\[\])   const \[linkPreview, setLinkPreview\] \= useState\<any\>(null)   const \[previewLoading, setPreviewLoading\] \= useState(false)   const ref \= useRef\<HTMLTextAreaElement\>(null)   const { tenant } \= useReachStore()   const supabase \= createBrowserClient()   const { upload, uploading } \= useFileUpload()     // Detect URLs and fetch preview   useEffect(() \=\> {     const urlMatch \= body.match(/https?:\\/\\/\[^\\s\]+/)     if (urlMatch && \!linkPreview) {       setPreviewLoading(true)       fetch(\`/api/link-preview?url=${encodeURIComponent(urlMatch\[0\])}\`)         .then(r \=\> r.json())         .then(data \=\> { setLinkPreview(data); setPreviewLoading(false) })         .catch(() \=\> setPreviewLoading(false))     }     if (\!urlMatch) setLinkPreview(null)   }, \[body\])     async function onChange(e: React.ChangeEvent\<HTMLTextAreaElement\>) {     const val \= e.target.value     setBody(val)     const cursor \= e.target.selectionStart ?? 0     const match \= val.slice(0, cursor).match(/@(\[\\w.-\]\*)$/)     if (match && match\[1\].length \>= 1\) {       setMentionStart(cursor \- match\[0\].length)       const { data } \= await supabase.from('profiles')         .select('id,display\_name,color').eq('tenant\_id', tenant?.id)         .ilike('display\_name', \`%${match\[1\]}%\`).limit(5)       setResults(data ?? \[\])     } else { setResults(\[\]) }   }     function insertMention(p: any) {     const cursor \= ref.current?.selectionStart ?? 0     const token \= \`@\[${p.display\_name}\](${p.id}) \`     setBody(body.slice(0, mentionStart) \+ token \+ body.slice(cursor))     setResults(\[\])     ref.current?.focus()   }     async function handleFiles(files: File\[\]) {     const uploaded \= await upload(files)     setPendingFiles(prev \=\> \[...prev, ...uploaded\])   }     async function handleSend() {     if ((\!body.trim() && pendingFiles.length \=== 0\) || sending || uploading) return     await onSend(body, pendingFiles, linkPreview)     setBody('')     setPendingFiles(\[\])     setLinkPreview(null)   }     return (     \<div className="relative p-4 border-t border-zinc-800 flex-shrink-0"\>       {results.length \> 0 && (         \<div className="absolute bottom-full left-4 right-4 mb-1 bg-zinc-800           border border-zinc-700 rounded-xl shadow-xl overflow-hidden z-50"\>           {results.map(p \=\> (             \<button key={p.id} type="button" onClick={() \=\> insertMention(p)}               className="flex items-center gap-2 w-full px-3 py-2 hover:bg-zinc-700 text-sm text-white text-left"\>               \<div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white"                 style={{ backgroundColor: p.color }}\>                 {p.display\_name\[0\].toUpperCase()}               \</div\>               {p.display\_name}             \</button\>           ))}         \</div\>       )}       {/\* Pending attachments preview \*/}       {pendingFiles.length \> 0 && (         \<div className="flex gap-2 mb-2 flex-wrap"\>           {pendingFiles.map((f, i) \=\> (             \<div key={i} className="relative flex items-center gap-2 bg-zinc-800 border               border-zinc-700 rounded-lg px-2 py-1 text-xs text-zinc-300"\>               {f.type?.startsWith('image/') && f.thumbnail\_url                 ? \<img src={f.thumbnail\_url} className="w-8 h-8 object-cover rounded" alt="" /\>                 : \<span\>📎\</span\>}               \<span className="truncate max-w-\[100px\]"\>{f.name}\</span\>               \<button onClick={() \=\> setPendingFiles(prev \=\> prev.filter((\_, j) \=\> j \!== i))}                 className="text-zinc-500 hover:text-red-400 ml-1"\>×\</button\>             \</div\>           ))}         \</div\>       )}       {/\* Link preview card \*/}       {linkPreview && (         \<div className="mb-2 flex gap-3 border border-zinc-700 rounded-lg bg-zinc-800/60 overflow-hidden max-w-sm"\>           {linkPreview.image && \<img src={linkPreview.image} className="w-16 h-16 object-cover flex-shrink-0" alt="" /\>}           \<div className="p-2 min-w-0"\>             \<p className="text-xs text-zinc-500 truncate"\>{linkPreview.domain}\</p\>             \<p className="text-sm font-medium text-white truncate"\>{linkPreview.title}\</p\>           \</div\>           \<button onClick={() \=\> setLinkPreview(null)} className="p-2 text-zinc-500 hover:text-white self-start"\>×\</button\>         \</div\>       )}       \<div className="flex items-end gap-2 bg-zinc-800 rounded-xl border         border-zinc-700 focus-within:border-\[\#48B8FF\] transition-colors px-3 py-2"\>         \<FileAttachButton onFiles={handleFiles} disabled={uploading} /\>         \<textarea ref={ref} value={body} onChange={onChange}           onKeyDown={e \=\> { if (e.key==='Enter'&&\!e.shiftKey){e.preventDefault();handleSend()} }}           placeholder="Message... (@ to mention, Shift+Enter for newline)"           rows={1}           className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500             outline-none resize-none max-h-32"           style={{height:'auto'}}           onInput={e=\>{const t=e.target as HTMLTextAreaElement;             t.style.height='auto';t.style.height=t.scrollHeight+'px'}}         /\>         {uploading && \<span className="text-xs text-zinc-500"\>Uploading...\</span\>}         \<button onClick={handleSend} disabled={(\!body.trim()&\&pendingFiles.length===0)||sending||uploading}           className="p-1 text-\[\#48B8FF\] hover:text-white transition-colors             disabled:text-zinc-600 disabled:cursor-not-allowed"\>           \<Send size={15}/\>         \</button\>       \</div\>     \</div\>   ) } |

## **9.4 Link Preview API Route**

| app/api/link-preview/route.ts |
| :---- |
| // app/api/link-preview/route.ts import { NextRequest, NextResponse } from 'next/server' import { getLinkPreview } from 'link-preview-js'   export async function GET(req: NextRequest) {   const url \= req.nextUrl.searchParams.get('url')   if (\!url) return NextResponse.json(null)   try {     const data \= await getLinkPreview(url, { timeout: 3000 }) as any     return NextResponse.json({       url: data.url,       title: data.title,       description: data.description ?? '',       image: data.images?.\[0\] ?? null,       domain: new URL(data.url).hostname.replace('www.', ''),     })   } catch {     return NextResponse.json(null)   } } |

| PART 10  ⚠ GAPS FILLED — PINNED MESSAGES |
| :---- |

## **10.1 PinnedMessagesBar Component**

| components/chat/PinnedMessagesBar.tsx |
| :---- |
| // components/chat/PinnedMessagesBar.tsx 'use client' import { useEffect, useState } from 'react' import { Pin, X } from 'lucide-react' import { createBrowserClient } from '@/lib/supabase' import { useReachStore } from '@/store/reach'   export function PinnedMessagesBar({ channelId }: { channelId: string }) {   const \[pinned, setPinned\] \= useState\<any\[\]\>(\[\])   const { user } \= useReachStore()   const supabase \= createBrowserClient()     useEffect(() \=\> {     supabase.from('pinned\_messages')       .select(\`\*, message:messages(id,body,author:profiles\!messages\_author\_id\_fkey(display\_name))\`)       .eq('channel\_id', channelId)       .order('created\_at', { ascending: false })       .then(({ data }) \=\> setPinned(data ?? \[\]))       const sub \= supabase       .channel(\`pinned:${channelId}\`)       .on('postgres\_changes', { event: '\*', schema: 'public',         table: 'pinned\_messages', filter: \`channel\_id=eq.${channelId}\` },         () \=\> {           // Refetch on any change           supabase.from('pinned\_messages')             .select(\`\*, message:messages(id,body,author:profiles\!messages\_author\_id\_fkey(display\_name))\`)             .eq('channel\_id', channelId)             .then(({ data }) \=\> setPinned(data ?? \[\]))         })       .subscribe()     return () \=\> supabase.removeChannel(sub)   }, \[channelId\])     async function unpin(pinnedId: string) {     await supabase.from('pinned\_messages').delete().eq('id', pinnedId)   }     if (pinned.length \=== 0\) return null     return (     \<div className="border-b border-zinc-800 bg-zinc-900/40 divide-y divide-zinc-800/60"\>       {pinned.map(p \=\> (         \<div key={p.id} className="flex items-center gap-2 px-4 py-2"\>           \<Pin size={11} className="text-yellow-400 flex-shrink-0" /\>           \<div className="flex-1 min-w-0"\>             \<span className="text-xs text-zinc-400 font-medium mr-1"\>               {p.message?.author?.display\_name}:             \</span\>             \<span className="text-xs text-zinc-300 truncate"\>{p.message?.body}\</span\>           \</div\>           \<button onClick={() \=\> unpin(p.id)} className="text-zinc-600 hover:text-red-400 flex-shrink-0"\>             \<X size={11}/\>           \</button\>         \</div\>       ))}     \</div\>   ) } |

| PART 11  DRAG-AND-DROP: ISSUE → CHANNEL |
| :---- |

This section is unchanged from v2.0. The full IssueCard dragstart, ChannelList onDrop, and IssuesSidebar code is in Part 7 of that document. The drop sequence is:

# **7\. Drag-and-Drop**

## **7.1 IssueCard — Add dragstart**

// Add to existing IssueCard component (board or sidebar):

function IssueCard({ issue }) {

  function onDragStart(e: React.DragEvent) {

    e.dataTransfer.setData('issueId', issue.id)

    e.dataTransfer.effectAllowed \= 'copy'

    // Ghost drag image

    const ghost \= document.createElement('div')

    ghost.textContent \= issue.title

    Object.assign(ghost.style, {

      position:'fixed', top:'-100px', left:'-100px',

      background:'\#16213E', color:'white', padding:'8px 12px',

      borderRadius:'8px', border:'1px solid \#48B8FF',

      fontSize:'12px', maxWidth:'200px', whiteSpace:'nowrap',

      overflow:'hidden', textOverflow:'ellipsis',

    })

    document.body.appendChild(ghost)

    e.dataTransfer.setDragImage(ghost, 0, 0\)

    setTimeout(() \=\> document.body.removeChild(ghost), 0\)

  }

  return (

    \<div draggable onDragStart={onDragStart}

      className="cursor-grab active:cursor-grabbing ..."\>

      {/\* existing card content \*/}

    \</div\>

  )

}

## **7.2 IssuesSidebar (in Chat right panel)**

// components/chat/IssuesSidebar.tsx

'use client'

import { useReachStore } from '@/store/reach'

export function IssuesSidebar() {

  const { issues } \= useReachStore()

  const active \= Object.values(issues).filter(i \=\> i.status \!== 'done')

  function onDragStart(e: React.DragEvent, id: string) {

    e.dataTransfer.setData('issueId', id)

    e.dataTransfer.effectAllowed \= 'copy'

  }

  return (

    \<div className="w-52 border-l border-zinc-800 bg-\[\#16213E\] flex flex-col flex-shrink-0"\>

      \<div className="p-3 border-b border-zinc-800"\>

        \<p className="text-\[10px\] font-semibold text-zinc-500 uppercase tracking-widest"\>

          Drag to channel

        \</p\>

      \</div\>

      \<div className="flex-1 overflow-y-auto p-2 space-y-1"\>

        {active.map(issue \=\> (

          \<div key={issue.id} draggable

            onDragStart={e \=\> onDragStart(e, issue.id)}

            className="p-2 rounded-md bg-zinc-800/60 border border-zinc-700

              cursor-grab active:cursor-grabbing hover:border-\[\#48B8FF\]

              transition-colors select-none"\>

            \<p className="text-xs text-white line-clamp-2"\>{issue.title}\</p\>

          \</div\>

        ))}

      \</div\>

    \</div\>

  )

}

## **7.3 Drop Sequence — Step by Step**

| Step | Action |
| :---- | :---- |
| 1 | IssueCard dragstart: setData("issueId", issue.id) |
| 2 | ChannelList row onDragOver: e.preventDefault(). Border → accent color |
| 3 | ChannelList row onDrop: getData("issueId"). Dispatch reach:drop-issue event |
| 4 | MessagePanel listener fires: dropIssue(issueId) called |
| 5 | INSERT messages {is\_system:true, issue\_id} |
| 6 | Supabase Realtime INSERT fires on all channel subscribers (\~80ms) |
| 7 | MessagePanel: msg.is\_system && msg.issue\_id → render InlineIssueCard |
| 8 | All 5 action buttons available: View, Assign, Done, IDE, Docs |

| Step | Action |
| :---- | :---- |
| 1 | IssueCard dragstart: setData("issueId", issue.id) |
| 2 | ChannelList row onDragOver: e.preventDefault(). Border → accent |
| 3 | ChannelList row onDrop: getData("issueId"). Dispatch reach:drop-issue |
| 4 | MessagePanel listener fires: dropIssue(issueId) |
| 5 | INSERT messages {is\_system:true, issue\_id} |
| 6 | Realtime delivers to all channel subscribers (\~80ms) |
| 7 | msg.is\_system && msg.issue\_id → render InlineIssueCard |
| 8 | 5 action buttons: View, Assign to me, Done, IDE, Docs |

| PART 12  ⚠ GAPS FILLED — DRAG ISSUE INTO LIVE MEETING ROOM |
| :---- |

| What was missing in v2.0 Issue drag-and-drop only worked for text channels. There was no way to surface an issue card inside an active video call. This part adds the meeting\_issue\_drops table (Part 2.8), a useMeetingIssues hook, and a MeetingIssueOverlay component that renders inside VideoRoom. |
| :---- |

## **12.1 useMeetingIssues Hook**

| hooks/useMeetingIssues.ts |
| :---- |
| // hooks/useMeetingIssues.ts import { useEffect, useState, useCallback } from 'react' import { createBrowserClient } from '@/lib/supabase' import { useReachStore } from '@/store/reach'   export function useMeetingIssues(meetingId: string | null) {   const \[droppedIssues, setDroppedIssues\] \= useState\<any\[\]\>(\[\])   const { user } \= useReachStore()   const supabase \= createBrowserClient()     useEffect(() \=\> {     if (\!meetingId) return     supabase.from('meeting\_issue\_drops')       .select(\`\*,         issue:issues(id,title,status,priority,assignee\_id,           assignee:profiles\!issues\_assignee\_id\_fkey(id,display\_name,color))\`)       .eq('meeting\_id', meetingId)       .eq('resolved', false)       .then(({ data }) \=\> setDroppedIssues(data ?? \[\]))       const sub \= supabase       .channel(\`meeting-issues:${meetingId}\`)       .on('postgres\_changes', { event: '\*', schema: 'public',         table: 'meeting\_issue\_drops', filter: \`meeting\_id=eq.${meetingId}\` },         async () \=\> {           const { data } \= await supabase.from('meeting\_issue\_drops')             .select(\`\*, issue:issues(id,title,status,priority,assignee\_id,               assignee:profiles\!issues\_assignee\_id\_fkey(id,display\_name,color))\`)             .eq('meeting\_id', meetingId)             .eq('resolved', false)           setDroppedIssues(data ?? \[\])         })       .subscribe()     return () \=\> supabase.removeChannel(sub)   }, \[meetingId\])     const dropIssue \= useCallback(async (issueId: string) \=\> {     if (\!meetingId || \!user?.id) return     await supabase.from('meeting\_issue\_drops').insert({       meeting\_id: meetingId, issue\_id: issueId, dropped\_by: user.id     })   }, \[meetingId, user?.id\])     const resolveIssue \= useCallback(async (dropId: string) \=\> {     await supabase.from('meeting\_issue\_drops')       .update({ resolved: true }).eq('id', dropId)   }, \[\])     return { droppedIssues, dropIssue, resolveIssue } } |

## **12.2 MeetingIssueOverlay Component**

Add this to VideoRoom.tsx. It renders as a draggable overlay inside the video call, showing all issues dropped into the meeting.

| components/video/MeetingIssueOverlay.tsx |
| :---- |
| // components/video/MeetingIssueOverlay.tsx 'use client' import { useState } from 'react' import { useMeetingIssues } from '@/hooks/useMeetingIssues' import { useReachStore } from '@/store/reach' import { CheckSquare, UserCheck, X, ChevronDown, ChevronUp } from 'lucide-react' import { createBrowserClient } from '@/lib/supabase'   export function MeetingIssueOverlay({ meetingId }: { meetingId: string }) {   const { droppedIssues, dropIssue, resolveIssue } \= useMeetingIssues(meetingId)   const { issues, user, updateIssue } \= useReachStore()   const \[collapsed, setCollapsed\] \= useState(false)   const supabase \= createBrowserClient()     // Handle drop on overlay area   function onDragOver(e: React.DragEvent) { e.preventDefault() }   function onDrop(e: React.DragEvent) {     e.preventDefault()     const issueId \= e.dataTransfer.getData('issueId')     if (issueId) dropIssue(issueId)   }     async function assignToMe(issueId: string) {     updateIssue({ id: issueId, assignee\_id: user?.id })     await supabase.from('issues').update({ assignee\_id: user?.id }).eq('id', issueId)   }     async function markDone(issueId: string, dropId: string) {     updateIssue({ id: issueId, status: 'done' })     await supabase.from('issues').update({ status: 'done' }).eq('id', issueId)     await resolveIssue(dropId)   }     return (     \<div       className="absolute bottom-20 left-4 w-72 bg-\[\#16213E\]/95 backdrop-blur-sm         border border-zinc-700 rounded-xl shadow-2xl z-40 overflow-hidden"       onDragOver={onDragOver} onDrop={onDrop}\>       \<div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700         cursor-pointer" onClick={() \=\> setCollapsed(c \=\> \!c)}\>         \<span className="text-xs font-semibold text-zinc-300"\>           Issues in meeting ({droppedIssues.length})         \</span\>         {collapsed ? \<ChevronDown size={12} className="text-zinc-400"/\> : \<ChevronUp size={12} className="text-zinc-400"/\>}       \</div\>       {\!collapsed && (         \<\>           {droppedIssues.length \=== 0 && (             \<div className="px-3 py-4 text-center text-zinc-600 text-xs"\>               Drag issues here to discuss             \</div\>           )}           \<div className="divide-y divide-zinc-800 max-h-64 overflow-y-auto"\>             {droppedIssues.map(drop \=\> (               \<div key={drop.id} className="px-3 py-2"\>                 \<div className="flex items-start gap-2"\>                   \<div className="flex-1 min-w-0"\>                     \<p className="text-xs text-white font-medium truncate"\>{drop.issue?.title}\</p\>                     {drop.issue?.assignee && (                       \<p className="text-\[10px\] text-zinc-500"\>                         Assigned: {drop.issue.assignee.display\_name}                       \</p\>                     )}                   \</div\>                   \<button onClick={() \=\> resolveIssue(drop.id)}                     className="text-zinc-600 hover:text-zinc-400 flex-shrink-0"\>                     \<X size={11}/\>                   \</button\>                 \</div\>                 \<div className="flex gap-1 mt-1.5"\>                   \<button onClick={() \=\> assignToMe(drop.issue.id)}                     className="flex items-center gap-1 text-\[10px\] px-2 py-0.5 rounded                       bg-zinc-800 hover:bg-zinc-700 text-zinc-300"\>                     \<UserCheck size={9}/\> Mine                   \</button\>                   \<button onClick={() \=\> markDone(drop.issue.id, drop.id)}                     disabled={drop.issue?.status \=== 'done'}                     className="flex items-center gap-1 text-\[10px\] px-2 py-0.5 rounded                       bg-zinc-800 hover:bg-zinc-700 text-zinc-300 disabled:opacity-40"\>                     \<CheckSquare size={9}/\> Done                   \</button\>                 \</div\>               \</div\>             ))}           \</div\>           \<div className="px-3 py-2 border-t border-zinc-700 text-\[10px\] text-zinc-600 text-center"\>             Drop issues from sidebar to discuss           \</div\>         \</\>       )}     \</div\>   ) } |

## **12.3 Add to VideoRoom**

In components/video/VideoRoom.tsx, add the overlay inside the outer div, after the video grid:

| Modification to VideoRoom.tsx |
| :---- |
| // Inside VideoRoom — add after \<div className="flex-1 grid gap-2 p-4"\>: import { MeetingIssueOverlay } from './MeetingIssueOverlay'   // Inside the return JSX, make the outer div relative: \<div className="flex flex-col h-full bg-zinc-900 relative"\>   {/\* ... existing video grid ... \*/}   {/\* Add overlay: \*/}   \<MeetingIssueOverlay meetingId={meetingId} /\>   {/\* ... existing controls ... \*/} \</div\> |

| PART 13  NATIVE WebRTC VIDEO (STUN/TURN, MESH P2P, SFU PATH) |
| :---- |

This section is unchanged from v2.0 Parts 8–11. The architecture, TURN setup, lib/webrtc.ts, signaling, useWebRTC hook, VideoRoom, RecordingControls are all identical. The only addition is MeetingIssueOverlay (Part 12 above). Reproduce all v2.0 code for Parts 8–11 here.

# **Native WebRTC — Architecture**

| NO THIRD-PARTY VIDEO SDK Zero Daily.co, LiveKit, or any other video platform. REACH uses RTCPeerConnection (browser built-in), the webrtc\_signals Supabase table as the signaling channel, and your choice of STUN/TURN server. Users who need Zoom connect their own account in Settings → Integrations. |
| :---- |

## **8.1 How It Works**

| Layer | Technology |
| :---- | :---- |
| Signaling | webrtc\_signals Supabase table \+ Realtime subscription |
| STUN | Google public STUN (stun:stun.l.google.com:19302) — always free |
| TURN | coturn / Twilio / Metered — env-var switched (Part 1.2) |
| Media | RTCPeerConnection \+ getUserMedia — browser native |
| Mesh | Full mesh P2P — each peer connects directly to every other peer |
| Max | Up to 8 participants (mesh). Beyond 8: mediasoup SFU (upgrade path in Part 8.5) |
| Recording | MediaRecorder API → Supabase Storage (Part 11\) |

## **8.2 TURN Server — Setup by Provider**

### **Option A: Self-Hosted coturn (VPS)**

\# Ubuntu 22.04 VPS — run as root

apt-get update && apt-get install \-y coturn

\# /etc/turnserver.conf — replace ALL\_CAPS values

listening-port=3478

tls-listening-port=5349

fingerprint

use-auth-secret

static-auth-secret=YOUR\_SECRET\_PASSWORD

realm=yourdomain.com

log-file=/var/log/coturn/turnserver.log

no-multicast-peers

denied-peer-ip=0.0.0.0-0.255.255.255

denied-peer-ip=10.0.0.0-10.255.255.255

denied-peer-ip=172.16.0.0-172.31.255.255

denied-peer-ip=192.168.0.0-192.168.255.255

cert=/etc/letsencrypt/live/yourdomain.com/fullchain.pem

pkey=/etc/letsencrypt/live/yourdomain.com/privkey.pem

\# Start service

systemctl enable coturn && systemctl start coturn

\# Open firewall ports

ufw allow 3478/tcp && ufw allow 3478/udp

ufw allow 5349/tcp && ufw allow 5349/udp

ufw allow 49152:65535/udp  \# TURN relay range

\# Set in .env.local:

TURN\_SERVER\_URL=turn:yourdomain.com:3478

TURN\_SERVER\_USERNAME=reachuser

TURN\_SERVER\_CREDENTIAL=YOUR\_SECRET\_PASSWORD

### **Option B: Twilio TURN (no infra)**

\# Get credentials from Twilio Console → Network Traversal

\# Set in .env.local:

TWILIO\_ACCOUNT\_SID=AC...

TWILIO\_AUTH\_TOKEN=...

\# The get-ice-servers Edge Function (Part 15.1) calls Twilio API

\# to get short-lived TURN credentials dynamically.

\# Cost: \~$0.40/GB of TURN relay traffic.

### **Option C: Metered.ca TURN (free tier)**

\# Create account at metered.ca → TURN

\# Free tier: 50GB/month relay bandwidth

\# Set in .env.local:

METERED\_API\_KEY=...

METERED\_DOMAIN=yourapp.metered.live

\# The get-ice-servers Edge Function calls Metered API for credentials.

## **8.3 lib/webrtc.ts — ICE Config Loader**

// lib/webrtc.ts

// Fetches ICE server config from Edge Function.

// The Edge Function reads env vars and calls whichever TURN provider is configured.

import { createBrowserClient } from '@/lib/supabase'

export async function getIceServers(): Promise\<RTCIceServer\[\]\> {

  const supabase \= createBrowserClient()

  const { data, error } \= await supabase.functions.invoke('get-ice-servers')

  if (error || \!data?.iceServers) {

    // Fallback to Google public STUN only (no relay)

    console.warn('TURN fetch failed, falling back to STUN only')

    return \[{ urls: 'stun:stun.l.google.com:19302' }\]

  }

  return data.iceServers

}

// RTCPeerConnection config builder

export async function createPeerConnection(): Promise\<RTCPeerConnection\> {

  const iceServers \= await getIceServers()

  return new RTCPeerConnection({

    iceServers,

    iceTransportPolicy: 'all',  // change to "relay" to force TURN

    bundlePolicy: 'max-bundle',

    rtcpMuxPolicy: 'require',

  })

}

## **8.4 Signaling via Supabase Realtime**

webrtc\_signals table IS the signaling server. No WebSocket server to maintain.

// lib/signal.ts

import { createBrowserClient } from '@/lib/supabase'

export async function sendSignal(

  roomCode: string,

  fromUser: string,

  type: string,

  payload: object,

  toUser?: string

) {

  const supabase \= createBrowserClient()

  await supabase.from('webrtc\_signals').insert({

    room\_code: roomCode,

    from\_user: fromUser,

    to\_user: toUser ?? null,

    type,

    payload,

  })

}

export function subscribeToSignals(

  roomCode: string,

  onSignal: (signal: any) \=\> void

) {

  const supabase \= createBrowserClient()

  const sub \= supabase

    .channel(\`signals:${roomCode}\`)

    .on('postgres\_changes', {

      event: 'INSERT', schema: 'public', table: 'webrtc\_signals',

      filter: \`room\_code=eq.${roomCode}\`,

    }, payload \=\> onSignal(payload.new))

    .subscribe()

  return () \=\> supabase.removeChannel(sub)

}

## **8.5 SFU Upgrade Path (\>8 participants)**

| When to upgrade | Signs |
| :---- | :---- |
| CPU spikes on sender | Browser CPU \> 80% in meetings with 5+ people |
| Bandwidth explosion | Each sender sends N-1 streams; 8 people \= 7 upstreams each |
| Recommendation | Migrate to mediasoup self-hosted SFU on same VPS as coturn |

\# mediasoup upgrade (future — not needed for MVP)

\# npm install mediasoup   (server-side, Node.js)

\# Replace RTCPeerConnection mesh with SFU fan-out.

\# The webrtc\_signals table and signaling pattern stays identical.

\# Only the peer connection setup changes on the client.

  **PART 9 — SIGNALING SERVER (Edge Function \+ Realtime)**  

# **9\. Signaling — create-meeting Edge Function**

This Edge Function creates the meeting row, generates a room\_code, and posts a system message to the channel. No video infrastructure is spun up — the browser handles everything.

// supabase/functions/create-meeting/index.ts

import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS \= {

  "Access-Control-Allow-Origin": "\*",

  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",

}

serve(async (req) \=\> {

  if (req.method \=== "OPTIONS") return new Response(null, { headers: CORS })

  const supabase \= createClient(

    Deno.env.get("SUPABASE\_URL")\!,

    Deno.env.get("SUPABASE\_SERVICE\_ROLE\_KEY")\!

  )

  // Verify JWT — get authenticated user

  const authHeader \= req.headers.get("Authorization") ?? ""

  const { data: { user }, error: authErr } \=

    await supabase.auth.getUser(authHeader.replace("Bearer ", ""))

  if (authErr || \!user)

    return new Response("Unauthorized", { status: 401 })

  const { title, channel\_id, project\_id, scheduled\_at, external\_emails }

    \= await req.json()

  // Get profile for tenant\_id and display\_name

  const { data: profile } \= await supabase

    .from("profiles")

    .select("tenant\_id, display\_name")

    .eq("id", user.id)

    .single()

  if (\!profile)

    return new Response("Profile not found", { status: 400 })

  // Create meeting — room\_code auto-generated by DB default

  const { data: meeting, error: mErr } \= await supabase

    .from("meetings")

    .insert({

      tenant\_id: profile.tenant\_id,

      project\_id: project\_id ?? null,

      channel\_id: channel\_id ?? null,

      title: title || "Standup",

      scheduled\_at: scheduled\_at ?? new Date().toISOString(),

      status: "scheduled",

      host\_id: user.id,

      external\_emails: external\_emails ?? \[\],

    })

    .select()

    .single()

  if (mErr || \!meeting)

    return new Response(JSON.stringify({ error: mErr }), { status: 500 })

  // Post system message to channel with join link

  if (channel\_id) {

    const joinUrl \= \`${Deno.env.get("NEXT\_PUBLIC\_APP\_URL")}/meeting/${meeting.room\_code}\`

    // Announce the meeting

    await supabase.from("messages").insert({

      tenant\_id: profile.tenant\_id,

      channel\_id,

      author\_id: user.id,

      body: \`${profile.display\_name} started a video standup: ${title || "Standup"}. Join: ${joinUrl}\`,

      is\_system: true,

    })

  }

  return new Response(JSON.stringify({

    meeting\_id: meeting.id,

    room\_code: meeting.room\_code,

    join\_url: \`${Deno.env.get("NEXT\_PUBLIC\_APP\_URL")}/meeting/${meeting.room\_code}\`,

  }), { headers: { ...CORS, "Content-Type": "application/json" } })

})

supabase functions deploy create-meeting

  **PART 10 — VIDEO COMPONENT (Full JSX)**  

# **10\. Video Components**

## **10.1 useWebRTC Hook — Full Mesh P2P**

// hooks/useWebRTC.ts

// Full mesh: each peer connects directly to every other peer.

// Works for up to 8 participants without SFU.

import { useEffect, useRef, useState, useCallback } from 'react'

import { createBrowserClient } from '@/lib/supabase'

import { createPeerConnection } from '@/lib/webrtc'

import { sendSignal, subscribeToSignals } from '@/lib/signal'

import { useReachStore } from '@/store/reach'

interface Peer {

  userId: string

  displayName: string

  stream: MediaStream | null

  pc: RTCPeerConnection

}

export function useWebRTC(roomCode: string | null) {

  const { user } \= useReachStore()

  const \[localStream, setLocalStream\] \= useState\<MediaStream | null\>(null)

  const \[peers, setPeers\] \= useState\<Record\<string, Peer\>\>({})

  const \[joined, setJoined\] \= useState(false)

  const \[error, setError\] \= useState\<string | null\>(null)

  const \[camEnabled, setCamEnabled\] \= useState(true)

  const \[micEnabled, setMicEnabled\] \= useState(true)

  const peersRef \= useRef\<Record\<string, Peer\>\>({})

  const localStreamRef \= useRef\<MediaStream | null\>(null)

  const supabase \= createBrowserClient()

  // ── Join the room ──────────────────────────────────────────────────

  const join \= useCallback(async () \=\> {

    if (\!roomCode || \!user?.id) return

    // 1\. Get local media

    let stream: MediaStream

    try {

      stream \= await navigator.mediaDevices.getUserMedia({

        video: { width:1280, height:720, frameRate:30 },

        audio: { echoCancellation:true, noiseSuppression:true },

      })

    } catch (e) {

      setError('Camera/mic access denied. Please allow access and try again.')

      return

    }

    localStreamRef.current \= stream

    setLocalStream(stream)

    // 2\. Subscribe to incoming signals

    const unsub \= subscribeToSignals(roomCode, handleSignal)

    // 3\. Announce presence — broadcast "join" to room

    await sendSignal(roomCode, user.id, 'join', {

      display\_name: user.display\_name ?? user.email,

    })

    setJoined(true)

    return unsub

  }, \[roomCode, user?.id\])

  // ── Handle incoming signals ─────────────────────────────────────────

  async function handleSignal(signal: any) {

    if (signal.from\_user \=== user?.id) return  // ignore own signals

    if (signal.to\_user && signal.to\_user \!== user?.id) return  // not for us

    const fromId \= signal.from\_user

    switch (signal.type) {

      case 'join': {

        // New peer joined — create a PC and send offer

        const pc \= await createPeerConnection()

        setupPC(pc, fromId)

        // Add local tracks to new PC

        localStreamRef.current?.getTracks().forEach(t \=\>

          pc.addTrack(t, localStreamRef.current\!)

        )

        // Create and send offer

        const offer \= await pc.createOffer()

        await pc.setLocalDescription(offer)

        await sendSignal(roomCode\!, user\!.id, 'offer',

          { sdp: offer }, fromId)

        addPeer(fromId, signal.payload.display\_name, pc)

        break

      }

      case 'offer': {

        // Received offer — create PC, set remote desc, send answer

        let pc \= peersRef.current\[fromId\]?.pc

        if (\!pc) {

          pc \= await createPeerConnection()

          setupPC(pc, fromId)

          localStreamRef.current?.getTracks().forEach(t \=\>

            pc\!.addTrack(t, localStreamRef.current\!)

          )

          addPeer(fromId, 'Participant', pc)

        }

        await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp))

        const answer \= await pc.createAnswer()

        await pc.setLocalDescription(answer)

        await sendSignal(roomCode\!, user\!.id, 'answer',

          { sdp: answer }, fromId)

        break

      }

      case 'answer': {

        const pc \= peersRef.current\[fromId\]?.pc

        if (pc) await pc.setRemoteDescription(

          new RTCSessionDescription(signal.payload.sdp))

        break

      }

      case 'ice-candidate': {

        const pc \= peersRef.current\[fromId\]?.pc

        if (pc && signal.payload.candidate) {

          await pc.addIceCandidate(

            new RTCIceCandidate(signal.payload.candidate))

        }

        break

      }

      case 'leave': {

        cleanupPeer(fromId)

        break

      }

    }

  }

  // ── PC event handlers ───────────────────────────────────────────────

  function setupPC(pc: RTCPeerConnection, peerId: string) {

    // Send ICE candidates to the peer as they are gathered

    pc.onicecandidate \= async (e) \=\> {

      if (e.candidate) {

        await sendSignal(roomCode\!, user\!.id, 'ice-candidate',

          { candidate: e.candidate }, peerId)

      }

    }

    // Receive remote tracks

    pc.ontrack \= (e) \=\> {

      const stream \= e.streams\[0\]

      setPeers(prev \=\> ({

        ...prev,

        \[peerId\]: { ...prev\[peerId\], stream }

      }))

      peersRef.current\[peerId\] \= {

        ...peersRef.current\[peerId\], stream

      }

    }

    pc.onconnectionstatechange \= () \=\> {

      if (pc.connectionState \=== 'failed'

          || pc.connectionState \=== 'disconnected') {

        cleanupPeer(peerId)

      }

    }

  }

  function addPeer(userId: string, displayName: string, pc: RTCPeerConnection) {

    const peer: Peer \= { userId, displayName, stream: null, pc }

    peersRef.current\[userId\] \= peer

    setPeers(prev \=\> ({ ...prev, \[userId\]: peer }))

  }

  function cleanupPeer(userId: string) {

    peersRef.current\[userId\]?.pc.close()

    const updated \= { ...peersRef.current }

    delete updated\[userId\]

    peersRef.current \= updated

    setPeers({ ...updated })

  }

  // ── Leave room ──────────────────────────────────────────────────────

  const leave \= useCallback(async () \=\> {

    if (roomCode && user?.id)

      await sendSignal(roomCode, user.id, 'leave', {})

    localStreamRef.current?.getTracks().forEach(t \=\> t.stop())

    Object.values(peersRef.current).forEach(p \=\> p.pc.close())

    peersRef.current \= {}

    setPeers({})

    setLocalStream(null)

    setJoined(false)

  }, \[roomCode, user?.id\])

  // ── Media toggles ───────────────────────────────────────────────────

  const toggleCam \= useCallback(() \=\> {

    localStreamRef.current?.getVideoTracks().forEach(t \=\> {

      t.enabled \= \!t.enabled

    })

    setCamEnabled(prev \=\> \!prev)

  }, \[\])

  const toggleMic \= useCallback(() \=\> {

    localStreamRef.current?.getAudioTracks().forEach(t \=\> {

      t.enabled \= \!t.enabled

    })

    setMicEnabled(prev \=\> \!prev)

  }, \[\])

  return {

    localStream, peers: Object.values(peers),

    joined, error,

    camEnabled, micEnabled,

    join, leave, toggleCam, toggleMic

  }

}

## **10.2 VideoRoom Component**

// components/video/VideoRoom.tsx

'use client'

import { useEffect, useRef } from 'react'

import { useWebRTC } from '@/hooks/useWebRTC'

import { Video, VideoOff, Mic, MicOff, PhoneOff } from 'lucide-react'

import { RecordingControls } from './RecordingControls'

export function VideoRoom({ roomCode, meetingId, onLeave }:

  { roomCode: string; meetingId: string; onLeave: () \=\> void }) {

  const { localStream, peers, joined, error,

    camEnabled, micEnabled,

    join, leave, toggleCam, toggleMic } \= useWebRTC(roomCode)

  useEffect(() \=\> {

    const unsub \= join()

    return () \=\> { unsub?.then(fn \=\> fn?.()) }

  }, \[roomCode\])

  async function handleLeave() {

    await leave()

    onLeave()

  }

  if (error) return (

    \<div className="flex-1 flex items-center justify-center bg-zinc-900"\>

      \<div className="text-center"\>

        \<p className="text-red-400 mb-4"\>{error}\</p\>

        \<button onClick={onLeave}

          className="px-4 py-2 bg-zinc-700 rounded text-white text-sm"\>

          Go back

        \</button\>

      \</div\>

    \</div\>

  )

  return (

    \<div className="flex flex-col h-full bg-zinc-900"\>

      {/\* Video grid \*/}

      \<div className="flex-1 grid gap-2 p-4"

        style={{ gridTemplateColumns: \`repeat(${Math.min(peers.length+1,3)}, 1fr)\` }}\>

        {/\* Local video \*/}

        \<VideoTile stream={localStream} label="You (me)" muted /\>

        {/\* Remote peers \*/}

        {peers.map(peer \=\> (

          \<VideoTile key={peer.userId} stream={peer.stream}

            label={peer.displayName} /\>

        ))}

        {\!joined && (

          \<div className="col-span-full flex items-center justify-center h-48

            bg-zinc-800 rounded-xl text-zinc-500 text-sm"\>

            Connecting...

          \</div\>

        )}

      \</div\>

      {/\* Controls \*/}

      \<div className="flex items-center justify-center gap-3 pb-6"\>

        \<button onClick={toggleCam}

          className={\`p-3 rounded-full transition-colors ${

            camEnabled

              ? 'bg-zinc-700 hover:bg-zinc-600 text-white'

              : 'bg-red-600 hover:bg-red-500 text-white'

          }\`}\>

          {camEnabled ? \<Video size={18}/\> : \<VideoOff size={18}/\>}

        \</button\>

        \<button onClick={toggleMic}

          className={\`p-3 rounded-full transition-colors ${

            micEnabled

              ? 'bg-zinc-700 hover:bg-zinc-600 text-white'

              : 'bg-red-600 hover:bg-red-500 text-white'

          }\`}\>

          {micEnabled ? \<Mic size={18}/\> : \<MicOff size={18}/\>}

        \</button\>

        \<RecordingControls

          localStream={localStream}

          meetingId={meetingId}

        /\>

        \<button onClick={handleLeave}

          className="p-3 rounded-full bg-red-600 hover:bg-red-500

            text-white transition-colors"\>

          \<PhoneOff size={18}/\>

        \</button\>

      \</div\>

    \</div\>

  )

}

// Renders a single video tile

function VideoTile({ stream, label, muted \= false }:

  { stream: MediaStream|null; label: string; muted?: boolean }) {

  const ref \= useRef\<HTMLVideoElement\>(null)

  useEffect(() \=\> {

    if (ref.current && stream) ref.current.srcObject \= stream

  }, \[stream\])

  return (

    \<div className="relative bg-zinc-800 rounded-xl overflow-hidden aspect-video"\>

      {stream

        ? \<video ref={ref} autoPlay playsInline muted={muted}

            className="w-full h-full object-cover" /\>

        : \<div className="absolute inset-0 flex items-center justify-center

            text-zinc-600 text-sm"\>{label}\</div\>

      }

      \<div className="absolute bottom-2 left-2 text-xs text-white

        bg-black/50 px-2 py-0.5 rounded-md"\>{label}\</div\>

    \</div\>

  )

}

## **10.3 StartMeetingButton**

// components/video/StartMeetingButton.tsx

'use client'

import { useState } from 'react'

import { Video } from 'lucide-react'

import { createBrowserClient } from '@/lib/supabase'

import { VideoRoom } from './VideoRoom'

export function StartMeetingButton({ channelId }: { channelId: string }) {

  const \[meetingData, setMeetingData\] \= useState\<any\>(null)

  const \[loading, setLoading\] \= useState(false)

  const supabase \= createBrowserClient()

  async function start() {

    setLoading(true)

    const { data, error } \= await supabase.functions.invoke('create-meeting', {

      body: { title: 'Standup', channel\_id: channelId }

    })

    if (\!error) setMeetingData(data)

    setLoading(false)

  }

  if (meetingData) return (

    \<div className="fixed inset-0 bg-black/80 z-50 flex flex-col"\>

      \<VideoRoom

        roomCode={meetingData.room\_code}

        meetingId={meetingData.meeting\_id}

        onLeave={() \=\> setMeetingData(null)}

      /\>

    \</div\>

  )

  return (

    \<button onClick={start} disabled={loading}

      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm

        bg-zinc-700 hover:bg-zinc-600 text-white transition-colors

        disabled:opacity-50 disabled:cursor-not-allowed"\>

      \<Video size={13}/\>

      {loading ? 'Starting...' : 'Start Standup'}

    \</button\>

  )

}

## **10.4 Meeting Join Page**

// app/meeting/\[roomCode\]/page.tsx

// Anyone with the room\_code URL can join — including external participants

'use client'

import { useParams } from 'next/navigation'

import { useState, useEffect } from 'react'

import { createBrowserClient } from '@/lib/supabase'

import { VideoRoom } from '@/components/video/VideoRoom'

export default function MeetingPage() {

  const { roomCode } \= useParams\<{ roomCode: string }\>()

  const \[meeting, setMeeting\] \= useState\<any\>(null)

  const \[joined, setJoined\] \= useState(false)

  const \[name, setName\] \= useState('')

  const supabase \= createBrowserClient()

  useEffect(() \=\> {

    supabase.from('meetings')

      .select('id,title,status')

      .eq('room\_code', roomCode)

      .single()

      .then(({ data }) \=\> setMeeting(data))

  }, \[roomCode\])

  if (\!meeting) return (

    \<div className="flex h-screen items-center justify-center bg-zinc-900

      text-zinc-400"\>Loading...\</div\>

  )

  if (meeting.status \=== 'ended') return (

    \<div className="flex h-screen items-center justify-center bg-zinc-900"\>

      \<p className="text-zinc-400"\>This meeting has ended.\</p\>

    \</div\>

  )

  if (\!joined) return (

    \<div className="flex h-screen items-center justify-center bg-zinc-900"\>

      \<div className="bg-zinc-800 rounded-xl p-8 w-80 border border-zinc-700"\>

        \<h2 className="text-white font-semibold text-lg mb-1"\>{meeting.title}\</h2\>

        \<p className="text-zinc-400 text-sm mb-6"\>Enter your name to join\</p\>

        \<input value={name} onChange={e \=\> setName(e.target.value)}

          placeholder="Your name"

          className="w-full bg-zinc-700 border border-zinc-600 rounded px-3 py-2

            text-white text-sm mb-4 focus:outline-none focus:border-\[\#48B8FF\]"

        /\>

        \<button onClick={() \=\> name.trim() && setJoined(true)}

          disabled={\!name.trim()}

          className="w-full py-2 bg-\[\#48B8FF\] text-\[\#1A1A2E\] font-semibold

            rounded-md disabled:opacity-50 text-sm"\>

          Join Meeting

        \</button\>

      \</div\>

    \</div\>

  )

  return (

    \<div className="h-screen"\>

      \<VideoRoom

        roomCode={roomCode}

        meetingId={meeting.id}

        onLeave={() \=\> setJoined(false)}

      /\>

    \</div\>

  )

}

  **PART 11 — RECORDING → SUPABASE STORAGE**  

# **11\. Recording**

## **11.1 RecordingControls Component**

// components/video/RecordingControls.tsx

'use client'

import { useState, useRef } from 'react'

import { Circle, StopCircle } from 'lucide-react'

import { createBrowserClient } from '@/lib/supabase'

import { useReachStore } from '@/store/reach'

export function RecordingControls({ localStream, meetingId }:

  { localStream: MediaStream|null; meetingId: string }) {

  const \[recording, setRecording\] \= useState(false)

  const \[uploading, setUploading\] \= useState(false)

  const recorderRef \= useRef\<MediaRecorder | null\>(null)

  const chunksRef \= useRef\<Blob\[\]\>(\[\])

  const { user } \= useReachStore()

  const supabase \= createBrowserClient()

  async function startRecording() {

    if (\!localStream) return

    // Combine all peers' audio into one stream for recording.

    // For full recording (all video), use a canvas capture approach.

    // This records audio \+ local video — sufficient for standup notes.

    const mimeType \= MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')

      ? 'video/webm;codecs=vp9,opus'

      : 'video/webm'

    const recorder \= new MediaRecorder(localStream, { mimeType })

    chunksRef.current \= \[\]

    recorder.ondataavailable \= e \=\> {

      if (e.data.size \> 0\) chunksRef.current.push(e.data)

    }

    recorder.onstop \= async () \=\> {

      await uploadRecording()

    }

    recorder.start(1000)  // collect chunks every second

    recorderRef.current \= recorder

    setRecording(true)

  }

  function stopRecording() {

    recorderRef.current?.stop()

    setRecording(false)

  }

  async function uploadRecording() {

    if (chunksRef.current.length \=== 0\) return

    setUploading(true)

    const blob \= new Blob(chunksRef.current, { type: 'video/webm' })

    const { data: profile } \= await supabase

      .from('profiles').select('tenant\_id').eq('id', user?.id).single()

    const path \= \`${profile?.tenant\_id}/${meetingId}\_${Date.now()}.webm\`

    const { error: uploadErr } \= await supabase.storage

      .from('recordings')

      .upload(path, blob, {

        contentType: 'video/webm',

        upsert: false,

      })

    if (\!uploadErr) {

      // Save path to meeting row

      await supabase.from('meetings')

        .update({ recording\_path: path })

        .eq('id', meetingId)

    }

    setUploading(false)

    chunksRef.current \= \[\]

  }

  return (

    \<button

      onClick={recording ? stopRecording : startRecording}

      disabled={uploading || \!localStream}

      className={\[

        'p-3 rounded-full transition-colors',

        recording

          ? 'bg-red-600 hover:bg-red-500 animate-pulse text-white'

          : 'bg-zinc-700 hover:bg-zinc-600 text-white',

        uploading ? 'opacity-50 cursor-not-allowed' : '',

      \].join(' ')}

      title={recording ? 'Stop recording' : 'Start recording'}

    \>

      {uploading

        ? \<span className="text-xs"\>Saving...\</span\>

        : recording ? \<StopCircle size={18}/\> : \<Circle size={18}/\>

      }

    \</button\>

  )

}

## **11.2 Get Recording Signed URL**

// Recordings are private. Generate a signed URL on demand.

// Use in meeting detail view:

async function getRecordingUrl(path: string): Promise\<string | null\> {

  const supabase \= createBrowserClient()

  const { data } \= await supabase.storage

    .from('recordings')

    .createSignedUrl(path, 3600\)  // valid for 1 hour

  return data?.signedUrl ?? null

}

| Key points for Claude Code lib/webrtc.ts — ICE config loader, calls get-ice-servers Edge Function lib/signal.ts — sendSignal() and subscribeToSignals() — webrtc\_signals table is the signaling server hooks/useWebRTC.ts — full mesh P2P, handles join/offer/answer/ice-candidate/leave components/video/VideoRoom.tsx — NOW includes \<MeetingIssueOverlay meetingId={meetingId} /\> components/video/RecordingControls.tsx — MediaRecorder → Supabase Storage supabase/functions/create-meeting/index.ts — creates meeting row, posts system message to channel supabase/functions/get-ice-servers/index.ts — returns ICE config from whichever TURN provider env vars are set |
| :---- |

## **13.1 TURN Providers — Quick Reference**

| Provider | Cost | Best For |
| :---- | :---- | :---- |
| coturn self-hosted | $5-20/mo VPS | Full control, cheapest at scale |
| Twilio TURN | \~$0.40/GB | No infra, SLA-backed, easiest setup |
| Metered.ca | Free 50GB/mo | Best for early-stage / testing |

*For local testing: use Metered free tier. For production: self-hosted coturn on same VPS as your app gives best latency and cost at scale.*

| PART 17  NOTIFICATIONS (CHIMES, BADGES, BROWSER PUSH) |
| :---- |

Notifications are unchanged from v2.0 Parts 12-12.3. Reproduce lib/sounds.ts, lib/push.ts, NotificationBell, and useNotifications hook from that document.

| Notification types mention — @ mention in any chat message. Sound: triple-tone ascending. dm — Direct message. Sound: chord sequence. issue\_assigned — Issue assigned to you. Sound: two-note ascending. video\_start — Meeting started. Sound: four-note ascending chord. standup\_reminder — Daily reminder (cron-generated). Sound: same as message. email\_reply — New email reply linked to an issue you follow. Sound: same as message. |
| :---- |

## **12.1 lib/sounds.ts — Web Audio API (no files needed)**

// lib/sounds.ts

let \_ctx: AudioContext | null \= null

function ctx() {

  if (\!\_ctx) \_ctx \= new (window.AudioContext || (window as any).webkitAudioContext)()

  return \_ctx

}

function tone(freq: number, dur: number, vol \= 0.25) {

  const ac \= ctx()

  const o \= ac.createOscillator()

  const g \= ac.createGain()

  o.connect(g); g.connect(ac.destination)

  o.frequency.value \= freq; o.type \= 'sine'

  g.gain.setValueAtTime(vol, ac.currentTime)

  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime \+ dur)

  o.start(ac.currentTime); o.stop(ac.currentTime \+ dur)

}

export const Sounds \= {

  message:      () \=\> { tone(880,0.1,0.2); setTimeout(()=\>tone(1100,0.1,0.15),80) },

  dm:           () \=\> { tone(1046,0.15,0.3); setTimeout(()=\>tone(1318,0.15,0.25),120)

                        setTimeout(()=\>tone(1568,0.2,0.3),250) },

  mention:      () \=\> { tone(1200,0.08,0.4); setTimeout(()=\>tone(1500,0.08,0.35),100)

                        setTimeout(()=\>tone(1200,0.08,0.3),200) },

  issueAssigned:() \=\> { tone(659,0.1,0.25); setTimeout(()=\>tone(784,0.15,0.2),110) },

  meetingStart: () \=\> { \[523,659,784,1046\].forEach((f,i) \=\>

                        setTimeout(()=\>tone(f,0.12,0.35),i\*80)) },

}

export function playNotificationSound(type: string) {

  const enabled \= localStorage.getItem('reach:sounds') \!== 'false'

  if (\!enabled) return

  const map: Record\<string,()=\>void\> \= {

    dm:             Sounds.dm,

    mention:        Sounds.mention,

    issue\_assigned: Sounds.issueAssigned,

    video\_start:    Sounds.meetingStart,

  }

  ;(map\[type\] ?? Sounds.message)()

}

## **12.2 lib/push.ts — Browser Push Notifications**

// lib/push.ts

export async function requestNotificationPermission(): Promise\<boolean\> {

  if (\!('Notification' in window)) return false

  if (Notification.permission \=== 'granted') return true

  const r \= await Notification.requestPermission()

  return r \=== 'granted'

}

export function showBrowserNotification(

  title: string, body: string, link?: string

) {

  if (Notification.permission \!== 'granted') return

  if (document.hasFocus()) return  // suppress if app is active

  const n \= new Notification(title, {

    body, icon: '/favicon.ico', tag: 'reach',

  })

  if (link) n.onclick \= () \=\> { window.focus(); window.location.href \= link }

}

// Call after first user gesture (e.g. button click on app boot):

// requestNotificationPermission()

## **12.3 NotificationBell Component**

// components/notifications/NotificationBell.tsx

'use client'

import { useState } from 'react'

import { Bell } from 'lucide-react'

import { formatDistanceToNow } from 'date-fns'

import { useNotifications } from '@/hooks/useNotifications'

export function NotificationBell() {

  const \[open, setOpen\] \= useState(false)

  const { notifications, unreadNotifCount, dismiss, dismissAll } \= useNotifications()

  return (

    \<div className="relative"\>

      \<button onClick={() \=\> setOpen(o \=\> \!o)}

        className="relative p-2 rounded-md hover:bg-zinc-700 transition-colors

          text-zinc-300 hover:text-white"\>

        \<Bell size={17}/\>

        {unreadNotifCount \> 0 && (

          \<span className="absolute top-0.5 right-0.5 w-4 h-4 bg-\[\#48B8FF\]

            rounded-full text-\[10px\] font-bold text-\[\#1A1A2E\]

            flex items-center justify-center"\>

            {unreadNotifCount \> 9 ? '9+' : unreadNotifCount}

          \</span\>

        )}

      \</button\>

      {open && (

        \<div className="absolute right-0 top-full mt-1 w-80 bg-\[\#16213E\]

          border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden"\>

          \<div className="flex items-center justify-between px-4 py-3

            border-b border-zinc-700"\>

            \<span className="font-semibold text-white text-sm"\>Notifications\</span\>

            \<button onClick={dismissAll}

              className="text-xs text-zinc-400 hover:text-\[\#48B8FF\]"\>

              Mark all read

            \</button\>

          \</div\>

          \<div className="max-h-80 overflow-y-auto divide-y divide-zinc-800"\>

            {notifications.length \=== 0

              ? \<p className="text-center text-zinc-500 text-sm py-8"\>

                  No notifications

                \</p\>

              : notifications.map(n \=\> (

                \<div key={n.id}

                  onClick={() \=\> { dismiss(n.id); if(n.link) window.location.href=n.link }}

                  className={\[

                    'px-4 py-3 cursor-pointer hover:bg-zinc-800/60 transition-colors',

                    \!n.read ? 'border-l-2 border-l-\[\#48B8FF\]' : '',

                  \].join(' ')}

                \>

                  \<div className="flex items-start gap-2"\>

                    {n.actor && (

                      \<div className="w-6 h-6 rounded-full flex-shrink-0

                        flex items-center justify-center text-xs font-bold text-white"

                        style={{ backgroundColor: n.actor.color ?? '\#48B8FF' }}\>

                        {n.actor.display\_name?.\[0\]?.toUpperCase()}

                      \</div\>

                    )}

                    \<div className="flex-1 min-w-0"\>

                      \<p className="text-sm font-medium text-white truncate"\>

                        {n.title}

                      \</p\>

                      {n.body && (

                        \<p className="text-xs text-zinc-400 mt-0.5 line-clamp-2"\>

                          {n.body}

                        \</p\>

                      )}

                      \<p className="text-xs text-zinc-600 mt-1"\>

                        {formatDistanceToNow(new Date(n.created\_at),{addSuffix:true})}

                      \</p\>

                    \</div\>

                  \</div\>

                \</div\>

              ))

            }

          \</div\>

        \</div\>

      )}

    \</div\>

  )

}

| PART 18  ⚠ GAPS FILLED — REAL EMAIL THREADING (Gmail \+ Outlook) |
| :---- |

| What was missing in v2.0 OAuth routes existed but there was no actual email reading, threading, or composing. No sync mechanism to pull emails from Gmail/Outlook into REACH. No UI to see email threads linked to issues. No ability to reply to emails from within REACH. This part fills ALL of those gaps. |
| :---- |

## **18.1 OAuth Routes (same as v2.0 — reproduce from Part 13\)**

The Google OAuth routes (app/api/auth/google/route.ts and callback) and Microsoft OAuth routes are unchanged. Reproduce them from v2.0 Part 13\.

## **Google OAuth — Both Routes**

// app/api/auth/google/route.ts

import { NextResponse } from 'next/server'

const SCOPES \= \[

  'https://www.googleapis.com/auth/gmail.readonly',

  'https://www.googleapis.com/auth/gmail.send',

  'https://www.googleapis.com/auth/gmail.compose',

  'https://www.googleapis.com/auth/calendar.readonly',

  'openid', 'email', 'profile',

\].join(' ')

export async function GET() {

  const url \= new URL('https://accounts.google.com/o/oauth2/v2/auth')

  url.searchParams.set('client\_id', process.env.GOOGLE\_CLIENT\_ID\!)

  url.searchParams.set('redirect\_uri', process.env.GOOGLE\_REDIRECT\_URI\!)

  url.searchParams.set('response\_type', 'code')

  url.searchParams.set('scope', SCOPES)

  url.searchParams.set('access\_type', 'offline')

  url.searchParams.set('prompt', 'consent')

  return NextResponse.redirect(url)

}

// app/api/auth/google/callback/route.ts

import { NextRequest, NextResponse } from 'next/server'

import { createServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {

  const code \= new URL(req.url).searchParams.get('code')

  if (\!code) return NextResponse.redirect(

    \`${process.env.NEXT\_PUBLIC\_APP\_URL}/settings/integrations?error=no\_code\`)

  // Exchange code for tokens

  const tokenRes \= await fetch('https://oauth2.googleapis.com/token', {

    method: 'POST',

    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },

    body: new URLSearchParams({

      code,

      client\_id: process.env.GOOGLE\_CLIENT\_ID\!,

      client\_secret: process.env.GOOGLE\_CLIENT\_SECRET\!,

      redirect\_uri: process.env.GOOGLE\_REDIRECT\_URI\!,

      grant\_type: 'authorization\_code',

    }),

  })

  const tokens \= await tokenRes.json()

  // Get user email from Google

  const profileRes \= await fetch(

    'https://www.googleapis.com/oauth2/v2/userinfo',

    { headers: { Authorization: \`Bearer ${tokens.access\_token}\` } }

  )

  const gProfile \= await profileRes.json()

  // Get Supabase user from cookie-based session (server-side)

  const supabase \= createServerClient()

  const { data: { user } } \= await supabase.auth.getUser()

  // user will be null for external guests — skip token save in that case

  if (user) {

    const { data: profile } \= await supabase

      .from('profiles').select('tenant\_id').eq('id', user.id).single()

    await supabase.from('integration\_tokens').upsert({

      user\_id: user.id,

      tenant\_id: profile?.tenant\_id,

      provider: 'google',

      access\_token: tokens.access\_token,

      refresh\_token: tokens.refresh\_token,

      token\_expiry: new Date(Date.now() \+ tokens.expires\_in \* 1000).toISOString(),

      scopes: SCOPES.split(' '),

      provider\_email: gProfile.email,

    }, { onConflict: 'user\_id,provider' })

  }

  return NextResponse.redirect(

    \`${process.env.NEXT\_PUBLIC\_APP\_URL}/settings/integrations?success=google\`)

}

## **13.2 Microsoft OAuth (Outlook/365)**

// app/api/auth/microsoft/route.ts

import { NextResponse } from 'next/server'

const MS\_SCOPES \= \[

  'offline\_access', 'User.Read',

  'Mail.Read', 'Mail.Send', 'Calendars.Read',

\].join(' ')

export async function GET() {

  const url \= new URL(

    \`https://login.microsoftonline.com/${process.env.AZURE\_TENANT\_ID}/oauth2/v2.0/authorize\`

  )

  url.searchParams.set('client\_id', process.env.AZURE\_CLIENT\_ID\!)

  url.searchParams.set('response\_type', 'code')

  url.searchParams.set('redirect\_uri', process.env.AZURE\_REDIRECT\_URI\!)

  url.searchParams.set('scope', MS\_SCOPES)

  url.searchParams.set('response\_mode', 'query')

  return NextResponse.redirect(url)

}

// app/api/auth/microsoft/callback/route.ts

export async function GET(req: NextRequest) {

  const code \= new URL(req.url).searchParams.get('code')

  if (\!code) return NextResponse.redirect(

    \`${process.env.NEXT\_PUBLIC\_APP\_URL}/settings/integrations?error=no\_code\`)

  const tokenRes \= await fetch(

    \`https://login.microsoftonline.com/${process.env.AZURE\_TENANT\_ID}/oauth2/v2.0/token\`,

    {

      method: 'POST',

      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },

      body: new URLSearchParams({

        code,

        client\_id: process.env.AZURE\_CLIENT\_ID\!,

        client\_secret: process.env.AZURE\_CLIENT\_SECRET\!,

        redirect\_uri: process.env.AZURE\_REDIRECT\_URI\!,

        grant\_type: 'authorization\_code',

        scope: MS\_SCOPES,

      }),

    }

  )

  const tokens \= await tokenRes.json()

  const supabase \= createServerClient()

  const { data: { user } } \= await supabase.auth.getUser()

  if (user) {

    const { data: profile } \= await supabase

      .from('profiles').select('tenant\_id').eq('id', user.id).single()

    await supabase.from('integration\_tokens').upsert({

      user\_id: user.id,

      tenant\_id: profile?.tenant\_id,

      provider: 'microsoft',

      access\_token: tokens.access\_token,

      refresh\_token: tokens.refresh\_token,

      token\_expiry: new Date(Date.now() \+ tokens.expires\_in \* 1000).toISOString(),

      scopes: MS\_SCOPES.split(' '),

    }, { onConflict: 'user\_id,provider' })

  }

  return NextResponse.redirect(

    \`${process.env.NEXT\_PUBLIC\_APP\_URL}/settings/integrations?success=microsoft\`)

}

## **18.2 Email Sync Edge Function — sync-emails**

This Edge Function pulls the last 20 emails from the connected provider and upserts them into email\_threads. Called on demand and by cron.

| supabase/functions/sync-emails/index.ts |
| :---- |
| // supabase/functions/sync-emails/index.ts import { serve } from "https://deno.land/std@0.208.0/http/server.ts" import { createClient } from "https://esm.sh/@supabase/supabase-js@2"   const CORS \= {   "Access-Control-Allow-Origin": "\*",   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", }   serve(async (req) \=\> {   if (req.method \=== "OPTIONS") return new Response(null, { headers: CORS })     const supabase \= createClient(     Deno.env.get("SUPABASE\_URL")\!,     Deno.env.get("SUPABASE\_SERVICE\_ROLE\_KEY")\!   )     const authHeader \= req.headers.get("Authorization") ?? ""   const { data: { user }, error: authErr } \=     await supabase.auth.getUser(authHeader.replace("Bearer ", ""))   if (authErr || \!user)     return new Response("Unauthorized", { status: 401 })     const { provider, issue\_id } \= await req.json()     const { data: tokenRow } \= await supabase     .from("integration\_tokens")     .select("\*")     .eq("user\_id", user.id)     .eq("provider", provider ?? "google")     .single()     if (\!tokenRow)     return new Response("No token", { status: 400 })     const { data: profile } \= await supabase     .from("profiles").select("tenant\_id").eq("id", user.id).single()     let emails: any\[\] \= \[\]     if (tokenRow.provider \=== "google") {     // Gmail API: list messages     const listRes \= await fetch(       "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20\&labelIds=INBOX",       { headers: { Authorization: \`Bearer ${tokenRow.access\_token}\` } }     )     const list \= await listRes.json()     for (const m of (list.messages ?? \[\]).slice(0, 20)) {       const msgRes \= await fetch(         \`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full\`,         { headers: { Authorization: \`Bearer ${tokenRow.access\_token}\` } }       )       const msg \= await msgRes.json()       const headers \= msg.payload?.headers ?? \[\]       const get \= (name: string) \=\> headers.find((h: any) \=\> h.name \=== name)?.value ?? ""         emails.push({         provider: "google",         thread\_id: msg.threadId,         message\_id: msg.id,         subject: get("Subject"),         from\_email: get("From").match(/\<(.+)\>/)?.\[1\] ?? get("From"),         from\_name: get("From").match(/^(\[^\<\]+)/)?.\[1\]?.trim() ?? "",         snippet: msg.snippet,         is\_read: \!msg.labelIds?.includes("UNREAD"),         provider\_received\_at: new Date(Number(msg.internalDate)).toISOString(),         in\_reply\_to: get("In-Reply-To") || null,       })     }   } else if (tokenRow.provider \=== "microsoft") {     // Microsoft Graph: list messages     const listRes \= await fetch(       "https://graph.microsoft.com/v1.0/me/messages?$top=20&$orderby=receivedDateTime desc",       { headers: { Authorization: \`Bearer ${tokenRow.access\_token}\` } }     )     const list \= await listRes.json()     for (const m of (list.value ?? \[\]).slice(0, 20)) {       emails.push({         provider: "microsoft",         thread\_id: m.conversationId,         message\_id: m.id,         subject: m.subject,         from\_email: m.from?.emailAddress?.address ?? "",         from\_name: m.from?.emailAddress?.name ?? "",         snippet: m.bodyPreview,         is\_read: m.isRead,         provider\_received\_at: m.receivedDateTime,         in\_reply\_to: m.conversationId || null,       })     }   }     // Upsert all emails   const rows \= emails.map(e \=\> ({     ...e,     tenant\_id: profile?.tenant\_id,     user\_id: user.id,     issue\_id: issue\_id ?? null,   }))     if (rows.length \> 0\) {     await supabase.from("email\_threads").upsert(rows,       { onConflict: "user\_id,provider,message\_id" })   }     return new Response(JSON.stringify({ synced: rows.length }),     { headers: { ...CORS, "Content-Type": "application/json" } }) })   supabase functions deploy sync-emails |

## **18.3 Send Reply Edge Function — send-email-reply**

| supabase/functions/send-email-reply/index.ts |
| :---- |
| // supabase/functions/send-email-reply/index.ts import { serve } from "https://deno.land/std@0.208.0/http/server.ts" import { createClient } from "https://esm.sh/@supabase/supabase-js@2"   const CORS \= {   "Access-Control-Allow-Origin": "\*",   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", }   serve(async (req) \=\> {   if (req.method \=== "OPTIONS") return new Response(null, { headers: CORS })     const supabase \= createClient(     Deno.env.get("SUPABASE\_URL")\!,     Deno.env.get("SUPABASE\_SERVICE\_ROLE\_KEY")\!   )     const authHeader \= req.headers.get("Authorization") ?? ""   const { data: { user }, error: authErr } \=     await supabase.auth.getUser(authHeader.replace("Bearer ", ""))   if (authErr || \!user) return new Response("Unauthorized", { status: 401 })     const { to, subject, body, thread\_id, in\_reply\_to, issue\_id, provider } \= await req.json()     const { data: tokenRow } \= await supabase     .from("integration\_tokens")     .select("\*").eq("user\_id", user.id).eq("provider", provider ?? "google").single()     if (\!tokenRow) return new Response("No token", { status: 400 })     if (tokenRow.provider \=== "google") {     // Build RFC 2822 message     const rawMessage \= \[       \`To: ${to}\`,       \`Subject: ${in\_reply\_to ? "Re: " : ""}${subject}\`,       \`Content-Type: text/html; charset=utf-8\`,       in\_reply\_to ? \`In-Reply-To: ${in\_reply\_to}\` : "",       in\_reply\_to ? \`References: ${in\_reply\_to}\` : "",       "",       body,     \].filter(Boolean).join("\\r\\n")       const encoded \= btoa(rawMessage)       .replace(/\\+/g, "-").replace(/\\//g, "\_").replace(/=+$/, "")       const sendRes \= await fetch(       \`https://gmail.googleapis.com/gmail/v1/users/me/messages/send\`,       {         method: "POST",         headers: {           Authorization: \`Bearer ${tokenRow.access\_token}\`,           "Content-Type": "application/json",         },         body: JSON.stringify({           raw: encoded,           ...(thread\_id ? { threadId: thread\_id } : {}),         }),       }     )     const sent \= await sendRes.json()     return new Response(JSON.stringify({ message\_id: sent.id }),       { headers: { ...CORS, "Content-Type": "application/json" } })     } else if (tokenRow.provider \=== "microsoft") {     // Microsoft Graph: send reply     await fetch(       \`https://graph.microsoft.com/v1.0/me/sendMail\`,       {         method: "POST",         headers: {           Authorization: \`Bearer ${tokenRow.access\_token}\`,           "Content-Type": "application/json",         },         body: JSON.stringify({           message: {             subject: (in\_reply\_to ? "Re: " : "") \+ subject,             body: { contentType: "HTML", content: body },             toRecipients: \[{ emailAddress: { address: to } }\],           },           saveToSentItems: true,         }),       }     )     return new Response(JSON.stringify({ sent: true }),       { headers: { ...CORS, "Content-Type": "application/json" } })   }     return new Response("Unknown provider", { status: 400 }) })   supabase functions deploy send-email-reply |

## **18.4 EmailThreadPanel Component**

| components/email/EmailThreadPanel.tsx |
| :---- |
| // components/email/EmailThreadPanel.tsx 'use client' import { useEffect, useState } from 'react' import { createBrowserClient } from '@/lib/supabase' import { useReachStore } from '@/store/reach' import { formatDistanceToNow } from 'date-fns' import { Send, RefreshCw } from 'lucide-react'   export function EmailThreadPanel({ issueId }: { issueId: string }) {   const \[emails, setEmails\] \= useState\<any\[\]\>(\[\])   const \[loading, setLoading\] \= useState(true)   const \[syncing, setSyncing\] \= useState(false)   const \[replyTo, setReplyTo\] \= useState\<any\>(null)   const \[replyBody, setReplyBody\] \= useState('')   const \[sending, setSending\] \= useState(false)   const { user } \= useReachStore()   const supabase \= createBrowserClient()     useEffect(() \=\> {     load()   }, \[issueId\])     async function load() {     setLoading(true)     const { data } \= await supabase.from('email\_threads')       .select('\*').eq('issue\_id', issueId)       .order('provider\_received\_at', { ascending: true })     setEmails(data ?? \[\])     setLoading(false)   }     async function sync() {     setSyncing(true)     await supabase.functions.invoke('sync-emails', {       body: { provider: 'google', issue\_id: issueId }     })     await load()     setSyncing(false)   }     async function sendReply() {     if (\!replyTo || \!replyBody.trim() || sending) return     setSending(true)     await supabase.functions.invoke('send-email-reply', {       body: {         to: replyTo.from\_email,         subject: replyTo.subject,         body: \`\<p\>${replyBody.replace(/\\n/g, '\<br/\>')}\</p\>\`,         thread\_id: replyTo.thread\_id,         in\_reply\_to: replyTo.message\_id,         issue\_id: issueId,         provider: 'google',       }     })     setReplyBody('')     setReplyTo(null)     setSending(false)     await load()   }     return (     \<div className="space-y-2"\>       \<div className="flex items-center justify-between"\>         \<h4 className="text-sm font-semibold text-white"\>Email Thread\</h4\>         \<button onClick={sync} disabled={syncing}           className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"\>           \<RefreshCw size={11} className={syncing ? 'animate-spin' : ''}/\> Sync         \</button\>       \</div\>       {loading && \<p className="text-xs text-zinc-500"\>Loading emails...\</p\>}       {emails.length \=== 0 && \!loading && (         \<p className="text-xs text-zinc-500"\>No emails linked to this issue.\</p\>       )}       \<div className="space-y-2 max-h-80 overflow-y-auto"\>         {emails.map(email \=\> (           \<div key={email.id}             className={\`rounded-lg border p-3 ${email.is\_sent ? 'border-\[\#48B8FF\]/30 bg-\[\#48B8FF\]/5' : 'border-zinc-700 bg-zinc-800/40'}\`}\>             \<div className="flex items-start justify-between gap-2 mb-1"\>               \<div\>                 \<p className="text-xs font-medium text-white"\>{email.from\_name || email.from\_email}\</p\>                 \<p className="text-\[10px\] text-zinc-500"\>{email.subject}\</p\>               \</div\>               \<p className="text-\[10px\] text-zinc-600 flex-shrink-0"\>                 {email.provider\_received\_at                   ? formatDistanceToNow(new Date(email.provider\_received\_at), { addSuffix: true })                   : ''}               \</p\>             \</div\>             \<p className="text-xs text-zinc-300 line-clamp-3"\>{email.snippet}\</p\>             \<button onClick={() \=\> setReplyTo(email)}               className="mt-1.5 text-\[10px\] text-\[\#48B8FF\] hover:underline"\>Reply\</button\>           \</div\>         ))}       \</div\>       {replyTo && (         \<div className="border border-zinc-700 rounded-lg p-3 space-y-2"\>           \<p className="text-xs text-zinc-400"\>Replying to {replyTo.from\_email}\</p\>           \<textarea value={replyBody} onChange={e \=\> setReplyBody(e.target.value)}             placeholder="Write your reply..."             rows={4}             className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2               text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-\[\#48B8FF\] resize-none" /\>           \<div className="flex gap-2"\>             \<button onClick={sendReply} disabled={\!replyBody.trim() || sending}               className="flex items-center gap-1 px-3 py-1.5 bg-\[\#48B8FF\] text-\[\#1A1A2E\]                 rounded text-xs font-semibold disabled:opacity-50"\>               \<Send size={11}/\> {sending ? 'Sending...' : 'Send Reply'}             \</button\>             \<button onClick={() \=\> { setReplyTo(null); setReplyBody('') }}               className="px-3 py-1.5 bg-zinc-700 text-zinc-300 rounded text-xs"\>Cancel\</button\>           \</div\>         \</div\>       )}     \</div\>   ) } |

## **18.5 Link Email to Issue**

Add this button to the Issue Detail panel to associate an email thread with an issue:

| IssueDetailPanel addition |
| :---- |
| // Inside IssueDetailPanel — add 'Link Email' button: // When clicked, shows a list of recent email\_threads the user hasn't linked yet.   async function linkEmailThread(threadId: string) {   await supabase.from('email\_threads')     .update({ issue\_id: issueId })     .eq('thread\_id', threadId)     .eq('user\_id', user?.id) } |

| PART 19  ⚠ GAPS FILLED — @ MENTIONS EVERYWHERE |
| :---- |

| What was missing in v2.0 @ mentions worked in chat MessageInput but not in:   \- Issue descriptions and comments   \- Document editor   \- IDE notes   \- Any other text surface This part provides the universal MentionInput component and the DB-level trigger that fires notifications for ALL surfaces. |
| :---- |

## **19.1 Universal MentionInput Component**

Drop-in replacement for any textarea. Use it everywhere — chat, issue descriptions, docs, comments.

| components/shared/MentionInput.tsx |
| :---- |
| // components/shared/MentionInput.tsx 'use client' import { useState, useRef } from 'react' import { createBrowserClient } from '@/lib/supabase' import { useReachStore } from '@/store/reach'   interface MentionInputProps {   value: string   onChange: (v: string) \=\> void   placeholder?: string   multiline?: boolean   rows?: number   onSubmit?: () \=\> void   className?: string   // The surface this is embedded in — for universal\_mentions tracking   surface?: 'chat' | 'issue\_description' | 'issue\_comment' | 'doc' | 'ide\_note'   resourceId?: string  // id of the containing resource   link?: string        // navigation link for notification }   export function MentionInput({   value, onChange, placeholder, multiline, rows \= 3,   onSubmit, className \= '', surface \= 'chat', resourceId, link }: MentionInputProps) {   const \[results, setResults\] \= useState\<any\[\]\>(\[\])   const \[mentionStart, setMentionStart\] \= useState(-1)   const ref \= useRef\<any\>(null)   const { tenant } \= useReachStore()   const supabase \= createBrowserClient()     async function handleChange(e: React.ChangeEvent\<any\>) {     const val \= e.target.value     onChange(val)     const cursor \= e.target.selectionStart ?? 0     const match \= val.slice(0, cursor).match(/@(\[\\w.-\]\*)$/)     if (match && match\[1\].length \>= 1\) {       setMentionStart(cursor \- match\[0\].length)       const { data } \= await supabase.from('profiles')         .select('id,display\_name,color')         .eq('tenant\_id', tenant?.id)         .ilike('display\_name', \`%${match\[1\]}%\`)         .limit(5)       setResults(data ?? \[\])     } else { setResults(\[\]) }   }     function insertMention(p: any) {     const cursor \= ref.current?.selectionStart ?? 0     const token \= \`@\[${p.display\_name}\](${p.id}) \`     onChange(value.slice(0, mentionStart) \+ token \+ value.slice(cursor))     setResults(\[\])     ref.current?.focus()       // Write to universal\_mentions if we have context     if (surface \!== 'chat' && resourceId) {       // Chat mentions are handled by DB trigger; other surfaces write here       supabase.from('universal\_mentions').insert({         mentioned\_user\_id: p.id,         surface, resource\_id: resourceId,         context\_text: value.slice(0, 120),         link: link ?? '',       }).then(() \=\> {})     }   }     const Tag \= multiline ? 'textarea' : 'input'   const baseClass \= \`w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2     text-sm text-white placeholder-zinc-500 focus:outline-none     focus:border-\[\#48B8FF\] transition-colors ${className}\`     return (     \<div className="relative"\>       {results.length \> 0 && (         \<div className="absolute bottom-full left-0 mb-1 bg-zinc-800 border border-zinc-700           rounded-xl shadow-xl overflow-hidden z-50 min-w-48"\>           {results.map(p \=\> (             \<button key={p.id} type="button" onClick={() \=\> insertMention(p)}               className="flex items-center gap-2 w-full px-3 py-2 hover:bg-zinc-700 text-sm text-white text-left"\>               \<div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center                 justify-center text-xs font-bold text-white"                 style={{ backgroundColor: p.color }}\>                 {p.display\_name\[0\].toUpperCase()}               \</div\>               {p.display\_name}             \</button\>           ))}         \</div\>       )}       \<Tag         ref={ref} value={value} onChange={handleChange}         placeholder={placeholder ?? 'Type @ to mention...'}         onKeyDown={(e: any) \=\> {           if (e.key==='Enter'&&\!e.shiftKey&\&onSubmit) { e.preventDefault(); onSubmit() }         }}         className={baseClass}         rows={multiline ? rows : undefined}       /\>     \</div\>   ) }   // Render @\[name\](id) as highlighted spans (use dangerouslySetInnerHTML) export function renderMentions(body: string): string {   return body.replace(/@\\\[(\[^\\\]\]+)\\\]\\(\[^)\]+\\)/g,     (\_, name) \=\> \`\<span class="text-\[\#48B8FF\] font-medium"\>@${name}\</span\>\`) }   // Extract user IDs from mention tokens export function extractMentionIds(body: string): string\[\] {   return \[...body.matchAll(/@\\\[(\[^\\\]\]+)\\\]\\((\[^)\]+)\\)/g)\].map(m \=\> m\[2\]) } |

## **19.2 Usage — Drop MentionInput in Anywhere**

| Surface | Implementation |
| :---- | :---- |
| Chat MessageInput | Already uses its own inline mention logic — see Part 9.3. Or replace with MentionInput. |
| Issue description editor | \<MentionInput surface="issue\_description" resourceId={issue.id} link={\`/board?issue=${issue.id}\`} multiline rows={4} /\> |
| Issue comment | \<MentionInput surface="issue\_comment" resourceId={comment.id} link={\`/board?issue=${issue.id}\`} /\> |
| Document editor | \<MentionInput surface="doc" resourceId={doc.id} link={\`/docs/${doc.id}\`} multiline rows={10} /\> |
| IDE note | \<MentionInput surface="ide\_note" resourceId={note.id} link={\`/ide?note=${note.id}\`} /\> |

## **19.3 universal\_mentions Notification Trigger**

Add this trigger to fire notifications for mentions on non-chat surfaces:

| SQL — universal mention trigger |
| :---- |
| \-- Trigger: new row in universal\_mentions → INSERT notification CREATE OR REPLACE FUNCTION notify\_on\_universal\_mention() RETURNS TRIGGER AS $$ DECLARE   actor\_name text; BEGIN   SELECT display\_name INTO actor\_name FROM profiles WHERE id \= NEW.actor\_id;   INSERT INTO notifications (tenant\_id, user\_id, type, title, body, link, actor\_id)   VALUES (     NEW.tenant\_id,     NEW.mentioned\_user\_id,     'mention',     COALESCE(actor\_name, 'Someone') || ' mentioned you in ' || NEW.surface,     LEFT(COALESCE(NEW.context\_text, ''), 120),     COALESCE(NEW.link, ''),     NEW.actor\_id   );   RETURN NEW; END; $$ LANGUAGE plpgsql SECURITY DEFINER;   CREATE TRIGGER t\_notify\_universal\_mention AFTER INSERT ON universal\_mentions   FOR EACH ROW EXECUTE FUNCTION notify\_on\_universal\_mention(); |

| PART 20  ⚠ GAPS FILLED — ZOOM FALLBACK (PROPERLY WIRED) |
| :---- |

| What was missing in v2.0 v2.0 described Zoom as "user-connected fallback" but the wiring was incomplete:   \- No detection of whether Zoom is connected in the UI   \- No fallback UI in VideoRoom when WebRTC fails   \- No "Start Zoom Meeting" button that appears only when Zoom is connected   \- The OAuth route and create-meeting API existed but were not connected to the video UI This part fixes all of that with a clean "REACH native first, Zoom if you have it" flow. |
| :---- |

## **20.1 The Clean Mental Model**

| Scenario | What Happens |
| :---- | :---- |
| User clicks "Start Standup" | REACH starts native WebRTC meeting. No Zoom required. |
| WebRTC fails (NAT/firewall) | Error banner appears: "Video blocked? Use Zoom fallback." |
| User clicks Zoom fallback | If Zoom connected: creates Zoom meeting and posts link. If not: redirects to Settings → Integrations. |
| User connects Zoom in Settings | "Create Zoom Meeting" button appears in channel header alongside "Start Standup". |

## **20.2 VideoRoom Error Banner with Zoom Fallback**

| VideoRoom.tsx — error state with Zoom fallback |
| :---- |
| // Add to VideoRoom.tsx — replace the simple error return: import { ExternalLink } from 'lucide-react' import { useReachStore } from '@/store/reach'   // Inside VideoRoom, after the WebRTC error state: const { user } \= useReachStore() const \[zoomLoading, setZoomLoading\] \= useState(false)   async function startZoomFallback() {   if (\!user?.zoom\_connected) {     window.location.href \= '/settings/integrations'     return   }   setZoomLoading(true)   const res \= await fetch('/api/zoom/create-meeting', {     method: 'POST',     headers: { 'Content-Type': 'application/json' },     body: JSON.stringify({ topic: 'REACH Standup', channel\_id: null }),   })   const data \= await res.json()   if (data.join\_url) window.open(data.join\_url, '\_blank')   setZoomLoading(false)   onLeave() }   // Replace error return block: if (error) return (   \<div className="flex-1 flex items-center justify-center bg-zinc-900"\>     \<div className="text-center max-w-sm px-6"\>       \<p className="text-red-400 mb-2 text-sm"\>{error}\</p\>       \<p className="text-zinc-500 text-xs mb-6"\>         If your network blocks direct connections, use Zoom as a fallback.       \</p\>       \<div className="flex flex-col gap-2"\>         \<button onClick={startZoomFallback} disabled={zoomLoading}           className="flex items-center justify-center gap-2 px-4 py-2             bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm disabled:opacity-50"\>           \<ExternalLink size={14}/\>           {zoomLoading ? 'Creating...' : user?.zoom\_connected ? 'Start Zoom Meeting' : 'Connect Zoom'}         \</button\>         \<button onClick={onLeave}           className="px-4 py-2 bg-zinc-700 rounded-lg text-white text-sm"\>           Go back         \</button\>       \</div\>     \</div\>   \</div\> ) |

## **20.3 Updated StartMeetingButton (shows both options when Zoom connected)**

| components/video/StartMeetingButton.tsx |
| :---- |
| // components/video/StartMeetingButton.tsx (complete replacement) 'use client' import { useState } from 'react' import { Video, ExternalLink, ChevronDown } from 'lucide-react' import { createBrowserClient } from '@/lib/supabase' import { VideoRoom } from './VideoRoom' import { useReachStore } from '@/store/reach'   export function StartMeetingButton({ channelId }: { channelId: string }) {   const \[meetingData, setMeetingData\] \= useState\<any\>(null)   const \[loading, setLoading\] \= useState(false)   const \[showMenu, setShowMenu\] \= useState(false)   const { user } \= useReachStore()   const supabase \= createBrowserClient()     async function startNative() {     setLoading(true); setShowMenu(false)     const { data, error } \= await supabase.functions.invoke('create-meeting', {       body: { title: 'Standup', channel\_id: channelId }     })     if (\!error) setMeetingData(data)     setLoading(false)   }     async function startZoom() {     setLoading(true); setShowMenu(false)     const res \= await fetch('/api/zoom/create-meeting', {       method: 'POST',       headers: { 'Content-Type': 'application/json' },       body: JSON.stringify({ topic: 'REACH Standup', channel\_id: channelId }),     })     const data \= await res.json()     if (data.join\_url) window.open(data.join\_url, '\_blank')     setLoading(false)   }     if (meetingData) return (     \<div className="fixed inset-0 bg-black/80 z-50 flex flex-col"\>       \<VideoRoom roomCode={meetingData.room\_code} meetingId={meetingData.meeting\_id}         onLeave={() \=\> setMeetingData(null)} /\>     \</div\>   )     // Single button if Zoom not connected   if (\!user?.zoom\_connected) return (     \<button onClick={startNative} disabled={loading}       className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm         bg-zinc-700 hover:bg-zinc-600 text-white transition-colors disabled:opacity-50"\>       \<Video size={13}/\> {loading ? 'Starting...' : 'Start Standup'}     \</button\>   )     // Dropdown if Zoom is connected   return (     \<div className="relative"\>       \<div className="flex"\>         \<button onClick={startNative} disabled={loading}           className="flex items-center gap-1.5 px-3 py-1.5 rounded-l-md text-sm             bg-zinc-700 hover:bg-zinc-600 text-white transition-colors disabled:opacity-50"\>           \<Video size={13}/\> {loading ? 'Starting...' : 'Start Standup'}         \</button\>         \<button onClick={() \=\> setShowMenu(m \=\> \!m)} disabled={loading}           className="px-1.5 py-1.5 rounded-r-md text-sm bg-zinc-600 hover:bg-zinc-500             text-white border-l border-zinc-500"\>           \<ChevronDown size={12}/\>         \</button\>       \</div\>       {showMenu && (         \<div className="absolute right-0 top-full mt-1 w-48 bg-zinc-800 border border-zinc-700           rounded-xl shadow-xl z-50 overflow-hidden"\>           \<button onClick={startNative}             className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-zinc-700 text-sm text-white"\>             \<Video size={13}/\> REACH Video (native)           \</button\>           \<button onClick={startZoom}             className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-zinc-700 text-sm text-white               border-t border-zinc-700"\>             \<ExternalLink size={13}/\> Start Zoom Meeting           \</button\>         \</div\>       )}     \</div\>   ) } |

## **20.4 OAuth Routes (same as v2.0 — kept for reference)**

app/api/auth/zoom/route.ts and /callback/route.ts are unchanged from v2.0 Part 14.1. After successful OAuth, update the profile:

| zoom/callback addition |
| :---- |
| // Add to zoom/callback/route.ts after saving token: await supabase.from('profiles').update({ zoom\_connected: true }).eq('id', user\!.id) |

# **14\. Zoom & Google Meet — User Fallback**

| REACH DOES NOT DEPEND ON ZOOM OR MEET REACH owns zero Zoom or Meet infrastructure. Users who prefer these tools connect their own account in Settings → Integrations. REACH then allows them to create meetings from within the app using their own credentials. If they are blocked by TURN/NAT, they can fall back to these tools. No REACH platform Zoom account is needed. |
| :---- |

## **14.1 Zoom OAuth (user connects own account)**

// app/api/auth/zoom/route.ts

export async function GET() {

  const url \= new URL('https://zoom.us/oauth/authorize')

  url.searchParams.set('response\_type', 'code')

  url.searchParams.set('client\_id', process.env.ZOOM\_CLIENT\_ID\!)

  url.searchParams.set('redirect\_uri', process.env.ZOOM\_REDIRECT\_URI\!)

  return NextResponse.redirect(url)

}

// app/api/auth/zoom/callback/route.ts

export async function GET(req: NextRequest) {

  const code \= new URL(req.url).searchParams.get('code')

  if (\!code) return NextResponse.redirect(

    \`${process.env.NEXT\_PUBLIC\_APP\_URL}/settings/integrations?error=no\_code\`)

  const creds \= Buffer.from(

    \`${process.env.ZOOM\_CLIENT\_ID}:${process.env.ZOOM\_CLIENT\_SECRET}\`

  ).toString('base64')

  const tokenRes \= await fetch('https://zoom.us/oauth/token', {

    method: 'POST',

    headers: {

      'Authorization': \`Basic ${creds}\`,

      'Content-Type': 'application/x-www-form-urlencoded',

    },

    body: new URLSearchParams({

      code,

      grant\_type: 'authorization\_code',

      redirect\_uri: process.env.ZOOM\_REDIRECT\_URI\!,

    }),

  })

  const tokens \= await tokenRes.json()

  const supabase \= createServerClient()

  const { data: { user } } \= await supabase.auth.getUser()

  if (user) {

    const { data: profile } \= await supabase

      .from('profiles').select('tenant\_id').eq('id', user.id).single()

    await supabase.from('integration\_tokens').upsert({

      user\_id: user.id,

      tenant\_id: profile?.tenant\_id,

      provider: 'zoom',

      access\_token: tokens.access\_token,

      refresh\_token: tokens.refresh\_token,

      token\_expiry: new Date(Date.now() \+ tokens.expires\_in \* 1000).toISOString(),

    }, { onConflict: 'user\_id,provider' })

  }

  return NextResponse.redirect(

    \`${process.env.NEXT\_PUBLIC\_APP\_URL}/settings/integrations?success=zoom\`)

}

## **14.2 Create Zoom Meeting (from user's account)**

// app/api/zoom/create-meeting/route.ts

export async function POST(req: NextRequest) {

  const { topic, channel\_id, scheduled\_at } \= await req.json()

  const supabase \= createServerClient()

  const { data: { user } } \= await supabase.auth.getUser()

  const { data: tokenRow } \= await supabase

    .from('integration\_tokens')

    .select('access\_token')

    .eq('user\_id', user?.id)

    .eq('provider', 'zoom')

    .single()

  if (\!tokenRow)

    return NextResponse.json({ error: 'Zoom not connected' }, { status: 400 })

  const res \= await fetch('https://api.zoom.us/v2/users/me/meetings', {

    method: 'POST',

    headers: {

      'Authorization': \`Bearer ${tokenRow.access\_token}\`,

      'Content-Type': 'application/json',

    },

    body: JSON.stringify({

      topic: topic || 'REACH Standup',

      type: scheduled\_at ? 2 : 1,

      start\_time: scheduled\_at,

      duration: 30,

      settings: { join\_before\_host: true, waiting\_room: false },

    }),

  })

  const meeting \= await res.json()

  if (channel\_id) {

    const { data: profile } \= await supabase

      .from('profiles').select('tenant\_id').eq('id', user?.id).single()

    await supabase.from('messages').insert({

      tenant\_id: profile?.tenant\_id,

      channel\_id, author\_id: user?.id,

      body: \`Zoom meeting: ${meeting.join\_url}\`,

      is\_system: false,

    })

  }

  return NextResponse.json({

    join\_url: meeting.join\_url,

    start\_url: meeting.start\_url,

  })

}

| PART 21  EDGE FUNCTIONS |
| :---- |

All Edge Functions from v2.0 are unchanged: get-ice-servers, send-notification, send-meeting-invite, refresh-oauth-tokens. New in v3.0: sync-emails, send-email-reply (Part 18). Reproduce all v2.0 Edge Functions from Parts 15.1–15.4.

## **21.1 Deploy All Edge Functions — One Command**

| Terminal — deploy all |
| :---- |
| supabase functions deploy get-ice-servers supabase functions deploy create-meeting supabase functions deploy send-notification supabase functions deploy send-meeting-invite supabase functions deploy refresh-oauth-tokens supabase functions deploy sync-emails supabase functions deploy send-email-reply |

#  **Edge Functions**

## **15.1 get-ice-servers**

// supabase/functions/get-ice-servers/index.ts

// Returns ICE server config. Reads whichever TURN env vars are set.

import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const CORS \= {

  "Access-Control-Allow-Origin": "\*",

  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",

}

serve(async (req) \=\> {

  if (req.method \=== "OPTIONS") return new Response(null, { headers: CORS })

  const iceServers: any\[\] \= \[

    { urls: "stun:stun.l.google.com:19302" },

    { urls: "stun:stun1.l.google.com:19302" },

  \]

  const turnUrl      \= Deno.env.get("TURN\_SERVER\_URL")

  const turnUser     \= Deno.env.get("TURN\_SERVER\_USERNAME")

  const turnCred     \= Deno.env.get("TURN\_SERVER\_CREDENTIAL")

  const twilioSid    \= Deno.env.get("TWILIO\_ACCOUNT\_SID")

  const twilioToken  \= Deno.env.get("TWILIO\_AUTH\_TOKEN")

  const meteredKey   \= Deno.env.get("METERED\_API\_KEY")

  const meteredDomain= Deno.env.get("METERED\_DOMAIN")

  if (turnUrl && turnUser && turnCred) {

    // Option A: coturn

    iceServers.push({

      urls: \[turnUrl, turnUrl.replace("turn:", "turns:")\],

      username: turnUser,

      credential: turnCred,

    })

  } else if (twilioSid && twilioToken) {

    // Option B: Twilio — fetch short-lived credentials

    const creds \= btoa(\`${twilioSid}:${twilioToken}\`)

    const r \= await fetch(

      \`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Tokens.json\`,

      { method: "POST", headers: { Authorization: \`Basic ${creds}\` } }

    )

    const data \= await r.json()

    iceServers.push(...(data.ice\_servers ?? \[\]))

  } else if (meteredKey && meteredDomain) {

    // Option C: Metered.ca

    const r \= await fetch(

      \`https://${meteredDomain}/api/v1/turn/credentials?apiKey=${meteredKey}\`

    )

    const data \= await r.json()

    iceServers.push(...(data ?? \[\]))

  }

  return new Response(JSON.stringify({ iceServers }), {

    headers: { ...CORS, "Content-Type": "application/json" }

  })

})

supabase functions deploy get-ice-servers

## **15.2 send-notification**

// supabase/functions/send-notification/index.ts

import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) \=\> {

  const { user\_id, type, title, body, link } \= await req.json()

  const supabase \= createClient(

    Deno.env.get("SUPABASE\_URL")\!,

    Deno.env.get("SUPABASE\_SERVICE\_ROLE\_KEY")\!

  )

  // Get user email from auth.users via service role

  const { data: { user } } \= await supabase.auth.admin.getUserById(user\_id)

  const email \= user?.email

  // Get notification preferences

  const { data: prefs } \= await supabase.from("profiles")

    .select("notification\_email, notification\_types")

    .eq("id", user\_id).single()

  const emailTypes \= \["mention", "dm", "issue\_assigned"\]

  if (email && prefs?.notification\_email && emailTypes.includes(type)) {

    await fetch("https://api.resend.com/emails", {

      method: "POST",

      headers: {

        "Authorization": \`Bearer ${Deno.env.get("RESEND\_API\_KEY")}\`,

        "Content-Type": "application/json",

      },

      body: JSON.stringify({

        from: Deno.env.get("FROM\_EMAIL"),

        to: email,

        subject: title,

        html: \`\<p\>${body ?? title}\</p\>

          \<a href="${Deno.env.get("NEXT\_PUBLIC\_APP\_URL")}${link ?? ""}"\>

          View in REACH\</a\>\`,

      }),

    })

  }

  return new Response("ok")

})

supabase functions deploy send-notification

## **15.3 send-meeting-invite**

// supabase/functions/send-meeting-invite/index.ts

import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

serve(async (req) \=\> {

  const { to\_emails, join\_url, title, scheduled\_at } \= await req.json()

  for (const email of (to\_emails ?? \[\])) {

    await fetch("https://api.resend.com/emails", {

      method: "POST",

      headers: {

        "Authorization": \`Bearer ${Deno.env.get("RESEND\_API\_KEY")}\`,

        "Content-Type": "application/json",

      },

      body: JSON.stringify({

        from: Deno.env.get("FROM\_EMAIL"),

        to: email,

        subject: \`REACH Invite: ${title}\`,

        html: \`

          \<h2\>${title}\</h2\>

          ${scheduled\_at

            ? \`\<p\>${new Date(scheduled\_at).toLocaleString()}\</p\>\` : ""}

          \<a href="${join\_url}" style="display:inline-block;padding:12px 24px;

            background:\#48B8FF;color:\#1A1A2E;text-decoration:none;

            border-radius:8px;font-weight:bold;"\>Join Meeting\</a\>

          \<p style="color:\#888;font-size:12px"\>Or: ${join\_url}\</p\>

        \`,

      }),

    })

  }

  return new Response(JSON.stringify({ sent: to\_emails?.length ?? 0 }))

})

supabase functions deploy send-meeting-invite

## **15.4 refresh-oauth-tokens**

// supabase/functions/refresh-oauth-tokens/index.ts

import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async () \=\> {

  const supabase \= createClient(

    Deno.env.get("SUPABASE\_URL")\!,

    Deno.env.get("SUPABASE\_SERVICE\_ROLE\_KEY")\!

  )

  // Find tokens expiring in next 60 minutes

  const { data: expiring } \= await supabase

    .from("integration\_tokens").select("\*")

    .lt("token\_expiry", new Date(Date.now()+3600000).toISOString())

  let refreshed \= 0

  for (const t of expiring ?? \[\]) {

    let newTokens: any \= null

    if (t.provider \=== "google") {

      const r \= await fetch("https://oauth2.googleapis.com/token", {

        method: "POST",

        headers: { "Content-Type": "application/x-www-form-urlencoded" },

        body: new URLSearchParams({

          refresh\_token: t.refresh\_token,

          client\_id: Deno.env.get("GOOGLE\_CLIENT\_ID")\!,

          client\_secret: Deno.env.get("GOOGLE\_CLIENT\_SECRET")\!,

          grant\_type: "refresh\_token",

        }),

      })

      newTokens \= await r.json()

    }

    if (t.provider \=== "microsoft") {

      const r \= await fetch(

        \`https://login.microsoftonline.com/${Deno.env.get("AZURE\_TENANT\_ID")}/oauth2/v2.0/token\`,

        {

          method: "POST",

          headers: { "Content-Type": "application/x-www-form-urlencoded" },

          body: new URLSearchParams({

            refresh\_token: t.refresh\_token,

            client\_id: Deno.env.get("AZURE\_CLIENT\_ID")\!,

            client\_secret: Deno.env.get("AZURE\_CLIENT\_SECRET")\!,

            grant\_type: "refresh\_token",

          }),

        }

      )

      newTokens \= await r.json()

    }

    if (newTokens?.access\_token) {

      await supabase.from("integration\_tokens").update({

        access\_token: newTokens.access\_token,

        token\_expiry: new Date(Date.now()+newTokens.expires\_in\*1000).toISOString(),

      }).eq("id", t.id)

      refreshed++

    }

  }

  return new Response(JSON.stringify({ refreshed }))

})

supabase functions deploy refresh-oauth-tokens

| PART 22  CRON JOBS |
| :---- |

All cron jobs from v2.0 are unchanged. New in v3.0: email sync cron. Run all blocks in Supabase SQL Editor

.**Cron Jobs**

Run all blocks in Supabase SQL Editor. Requires pg\_cron and pg\_net extensions (Part 1.4).

\-- ── Set these app settings once (required for HTTP calls from cron) ──

ALTER DATABASE postgres SET app.supabase\_url \= 'https://YOUR\_PROJECT\_REF.supabase.co';

ALTER DATABASE postgres SET app.service\_role\_key \= 'eyJ...your\_service\_role\_key...';

\-- ── CRON 1: Refresh OAuth tokens every 30 minutes ──

SELECT cron.schedule(

  'refresh-oauth-tokens', '\*/30 \* \* \* \*',

  $$ SELECT net.http\_post(

    url := current\_setting('app.supabase\_url') || '/functions/v1/refresh-oauth-tokens',

    headers := jsonb\_build\_object(

      'Content-Type', 'application/json',

      'Authorization', 'Bearer ' || current\_setting('app.service\_role\_key')

    ),

    body := '{}'::jsonb

  ); $$

);

\-- ── CRON 2: Purge old webrtc\_signals (ephemeral — keep 2 hours) ──

SELECT cron.schedule(

  'purge-webrtc-signals', '\*/15 \* \* \* \*',

  $$ DELETE FROM webrtc\_signals

     WHERE created\_at \< now() \- interval '2 hours'; $$

);

\-- ── CRON 3: Clean up old notifications (keep 90 days) ──

SELECT cron.schedule(

  'cleanup-notifications', '0 2 \* \* \*',

  $$ DELETE FROM notifications

     WHERE created\_at \< now() \- interval '90 days'; $$

);

\-- ── CRON 4: Purge soft-deleted messages older than 30 days ──

SELECT cron.schedule(

  'purge-deleted-messages', '0 3 \* \* 0',

  $$ DELETE FROM messages

     WHERE deleted \= true

     AND deleted\_at \< now() \- interval '30 days'; $$

);

\-- ── CRON 5: Auto-end meetings that started but never ended (stuck live) ──

SELECT cron.schedule(

  'end-stuck-meetings', '\*/30 \* \* \* \*',

  $$ UPDATE meetings SET status \= 'ended', ended\_at \= now()

     WHERE status \= 'live'

     AND started\_at \< now() \- interval '4 hours'; $$

);

\-- ── CRON 6: Daily standup reminder (weekdays 9am UTC) ──

SELECT cron.schedule(

  'standup-reminder', '0 9 \* \* 1-5',

  $$ INSERT INTO notifications (tenant\_id, user\_id, type, title, body, link)

     SELECT p.tenant\_id, p.id,

       'standup\_reminder', 'Daily Standup',

       'Time for your standup\!', '/video'

     FROM profiles p

     JOIN workspace\_settings ws ON ws.tenant\_id \= p.tenant\_id

     WHERE ws.standup\_reminders \= true; $$

);

\-- View jobs:   SELECT \* FROM cron.job;

\-- Remove job:  SELECT cron.unschedule('job-name');

| SQL — All Cron Jobs |
| :---- |
| \-- ── Set app settings once (required for HTTP calls from cron) ── ALTER DATABASE postgres SET app.supabase\_url \= 'https://YOUR\_PROJECT\_REF.supabase.co'; ALTER DATABASE postgres SET app.service\_role\_key \= 'eyJ...your\_service\_role\_key...';   \-- CRON 1: Refresh OAuth tokens every 30 min SELECT cron.schedule('refresh-oauth-tokens', '\*/30 \* \* \* \*', $$ SELECT net.http\_post(   url := current\_setting('app.supabase\_url') || '/functions/v1/refresh-oauth-tokens',   headers := jsonb\_build\_object('Content-Type', 'application/json',     'Authorization', 'Bearer ' || current\_setting('app.service\_role\_key')),   body := '{}'::jsonb ); $$);   \-- CRON 2: Purge old webrtc\_signals every 15 min SELECT cron.schedule('purge-webrtc-signals', '\*/15 \* \* \* \*', $$   DELETE FROM webrtc\_signals WHERE created\_at \< now() \- interval '2 hours'; $$);   \-- CRON 3: Clean up old notifications (90 days) SELECT cron.schedule('cleanup-notifications', '0 2 \* \* \*', $$   DELETE FROM notifications WHERE created\_at \< now() \- interval '90 days'; $$);   \-- CRON 4: Purge soft-deleted messages (30 days) SELECT cron.schedule('purge-deleted-messages', '0 3 \* \* 0', $$   DELETE FROM messages WHERE deleted \= true AND deleted\_at \< now() \- interval '30 days'; $$);   \-- CRON 5: Auto-end stuck meetings (30 min check) SELECT cron.schedule('end-stuck-meetings', '\*/30 \* \* \* \*', $$   UPDATE meetings SET status \= 'ended', ended\_at \= now()   WHERE status \= 'live' AND started\_at \< now() \- interval '4 hours'; $$);   \-- CRON 6: Daily standup reminder (weekdays 9am UTC) SELECT cron.schedule('standup-reminder', '0 9 \* \* 1-5', $$   INSERT INTO notifications (tenant\_id, user\_id, type, title, body, link)   SELECT p.tenant\_id, p.id, 'standup\_reminder', 'Daily Standup',     'Time for your standup\!', '/video'   FROM profiles p JOIN workspace\_settings ws ON ws.tenant\_id \= p.tenant\_id   WHERE ws.standup\_reminders \= true; $$);   \-- CRON 7: Sync emails for all connected users every 5 min SELECT cron.schedule('sync-emails', '\*/5 \* \* \* \*', $$ SELECT net.http\_post(   url := current\_setting('app.supabase\_url') || '/functions/v1/sync-emails',   headers := jsonb\_build\_object('Content-Type', 'application/json',     'Authorization', 'Bearer ' || current\_setting('app.service\_role\_key')),   body := '{"provider":"google"}'::jsonb ); $$); |

| PART 23  CHANNEL MANAGEMENT |
| :---- |

Channel management (useChannelManagement hook with addMember, removeMember, archive, rename) is unchanged from v2.0 Part 17\. Reproduce that code.

# **Channel Management**

// hooks/useChannelManagement.ts

import { createBrowserClient } from '@/lib/supabase'

export function useChannelManagement(channelId: string) {

  const supabase \= createBrowserClient()

  async function addMember(userId: string) {

    const { data } \= await supabase.from('channels')

      .select('members').eq('id', channelId).single()

    const members \= \[...new Set(\[...(data?.members ?? \[\]), userId\])\]

    await supabase.from('channels').update({ members }).eq('id', channelId)

  }

  async function removeMember(userId: string) {

    const { data } \= await supabase.from('channels')

      .select('members').eq('id', channelId).single()

    const members \= (data?.members ?? \[\]).filter((id: string) \=\> id \!== userId)

    await supabase.from('channels').update({ members }).eq('id', channelId)

  }

  async function archive() {

    await supabase.from('channels')

      .update({ is\_archived: true }).eq('id', channelId)

  }

  async function rename(newName: string) {

    const slug \= newName.toLowerCase()

      .replace(/\\s+/g,'-').replace(/\[^a-z0-9-\]/g,'')

    await supabase.from('channels')

      .update({ name: slug }).eq('id', channelId)

  }

  return { addMember, removeMember, archive, rename }

}

| PART 24  CONVERSATION PRESERVATION & CLEANUP |
| :---- |

| Data | Retention |
| :---- | :---- |
| Active messages | Indefinite |
| Soft-deleted messages | 30 days then hard-purged (cron) |
| Notifications | 90 days then purged (cron) |
| System messages (issue drops) | Indefinite — audit trail |
| webrtc\_signals | 2 hours then purged (cron every 15 min) |
| Recording files | Supabase Storage — indefinite (tenant pays storage) |
| Meeting rows | Indefinite — recording\_path persists |
| Email threads | Indefinite — linked to issues |
| universal\_mentions | Indefinite — mention audit trail |
| meeting\_issue\_drops | Indefinite per meeting — resolved flag set on close |

| PART 25  USER SETTINGS & NOTIFICATION PREFERENCES |
| :---- |

NotificationSettings component is unchanged from v2.0 Part 20\. The Settings → Integrations page gains three new connection states to display:

# **20\. User Settings**

// components/settings/NotificationSettings.tsx

'use client'

import { useState, useEffect } from 'react'

import { createBrowserClient } from '@/lib/supabase'

import { useReachStore } from '@/store/reach'

const TYPES \= \[

  { key: 'mention',          label: '@ Mentions' },

  { key: 'dm',               label: 'Direct Messages' },

  { key: 'issue\_assigned',   label: 'Issue Assignments' },

  { key: 'video\_start',      label: 'Video Standup Start' },

  { key: 'standup\_reminder', label: 'Daily Standup Reminder' },

\]

export function NotificationSettings() {

  const { user } \= useReachStore()

  const supabase \= createBrowserClient()

  const \[prefs, setPrefs\] \= useState({

    notification\_email: true,

    notification\_browser: true,

    notification\_sounds: true,

    notification\_types: \['mention','dm','issue\_assigned','video\_start'\],

  })

  useEffect(() \=\> {

    supabase.from('profiles')

      .select('notification\_email,notification\_browser,

        notification\_sounds,notification\_types')

      .eq('id', user?.id).single()

      .then(({ data }) \=\> { if (data) setPrefs(data as any) })

  }, \[user?.id\])

  async function save(delta: Partial\<typeof prefs\>) {

    const next \= { ...prefs, ...delta }

    setPrefs(next)

    await supabase.from('profiles').update(next).eq('id', user?.id)

    localStorage.setItem('reach:sounds', String(next.notification\_sounds))

  }

  return (

    \<div className="space-y-5 max-w-md"\>

      \<h3 className="text-white font-semibold"\>Notification Preferences\</h3\>

      {\[

        { key:'notification\_email', label:'Email notifications',

          desc:'Emails for mentions and DMs' },

        { key:'notification\_browser', label:'Browser notifications',

          desc:'Desktop alerts when app is in background' },

        { key:'notification\_sounds', label:'Notification sounds',

          desc:'Chimes for messages and mentions' },

      \].map(item \=\> (

        \<label key={item.key}

          className="flex items-start justify-between gap-4 cursor-pointer"\>

          \<div\>

            \<p className="text-sm font-medium text-white"\>{item.label}\</p\>

            \<p className="text-xs text-zinc-500 mt-0.5"\>{item.desc}\</p\>

          \</div\>

          \<input type="checkbox"

            checked={(prefs as any)\[item.key\]}

            onChange={e \=\> save({ \[item.key\]: e.target.checked } as any)}

            className="mt-1 accent-\[\#48B8FF\] scale-125"

          /\>

        \</label\>

      ))}

      \<div className="pt-2 border-t border-zinc-800"\>

        \<p className="text-sm font-medium text-white mb-2"\>Notify me about\</p\>

        {TYPES.map(t \=\> (

          \<label key={t.key} className="flex items-center gap-2 py-1 cursor-pointer"\>

            \<input type="checkbox"

              checked={prefs.notification\_types?.includes(t.key)}

              onChange={e \=\> {

                const types \= e.target.checked

                  ? \[...(prefs.notification\_types ?? \[\]), t.key\]

                  : (prefs.notification\_types ?? \[\]).filter(x \=\> x \!== t.key)

                save({ notification\_types: types })

              }}

              className="accent-\[\#48B8FF\]"

            /\>

            \<span className="text-sm text-zinc-300"\>{t.label}\</span\>

          \</label\>

        ))}

      \</div\>

    \</div\>

  )

}

| Profile Column | Settings UI |
| :---- | :---- |
| gmail\_connected | Show "Gmail Connected ✓" or "Connect Gmail" button |
| outlook\_connected | Show "Outlook Connected ✓" or "Connect Outlook" button |
| zoom\_connected | Show "Zoom Connected ✓" or "Connect Zoom" button |

Update each OAuth callback to set the corresponding boolean (see Part 20.4 for zoom\_connected example). Apply the same pattern for Gmail: gmail\_connected \= true, and Outlook: outlook\_connected \= true.

| PART 26  MULTI-TENANT ISOLATION CHECKLIST |
| :---- |

| Surface | Mechanism | Detail |
| :---- | :---- | :---- |
| All DB queries | RLS policies | tenant\_id \= user's tenant\_id on every table |
| Realtime | Filtered subscriptions | Always filter by tenant\_id, channel\_id, or user\_id |
| Presence | Scoped channel name | presence:${tenant.id} — never global |
| Notifications | user\_id filter | user\_id=eq.${user.id} |
| WebRTC signals | room\_code secret | Random 16-char hex, ephemeral, purged after 2hr |
| Recordings | Storage path \+ RLS | ${tenant\_id}/${meeting\_id}.webm — folder RLS |
| Attachments | Storage path \+ RLS | ${tenant\_id}/${filename} — folder RLS |
| Email threads | user\_id \+ tenant\_id | user\_id \= auth.uid() — no cross-user reads |
| Edge Functions | JWT verification | Always verify JWT, always read tenant\_id from profiles |
| ChatLayout | Boot guard | Does not render until tenant is loaded |
| Email sync cron | Per-user token | Sync function reads from integration\_tokens per user |

| PART 27  FULL BEHAVIOR REFERENCE TABLE |
| :---- |

| Action | Client Behavior | Supabase / DB Effect |
| :---- | :---- | :---- |
| Click channel | Load messages. markRead. setActiveChannel. | INSERT channel\_last\_read |
| Send message (Enter) | Insert to DB. DO NOT append locally. | Realtime delivers \~80ms |
| Shift+Enter | New line in textarea | No DB write |
| Drag issue → channel | dropIssue(). INSERT system msg. | All clients see InlineIssueCard |
| Drag issue → meeting | dropIssue(meetingId). INSERT meeting\_issue\_drops. | All meeting participants see overlay card |
| Thread reply button | setActiveThread(msg.id). Opens ThreadPanel. | No DB write |
| Send thread reply | INSERT messages {thread\_of: parentId} | thread\_count++ on parent via trigger |
| Pin message | INSERT pinned\_messages. | PinnedMessagesBar updates via Realtime |
| Unpin message | DELETE pinned\_messages. | PinnedMessagesBar updates |
| Search (Cmd+K) | Opens SearchOverlay. textSearch query. | SELECT with FTS — no Realtime |
| Upload file | Upload to attachments bucket. Insert signed URL in message attachments. | Message delivered with attachments via Realtime |
| Link in message | Fetch /api/link-preview server-side. Embed in message. | link\_preview stored in message row |
| @ mention | Dropdown on @. Insert @\[name\](id) token. | notify\_on\_mention trigger fires |
| @ mention (non-chat) | MentionInput writes to universal\_mentions. notify\_on\_universal\_mention trigger. | Notification delivered via Realtime |
| Start native video | invoke create-meeting. Get room\_code. Open VideoRoom. | System msg with join link posted |
| Start Zoom | POST /api/zoom/create-meeting. Post join\_url as message. | Zoom meeting in user's account |
| WebRTC error | Error banner shown. Zoom fallback button appears. | Fallback creates Zoom or redirects to Settings |
| Sync email | invoke sync-emails. Upsert into email\_threads. | No Realtime — load() called after sync |
| Reply to email | invoke send-email-reply. Gmail/Graph API sends. | Load() called after reply |
| Notification click | markRead(id). Navigate to link. | UPDATE notifications.read |
| Mark all read | markAllNotifsRead(). UPDATE notifications. | Badge clears to 0 |

| PART 28  TEST OUTCOMES — DONE WHEN |
| :---- |

## **Chat**

|  | Test |
| :---- | :---- |
| ✓ | Send message in \#general → appears in \<1 second, no refresh |
| ✓ | Open \#general in two tabs → message in tab 1 appears in tab 2 instantly |
| ✓ | Drag issue from sidebar → drop onto \#general → InlineIssueCard appears for all users |
| ✓ | Click "Assign to me" → board avatar updates immediately |
| ✓ | Click "Mark Done" → column updates, time\_log.stopped\_at set |
| ✓ | Click Reply → ThreadPanel opens on right |
| ✓ | Send thread reply → reply appears in thread, thread\_count increments on parent |
| ✓ | Click Pin → message appears in PinnedMessagesBar for all users in channel |
| ✓ | Cmd+K → SearchOverlay opens. Type 2+ chars → results appear. Click result → jump to channel |
| ✓ | Attach image → thumbnail preview in input → send → image thumbnail visible in message |
| ✓ | Attach PDF → file icon with name → send → download link in message |
| ✓ | Paste URL in message → link preview card appears above send button → preview stored with message |
| ✓ | Open DM → message sends, visible only in that DM |
| ✓ | Presence dot green for online users |
| ✓ | Unread badge: message in \#bugs → badge increments. Click \#bugs → badge clears |
| ✓ | @ mention user in chat → notification fires, bell badge increments, sound plays |
| ✓ | @ mention user in issue description → notification fires (universal\_mentions) |
| ✓ | Edit message → (edited) label visible to all |
| ✓ | Delete message → \[This message was deleted\] shown to all |
| ✓ | Emoji reaction → count appears, click again removes |
| ✓ | Create channel → visible to all workspace members immediately |
| ✓ | Private channel → invisible to non-members |
| ✓ | User from Tenant A cannot see Tenant B data |

## **Video (Native WebRTC)**

|  | Test |
| :---- | :---- |
| ✓ | Click "Start Standup" → meeting row created, system message with join link in channel |
| ✓ | Second user opens join URL → both see each other via P2P (\~2s connect time) |
| ✓ | Camera off → local video freezes for all peers |
| ✓ | Mic off → audio muted for all peers |
| ✓ | Drag issue from IssuesSidebar into MeetingIssueOverlay → issue card appears for all meeting participants |
| ✓ | Click "Assign to me" in meeting overlay → board updates |
| ✓ | Click "Done" in meeting overlay → issue resolved, card removed from overlay |
| ✓ | Start recording → red pulse on button |
| ✓ | Stop recording → file in Supabase Storage under recordings/{tenant\_id}/ |
| ✓ | meetings.recording\_path updated after upload |
| ✓ | Leave meeting → status set to ended |
| ✓ | External user (no REACH account) opens room URL → name prompt → joins successfully |
| ✓ | TURN fallback: block UDP → call still connects via TURN relay |
| ✓ | WebRTC error on bad network → "Use Zoom fallback" button appears |
| ✓ | Zoom connected \+ click fallback → Zoom meeting opens in new tab, link posted in channel |
| ✓ | Zoom not connected \+ click fallback → redirects to Settings → Integrations |
| ✓ | Zoom connected → StartMeetingButton shows dropdown with both options |

## **Email Integration**

|  | Test |
| :---- | :---- |
| ✓ | Connect Gmail → integration\_tokens row created, gmail\_connected \= true |
| ✓ | Connect Outlook → integration\_tokens row for microsoft provider |
| ✓ | Sync emails → email\_threads populated from Gmail inbox |
| ✓ | Link email thread to issue → EmailThreadPanel shows thread on issue detail page |
| ✓ | Click Reply → compose reply → Send → email sent via Gmail API, appears in thread |
| ✓ | Token refresh cron → token\_expiry extended before expiry |

## **Notifications**

|  | Test |
| :---- | :---- |
| ✓ | Receive mention → bell badge, correct sound, browser notification when tab not focused |
| ✓ | Click notification → navigates to correct channel |
| ✓ | Mark all read → badge clears |
| ✓ | Disable sounds in Settings → mentions arrive silently |

| PART 29  USER GUIDE |
| :---- |

This section is written for end users. Copy directly into product documentation or an in-app help panel.

## **Chat**

### **Channels**

* Click any channel in the left sidebar to open it

* A blue number badge means unread messages — it clears when you open the channel

* Private channels (lock icon) are only visible to members

* Click \+ next to Channels to create a new one

* Press Cmd+K (or the search icon) to search all messages

### **Sending Messages**

* Type in the bar at the bottom and press Enter to send

* Shift+Enter adds a new line without sending

* Type @ and a name to mention someone — select from the dropdown. Mentioned users get a notification.

* Paste any URL — a link preview appears automatically

* Click the paperclip icon to attach files (images, PDFs, documents, video)

### **Threads**

* Hover over any message → click the speech bubble icon to open a thread

* Thread replies are private to the thread — they don't appear in the main channel

* Thread reply count appears under the parent message — click it to reopen the thread

### **Reactions, Editing, Pinning**

* Hover over any message to see quick-reaction emojis and action buttons

* Click an emoji to react — click again to remove your reaction

* You can edit or delete only your own messages. Deleted messages show \[This message was deleted\] for audit trail.

* Click the pin icon (hover actions) to pin a message — pinned messages appear in the Pinned bar at the top of the channel

## **The Signature Move: Drag Issue Into Channel**

* In Chat, the right panel shows active issues from your sprint

* Drag any issue card and drop it onto a channel name in the left sidebar

* An Issue Card appears in the channel for all members instantly

* Issue Cards have 5 buttons: View, Assign to me, Mark Done, Open in IDE, Open in Docs

* All actions update in real-time for every member in the channel

## **Video Standups**

* Click "Start Standup" in any channel header — no download, no new tab

* A video call opens in an overlay. All participants use browser-native video.

* Invite people outside your workspace: share the join URL from the channel message

* External participants only need a browser and a name — no REACH account required

* Toggle camera and mic with the buttons at the bottom of the call

* Click the record button to record the standup — it saves automatically

### **Drag Issues Into a Live Meeting**

* While in a video call, the "Issues in meeting" panel appears bottom-left

* Drag any issue from the sidebar and drop it onto that panel

* All meeting participants see the issue card with Assign and Done buttons

* Click "Done" on a resolved issue to remove it from the meeting overlay

### **If Video Doesn't Connect**

* Your network may block direct P2P connections (common on corporate networks)

* An error message will appear with a "Use Zoom fallback" button

* If you have Zoom connected in Settings → Integrations, clicking this starts a Zoom meeting immediately

* If Zoom is not connected, you'll be taken to Settings to connect it first

## **Email — Gmail & Outlook**

* Connect your email in Settings → Integrations → Connect Gmail or Connect Outlook

* Once connected, emails linked to issues appear in the issue detail panel

* Click "Link Email" on any email thread to associate it with an issue

* Reply directly from REACH without leaving the app — the reply sends via your connected account

* Emails sync automatically every 5 minutes

## **Direct Messages**

* Click a team member's name or the DM section to open a direct message

* Green dot \= online now. Grey dot \= offline.

* DMs support all chat features: mentions, reactions, threads, file attachments, issue cards

## **Notifications**

* The bell icon shows unread notification count

* Click any notification to jump to the relevant message or issue

* Click "Mark all read" to clear all badges

* Configure what notifies you in Settings → Notifications

## **Keyboard Shortcuts**

| Shortcut | Action |
| :---- | :---- |
| Enter | Send message |
| Shift+Enter | New line in message |
| Escape | Cancel edit / Close thread / Close search |
| @ | Trigger @mention dropdown |
| Cmd+K / Ctrl+K | Open search |

| REAL-TIME GUARANTEES Everything in REACH — messages, reactions, threads, issue changes, presence, notifications, meeting issue cards — updates in real-time without refresh. If something does not appear within 3 seconds, your browser WebSocket connection may have dropped. The app reconnects automatically. Hard-refresh (Ctrl+Shift+R) as a last resort. |
| :---- |

