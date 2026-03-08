# ?? REACH: Northstar Mastery Plan
**"Everything is an issue. Everything flows from issues. Everything reports back to issues."**

## ?? The Vision
REACH is not a task tracker. It is a live-action **Nervous System** for software development where every code modification, chat message, and real-time cursor presence is intrinsically bound to a core primitive: the **Issue**.

We are competing against fragmented context:
- Linear is fast, but it is just a static row.
- Jira is robust, but it is bloated and disjointed.
- GitHub is code-native, but it is PR-centric, not PM-centric.

REACH bridges the gap by making the **Issue the integration hub.**

### The 3 Anchor Pillars
1. **WORK** (Get things done): Sprint Board, My Tasks, Backlog, Roadmap, Code & PRs, Shapes
2. **INSIGHTS** (Understand and improve): EVM Analytics, Velocity, CPI/SPI, Dashboards, Live Risk Registers
3. **STRUCTURE** (Configure and manage): WBS Projects, Members, RBAC, Tags, External Stakeholders

---

## ??? The Roadmap to Execution (TODO PLAN)

### Phase 1: The Primitive Layer Database Engine (? Completed)
- [x] Blow up the fragmented legacy schemas.
- [x] Establish the Atomic `issues` table as the anchor.
- [x] Create resilient `comm_conversations` and `target_issue_id` bridging.
- [x] Wire robust Database RPC `comm_set_presence` (RIP 400 Edge loops).
- [x] Set up Supabase Realtime broadcast channels.

### Phase 2: The UI Scaffolding & Design System Hookups (?? In Progress)
- [x] Establish dark/light theme standard variables mapped to industry identifiers.
- [x] Configure `.jsx` interoperability in TSConfig.
- [ ] Inject raw Figma `.jsx` exports `ReachShell.jsx` and `ReachIDE.jsx` into `src/figma-exports/`.
- [ ] Connect the UI views to routing (Dashboard, IDE, Video Standups). 

### Phase 3: The WebRTC Standup Engine
- [x] Scaffold standard `useWebRTC.ts` hooks focusing on Free Google STUNs.
- [ ] Connect `useWebRTC.ts` to Supabase Realtime Signaling.
    - *When User A joins `meeting-RC-001`, broadcast connection offer.*
    - *When User B receives, return ICE Candidate Answer.*
- [ ] Mount video streams to the new UI grid. 
- [ ] Wire the "Pre-fill Standup notes" directly to active sprint issues.

### Phase 4: IDE and Monaco Intelligence
- [ ] Connect `ReachIDE.jsx` to live Monaco editor instances via `@monaco-editor/react`.
- [ ] Wire `useIssuePresence.ts` to broadcast cursor line position using Supabase Channel `issue:K-COR-001:presence`.
- [ ] Build the real-time AI Chat Context Window (feeding it the actual loaded file + active plan step).

### Phase 5: The Analytics Rollup
- [ ] Generate aggregated EV (Earned Value) calculations natively via Postgres Views.
- [ ] Feed real-time Velocity, CPI, SPI metrics into the Dashboard UI.
- [ ] Render Burn-down SVGs automatically using `issues` timestamp deltas.

---

## ??? Core Rules to Protect the Architecture
1. **Never mutate State without an Issue ID**. If a chat message is sent, what issue does it belong to?
2. **Never poll the server.** Push everything through Realtime Subscriptions or HTTP RPC inserts.
3. **Avoid monolithic React files**. Keep Figma exports pure and dumb, wrap them with Smart Hooks in `src/pages`. 

*This document is the absolute blueprint. All subsequent edits and feature additions MUST abide by the architecture above.*