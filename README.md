# EACH - Unified Developer Platform

A full-stack project management + IDE + chat + docs platform built with React, TypeScript, Supabase, and Monaco Editor.

## Architecture

```text
reach-portal/
|- apps/web/          <- Main SPA (Vite + React 19 + Tailwind v4)
|- apps/storybook/    <- Component library (planned)
|- apps/mobile/       <- Mobile shell (planned)
|- packages/          <- Shared libraries (ui, auth, api-client, etc.)
|- infra/             <- Docker, K8s, Terraform (planned)
`- tools/             <- DB migrations, codegen
```

## Modules

| Module | Path | Description |
|---|---|---|
| PM Board | `/board/:id` | Scrum/Kanban/Table/Chart views, sprints, issues, drag-drop |
| IDE | `/ide` | Monaco editor, Git panel, terminal, file tree, floating windows |
| Chat | `/chat` | Team messaging via CometChat + AI assistant (OpenRouter BYOK) |
| Docs | `/docs` | TipTap rich-text editor, knowledge base |
| Admin | `/admin` | User/role management, workspace settings |

## Prerequisites

- Node.js >= 18 (tested with v24)
- npm or pnpm
- A Supabase project (free tier works)
- (Optional) OpenRouter API key for AI chat

## Quick Start

```bash
# 1. Clone
git clone https://github.com/managekube-hue/REACH.git
cd REACH/reach-portal/apps/web

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your Supabase URL + anon key

# 4. Run database migrations (creates tables)
node ../../scripts/create-tables.cjs

# 5. Start dev server
npx vite dev --host
# -> http://localhost:5173
```

## Environment Variables

Create a `.env` file in `apps/web/`:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Build for Production

```bash
cd reach-portal/apps/web
npx vite build          # Output -> dist/
npx vite preview        # Preview production build
```

## Deploy

The `dist/` folder is a static SPA. Deploy to:

- Vercel: `npx vercel --prod`
- Netlify: drag-drop `dist/` folder
- Docker: use `infra/docker/` Dockerfile (planned)

## Stack

| Layer | Technology |
|---|---|
| Framework | React 19.2 + TypeScript 5.9 |
| Build | Vite 8.0 (beta) |
| Styling | Tailwind CSS v4.2 |
| State | Zustand (persisted) |
| Database | Supabase (PostgreSQL + Realtime) |
| Editor | Monaco Editor (`@monaco-editor/react`) |
| Tables | TanStack Table v8 |
| Charts | Recharts |
| DnD | `@dnd-kit/core` + sortable |
| Rich Text | TipTap |
| Git | `isomorphic-git` + `lightning-fs` |
| Chat | CometChat SDK + OpenRouter AI |
| Icons | Lucide React |

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+B | Toggle sidebar |
| Ctrl+K | Focus search |
| Ctrl+J | Toggle AI chat |
| Ctrl+/ | Toggle terminal |
| Ctrl+Shift+E | File tree |
| Ctrl+Shift+G | Git panel |
| Ctrl+Shift+F | Filter bar |
| ? | Shortcut help |

## License

Private - All rights reserved.
