import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/*
 ██████╗ ███████╗ █████╗  ██████╗██╗  ██╗
 ██╔══██╗██╔════╝██╔══██╗██╔════╝██║  ██║
 ██████╔╝█████╗  ███████║██║     ███████║
 ██╔══██╗██╔══╝  ██╔══██║██║     ██╔══██║
 ██║  ██║███████╗██║  ██║╚██████╗██║  ██║
 ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝
 
 Unified Development Platform
 Issue-first. Thread-driven. Every surface connected.
 
 Design language: Precision-dark / Warm-light
 The issue is not a row. It is the thread.
*/

/* ─── FONT INJECTION ──────────────────────────────────────── */
const injectFonts = () => {
  if (document.getElementById("reach-fonts")) return;
  const link = document.createElement("link");
  link.id = "reach-fonts";
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,400&family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&display=swap";
  document.head.appendChild(link);
};

/* ─── THEME ───────────────────────────────────────────────── */
const THEMES = {
  dark: {
    bg: "#080809",
    surface: "#0E0E10",
    surface2: "#141416",
    surface3: "#1A1A1D",
    surface4: "#202024",
    border: "#222226",
    borderStrong: "#2E2E34",
    text: "#EEEEF2",
    textSub: "#9898A8",
    textMuted: "#54545E",
    accent: "#3ECFCF",
    accentWarm: "#E8965A",
    accentPurple: "#8B7CF8",
    danger: "#F26B6B",
    success: "#3EC98E",
    warn: "#E8C25A",
    glow: "rgba(62,207,207,0.12)",
    glowWarm: "rgba(232,150,90,0.10)",
    threadLine: "#222226",
  },
  light: {
    bg: "#FFFFFF",
    surface: "#FFFFFF",
    surface2: "#F7F7F8",
    surface3: "#EFEFEF",
    surface4: "#E5E5E7",
    border: "#E5E5E7",
    borderStrong: "#CBCBCE",
    text: "#111111",
    textSub: "#555560",
    textMuted: "#9999A8",
    accent: "#0D8A8A",
    accentWarm: "#C4622A",
    accentPurple: "#5B4CC0",
    danger: "#C0392B",
    success: "#1D8A5E",
    warn: "#B8860B",
    glow: "rgba(13,138,138,0.07)",
    glowWarm: "rgba(196,98,42,0.07)",
    threadLine: "#E5E5E7",
  }
};

/* ─── MOCK DATA ───────────────────────────────────────────── */
const USERS = {
  u1: { id:"u1", name:"Alex Chen",    initials:"AC", hue:"#3ECFCF", role:"admin",  status:"active" },
  u2: { id:"u2", name:"Jordan Dale",  initials:"JD", hue:"#8B7CF8", role:"member", status:"active" },
  u3: { id:"u3", name:"Sam Kim",      initials:"SK", hue:"#3EC98E", role:"member", status:"away"   },
  u4: { id:"u4", name:"Priya Nair",   initials:"PN", hue:"#E8C25A", role:"guest",  status:"offline"},
};
const ME = USERS.u1;

const ISSUES = [
  {
    id:"RC-001", title:"Auth token refresh race condition",
    status:"in_progress", priority:"critical", points:5,
    assignee:"u1", reporter:"u2", sprint:"S12", planStep:"3c",
    branch:"fix/auth-refresh", tags:["auth","backend"],
    chatCount:7, docLinked:true, prLinked:true,
    created:"2026-03-01", updated:"2026-03-09",
    description:"Fix the promise-queue race where simultaneous 401s cause duplicate refresh calls. Affects all API modules in high-concurrency sessions.",
    acceptance:["No duplicate refresh fires simultaneously","Queued requests resolve after single refresh","401 recovery across all API modules","Zero regression in auth flow tests"],
    timeLogged: 6.5,
    crmContext:{ account:"Northstar Labs", deal:"Platform Expansion $24k", health:"at-risk" },
    thread:[
      { type:"created",   actor:"u2", ts:"Mar 1, 09:00", body:"Issue created from customer report #NL-2291" },
      { type:"comment",   actor:"u1", ts:"Mar 1, 09:45", body:"Reproducing in staging. The interceptor chain fires before the first refresh promise resolves." },
      { type:"mentioned", actor:"u2", ts:"Mar 3, 10:12", body:"@AC @SK — need eyes on this. NL is seeing 5–10 logouts/day.", mentions:["u1","u3"] },
      { type:"commit",    actor:"u1", ts:"Mar 5, 14:30", body:"feat: add refreshPromise lock · fix/auth-refresh · 3 files changed" },
      { type:"pr",        actor:"u1", ts:"Mar 7, 11:00", body:"PR #42 opened · fix/auth-refresh → main · CI passing" },
      { type:"review",    actor:"u2", ts:"Mar 8, 09:20", body:"Approved with minor suggestions. Promise finally() looks correct." },
      { type:"comment",   actor:"u3", ts:"Mar 9, 08:44", body:"@AC one edge case: network error during refresh still clears the lock. Add toast in catch layer." },
    ]
  },
  {
    id:"RC-002", title:"Dashboard widget lazy loading",
    status:"todo", priority:"high", points:3,
    assignee:"u2", reporter:"u1", sprint:"S12", planStep:"3d",
    branch:null, tags:["frontend","perf"],
    chatCount:1, docLinked:false, prLinked:false,
    created:"2026-03-02", updated:"2026-03-07",
    description:"Defer non-critical dashboard widgets until after first paint. Target: <1.8s LCP.",
    acceptance:["LCP under 1.8s on slow 3G","Charts render below the fold","No layout shift"],
    timeLogged:0,
    crmContext: null,
    thread:[
      { type:"created",   actor:"u1", ts:"Mar 2, 10:00", body:"Issue created — performance audit flagged LCP at 3.2s" },
    ]
  },
  {
    id:"RC-003", title:"Time tracker trigger optimization",
    status:"review", priority:"medium", points:2,
    assignee:"u1", reporter:"u3", sprint:"S12", planStep:"3e",
    branch:"perf/time-trigger", tags:["db","perf"],
    chatCount:2, docLinked:false, prLinked:true,
    created:"2026-03-03", updated:"2026-03-09",
    description:"Postgres trigger fires on every issue UPDATE even when status hasn't changed. Add OLD.status != NEW.status guard.",
    acceptance:["Trigger only fires on status change","Query time < 2ms","Zero data loss"],
    timeLogged: 3,
    crmContext:null,
    thread:[
      { type:"created", actor:"u3", ts:"Mar 3, 11:00", body:"Spotted this in slow query log. 40% of triggers are no-ops." },
      { type:"commit",  actor:"u1", ts:"Mar 7, 16:00", body:"perf: add status guard to trigger · perf/time-trigger" },
    ]
  },
  {
    id:"RC-004", title:"CRM pipeline drag-and-drop",
    status:"todo", priority:"high", points:5,
    assignee:"u3", reporter:"u1", sprint:"S12", planStep:"3f",
    branch:null, tags:["frontend","crm"],
    chatCount:0, docLinked:false, prLinked:false,
    created:"2026-03-04", updated:"2026-03-04",
    description:"Implement HTML5 drag-and-drop for deal stage advancement. Optimistic update with rollback on error.",
    acceptance:["Drag between stages with optimistic update","Rollback on Supabase error","Mobile touch support"],
    timeLogged:0,
    crmContext: null,
    thread:[
      { type:"created", actor:"u1", ts:"Mar 4, 09:00", body:"CRM v1 milestone: pipeline must be drag-operable at launch." },
    ]
  },
  {
    id:"RC-008", title:"CRDT offline queue implementation",
    status:"review", priority:"critical", points:13,
    assignee:"u2", reporter:"u1", sprint:"S12", planStep:"5.1",
    branch:"feat/offline-crdt", tags:["offline","arch"],
    chatCount:8, docLinked:true, prLinked:true,
    created:"2026-02-25", updated:"2026-03-09",
    description:"Implement local-first CRDT log with localStorage persistence, sync badge, and conflict resolution.",
    acceptance:["Issues editable offline","Queue drains on reconnect","Conflict resolution UI"],
    timeLogged:18,
    crmContext:null,
    thread:[
      { type:"created", actor:"u1", ts:"Feb 25, 09:00", body:"Core architecture requirement. No ship without it." },
      { type:"comment", actor:"u2", ts:"Mar 1, 14:00", body:"Using Automerge. Initial impl working in isolation." },
      { type:"commit",  actor:"u2", ts:"Mar 5, 17:30", body:"feat: CRDT log + localStorage persistence · 14 files" },
      { type:"pr",      actor:"u2", ts:"Mar 8, 10:00", body:"PR #43 opened · feat/offline-crdt → main · CI pending" },
    ]
  },
];

const CHANNELS = [
  { id:"c1", name:"general",     unread:3, type:"public" },
  { id:"c2", name:"reach-core",  unread:0, type:"public" },
  { id:"c3", name:"design",      unread:1, type:"public" },
  { id:"c4", name:"Jordan Dale", unread:2, type:"dm", user:"u2" },
];

const MSGS = {
  c1:[
    { id:"m1", author:"u2", body:"RC-003 is in review. Trigger opt dropped query time 40%.", ts:"09:42", ref:"RC-003" },
    { id:"m2", author:"u1", body:"Solid. On RC-001 — need the token spec closed out before I can merge.", ts:"09:44" },
    { id:"m3", author:"u3", body:"@AC @JD — Northstar escalating. They're seeing 8 logouts today. RC-001 needs to ship.", ts:"09:51", mentions:["u1","u2"], urgent:true },
    { id:"m4", author:"system", body:"RC-001 status → In Progress · Alex Chen · 10:02 AM", ts:"10:02", ref:"RC-001" },
    { id:"m5", author:"u2", body:"RC-008 is in review. CRDT impl was a beast. Queue + conflict UI both working.", ts:"10:15", ref:"RC-008" },
  ],
  c2:[
    { id:"m6", author:"u1", body:"Sprint target: 24pts. We're at 18 done. RC-001 + RC-003 close us out.", ts:"08:30" },
    { id:"m7", author:"u3", body:"RC-003 closes today. On it.", ts:"08:45" },
  ],
  c4:[
    { id:"m8", author:"u2", body:"Can you look at the CRDT PR when you get a sec?", ts:"Yesterday" },
    { id:"m9", author:"u1", body:"In queue. Tomorrow morning.", ts:"Yesterday" },
  ]
};

const SPRINT = { name:"Sprint 12", goal:"Ship auth overhaul + CRDT + CRM v1", start:"Mar 1", end:"Mar 14", pointsDone:18, pointsTotal:24 };

const CRM_ACCOUNTS = [
  { id:"a1", name:"Northstar Labs",  arr:24000,  health:"at-risk",  openIssues:4, renewal:"Jun 2026", tier:"Business",   contacts:2 },
  { id:"a2", name:"Apex Ventures",   arr:48000,  health:"healthy",  openIssues:1, renewal:"Dec 2026", tier:"Enterprise", contacts:3 },
  { id:"a3", name:"Cascade Systems", arr:120000, health:"healthy",  openIssues:0, renewal:"Jan 2027", tier:"Enterprise", contacts:7 },
  { id:"a4", name:"Orbit Protocol",  arr:9600,   health:"healthy",  openIssues:2, renewal:"Sep 2026", tier:"Startup",    contacts:1 },
];

const CRM_PIPELINE = {
  prospect:    [{ id:"d1", title:"Meridian AI",  value:36000, prob:20, account:"Meridian AI",   owner:"u1", close:"Jun 1" }],
  qualified:   [{ id:"d2", title:"Vertex Corp",  value:12000, prob:40, account:"Vertex Corp",   owner:"u3", close:"Apr 15" }],
  proposal:    [{ id:"d3", title:"Synapse Labs", value:48000, prob:65, account:"Synapse Labs",  owner:"u1", close:"Apr 1" }],
  negotiation: [{ id:"d4", title:"BlueField",    value:120000, prob:80, account:"BlueField Tech", owner:"u2", close:"Mar 25" }],
  won:  [],
  lost: [],
};

const CAP = [
  { name:"Alex Chen",      type:"founder",  shares:2500000, cls:"Common",      pct:25.0, vesting:"48m/12m cliff" },
  { name:"Jordan Dale",    type:"founder",  shares:2000000, cls:"Common",      pct:20.0, vesting:"48m/12m cliff" },
  { name:"Apex Ventures",  type:"investor", shares:3000000, cls:"Series A",    pct:30.0, vesting:null },
  { name:"Option Pool",    type:"pool",     shares:1500000, cls:"ISO Options", pct:15.0, vesting:"Various" },
  { name:"Sam Kim",        type:"employee", shares:150000,  cls:"ISO Options", pct:1.5,  vesting:"48m/12m cliff" },
];

/* ─── ICONS ──────────────────────────────────────────────── */
const ICON_PATHS = {
  home:"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
  layers:"M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  git:"M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9",
  book:"M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 004 17V4.5A2.5 2.5 0 016.5 2H20v20H6.5",
  chat:"M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z",
  video:"M23 7l-7 5 7 5V7zM1 5h15v14H1z",
  bar:"M18 20V10M12 20V4M6 20v-6",
  users:"M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  pie:"M21.21 15.89A10 10 0 118 2.83M22 12A10 10 0 0012 2v10z",
  brief:"M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2",
  clock:"M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2",
  dollar:"M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
  cog:"M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  plus:"M12 5v14M5 12h14",
  x:"M18 6L6 18M6 6l12 12",
  check:"M20 6L9 17l-5-5",
  chevD:"M6 9l6 6 6-6",
  chevR:"M9 18l6-6-6-6",
  chevL:"M15 18l-6-6 6-6",
  search:"M11 17a6 6 0 100-12 6 6 0 000 12zM21 21l-4.35-4.35",
  bell:"M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  sun:"M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42",
  moon:"M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
  terminal:"M4 17l6-6-6-6M12 19h8",
  code:"M16 18l6-6-6-6M8 6L2 12l6 6",
  file:"M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z M14 2v6h6",
  folder:"M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z",
  send:"M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  link:"M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  edit:"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7 M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  pin:"M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M12 10a1 1 0 100-2 1 1 0 000 2z",
  alert:"M12 22a10 10 0 100-20 10 10 0 000 20zM12 8v4M12 16h.01",
  checkCircle:"M22 12a10 10 0 11-20 0 10 10 0 0120 0zM9 12l2 2 4-4",
  lock:"M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4",
  globe:"M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20",
  zap:"M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  map:"M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z M9 4v13M15 7v13",
  refresh:"M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15",
  more:"M5 12h.01M12 12h.01M19 12h.01",
  trend:"M23 6l-9.5 9.5-5-5L1 18M17 6h6v6",
  activity:"M22 12h-4l-3 9L9 3l-3 9H2",
  shield:"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  gitpr:"M18 15a3 3 0 100-6 3 3 0 000 6zM6 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM6 9v12M18 9A9 9 0 006 18",
  trash:"M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2",
  target:"M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z",
  pct:"M19 5L5 19M6.5 6.5h.01M17.5 17.5h.01",
  external:"M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3",
  copy:"M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9a2 2 0 00-2-2z M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1",
  at:"M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z",
  mic:"M12 1a3 3 0 013 3v8a3 3 0 01-6 0V4a3 3 0 013-3zM19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8",
  maximize:"M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3",
};

const Ico = ({ n, s=14, c="currentColor", style={} }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={style}>
    {(ICON_PATHS[n]||"").split("M").filter(Boolean).map((d,i)=>(
      <path key={i} d={"M"+d}/>
    ))}
  </svg>
);

/* ─── PRIORITY SYSTEM ─────────────────────────────────────── */
const PRIORITY = {
  critical: { label:"Critical", color:"#F26B6B", dot:"●" },
  high:     { label:"High",     color:"#E8965A", dot:"▲" },
  medium:   { label:"Medium",   color:"#3ECFCF", dot:"■" },
  low:      { label:"Low",      color:"#54545E", dot:"○" },
};

const STATUS = {
  todo:        { label:"Todo",        bg:"#222226", fg:"#9898A8" },
  in_progress: { label:"In Progress", bg:"rgba(62,207,207,0.12)", fg:"#3ECFCF" },
  review:      { label:"Review",      bg:"rgba(139,124,248,0.12)", fg:"#8B7CF8" },
  done:        { label:"Done",        bg:"rgba(62,201,142,0.12)", fg:"#3EC98E" },
};

/* ─── GLOBAL CSS ─────────────────────────────────────────── */
const CSS = (t) => `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body{height:100%;background:${t.bg};color:${t.text};font-family:'DM Mono',monospace;font-size:13px;-webkit-font-smoothing:antialiased;}
::-webkit-scrollbar{width:3px;height:3px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:${t.border};border-radius:2px;}
*{scrollbar-width:thin;scrollbar-color:${t.border} transparent;}
input,textarea,select,button{font-family:'DM Mono',monospace;outline:none;}
a{text-decoration:none;color:inherit;}

/* ── Type scale ── */
.brg{font-family:'Bricolage Grotesque',sans-serif;}
.mono{font-family:'DM Mono',monospace;}

/* ── Layout ── */
.app{display:flex;flex-direction:column;height:100vh;overflow:hidden;}
.app-body{display:flex;flex:1;overflow:hidden;}
.sidebar{width:228px;flex-shrink:0;background:${t.surface};border-right:1px solid ${t.border};display:flex;flex-direction:column;overflow:hidden;transition:width .2s;}
.sidebar.slim{width:52px;}
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}
.topbar{height:48px;background:${t.surface};border-bottom:1px solid ${t.border};display:flex;align-items:center;padding:0 20px;gap:10px;flex-shrink:0;}
.content{flex:1;overflow:auto;background:${t.bg};}

/* ── Nav ── */
.nav-sect{padding:10px 8px 2px;}
.nav-lbl{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:${t.textMuted};padding:0 10px;margin-bottom:4px;font-weight:600;}
.nav-item{display:flex;align-items:center;gap:9px;padding:6px 10px;border-radius:6px;color:${t.textSub};font-size:11.5px;cursor:pointer;user-select:none;transition:all .1s;position:relative;white-space:nowrap;overflow:hidden;}
.nav-item:hover{background:${t.surface2};color:${t.text};}
.nav-item.active{background:${t.glow};color:${t.accent};}
.nav-item .badge{margin-left:auto;background:${t.danger};color:#fff;font-size:9px;padding:1px 5px;border-radius:10px;font-weight:700;min-width:16px;text-align:center;flex-shrink:0;}

/* ── Buttons ── */
.btn{display:inline-flex;align-items:center;gap:6px;padding:6px 13px;border-radius:6px;font-size:11.5px;font-weight:500;border:none;cursor:pointer;white-space:nowrap;transition:all .12s;font-family:'DM Mono',monospace;}
.btn-p{background:${t.accent};color:${t.bg};}
.btn-p:hover{opacity:.88;}
.btn-g{background:transparent;color:${t.textSub};border:1px solid ${t.border};}
.btn-g:hover{background:${t.surface2};color:${t.text};border-color:${t.borderStrong};}
.btn-d{background:rgba(242,107,107,0.12);color:${t.danger};border:1px solid rgba(242,107,107,0.2);}
.btn-sm{padding:4px 9px;font-size:11px;}
.btn-xs{padding:2px 7px;font-size:10px;}
.btn-ico{padding:5px;border-radius:5px;background:transparent;border:1px solid ${t.border};color:${t.textSub};display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:.12s;}
.btn-ico:hover{background:${t.surface2};color:${t.text};}

/* ── Cards ── */
.card{background:${t.surface};border:1px solid ${t.border};border-radius:10px;padding:16px;}
.card-sm{padding:12px;}
.card:hover{border-color:${t.borderStrong};}

/* ── Inputs ── */
.inp{background:${t.surface2};border:1px solid ${t.border};border-radius:6px;padding:7px 11px;font-size:12px;color:${t.text};width:100%;transition:.12s;font-family:'DM Mono',monospace;}
.inp:focus{border-color:${t.accent};background:${t.surface};}
.inp::placeholder{color:${t.textMuted};}
.lbl{font-size:10px;color:${t.textSub};margin-bottom:4px;display:block;font-weight:500;letter-spacing:.04em;}

/* ── Chips / Tags ── */
.chip{display:inline-flex;align-items:center;gap:3px;padding:2px 7px;border-radius:4px;font-size:10px;font-weight:600;letter-spacing:.03em;}
.chip-teal{background:rgba(62,207,207,0.12);color:${t.accent};}
.chip-red{background:rgba(242,107,107,0.12);color:${t.danger};}
.chip-grn{background:rgba(62,201,142,0.12);color:${t.success};}
.chip-ylw{background:rgba(232,194,90,0.12);color:${t.warn};}
.chip-prp{background:rgba(139,124,248,0.12);color:${t.accentPurple};}
.chip-dim{background:${t.surface3};color:${t.textSub};}

/* ── Dividers ── */
.div-h{height:1px;background:${t.border};margin:10px 0;}
.div-v{width:1px;background:${t.border};margin:0 6px;align-self:stretch;}

/* ── Avatar ── */
.av{border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;letter-spacing:.04em;flex-shrink:0;}
.av-xs{width:18px;height:18px;font-size:7px;}
.av-sm{width:22px;height:22px;font-size:8px;}
.av-md{width:28px;height:28px;font-size:10px;}
.av-lg{width:36px;height:36px;font-size:13px;}
.av-xl{width:48px;height:48px;font-size:17px;}
.presence{position:relative;}
.presence::after{content:'';position:absolute;bottom:0;right:0;width:7px;height:7px;border-radius:50%;border:2px solid ${t.surface};}
.active-s::after{background:${t.success};}
.away-s::after{background:${t.warn};}
.offline-s::after{background:${t.textMuted};}

/* ── Toggle ── */
.tog{width:34px;height:18px;border-radius:9px;cursor:pointer;transition:.2s;position:relative;flex-shrink:0;}
.tog::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:.2s;}
.tog-on{background:${t.accent};}
.tog-off{background:${t.surface4};}
.tog-on::after{left:18px;}

/* ── Progress ── */
.prog{height:3px;background:${t.surface3};border-radius:2px;overflow:hidden;}
.prog-fill{height:100%;border-radius:2px;transition:.4s;}

/* ── Table ── */
.tbl{width:100%;border-collapse:collapse;}
.tbl th{text-align:left;padding:9px 14px;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:${t.textMuted};border-bottom:1px solid ${t.border};font-weight:600;white-space:nowrap;}
.tbl td{padding:11px 14px;border-bottom:1px solid ${t.border};font-size:12px;}
.tbl tr:last-child td{border-bottom:none;}
.tbl tr:hover td{background:${t.surface2};}

/* ── Issue row ── */
.iss-row{display:flex;align-items:center;gap:9px;padding:9px 16px;border-bottom:1px solid ${t.border};cursor:pointer;transition:.1s;}
.iss-row:hover{background:${t.surface2};}
.iss-row:last-child{border-bottom:none;}

/* ── Board ── */
.board-col{flex:1;min-width:240px;display:flex;flex-direction:column;border-right:1px solid ${t.border};}
.board-col:last-child{border-right:none;}
.board-col-hd{padding:12px 14px;border-bottom:1px solid ${t.border};background:${t.surface};}
.board-card{margin:8px;background:${t.surface};border:1px solid ${t.border};border-radius:8px;padding:12px;cursor:pointer;transition:.14s;}
.board-card:hover{border-color:${t.accent}55;transform:translateY(-1px);box-shadow:0 4px 16px rgba(0,0,0,.2);}
.board-card.dragging{opacity:.4;}

/* ── Thread ── */
.thread-line{position:absolute;left:10px;top:0;bottom:0;width:1px;background:${t.threadLine};}
.thread-dot{width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;z-index:1;}
.thread-item{display:flex;gap:10px;padding:10px 0;position:relative;}

/* ── Deal card ── */
.deal{background:${t.surface};border:1px solid ${t.border};border-radius:8px;padding:11px;margin-bottom:6px;cursor:pointer;transition:.14s;}
.deal:hover{border-color:${t.accent}44;transform:translateY(-1px);}

/* ── IDE ── */
.ide-layout{display:flex;height:100%;}
.ide-tree{width:210px;border-right:1px solid ${t.border};overflow:auto;flex-shrink:0;background:${t.surface};}
.ide-editor{flex:1;display:flex;flex-direction:column;min-width:0;}
.ide-tabs{display:flex;border-bottom:1px solid ${t.border};background:${t.surface2};overflow-x:auto;}
.ide-tab{display:flex;align-items:center;gap:6px;padding:8px 16px;font-size:11px;cursor:pointer;border-right:1px solid ${t.border};white-space:nowrap;color:${t.textSub};transition:.1s;}
.ide-tab.active{background:${t.bg};color:${t.text};border-bottom:1px solid ${t.bg};margin-bottom:-1px;}
.ide-code{flex:1;overflow:auto;padding:20px 24px;font-size:12.5px;line-height:1.75;background:${t.bg};}
.ide-ai{width:320px;border-left:1px solid ${t.border};display:flex;flex-direction:column;background:${t.surface};}
.ide-statusbar{height:24px;background:${t.surface2};border-top:1px solid ${t.border};display:flex;align-items:center;padding:0 16px;gap:16px;font-size:10px;color:${t.textMuted};}

/* ── Syntax ── */
.kw{color:#BD7BE8;}.fn{color:#5BA4F5;}.str{color:#5BD4A5;}
.cm{color:${t.textMuted};font-style:italic;}.num{color:#E8C25A;}.tp{color:#F09060;}

/* ── Modals / Panels ── */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;display:flex;align-items:flex-start;justify-content:flex-end;}
.panel{background:${t.surface};border-left:1px solid ${t.border};width:500px;height:100%;overflow-y:auto;display:flex;flex-direction:column;animation:slideIn .2s ease;}
.modal-ov{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:200;display:flex;align-items:center;justify-content:center;}
.modal{background:${t.surface};border:1px solid ${t.borderStrong};border-radius:12px;width:560px;max-width:94vw;animation:fadeUp .15s ease;overflow:hidden;}

/* ── Animations ── */
@keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
@keyframes slideIn{from{opacity:0;transform:translateX(16px);}to{opacity:1;transform:translateX(0);}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.35;}}
@keyframes ticker{0%{transform:translateY(0);}100%{transform:translateY(-3px);}}
@keyframes glow{0%,100%{box-shadow:0 0 0 0 ${t.glow};}50%{box-shadow:0 0 20px 4px ${t.glow};}}
.fade-in{animation:fadeIn .18s ease;}
.slide-in{animation:slideIn .2s ease;}

/* ── Marketing ── */
.hero-grid{display:grid;grid-template-columns:1fr 1fr;gap:2px;background:${t.border};border-radius:12px;overflow:hidden;border:1px solid ${t.border};}
.hero-cell{background:${t.surface};padding:20px 24px;transition:.2s;}
.hero-cell:hover{background:${t.surface2};}
.thread-preview{position:relative;padding-left:28px;}
.noise{position:fixed;inset:0;pointer-events:none;opacity:.03;z-index:1000;background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E");}

/* ── Utils ── */
.flex{display:flex;}.col{flex-direction:column;}.items-c{align-items:center;}.jc-sb{justify-content:space-between;}.jc-c{justify-content:center;}
.gap-2{gap:2px;}.gap-4{gap:4px;}.gap-6{gap:6px;}.gap-8{gap:8px;}.gap-10{gap:10px;}.gap-12{gap:12px;}.gap-16{gap:16px;}.gap-20{gap:20px;}.gap-24{gap:24px;}
.flex-1{flex:1;}.min-w-0{min-width:0;}
.trunc{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.col-muted{color:${t.textSub};}.col-dim{color:${t.textMuted};}.col-acc{color:${t.accent};}.col-red{color:${t.danger};}.col-grn{color:${t.success};}.col-ylw{color:${t.warn};}
.fw-5{font-weight:500;}.fw-6{font-weight:600;}.fw-7{font-weight:700;}.fw-8{font-weight:800;}
.fs-9{font-size:9px;}.fs-10{font-size:10px;}.fs-11{font-size:11px;}.fs-12{font-size:12px;}.fs-13{font-size:13px;}.fs-14{font-size:14px;}.fs-16{font-size:16px;}.fs-18{font-size:18px;}.fs-22{font-size:22px;}.fs-28{font-size:28px;}.fs-40{font-size:40px;}
.mt-4{margin-top:4px;}.mt-8{margin-top:8px;}.mt-12{margin-top:12px;}.mt-16{margin-top:16px;}.mt-24{margin-top:24px;}
.mb-4{margin-bottom:4px;}.mb-8{margin-bottom:8px;}.mb-12{margin-bottom:12px;}.mb-16{margin-bottom:16px;}.mb-24{margin-bottom:24px;}
.p-8{padding:8px;}.p-12{padding:12px;}.p-16{padding:16px;}.p-20{padding:20px;}.p-24{padding:24px;}
.px-12{padding-left:12px;padding-right:12px;}.px-16{padding-left:16px;padding-right:16px;}.px-24{padding-left:24px;padding-right:24px;}
.py-8{padding-top:8px;padding-bottom:8px;}.py-12{padding-top:12px;padding-bottom:12px;}
.w-full{width:100%;}.h-full{height:100%;}
.rel{position:relative;}.abs{position:absolute;}
.cur-p{cursor:pointer;}.select-none{user-select:none;}
.op-0{opacity:0;}.op-5{opacity:.5;}
.bd{border:1px solid ${t.border};}.bd-r{border-radius:6px;}.bd-r-8{border-radius:8px;}.bd-r-12{border-radius:12px;}
.bg-surf{background:${t.surface};}.bg-surf2{background:${t.surface2};}.bg-surf3{background:${t.surface3};}
.italic{font-style:italic;}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
.setting-row{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid ${t.border};}
.setting-row:last-child{border-bottom:none;}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:${t.textMuted};padding:48px;}
`;

/* ─── MICRO CHARTS (no recharts, pure DOM) ─────────────────── */
const MicroLine = ({ pts, color, h = 48, w = 120 }) => {
  const vals = pts.map(p => p.v);
  const mn = Math.min(...vals), mx = Math.max(...vals);
  const rng = mx - mn || 1;
  const svg = pts.map((p, i) => ({
    x: (i / (pts.length - 1)) * 100,
    y: 100 - ((p.v - mn) / rng) * 85,
  }));
  const d = svg.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: w, height: h, display: "block" }}>
      <defs>
        <linearGradient id={`lg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d} L100,100 L0,100 Z`} fill={`url(#lg-${color.replace("#","")})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" />
    </svg>
  );
};

const Donut = ({ segs, sz = 72, inner = 24 }) => {
  const tot = segs.reduce((s, x) => s + x.v, 0);
  const r = (sz - inner) / 2 - 2;
  const cx = sz / 2, cy = sz / 2;
  const circ = 2 * Math.PI * r;
  let cum = 0;
  return (
    <svg width={sz} height={sz}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1A1A1D" strokeWidth={inner / 2} />
      {segs.map((seg, i) => {
        const pct = seg.v / tot;
        const offset = circ * (1 - pct);
        const rot = (cum / tot) * 360 - 90;
        cum += seg.v;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.c} strokeWidth={inner / 2}
            strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${rot}deg)` }} />
        );
      })}
    </svg>
  );
};

const Burndown = ({ h = 100 }) => {
  const ideal = [[0,24],[2,20],[4,16],[6,12],[8,8],[10,4],[13,0]];
  const actual = [[0,24],[2,21],[4,19],[6,14],[8,10]];
  const toSvg = (pts, maxX = 13, maxY = 24) =>
    pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${(x / maxX) * 100},${100 - (y / maxY) * 90}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: h }}>
      <path d={toSvg(ideal)} fill="none" stroke="#333340" strokeWidth="1.5" strokeDasharray="3 2" />
      <path d={`${toSvg(actual)} L${(4 / 13) * 100},100 L0,100 Z`} fill="rgba(62,207,207,0.07)" />
      <path d={toSvg(actual)} fill="none" stroke="#3ECFCF" strokeWidth="2.5" />
      {actual.map(([x, y], i) => (
        <circle key={i} cx={(x / 13) * 100} cy={100 - (y / 24) * 90} r="2.5" fill="#3ECFCF" />
      ))}
    </svg>
  );
};

/* ─── SHARED COMPONENTS ──────────────────────────────────── */
const Av = ({ uid, size = "sm", showStatus = false }) => {
  const u = USERS[uid] || { initials: uid, hue: "#555", status: "offline" };
  const cls = `av av-${size}${showStatus ? ` presence ${u.status}-s` : ""}`;
  return (
    <div className={cls} style={{ background: u.hue + "25", color: u.hue, border: `1px solid ${u.hue}40` }}>
      {u.initials}
    </div>
  );
};

const Prio = ({ p, text = false }) => (
  <span style={{ color: PRIORITY[p]?.color || "#555", fontSize: 11 }} title={PRIORITY[p]?.label}>
    {PRIORITY[p]?.dot}{text ? ` ${PRIORITY[p]?.label}` : ""}
  </span>
);

const StatusChip = ({ s }) => {
  const st = STATUS[s] || STATUS.todo;
  return (
    <span className="chip" style={{ background: st.bg, color: st.fg, fontSize: 10 }}>{st.label}</span>
  );
};

const ProgBar = ({ v, max, c, h = 3 }) => (
  <div className="prog" style={{ height: h }}>
    <div className="prog-fill" style={{ width: `${Math.min(100, (v / max) * 100)}%`, background: c }} />
  </div>
);

const Tog = ({ on, set }) => (
  <div className={`tog tog-${on ? "on" : "off"}`} onClick={() => set(!on)} />
);

const Tip = ({ text, children }) => {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)", background: "#1A1A1D",
          color: "#EEEEF2", border: "1px solid #2E2E34", fontSize: 10,
          padding: "4px 8px", borderRadius: 5, whiteSpace: "nowrap",
          pointerEvents: "none", zIndex: 999, fontWeight: 600,
        }}>
          {text}
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, sub, delta, color, icon }) => (
  <div className="card card-sm fade-in">
    <div className="flex items-c jc-sb mb-8">
      <span className="fs-10 col-dim" style={{ letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
      {icon && <Ico n={icon} s={13} c={color || "#54545E"} />}
    </div>
    <div className="flex items-c gap-8">
      <span className="brg fw-7" style={{ fontSize: 22, color: color || "inherit" }}>{value}</span>
      {delta !== undefined && (
        <span className={`chip chip-${delta >= 0 ? "grn" : "red"}`}>{delta >= 0 ? "↑" : "↓"}{Math.abs(delta)}%</span>
      )}
    </div>
    {sub && <div className="fs-10 col-dim mt-4">{sub}</div>}
  </div>
);

/* ─── @MENTION SYSTEM ─────────────────────────────────────── */
const AtMentionHint = ({ t }) => (
  <div style={{
    background: t.surface2, border: `1px solid ${t.borderStrong}`,
    borderRadius: 8, padding: "12px 16px", marginBottom: 12,
    borderLeft: `3px solid ${t.accent}`,
  }}>
    <div className="flex items-c gap-8 mb-4">
      <Ico n="at" s={13} c={t.accent} />
      <span style={{ fontSize: 11, fontWeight: 700, color: t.accent }}>@ System — The Thread</span>
    </div>
    <div style={{ fontSize: 11, color: t.textSub, lineHeight: 1.65 }}>
      Every <code style={{ background: t.surface3, padding: "1px 5px", borderRadius: 3, color: t.accent }}>@mention</code> creates a cross-surface link.
      {" "}Mention <code style={{ background: t.surface3, padding: "1px 5px", borderRadius: 3, color: t.accentPurple }}>@RC-001</code> in chat
      → it surfaces in the issue thread, IDE context, standup agenda, and CRM account if linked.
      {" "}One mention. Everywhere it matters.
    </div>
  </div>
);

/* ─── ISSUE THREAD PANEL ─────────────────────────────────── */
const IssuePanel = ({ issue, T, onClose }) => {
  const [tab, setTab] = useState("thread");
  const [comment, setComment] = useState("");
  if (!issue) return null;

  const u = USERS[issue.assignee];

  const threadIcon = (type) => {
    const map = {
      created: { c: T.textMuted, icon: "plus" },
      comment: { c: T.accent, icon: "chat" },
      mentioned: { c: T.accentPurple, icon: "at" },
      commit: { c: T.success, icon: "git" },
      pr: { c: T.accentWarm, icon: "gitpr" },
      review: { c: T.success, icon: "checkCircle" },
    };
    return map[type] || map.comment;
  };

  const renderBody = (item) => {
    let body = item.body;
    if (item.mentions) {
      return body.split(/(@\w+)/).map((part, i) => {
        if (part.startsWith("@")) {
          return <span key={i} style={{ color: T.accentPurple, fontWeight: 600 }}>{part}</span>;
        }
        return part;
      });
    }
    if (item.ref || body.includes("RC-")) {
      return body.split(/(RC-\d+)/).map((part, i) => {
        if (/^RC-\d+$/.test(part)) {
          return <span key={i} style={{ color: T.accent, fontWeight: 600, cursor: "pointer" }}>{part}</span>;
        }
        return part;
      });
    }
    return body;
  };

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="panel fade-in">
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div className="flex items-c jc-sb mb-10">
            <div className="flex items-c gap-8">
              <Prio p={issue.priority} />
              <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>{issue.id}</span>
              <StatusChip s={issue.status} />
              {issue.prLinked && <span className="chip chip-grn"><Ico n="gitpr" s={9}/> PR</span>}
              {issue.docLinked && <span className="chip chip-teal"><Ico n="book" s={9}/> Doc</span>}
            </div>
            <button className="btn-ico" onClick={onClose}><Ico n="x" s={13}/></button>
          </div>
          <div className="brg fw-7" style={{ fontSize: 17, lineHeight: 1.3, marginBottom: 12 }}>{issue.title}</div>
          <div className="flex gap-12" style={{ fontSize: 11, color: T.textSub }}>
            <span className="flex items-c gap-4"><Av uid={issue.assignee} size="xs" /> {USERS[issue.assignee]?.name}</span>
            <span>Sprint 12</span>
            <span style={{ color: T.accent }}>Step {issue.planStep}</span>
            <span style={{ marginLeft: "auto" }}>{issue.points}pt</span>
          </div>
        </div>

        {/* CRM Context Rail */}
        {issue.crmContext && (
          <div style={{ padding: "10px 20px", background: `${T.accentWarm}10`, borderBottom: `1px solid ${T.border}` }}>
            <div className="flex items-c gap-8">
              <Ico n="brief" s={12} c={T.accentWarm} />
              <span style={{ fontSize: 11, color: T.accentWarm, fontWeight: 600 }}>Commercial context</span>
            </div>
            <div style={{ fontSize: 11, color: T.textSub, marginTop: 4, lineHeight: 1.6 }}>
              <span style={{ color: T.text, fontWeight: 600 }}>{issue.crmContext.account}</span>
              {" · "}{issue.crmContext.deal}
              {" · "}<span style={{ color: T.danger }}>{issue.crmContext.health}</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
          {["thread", "code", "docs", "time"].map(tb => (
            <button key={tb} onClick={() => setTab(tb)} style={{
              padding: "9px 16px", fontSize: 11, background: "none", border: "none",
              color: tab === tb ? T.accent : T.textMuted,
              borderBottom: `2px solid ${tab === tb ? T.accent : "transparent"}`,
              cursor: "pointer", textTransform: "capitalize", letterSpacing: "0.04em",
              fontFamily: "'DM Mono', monospace",
            }}>{tb}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* ── THREAD TAB ── */}
          {tab === "thread" && (
            <div style={{ padding: "16px 20px" }}>
              <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.7, marginBottom: 16 }}>
                {issue.description}
              </div>

              {/* Acceptance criteria */}
              <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14, marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Acceptance Criteria</div>
                {issue.acceptance.map((c, i) => (
                  <div key={i} className="flex gap-8 mb-8">
                    <Ico n="checkCircle" s={12} c={T.success} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 11, color: T.textSub }}>{c}</span>
                  </div>
                ))}
              </div>

              {/* THE THREAD — the whole value prop */}
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                Issue Thread
              </div>
              <div className="rel" style={{ paddingLeft: 28 }}>
                <div className="thread-line" />
                {issue.thread.map((item, i) => {
                  const { c, icon } = threadIcon(item.type);
                  const actor = USERS[item.actor];
                  return (
                    <div key={i} className="thread-item">
                      <div className="thread-dot" style={{ background: c + "22", border: `1px solid ${c}44`, marginLeft: -28 + 0 }}>
                        <Ico n={icon} s={10} c={c} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
                        <div className="flex items-c gap-6 mb-4">
                          <span style={{ fontSize: 11, fontWeight: 600 }}>{actor?.name}</span>
                          <span style={{ fontSize: 10, color: T.textMuted }}>{item.ts}</span>
                          {item.urgent && <span className="chip chip-red">urgent</span>}
                        </div>
                        <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.6 }}>
                          {renderBody(item)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Comment input */}
              <div className="div-h" />
              <AtMentionHint t={T} />
              <div className="flex gap-8">
                <textarea className="inp flex-1" rows={2} placeholder="Add to thread… @mention to cross-link surfaces"
                  value={comment} onChange={e => setComment(e.target.value)}
                  style={{ resize: "none", lineHeight: 1.6 }} />
                <button className="btn btn-p btn-sm" style={{ alignSelf: "flex-end" }}>
                  <Ico n="send" s={12} />
                </button>
              </div>
            </div>
          )}

          {/* ── CODE TAB ── */}
          {tab === "code" && (
            <div style={{ padding: "16px 20px" }}>
              <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div className="flex items-c gap-8 mb-8">
                  <Ico n="git" s={12} c={T.success} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.success }}>PR #42 — open</span>
                  <span className="chip chip-grn">CI passing</span>
                </div>
                <div style={{ fontSize: 11, color: T.textSub }}>{issue.branch} → main · 3 files changed</div>
              </div>
              <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>Linked files</div>
              {["src/auth/tokenRefresh.ts", "src/auth/interceptor.ts", "src/api/client.ts"].map(f => (
                <div key={f} className="flex items-c gap-8" style={{ padding: "9px 0", borderBottom: `1px solid ${T.border}`, fontSize: 12 }}>
                  <Ico n="file" s={12} c={T.accent} />
                  <span style={{ flex: 1, color: T.accent, fontFamily: "'DM Mono', monospace" }}>{f}</span>
                  <button className="btn btn-g btn-xs">Open IDE</button>
                </div>
              ))}
            </div>
          )}

          {/* ── DOCS TAB ── */}
          {tab === "docs" && (
            <div style={{ padding: "16px 20px" }}>
              {[
                { title: "Auth Token Refresh — Design Spec", words: 820, status: "published" },
                { title: "REACH Platform PRD", words: 4200, status: "published", pinned: true },
              ].map(d => (
                <div key={d.title} className="flex gap-10" style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}` }}>
                  <Ico n="book" s={14} c={d.pinned ? T.accent : T.textSub} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{d.title}</div>
                    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>
                      {d.words}w · {d.status}
                      {d.pinned && <span className="chip chip-teal" style={{ marginLeft: 6 }}>AI ref</span>}
                    </div>
                  </div>
                </div>
              ))}
              <button className="btn btn-g btn-sm mt-12"><Ico n="plus" s={11}/> Link doc</button>
            </div>
          )}

          {/* ── TIME TAB ── */}
          {tab === "time" && (
            <div style={{ padding: "16px 20px" }}>
              <div className="flex items-c jc-sb mb-16">
                <div>
                  <div className="brg fw-7" style={{ fontSize: 20 }}>{issue.timeLogged}h</div>
                  <div style={{ fontSize: 10, color: T.textMuted }}>Total logged</div>
                </div>
                <button className="btn btn-g btn-sm"><Ico n="plus" s={11}/> Log time</button>
              </div>
              <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 12, fontSize: 11, color: T.textSub }}>
                <Ico n="zap" s={11} c={T.success} /> Time tracking is <strong style={{ color: T.success }}>automatic</strong>. When this issue moves to In Progress, the Postgres trigger starts a timer. When it moves to Review or Done, it stops. No manual entry needed.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── TOPBAR ─────────────────────────────────────────────── */
const Topbar = ({ T, route, theme, setTheme, onSearch, onIssue }) => {
  return (
    <div className="topbar">
      {/* Breadcrumb */}
      <div style={{ fontSize: 11, color: T.textMuted }}>
        <span style={{ color: T.textSub }}>Acme Corp</span>
        <span style={{ margin: "0 6px" }}>/</span>
        <span style={{ color: T.text, fontWeight: 500 }}>{route.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
      </div>
      <div style={{ flex: 1, maxWidth: 340, margin: "0 12px" }}>
        <div style={{ position: "relative" }}>
          <Ico n="search" s={12} c={T.textMuted} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
          <input className="inp" placeholder="Search or jump to… ⌘K" readOnly onClick={onSearch}
            style={{ paddingLeft: 28, height: 30, fontSize: 11, cursor: "pointer" }} />
          <kbd style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 9, background: T.surface3, color: T.textMuted, padding: "2px 5px", borderRadius: 3, pointerEvents: "none" }}>⌘K</kbd>
        </div>
      </div>
      <div style={{ flex: 1 }} />

      {/* Active timer */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: `rgba(62,207,207,0.08)`, border: `1px solid rgba(62,207,207,0.2)`, borderRadius: 6, padding: "5px 12px", cursor: "pointer" }}
        onClick={() => onIssue(ISSUES[0])}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.danger, animation: "pulse 1.5s infinite" }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: T.accent }}>RC-001</span>
        <span style={{ fontSize: 11, color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>2:14:07</span>
        <button style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer", padding: 0 }} onClick={e => e.stopPropagation()}>
          <Ico n="x" s={11} />
        </button>
      </div>

      <div style={{ width: 1, height: 20, background: T.border, margin: "0 4px" }} />

      <Tip text="Notifications">
        <button className="btn-ico" style={{ position: "relative" }}>
          <Ico n="bell" s={14} />
          <div style={{ position: "absolute", top: 3, right: 3, width: 5, height: 5, borderRadius: "50%", background: T.danger }} />
        </button>
      </Tip>

      <Tip text={theme === "dark" ? "Light mode" : "Dark mode"}>
        <button className="btn-ico" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}>
          <Ico n={theme === "dark" ? "sun" : "moon"} s={14} />
        </button>
      </Tip>

      <Av uid="u1" size="sm" showStatus />
    </div>
  );
};

/* ─── SIDEBAR ─────────────────────────────────────────────── */
const Sidebar = ({ T, route, nav, slim }) => {
  const [workspaceOpen, setWorkspaceOpen] = useState(true);
  const [teamsOpen, setTeamsOpen] = useState(true);
  const [kubricOpen, setKubricOpen] = useState(true);
  const [tryOpen, setTryOpen] = useState(true);

  const NavItem = ({ item, depth = 0 }) => (
    <div className={`nav-item${route === item.id ? " active" : ""}`}
      style={{ paddingLeft: slim ? 14 : 10 + depth * 10 }}
      onClick={() => nav(item.id)} title={slim ? item.label : undefined}>
      <Ico n={item.icon} s={13} />
      {!slim && <span className="trunc flex-1">{item.label}</span>}
      {!slim && item.badge > 0 && <span className="badge">{item.badge}</span>}
      {slim && item.badge > 0 && <div style={{ position: "absolute", top: 3, right: 3, width: 5, height: 5, borderRadius: "50%", background: T.danger }} />}
    </div>
  );

  const SectionHeader = ({ label, open, onToggle }) => !slim ? (
    <div className="flex items-c gap-4 cur-p select-none"
      style={{ padding: "8px 10px 3px", fontSize: 11, color: T.textSub, fontWeight: 600 }}
      onClick={onToggle}>
      <Ico n={open ? "chevD" : "chevR"} s={10} c={T.textMuted} />
      <span>{label}</span>
    </div>
  ) : null;

  return (
    <div className={`sidebar${slim ? " slim" : ""}`}>
      {/* Wordmark */}
      <div style={{ height: 48, display: "flex", alignItems: "center", padding: slim ? "0 14px" : "0 16px", borderBottom: `1px solid ${T.border}`, flexShrink: 0, gap: 10 }}>
        <div style={{ width: 22, height: 22, background: T.accent, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", fontFamily: "'Bricolage Grotesque', sans-serif" }}>R</span>
        </div>
        {!slim && (
          <div className="flex items-c gap-6">
            <span className="brg fw-8" style={{ fontSize: 15, color: T.text, letterSpacing: "-0.02em" }}>REACH</span>
            <span style={{ fontSize: 9, color: T.textMuted, background: T.surface3, padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>BETA</span>
          </div>
        )}
        {!slim && <div style={{ flex: 1 }} />}
        {!slim && <button className="btn-ico" style={{ padding: 3 }} onClick={() => nav("settings")}><Ico n="cog" s={12} c={T.textMuted} /></button>}
      </div>

      {/* Nav scroll area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>

        {/* Search bar */}
        {!slim && (
          <div style={{ padding: "6px 10px 4px" }}>
            <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
              onClick={() => nav("search")}>
              <Ico n="search" s={11} c={T.textMuted} />
              <span style={{ fontSize: 11, color: T.textMuted, flex: 1 }}>Search...</span>
              <span style={{ fontSize: 9, color: T.textMuted, background: T.surface3, padding: "1px 5px", borderRadius: 3 }}>⌘K</span>
            </div>
            <div style={{ fontSize: 9, color: T.textMuted, marginTop: 3, paddingLeft: 2 }}>@mention &nbsp;#issue</div>
          </div>
        )}

        {/* Top Section — User & Issue Management */}
        <div style={{ padding: "4px 8px 2px" }}>
          <NavItem item={{ id: "dashboard",   icon: "home",     label: "Home dashboard" }} />
          <NavItem item={{ id: "issues",      icon: "activity", label: "My Issues" }} />
          <NavItem item={{ id: "inbox",       icon: "bell",     label: "Inbox",   badge: 3 }} />
          <NavItem item={{ id: "drafts",      icon: "file",     label: "Drafts" }} />
        </div>

        <div style={{ height: 1, background: T.border, margin: "4px 10px" }} />

        {/* Workspace Section */}
        <SectionHeader label="Workspace" open={workspaceOpen} onToggle={() => setWorkspaceOpen(p => !p)} />
        {workspaceOpen && (
          <div style={{ padding: "2px 8px 4px" }}>
            <NavItem item={{ id: "members",      icon: "users",   label: "Members" }}   depth={1} />
            <NavItem item={{ id: "sprint-board", icon: "folder",  label: "Projects" }}  depth={1} />
            <NavItem item={{ id: "standups",     icon: "users",   label: "Teams" }}     depth={1} />
            <NavItem item={{ id: "views",        icon: "layers",  label: "Views" }}     depth={1} />
          </div>
        )}

        <div style={{ height: 1, background: T.border, margin: "4px 10px" }} />

        {/* Your Teams Section */}
        <SectionHeader label="Your teams" open={teamsOpen} onToggle={() => setTeamsOpen(p => !p)} />
        {teamsOpen && (
          <div style={{ padding: "2px 8px 4px" }}>
            <NavItem item={{ id: "issues",      icon: "activity", label: "Issues" }}   depth={1} />
            <NavItem item={{ id: "sprint-board",icon: "folder",   label: "Projects" }} depth={1} />
            <NavItem item={{ id: "views",       icon: "layers",   label: "Views" }}    depth={1} />
          </div>
        )}

        <div style={{ height: 1, background: T.border, margin: "4px 10px" }} />

        {/* Try Section */}
        <SectionHeader label="Try" open={tryOpen} onToggle={() => setTryOpen(p => !p)} />
        {tryOpen && (
          <div style={{ padding: "2px 8px 4px" }}>
            <NavItem item={{ id: "backlog",  icon: "layers", label: "Import issues" }} depth={1} />
            <NavItem item={{ id: "settings", icon: "plus",   label: "Invite people" }} depth={1} />
            <NavItem item={{ id: "prs",      icon: "git",    label: "Link GitHub" }}   depth={1} />
          </div>
        )}

        <div style={{ height: 1, background: T.border, margin: "4px 10px" }} />

        {/* Main nav items */}
        <div style={{ padding: "4px 8px 2px" }}>
          <NavItem item={{ id: "views",    icon: "diamond",  label: "Shape Up" }} />
          <NavItem item={{ id: "backlog",  icon: "layers",   label: "Backlog" }} />
          <NavItem item={{ id: "dashboard",icon: "home",     label: "My Tasks" }} />
          <NavItem item={{ id: "roadmap",  icon: "chevR",    label: "Roadmap" }} />
          <NavItem item={{ id: "ide",      icon: "terminal", label: "Code & PRs", badge: 3 }} />
          <NavItem item={{ id: "docs",     icon: "book",     label: "[] Docs" }} />
          <NavItem item={{ id: "chat",     icon: "chat",     label: "Chat", badge: 14 }} />
          <NavItem item={{ id: "standups", icon: "video",    label: "Standups", badge: 1 }} />
        </div>

        <div style={{ height: 1, background: T.border, margin: "4px 10px" }} />

        {/* INSIGHTS section */}
        {!slim && <div className="nav-lbl" style={{ color: T.accent, paddingTop: 6 }}>INSIGHTS</div>}
        <div style={{ padding: "2px 8px 4px" }}>
          <NavItem item={{ id: "analytics",   icon: "bar",      label: "Dashboard" }} />
          <NavItem item={{ id: "analytics",   icon: "activity", label: "Analytics" }} />
          <NavItem item={{ id: "analytics",   icon: "zap",      label: "Dev Charts" }} />
          <NavItem item={{ id: "analytics",   icon: "brief",    label: "Reports" }} />
        </div>

        <div style={{ height: 1, background: T.border, margin: "4px 10px" }} />

        {/* STRUCTURE section */}
        {!slim && <div className="nav-lbl" style={{ color: T.accentWarm, paddingTop: 6 }}>STRUCTURE</div>}
        <div style={{ padding: "2px 8px 6px" }}>
          <NavItem item={{ id: "sprint-board", icon: "folder",   label: "Projects" }} />
          <NavItem item={{ id: "crm",          icon: "brief",    label: "CRM" }} />
          <NavItem item={{ id: "cap-table",    icon: "dollar",   label: "Cap Table" }} />
          <NavItem item={{ id: "time",         icon: "clock",    label: "Time Tracking" }} />
          <NavItem item={{ id: "marketing",    icon: "zap",      label: "Marketing" }} />
          <NavItem item={{ id: "members",      icon: "users",    label: "Members" }} />
          <NavItem item={{ id: "settings",     icon: "cog",      label: "Settings" }} />
        </div>

      </div>
      {/* User footer */}
      {!slim && (
        <div style={{ padding: "10px 8px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          <div className="flex items-c gap-8" style={{ padding: "7px 10px", borderRadius: 6, cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.background = T.surface2}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <Av uid="u1" size="sm" showStatus />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600 }} className="trunc">Alex Chen</div>
              <div style={{ fontSize: 10, color: T.textMuted }}>Admin · Acme Corp</div>
            </div>
            <Ico n="more" s={12} c={T.textMuted} />
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── PAGES ──────────────────────────────────────────────── */

/* ══ MARKETING ══════════════════════════════════════════════ */
const Marketing = ({ T, gotoAuth, theme, setTheme }) => {
  const [activeLifecycle, setActiveLifecycle] = useState(0);
  const [activeView, setActiveView] = useState("scrum");

  const PILLARS = [
    {
      symbol: "⬡", id: "work", label: "WORK", sub: '"Get things done"', color: T.accent,
      items: ["Sprint Board — Kanban · Scrum · Hybrid", "My Tasks — Personal queue", "Backlog — Groomed · Prioritized", "Roadmap — Now · Next · Later", "Shape Up — 6-week cycles"],
    },
    {
      symbol: "◈", id: "insights", label: "INSIGHTS", sub: '"Understand and improve"', color: T.accentPurple,
      items: ["Analytics — EVM · Velocity · CPI · SPI", "Reports — Cost · Progress · Cycle time", "Dashboard — Portfolio health", "Burn-down — Sprint progress", "Risk Register — Live risk surface"],
    },
    {
      symbol: "◎", id: "structure", label: "STRUCTURE", sub: '"Configure and manage"', color: T.accentWarm,
      items: ["Projects — WBS · Baseline · Budget", "Members — Roles · Permissions · Teams", "Clients — Stakeholders · External deps", "Tags — Taxonomy · Labels · Types", "Settings — Cost rates · Integrations"],
    },
  ];

  const LIFECYCLE = [
    {
      symbol: "◉", stage: "BORN", sub: "Created in Backlog · ID assigned · Timestamped",
      pillars: ["STRUCTURE","WORK"],
      triggers: ["Backlog item created","Auto-ID generated (K-COR-NNN)","Creator recorded","Timestamp set"],
      notifications: ["Reporter","Project lead (if configured)"],
      updates: ["Backlog count","Project issue count"],
    },
    {
      symbol: "◈", stage: "REFINED", sub: "Acceptance criteria · Story pointed · Dependencies",
      pillars: ["WORK","INSIGHTS"],
      triggers: ["Acceptance criteria written","Story points estimated","Tags applied","Dependencies linked"],
      notifications: ["Assignee (if set)","Team members watching"],
      updates: ["Sprint capacity","Velocity forecast"],
    },
    {
      symbol: "◎", stage: "ASSIGNED", sub: "Owner selected · Appears in My Tasks",
      pillars: ["WORK","STRUCTURE"],
      triggers: ["Owner selected from Members","Appears in My Tasks","Team notified"],
      notifications: ["Assignee: 'You have a new issue'","Reporter: 'Work assigned'"],
      updates: ["Member workload","Team capacity view"],
    },
    {
      symbol: "▶", stage: "IN PROGRESS", sub: "WIP count increments · Timer starts",
      pillars: ["WORK","INSIGHTS"],
      triggers: ["Drag to In Progress","WIP counter increments","Timer auto-starts","Board recolors if WIP limit hit"],
      notifications: ["PM: velocity tracking active","Stakeholders (if configured)"],
      updates: ["Cycle time clock starts","EVM: AC begins accumulating","Sprint burn-down"],
    },
    {
      symbol: "⌥", stage: "CODED", sub: "AI generates boilerplate · PR created · Issue ↔ PR linked",
      pillars: ["WORK"],
      triggers: ["Drag issue → IDE","AI generates boilerplate from description","PR created & linked"],
      notifications: ["PR reviewers notified","Code owners alerted","CI/CD triggered","#pr-reviews channel"],
      updates: ["Issue shows linked PR","Code & PRs module","File change log"],
    },
    {
      symbol: "✓", stage: "REVIEWED", sub: "PR reviewed · Changes merged · CI passes",
      pillars: ["WORK","INSIGHTS"],
      triggers: ["PR review requested","Comments added","Changes requested / Approved","CI passes","Merge"],
      notifications: ["All reviewers","Author","Downstream team"],
      updates: ["Issue moves to verification","Code merged","PR closed"],
    },
    {
      symbol: "⊞", stage: "DOCUMENTED", sub: "AI generates docs · Docs linked to issue",
      pillars: ["WORK","STRUCTURE"],
      triggers: ["Drag issue → Docs","AI generates from issue + PR diff","Docs published & linked"],
      notifications: ["Doc owners","Stakeholders subscribed to feature"],
      updates: ["Issue shows Docs artifact","Documentation index"],
    },
    {
      symbol: "⬡", stage: "SHIPPED", sub: "Deployed · Stakeholders notified · Analytics updated",
      pillars: ["WORK","INSIGHTS","STRUCTURE"],
      triggers: ["Deployed to production","Verification complete","Status → DONE","Timer stops","All artifacts finalized"],
      notifications: ["All stakeholders","Reporter: '✅ Your feature is live'","Team: '🎉 Shipped'"],
      updates: ["Velocity +points","Cycle time average","Throughput","EVM: EV updated","Audit log finalized"],
    },
  ];

  const VIEWS = [
    { id: "scrum", label: "Scrum", rhythm: "Fixed 1-2 week sprints", planning: "Story pointing, velocity, backlog refinement", artifacts: "Sprint board, burndown, velocity report, DoD", need: "Predictable sprint workflows, easy estimation, minimal ceremony friction." },
    { id: "kanban", label: "Kanban", rhythm: "Continuous flow, no fixed sprints", planning: "WIP limits, cycle time focus, CFD", artifacts: "Kanban board with swimlanes, SLAs, cycle time histograms", need: "No forced sprints, visual WIP limits, SLA tracking, fast prioritization." },
    { id: "shapeup", label: "Shape Up", rhythm: "6-week cycles + 2-week cooldown", planning: "Pitches not stories. Fixed time, variable scope.", artifacts: "Pitch documents, cycle plans, scope hammers", need: "No story points, no daily standups, fixed appetite over estimates." },
  ];

  const CHARTS = [
    { label: "Personal Throughput", who: "Developer", desc: "Issues closed per week — sustainable pace, self-awareness, performance review signal." },
    { label: "PR Cycle Time", who: "Developer", desc: "Time from PR open → merged with breakdown: first review, iteration, merge queue. Where are you waiting?" },
    { label: "My Queue by Priority", who: "Developer", desc: "Stacked bar of open assignments by priority. Prevents priority blindness when everything feels urgent." },
    { label: "Interruption Burden", who: "Developer", desc: "Unplanned work (bugs, hotfixes) vs. planned over time. Makes the cost of context-switching visible." },
    { label: "Cycle Time Scatterplot", who: "Manager", desc: "Dot plot with p50/p75/p95 percentiles. The single most powerful forecasting tool — tells you what you can reliably promise." },
    { label: "Cumulative Flow", who: "Manager", desc: "Stacked area by status over time. If In Progress grows while Done flatlines — you're stuck. Instantly." },
    { label: "WIP Aging Chart", who: "Manager", desc: "How long each in-progress issue has been open, with warning thresholds. Stale work made visible." },
    { label: "Predictability Index", who: "Manager", desc: "% committed work completed vs. scope changed vs. missed, per quarter. Quantifies forecast trust." },
  ];

  const lc = LIFECYCLE[activeLifecycle];
  const pillarColor = { WORK: T.accent, INSIGHTS: T.accentPurple, STRUCTURE: T.accentWarm };

  return (
    <div style={{ background: T.bg, minHeight: "100vh", fontFamily: "'DM Mono', monospace", color: T.text }}>

      {/* NAV */}
      <nav style={{ display: "flex", alignItems: "center", padding: "0 48px", height: 64, borderBottom: `1px solid ${T.border}`, background: T.surface, position: "sticky", top: 0, zIndex: 50 }}>
        <div className="flex items-c gap-10">
          <div style={{ width: 26, height: 26, background: T.accent, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="brg fw-8" style={{ fontSize: 13, color: "#fff" }}>R</span>
          </div>
          <span className="brg fw-8" style={{ fontSize: 17, letterSpacing: "-0.02em" }}>REACH</span>
        </div>
        <div style={{ flex: 1 }} />
        <div className="flex items-c gap-24" style={{ fontSize: 12, color: T.textSub }}>
          {["Product", "Pricing", "Docs", "Blog"].map(l => (
            <span key={l} style={{ cursor: "pointer", transition: ".1s" }}
              onMouseEnter={e => e.target.style.color = T.text}
              onMouseLeave={e => e.target.style.color = T.textSub}>{l}</span>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div className="flex gap-8 items-c">
          <button className="btn-ico" onClick={() => setTheme(t => t === "dark" ? "light" : "dark")} title="Toggle theme">
            <Ico n={theme === "dark" ? "sun" : "moon"} s={15} c={T.textSub} />
          </button>
          <button className="btn btn-g btn-sm" onClick={() => gotoAuth("signin")}>Sign in</button>
          <button className="btn btn-p btn-sm" onClick={() => gotoAuth("signup")}>Get started →</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 48px 60px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 24 }}>
          <div style={{ height: 1, width: 24, background: T.accent }} />
          <span style={{ fontSize: 10, color: T.accent, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>Issue-first · Agile-native · Three pillars</span>
        </div>

        <h1 className="brg" style={{ fontSize: "clamp(36px, 5.5vw, 68px)", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 24, maxWidth: 820 }}>
          Every issue. Every surface.<br />
          <span style={{ color: T.accent }}>One living thread.</span>
        </h1>

        <p style={{ fontSize: 15, color: T.textSub, lineHeight: 1.75, maxWidth: 580, marginBottom: 40, fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 400 }}>
          REACH is not a collection of features. It's three pillars — Work, Insights, Structure —
          and every issue born inside it follows a lifecycle that ties each one together.
          From backlog to shipped, with a clear line to every stakeholder who needs to know.
        </p>

        <div className="flex gap-12 flex-wrap">
          <button className="btn btn-p" style={{ fontSize: 14, padding: "11px 28px" }} onClick={() => gotoAuth("signup")}>Start for free →</button>
          <button className="btn btn-g" style={{ fontSize: 14, padding: "11px 28px" }} onClick={() => gotoAuth("app")}>View live demo</button>
        </div>

        <div className="flex items-c gap-16 mt-28" style={{ fontSize: 11, color: T.textMuted }}>
          <span>Trusted by engineering teams at</span>
          {["Northstar Labs", "Apex Ventures", "Cascade Systems"].map(n => (
            <span key={n} style={{ color: T.textSub, fontWeight: 600 }}>{n}</span>
          ))}
        </div>
      </div>

      {/* ── THREE PILLARS ── */}
      <div style={{ background: T.surface, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: "64px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12 }}>Architecture</div>
            <h2 className="brg fw-7" style={{ fontSize: 32, letterSpacing: "-0.02em", marginBottom: 12 }}>Three pillars. No orphaned features.</h2>
            <p style={{ fontSize: 13, color: T.textSub, maxWidth: 540, margin: "0 auto" }}>
              Every UI element maps to exactly one pillar. Industry language, developer instinct.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {PILLARS.map(p => (
              <div key={p.id} style={{ border: `1px solid ${T.border}`, borderRadius: 12, padding: 28, background: T.bg }}>
                <div style={{ fontSize: 28, marginBottom: 12, color: p.color }}>{p.symbol}</div>
                <div className="brg fw-8" style={{ fontSize: 18, color: p.color, letterSpacing: "-0.01em", marginBottom: 4 }}>{p.label}</div>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 20, fontStyle: "italic" }}>{p.sub}</div>
                {p.items.map((item, i) => (
                  <div key={i} className="flex gap-8 mb-8">
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: p.color, flexShrink: 0, marginTop: 6 }} />
                    <span style={{ fontSize: 11.5, color: T.textSub, lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── ISSUE LIFECYCLE ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 48px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12 }}>Issue Lifecycle</div>
          <h2 className="brg fw-7" style={{ fontSize: 32, letterSpacing: "-0.02em", marginBottom: 12 }}>Every issue follows a path.</h2>
          <p style={{ fontSize: 13, color: T.textSub, maxWidth: 480, margin: "0 auto" }}>
            From idea to archived artifact. Click a stage to see exactly what triggers, who gets notified, and what updates.
          </p>
        </div>

        {/* Stage selector — horizontal scroll */}
        <div style={{ display: "flex", gap: 0, overflowX: "auto", marginBottom: 28, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
          {LIFECYCLE.map((lc, i) => (
            <button key={i} onClick={() => setActiveLifecycle(i)} style={{
              flex: 1, minWidth: 90, padding: "14px 8px", background: activeLifecycle === i ? T.accent : T.surface,
              border: "none", borderRight: `1px solid ${T.border}`, cursor: "pointer",
              fontFamily: "'DM Mono', monospace", transition: ".12s",
            }}>
              <div style={{ fontSize: 18, marginBottom: 4, color: activeLifecycle === i ? "#fff" : T.textMuted }}>{lc.symbol}</div>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: activeLifecycle === i ? "#fff" : T.textSub }}>{lc.stage}</div>
            </button>
          ))}
        </div>

        {/* Active stage detail */}
        <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ padding: "20px 28px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", gap: 16, alignItems: "center" }}>
            <span style={{ fontSize: 28, color: T.accent }}>{lc.symbol}</span>
            <div>
              <div className="brg fw-7" style={{ fontSize: 18 }}>{lc.stage}</div>
              <div style={{ fontSize: 12, color: T.textSub, marginTop: 2 }}>{lc.sub}</div>
            </div>
            <div style={{ flex: 1 }} />
            <div className="flex gap-6">
              {lc.pillars.map(p => (
                <span key={p} className="chip" style={{ background: pillarColor[p] + "18", color: pillarColor[p], fontSize: 10, fontWeight: 700 }}>{p}</span>
              ))}
            </div>
          </div>

          {/* 3-col detail */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", background: T.bg }}>
            {[
              { label: "Triggers", items: lc.triggers, color: T.accent },
              { label: "Notifications", items: lc.notifications, color: T.accentPurple },
              { label: "Updates", items: lc.updates, color: T.success },
              { label: "Integration Surface", items: ["Chat → notify + discuss", "IDE → AI boilerplate → PR", "Docs → AI documentation", "Boards → WIP update", "Analytics → EVM recalculates"], color: T.accentWarm },
            ].map((col, i, arr) => (
              <div key={i} style={{ padding: "20px 24px", borderRight: i < arr.length - 1 ? `1px solid ${T.border}` : "none" }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: col.color, marginBottom: 12 }}>{col.label}</div>
                {col.items.map((item, j) => (
                  <div key={j} className="flex gap-8 mb-8">
                    <div style={{ width: 4, height: 4, borderRadius: "50%", background: col.color, flexShrink: 0, marginTop: 5 }} />
                    <span style={{ fontSize: 11, color: T.textSub, lineHeight: 1.5 }}>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── METHODOLOGY VIEWS ── */}
      <div style={{ background: T.surface, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: "64px 48px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12 }}>Views</div>
            <h2 className="brg fw-7" style={{ fontSize: 32, letterSpacing: "-0.02em", marginBottom: 12 }}>Your methodology. Not ours.</h2>
            <p style={{ fontSize: 13, color: T.textSub, maxWidth: 480, margin: "0 auto" }}>
              Scrum, Kanban, or Shape Up — REACH adapts to how your team actually works. Switch view modes per project.
            </p>
          </div>

          <div className="flex gap-8 jc-c mb-32">
            {VIEWS.map(v => (
              <button key={v.id} className={`btn btn-sm ${activeView === v.id ? "btn-p" : "btn-g"}`} onClick={() => setActiveView(v.id)}>{v.label}</button>
            ))}
          </div>

          {VIEWS.filter(v => v.id === activeView).map(v => (
            <div key={v.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 16 }}>
              {[
                { label: "Rhythm", value: v.rhythm },
                { label: "Planning", value: v.planning },
                { label: "Key Artifacts", value: v.artifacts },
                { label: "What teams need", value: v.need },
              ].map((item, i) => (
                <div key={i} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, background: T.bg }}>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textMuted, marginBottom: 8 }}>{item.label}</div>
                  <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.65 }}>{item.value}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── ANALYTICS / CHARTS ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "80px 48px" }}>
        <div style={{ display: "flex", gap: 32, alignItems: "flex-start", marginBottom: 48 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 12 }}>Insights</div>
            <h2 className="brg fw-7" style={{ fontSize: 32, letterSpacing: "-0.02em", marginBottom: 12 }}>Visualizations that answer the right question.</h2>
          </div>
          <div style={{ maxWidth: 320, fontSize: 13, color: T.textSub, lineHeight: 1.75, paddingTop: 8, fontFamily: "'Bricolage Grotesque', sans-serif" }}>
            Two audiences. Eight charts. Each one answers exactly one question a developer or manager has about delivery.
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, background: T.border, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
          {CHARTS.map((ch, i) => (
            <div key={i} style={{ background: T.surface, padding: "20px 22px" }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: ch.who === "Developer" ? T.accent : T.accentPurple, marginBottom: 8 }}>{ch.who}</div>
              <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 8, lineHeight: 1.3 }}>{ch.label}</div>
              <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.65 }}>{ch.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PRICING */}
      <div style={{ background: T.surface, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: "80px 48px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <h2 className="brg fw-7" style={{ fontSize: 32, marginBottom: 8, letterSpacing: "-0.02em" }}>Simple pricing.</h2>
            <p style={{ fontSize: 13, color: T.textSub }}>No per-seat shock. No feature gating that punishes growth.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[
              { name: "Starter", price: "$0", period: "forever", sub: "Up to 5 members", cta: "Start free", features: ["Issues + Sprint board", "Docs + Chat", "1 project", "2 members"] },
              { name: "Business", price: "$49", period: "/month", sub: "Unlimited members", cta: "Start trial", highlight: true, features: ["Everything in Starter", "IDE + GitHub", "Video standups", "CRM + Analytics", "AI assist (Claude)", "Time tracking"] },
              { name: "Enterprise", price: "Custom", period: "", sub: "Dedicated support", cta: "Talk to us", features: ["Everything in Business", "Cap table module", "SSO / SAML / Okta", "Audit log + Compliance", "SLA automation", "99.9% uptime SLA"] },
            ].map(plan => (
              <div key={plan.name} style={{ background: T.bg, border: `${plan.highlight ? 2 : 1}px solid ${plan.highlight ? T.accent : T.border}`, borderRadius: 12, padding: 28, position: "relative" }}>
                {plan.highlight && (
                  <div style={{ position: "absolute", top: -10, left: 24, background: T.accent, color: "#fff", fontSize: 9, padding: "2px 10px", borderRadius: 10, fontWeight: 800, letterSpacing: "0.1em" }}>MOST POPULAR</div>
                )}
                <div className="brg fw-7" style={{ fontSize: 15, marginBottom: 4 }}>{plan.name}</div>
                <div style={{ marginBottom: 4 }}>
                  <span className="brg fw-8" style={{ fontSize: 28, color: plan.highlight ? T.accent : T.text }}>{plan.price}</span>
                  <span style={{ fontSize: 12, color: T.textMuted }}>{plan.period}</span>
                </div>
                <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 24 }}>{plan.sub}</div>
                {plan.features.map(f => (
                  <div key={f} className="flex gap-8 mb-8">
                    <Ico n="check" s={11} c={T.success} />
                    <span style={{ fontSize: 11, color: T.textSub }}>{f}</span>
                  </div>
                ))}
                <button className={`btn ${plan.highlight ? "btn-p" : "btn-g"} w-full mt-16`}
                  style={{ justifyContent: "center", padding: "9px" }}
                  onClick={() => gotoAuth("signup")}>
                  {plan.cta} →
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ padding: "28px 48px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="brg fw-8" style={{ color: T.accent, fontSize: 15 }}>REACH</div>
        <div style={{ fontSize: 11, color: T.textMuted }}>Built by Managekube · 2026 · Issue-first development platform</div>
        <div className="flex gap-20" style={{ fontSize: 11, color: T.textMuted }}>
          {["Privacy", "Terms", "Status", "Docs"].map(l => (
            <span key={l} style={{ cursor: "pointer" }}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ══ AUTH ══════════════════════════════════════════════════ */
const AuthPage = ({ T, mode, setPage }) => {
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const isSignup = mode === "signup";

  return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace" }}>
      <div className="noise" />
      {/* Left branding panel */}
      <div style={{ width: 420, display: "none" }} />

      <div style={{ width: 380, position: "relative", zIndex: 2 }}>
        {/* Mark */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ width: 40, height: 40, background: T.accent, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <span className="brg fw-8" style={{ fontSize: 20, color: T.bg }}>R</span>
          </div>
          <div className="brg fw-7" style={{ fontSize: 22, marginBottom: 4, letterSpacing: "-0.02em" }}>{isSignup ? "Create your workspace" : "Welcome back"}</div>
          <div style={{ fontSize: 12, color: T.textSub }}>{isSignup ? "14-day free trial. No credit card." : "Sign in to continue."}</div>
        </div>

        <div className="card" style={{ padding: 32 }}>
          {/* OAuth */}
          <button className="btn btn-g w-full" style={{ justifyContent: "center", padding: "9px", marginBottom: 20 }}>
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-c gap-12 mb-20">
            <div className="div-h flex-1" style={{ margin: 0 }} />
            <span style={{ fontSize: 10, color: T.textMuted }}>OR</span>
            <div className="div-h flex-1" style={{ margin: 0 }} />
          </div>

          {isSignup && (
            <div style={{ marginBottom: 14 }}>
              <label className="lbl">Full name</label>
              <input className="inp" placeholder="Alex Chen" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <label className="lbl">Work email</label>
            <input className="inp" type="email" placeholder="you@company.io" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <div className="flex items-c jc-sb mb-4">
              <label className="lbl" style={{ margin: 0 }}>Password</label>
              {!isSignup && <span style={{ fontSize: 10, color: T.accent, cursor: "pointer" }}>Forgot?</span>}
            </div>
            <input className="inp" type="password" placeholder="••••••••" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
          </div>
          <button className="btn btn-p w-full" style={{ justifyContent: "center", padding: 11 }} onClick={() => setPage("app")}>
            {isSignup ? "Create account →" : "Sign in →"}
          </button>
        </div>

        <div style={{ textAlign: "center", fontSize: 12, color: T.textMuted, marginTop: 16 }}>
          {isSignup ? "Already have an account? " : "New to REACH? "}
          <span style={{ color: T.accent, cursor: "pointer" }} onClick={() => setPage(isSignup ? "signin" : "signup")}>
            {isSignup ? "Sign in" : "Get started free"}
          </span>
        </div>
      </div>
    </div>
  );
};

/* ══ GHOST BOOTSTRAP ONBOARDING ═════════════════════════════ */
/* 90-second conversion flow. User is emotionally invested     */
/* in their plan BEFORE dealing with API key friction.         */
const Onboarding = ({ T, onComplete }) => {
  const [step, setStep] = useState(0); // 0 = describe, 1 = model, 2 = connect
  const [idea, setIdea] = useState("");
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState(null);
  const [model, setModel] = useState("scrum");
  const [githubPat, setGithubPat] = useState("");
  const [connecting, setConnecting] = useState(false);

  const generatePlan = () => {
    if (!idea.trim()) return;
    setGenerating(true);
    setTimeout(() => {
      setPlan({
        name: idea.split(" ").slice(0, 4).join(" "),
        issues: [
          { id: "K-001", title: `Core: ${idea.split(" ").slice(0, 5).join(" ")}`, priority: "critical", points: 8 },
          { id: "K-002", title: "Auth + user model", priority: "high", points: 5 },
          { id: "K-003", title: "API scaffold + data layer", priority: "high", points: 5 },
          { id: "K-004", title: "UI shell + navigation", priority: "medium", points: 3 },
          { id: "K-005", title: "Deploy pipeline + staging env", priority: "medium", points: 3 },
        ],
        velocity: 18,
        sprintCount: 3,
        budget: "$0 — open source stack",
        cip: "PRD injected into IDE context. Every issue seeded with acceptance criteria. AI assist primed.",
      });
      setGenerating(false);
      setStep(1);
    }, 1200);
  };

  const connect = () => {
    setConnecting(true);
    setTimeout(() => { setConnecting(false); onComplete(); }, 1400);
  };

  const STEP_LABELS = ["Describe", "Choose model", "Connect"];

  return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Mono', monospace" }}>
      <div style={{ width: 560, position: "relative", zIndex: 2 }}>

        {/* Mark + progress */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, background: T.accent, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <span className="brg fw-8" style={{ fontSize: 17, color: "#fff" }}>R</span>
          </div>
          <div className="brg fw-7" style={{ fontSize: 22, marginBottom: 6, letterSpacing: "-0.02em" }}>Bootstrap your workspace</div>
          <div style={{ fontSize: 12, color: T.textSub }}>90 seconds. Your plan is generated before you ever see an API key.</div>
        </div>

        {/* Step pills */}
        <div className="flex gap-0 mb-28" style={{ border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
          {STEP_LABELS.map((l, i) => (
            <div key={i} style={{
              flex: 1, padding: "8px 12px", textAlign: "center", fontSize: 11, fontWeight: 600,
              background: i === step ? T.accent : i < step ? T.accent + "20" : T.surface,
              color: i === step ? "#fff" : i < step ? T.accent : T.textMuted,
              borderRight: i < 2 ? `1px solid ${T.border}` : "none",
              transition: ".2s",
            }}>
              {i < step ? "✓ " : `${i + 1}. `}{l}
            </div>
          ))}
        </div>

        {/* ── STEP 0: Describe your idea ── */}
        {step === 0 && (
          <div className="card" style={{ padding: 32 }}>
            <div className="brg fw-7" style={{ fontSize: 18, marginBottom: 8 }}>Describe your idea.</div>
            <div style={{ fontSize: 12, color: T.textSub, marginBottom: 20, lineHeight: 1.7 }}>
              REACH will generate your Foundation Plan — sprints, issues, capacity estimate, and CIP context — instantly.
              No database connection. No API key. Just your idea.
            </div>
            <label className="lbl">What are you building?</label>
            <textarea className="inp" rows={3} style={{ resize: "none", lineHeight: 1.7, marginBottom: 20, fontSize: 13 }}
              placeholder="e.g. A developer-first project tracker that connects issues to PRs, chat, and the CRM deal that funded the work…"
              value={idea} onChange={e => setIdea(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && e.metaKey) generatePlan(); }} />
            <button className="btn btn-p w-full" style={{ justifyContent: "center", padding: 11, fontSize: 13 }}
              onClick={generatePlan} disabled={!idea.trim() || generating}>
              {generating ? (
                <span className="flex items-c gap-8"><span style={{ animation: "pulse 1s infinite" }}>⟳</span> Generating foundation plan…</span>
              ) : "Generate Foundation Plan →"}
            </button>
            <div style={{ fontSize: 10, color: T.textMuted, textAlign: "center", marginTop: 10 }}>⌘↵ to generate</div>
          </div>
        )}

        {/* ── STEP 1: Choose your model ── */}
        {step === 1 && plan && (
          <div>
            {/* Plan preview */}
            <div className="card" style={{ padding: 24, marginBottom: 16 }}>
              <div className="flex items-c gap-8 mb-14">
                <Ico n="checkCircle" s={14} c={T.success} />
                <span className="brg fw-7" style={{ fontSize: 15 }}>Foundation Plan generated</span>
                <span className="chip chip-grn" style={{ marginLeft: "auto" }}>Ready</span>
              </div>

              <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: T.textMuted, marginBottom: 10 }}>Generated issues ({plan.issues.length})</div>
                {plan.issues.map(iss => (
                  <div key={iss.id} className="flex items-c gap-8 mb-6">
                    <Prio p={iss.priority} />
                    <span style={{ fontSize: 10, color: T.accent, fontWeight: 700, width: 48, flexShrink: 0 }}>{iss.id}</span>
                    <span style={{ flex: 1, fontSize: 11, color: T.textSub }} className="trunc">{iss.title}</span>
                    <span style={{ fontSize: 10, color: T.textMuted }}>{iss.points}pt</span>
                  </div>
                ))}
              </div>

              <div className="g2" style={{ gap: 8 }}>
                {[
                  { l: "Velocity estimate", v: `${plan.velocity}pt/sprint` },
                  { l: "Sprint count", v: `~${plan.sprintCount} sprints` },
                  { l: "Stack cost", v: plan.budget },
                  { l: "AI context", v: "PRD + issues" },
                ].map(row => (
                  <div key={row.l} style={{ background: T.surface3, borderRadius: 6, padding: "8px 12px" }}>
                    <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 2 }}>{row.l}</div>
                    <div style={{ fontSize: 11, fontWeight: 700 }}>{row.v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Model choice */}
            <div className="card" style={{ padding: 24 }}>
              <div className="brg fw-7" style={{ fontSize: 15, marginBottom: 16 }}>Choose your model.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                {[
                  { id: "scrum", label: "Scrum", sub: "Fixed sprints (1-2 weeks) · Story points · Velocity tracking" },
                  { id: "kanban", label: "Kanban", sub: "Continuous flow · WIP limits · Cycle time focus" },
                  { id: "shapeup", label: "Shape Up", sub: "6-week cycles · Pitches not stories · Fixed appetite" },
                ].map(m => (
                  <div key={m.id} onClick={() => setModel(m.id)} style={{
                    border: `2px solid ${model === m.id ? T.accent : T.border}`, borderRadius: 8, padding: "12px 16px",
                    cursor: "pointer", background: model === m.id ? T.accent + "08" : T.bg, transition: ".12s",
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3, color: model === m.id ? T.accent : T.text }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: T.textMuted }}>{m.sub}</div>
                  </div>
                ))}
              </div>
              <button className="btn btn-p w-full" style={{ justifyContent: "center", padding: 11 }} onClick={() => setStep(2)}>
                Lock in {model.charAt(0).toUpperCase() + model.slice(1)} →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Connect GitHub ── */}
        {step === 2 && (
          <div className="card" style={{ padding: 32 }}>
            <div className="flex items-c gap-10 mb-6">
              <Ico n="checkCircle" s={14} c={T.success} />
              <span style={{ fontSize: 12, color: T.success, fontWeight: 700 }}>Plan locked · {model.charAt(0).toUpperCase() + model.slice(1)} selected</span>
            </div>
            <div className="brg fw-7" style={{ fontSize: 18, marginBottom: 8 }}>Initialize the Lifeline.</div>
            <div style={{ fontSize: 12, color: T.textSub, marginBottom: 20, lineHeight: 1.7 }}>
              Connect GitHub to activate the IDE, PR tracking, and auto-commit → issue linking.
              Your plan is already built — this is just the final handshake.
            </div>

            <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: 14, marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: T.textMuted, letterSpacing: "0.1em", marginBottom: 8 }}>What this unlocks</div>
              {[
                "IDE opens the exact file for each issue",
                "PRs auto-link to issues on branch name",
                "Commits appear in the issue thread",
                "AI context seeded with your codebase structure",
              ].map((item, i) => (
                <div key={i} className="flex gap-8 mb-6">
                  <Ico n="check" s={11} c={T.success} style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: T.textSub }}>{item}</span>
                </div>
              ))}
            </div>

            <label className="lbl">GitHub Personal Access Token</label>
            <input className="inp" type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={githubPat} onChange={e => setGithubPat(e.target.value)}
              style={{ marginBottom: 8, fontFamily: "'DM Mono', monospace" }} />
            <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 20 }}>
              Needs: repo, read:org — <span style={{ color: T.accent, cursor: "pointer" }}>Generate token ↗</span>
            </div>

            <div className="flex gap-8">
              <button className="btn btn-p flex-1" style={{ justifyContent: "center", padding: 11 }}
                onClick={connect} disabled={connecting}>
                {connecting ? (
                  <span className="flex items-c gap-8"><span style={{ animation: "pulse 1s infinite" }}>⟳</span> Connecting…</span>
                ) : "Connect GitHub & Enter →"}
              </button>
              <button className="btn btn-g" style={{ padding: 11 }} onClick={onComplete}>
                Skip for now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ══ DASHBOARD ══════════════════════════════════════════════ */
const Dashboard = ({ T, setRoute, setIssue }) => {
  const inProg = ISSUES.filter(i => i.status === "in_progress");
  const critical = ISSUES.filter(i => i.priority === "critical");
  const myIssues = ISSUES.filter(i => i.assignee === "u1");

  return (
    <div style={{ padding: 28 }} className="fade-in">
      {/* Sprint banner */}
      <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: "18px 24px", marginBottom: 24, display: "flex", alignItems: "center", gap: 20 }}>
        <div>
          <div className="brg fw-7" style={{ fontSize: 17 }}>Good morning, Alex.</div>
          <div style={{ fontSize: 11, color: T.textSub, marginTop: 2 }}>
            <span style={{ color: T.accent, fontWeight: 600 }}>{SPRINT.name}</span> · {SPRINT.goal}
          </div>
        </div>
        <div style={{ flex: 1, maxWidth: 200 }}>
          <div className="flex items-c jc-sb mb-4" style={{ fontSize: 11 }}>
            <span style={{ color: T.textSub }}>Sprint progress</span>
            <span style={{ fontWeight: 700, color: T.accent }}>{SPRINT.pointsDone}/{SPRINT.pointsTotal}pt</span>
          </div>
          <ProgBar v={SPRINT.pointsDone} max={SPRINT.pointsTotal} c={T.accent} h={5} />
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>{SPRINT.start} → {SPRINT.end}</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-g btn-sm" onClick={() => setRoute("sprint-board")}>
          <Ico n="layers" s={12} /> Sprint board
        </button>
        <button className="btn btn-p btn-sm">
          <Ico n="plus" s={12} /> New issue
        </button>
      </div>

      {/* Stats */}
      <div className="g4 mb-20">
        <StatCard label="In progress" value={inProg.length} sub="issues active" color={T.accent} icon="activity" delta={8} />
        <StatCard label="Sprint velocity" value={`${SPRINT.pointsDone}pt`} sub="of 24 this sprint" color={T.success} icon="trend" />
        <StatCard label="Critical" value={critical.length} sub="need attention" color={T.danger} icon="alert" />
        <StatCard label="CRM pipeline" value="$216k" sub="open deals" color={T.accentWarm} icon="brief" delta={12} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16 }}>
        {/* My issues — the thread view */}
        <div>
          <div className="card" style={{ padding: 0, marginBottom: 16 }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div className="brg fw-6" style={{ fontSize: 14 }}>My issues</div>
              <button className="btn btn-g btn-sm" onClick={() => setRoute("backlog")}>View all</button>
            </div>
            {myIssues.map(issue => (
              <div key={issue.id} className="iss-row" onClick={() => setIssue(issue)}>
                <Prio p={issue.priority} />
                <span style={{ fontSize: 10, color: T.textMuted, width: 60, flexShrink: 0, fontWeight: 600 }}>{issue.id}</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 500 }} className="trunc">{issue.title}</span>
                <div className="flex items-c gap-6">
                  <StatusChip s={issue.status} />
                  {issue.chatCount > 0 && (
                    <span style={{ fontSize: 10, color: T.textMuted, display: "flex", alignItems: "center", gap: 3 }}>
                      <Ico n="chat" s={10} /> {issue.chatCount}
                    </span>
                  )}
                  {issue.crmContext && (
                    <Tip text={`${issue.crmContext.account} · ${issue.crmContext.health}`}>
                      <Ico n="brief" s={11} c={T.accentWarm} />
                    </Tip>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Thread activity */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}` }}>
              <div className="brg fw-6" style={{ fontSize: 14 }}>Thread activity</div>
            </div>
            <div style={{ position: "relative", padding: "10px 18px 10px 42px" }}>
              <div style={{ position: "absolute", left: 28, top: 0, bottom: 0, width: 1, background: T.border }} />
              {ISSUES[0].thread.slice(-4).map((item, i) => {
                const actor = USERS[item.actor];
                const icons = { created: "plus", comment: "chat", mentioned: "at", commit: "git", pr: "gitpr", review: "checkCircle" };
                const colors = { created: T.textMuted, comment: T.accent, mentioned: T.accentPurple, commit: T.success, pr: T.accentWarm, review: T.success };
                return (
                  <div key={i} className="flex gap-10" style={{ padding: "8px 0", borderBottom: i < 3 ? `1px solid ${T.border}` : "none" }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: (colors[item.type] || T.textMuted) + "18", border: `1px solid ${(colors[item.type] || T.textMuted)}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginLeft: -28, marginRight: 8 }}>
                      <Ico n={icons[item.type] || "chat"} s={9} c={colors[item.type] || T.textMuted} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>
                        {actor?.name}
                        <span style={{ fontWeight: 400, color: T.textMuted, marginLeft: 6 }}>{item.ts}</span>
                        <span style={{ marginLeft: 6, color: T.accent, fontSize: 10 }}>RC-001</span>
                      </div>
                      <div style={{ fontSize: 11, color: T.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.body}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="flex col gap-14">
          {/* Burndown */}
          <div className="card">
            <div className="flex items-c jc-sb mb-10">
              <div className="brg fw-6" style={{ fontSize: 13 }}>Burndown</div>
              <div className="flex gap-10" style={{ fontSize: 10, color: T.textMuted }}>
                <span className="flex items-c gap-4">
                  <div style={{ width: 14, height: 1, borderTop: "2px dashed #333340" }} />Ideal
                </span>
                <span className="flex items-c gap-4">
                  <div style={{ width: 14, height: 2, background: T.accent, borderRadius: 1 }} />Actual
                </span>
              </div>
            </div>
            <Burndown h={80} />
            <div className="flex jc-sb mt-4" style={{ fontSize: 9, color: T.textMuted }}>
              <span>Mar 1</span><span>Mar 14</span>
            </div>
          </div>

          {/* Recent chat */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
              <div className="brg fw-6" style={{ fontSize: 13 }}>Recent mentions</div>
            </div>
            {MSGS.c1.filter(m => m.urgent || m.ref).slice(0, 3).map(m => {
              const u = USERS[m.author];
              return (
                <div key={m.id} className="flex gap-10 p-12" style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.surface2}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  {u && <Av uid={m.author} size="sm" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600 }}>{u?.name} <span style={{ fontWeight: 400, color: T.textMuted }}>{m.ts}</span></div>
                    <div style={{ fontSize: 11, color: T.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.body}</div>
                    {m.ref && <span style={{ fontSize: 10, color: T.accent, fontWeight: 600 }}>{m.ref}</span>}
                    {m.urgent && <span className="chip chip-red fs-9">urgent</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* CRM critical account */}
          <div className="card" style={{ borderColor: T.danger + "44", background: T.danger + "06" }}>
            <div className="flex items-c gap-8 mb-10">
              <Ico n="alert" s={13} c={T.danger} />
              <span style={{ fontSize: 11, fontWeight: 700, color: T.danger }}>At-risk account</span>
            </div>
            <div className="brg fw-7" style={{ fontSize: 15, marginBottom: 4 }}>Northstar Labs</div>
            <div style={{ fontSize: 11, color: T.textSub, marginBottom: 10 }}>$24k ARR · 4 open issues · 8 logouts today</div>
            <div className="flex gap-8">
              <button className="btn btn-g btn-sm flex-1" style={{ justifyContent: "center" }} onClick={() => setRoute("crm")}>View account</button>
              <button className="btn btn-g btn-sm" onClick={() => setIssue(ISSUES[0])}><Ico n="link" s={11} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══ SPRINT BOARD ═══════════════════════════════════════════ */
const SprintBoard = ({ T, setIssue }) => {
  const [issues, setIssues] = useState(ISSUES);
  const [dragging, setDragging] = useState(null);
  const cols = ["todo", "in_progress", "review", "done"];
  const colLabels = { todo: "To Do", in_progress: "In Progress", review: "Review", done: "Done" };
  const colColors = { todo: T.textMuted, in_progress: T.accent, review: T.accentPurple, done: T.success };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }} className="fade-in">
      {/* Sprint header */}
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
        <div className="brg fw-6" style={{ fontSize: 14 }}>{SPRINT.name}</div>
        <span className="chip chip-teal">active</span>
        <span style={{ fontSize: 11, color: T.textSub }}>{SPRINT.goal}</span>
        <div style={{ flex: 1 }} />
        <div style={{ width: 100 }}><ProgBar v={SPRINT.pointsDone} max={SPRINT.pointsTotal} c={T.accent} h={4} /></div>
        <span style={{ fontSize: 11, color: T.textMuted }}>{SPRINT.pointsDone}/{SPRINT.pointsTotal}pt · {SPRINT.start}–{SPRINT.end}</span>
        <button className="btn btn-p btn-sm"><Ico n="plus" s={12}/> Issue</button>
      </div>

      {/* Board */}
      <div style={{ flex: 1, display: "flex", overflow: "auto" }}>
        {cols.map(col => {
          const colIssues = issues.filter(i => i.status === col);
          return (
            <div key={col} className="board-col"
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                if (dragging) {
                  setIssues(prev => prev.map(i => i.id === dragging ? { ...i, status: col } : i));
                  setDragging(null);
                }
              }}>
              <div className="board-col-hd">
                <div className="flex items-c gap-8">
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: colColors[col] }} />
                  <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: T.textMuted }}>{colLabels[col]}</span>
                  <span style={{ fontSize: 10, background: T.surface3, color: T.textMuted, padding: "1px 6px", borderRadius: 8 }}>{colIssues.length}</span>
                </div>
                {col === "todo" && (
                  <button className="btn-ico" style={{ padding: 3 }}><Ico n="plus" s={12}/></button>
                )}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "2px 0" }}>
                {colIssues.map(issue => (
                  <div key={issue.id} className={`board-card${dragging === issue.id ? " dragging" : ""}`}
                    draggable onDragStart={() => setDragging(issue.id)} onDragEnd={() => setDragging(null)}
                    onClick={() => setIssue(issue)}>
                    <div className="flex jc-sb mb-8">
                      <Prio p={issue.priority} />
                      <span style={{ fontSize: 9, color: T.textMuted, fontWeight: 700 }}>{issue.id}</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.4, marginBottom: 8 }}>{issue.title}</div>

                    {/* Tags */}
                    <div className="flex gap-4 flex-wrap mb-8">
                      {issue.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="chip chip-dim" style={{ fontSize: 9 }}>{tag}</span>
                      ))}
                    </div>

                    {/* Thread indicators — the value prop */}
                    <div className="flex items-c gap-6 mb-8" style={{ fontSize: 10, color: T.textMuted }}>
                      {issue.chatCount > 0 && <span className="flex items-c gap-3"><Ico n="chat" s={10}/> {issue.chatCount}</span>}
                      {issue.prLinked && <span className="flex items-c gap-3"><Ico n="gitpr" s={10} c={T.success}/> PR</span>}
                      {issue.docLinked && <span className="flex items-c gap-3"><Ico n="book" s={10} c={T.accent}/> Doc</span>}
                      {issue.crmContext && <span className="flex items-c gap-3"><Ico n="brief" s={10} c={T.accentWarm}/> CRM</span>}
                    </div>

                    <div className="flex items-c jc-sb">
                      <Av uid={issue.assignee} size="xs" showStatus />
                      <span className="chip chip-dim" style={{ fontSize: 9 }}>{issue.points}pt</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ══ BACKLOG ════════════════════════════════════════════════ */
/* ══ ISSUES ══════════════════════════════════════════════════ */
const Issues = ({ T, setIssue }) => {
  const [q, setQ]           = useState("");
  const [statusF, setStatusF] = useState("all");
  const [priorityF, setPriorityF] = useState("all");
  const [groupBy, setGroupBy] = useState("none"); // none | status | priority | assignee

  const filtered = ISSUES.filter(i =>
    (statusF   === "all" || i.status   === statusF) &&
    (priorityF === "all" || i.priority === priorityF) &&
    (q === "" || i.title.toLowerCase().includes(q.toLowerCase()) || i.id.toLowerCase().includes(q.toLowerCase()))
  );

  // Group issues
  const grouped = (() => {
    if (groupBy === "none") return { "All Issues": filtered };
    if (groupBy === "status") {
      const g = {};
      filtered.forEach(i => { (g[i.status] = g[i.status] || []).push(i); });
      return g;
    }
    if (groupBy === "priority") {
      const g = {};
      filtered.forEach(i => { (g[i.priority] = g[i.priority] || []).push(i); });
      return g;
    }
    if (groupBy === "assignee") {
      const g = {};
      filtered.forEach(i => { const name = USERS[i.assignee]?.name || "Unassigned"; (g[name] = g[name] || []).push(i); });
      return g;
    }
    return { "All Issues": filtered };
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }} className="fade-in">
      {/* Toolbar */}
      <div style={{ padding: "10px 20px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <div className="brg fw-6" style={{ fontSize: 14 }}>Issues</div>
        <span style={{ fontSize: 11, color: T.textMuted }}>— {filtered.length} of {ISSUES.length}</span>
        <div style={{ position: "relative", marginLeft: 8 }}>
          <Ico n="search" s={11} c={T.textMuted} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }} />
          <input className="inp" style={{ paddingLeft: 26, height: 28, fontSize: 11, width: 220 }} placeholder="Filter issues…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div style={{ flex: 1 }} />
        {/* Status filter */}
        {["all","todo","in_progress","review","done"].map(f => (
          <button key={f} className={`btn btn-sm ${statusF===f ? "btn-p" : "btn-g"}`} onClick={() => setStatusF(f)} style={{ fontSize: 10 }}>
            {f === "all" ? "All" : STATUS[f]?.label || f}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: T.border }} />
        {/* Group by */}
        <select value={groupBy} onChange={e => setGroupBy(e.target.value)}
          style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 5, color: T.text, fontSize: 10, padding: "3px 8px", cursor: "pointer" }}>
          <option value="none">No grouping</option>
          <option value="status">Group by Status</option>
          <option value="priority">Group by Priority</option>
          <option value="assignee">Group by Assignee</option>
        </select>
        <button className="btn btn-p btn-sm"><Ico n="plus" s={12}/> Issue</button>
      </div>

      {/* Issue table */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {Object.entries(grouped).map(([group, issues]) => (
          <div key={group}>
            {groupBy !== "none" && (
              <div style={{ padding: "10px 20px 4px", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: T.textMuted, background: T.surface2, borderBottom: `1px solid ${T.border}` }}>
                {group} <span style={{ color: T.textMuted, fontWeight: 400 }}>({issues.length})</span>
              </div>
            )}
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 24 }}></th>
                  <th style={{ width: 72 }}>ID</th>
                  <th>Title</th>
                  <th style={{ width: 90 }}>Status</th>
                  <th style={{ width: 72 }}>Priority</th>
                  <th style={{ width: 60 }}>Points</th>
                  <th style={{ width: 80 }}>Assignee</th>
                  <th style={{ width: 60 }}>CRM</th>
                </tr>
              </thead>
              <tbody>
                {issues.map(iss => (
                  <tr key={iss.id} onClick={() => setIssue(iss)} style={{ cursor: "pointer" }}>
                    <td><Prio p={iss.priority} /></td>
                    <td><span style={{ color: T.accent, fontWeight: 700, fontSize: 11 }}>{iss.id}</span></td>
                    <td><span style={{ fontSize: 12, fontWeight: 500 }}>{iss.title}</span></td>
                    <td><StatusChip s={iss.status} /></td>
                    <td><span style={{ fontSize: 10, color: T.textMuted, textTransform: "capitalize" }}>{iss.priority}</span></td>
                    <td><span style={{ fontSize: 11, color: T.textMuted }}>{iss.points}pt</span></td>
                    <td><div className="flex items-c gap-5"><Av uid={iss.assignee} size="xs" /><span style={{ fontSize: 10 }} className="trunc">{USERS[iss.assignee]?.name?.split(" ")[0]}</span></div></td>
                    <td>{iss.crmContext && <span style={{ fontSize: 9, color: T.accentWarm, fontWeight: 700 }}>● CRM</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
};

const Backlog = ({ T, setIssue }) => {
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const filtered = ISSUES.filter(i =>
    (filter === "all" || i.status === filter) &&
    (q === "" || i.title.toLowerCase().includes(q.toLowerCase()) || i.id.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }} className="fade-in">
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <div className="brg fw-6" style={{ fontSize: 14 }}>Backlog</div>
        <span style={{ fontSize: 11, color: T.textMuted }}>— {ISSUES.length} issues</span>
        <div style={{ flex: 1, maxWidth: 260, margin: "0 12px" }}>
          <div style={{ position: "relative" }}>
            <Ico n="search" s={11} c={T.textMuted} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)" }} />
            <input className="inp" style={{ paddingLeft: 26, height: 28, fontSize: 11 }} placeholder="Filter issues…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {["all", "todo", "in_progress", "review", "done"].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? "btn-p" : "btn-g"}`} onClick={() => setFilter(f)}>
            {f === "all" ? "All" : STATUS[f]?.label || f}
          </button>
        ))}
        <button className="btn btn-p btn-sm"><Ico n="plus" s={12}/> Issue</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 20 }}></th>
              <th style={{ width: 75 }}>ID</th>
              <th>Title</th>
              <th style={{ width: 120 }}>Status</th>
              <th style={{ width: 50 }}>Pts</th>
              <th style={{ width: 100 }}>Assignee</th>
              <th style={{ width: 120 }}>Thread</th>
              <th style={{ width: 100 }}>Branch</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(issue => (
              <tr key={issue.id} style={{ cursor: "pointer" }} onClick={() => setIssue(issue)}>
                <td><Prio p={issue.priority} /></td>
                <td><span style={{ fontSize: 10, color: T.textMuted, fontWeight: 700 }}>{issue.id}</span></td>
                <td>
                  <div className="flex items-c gap-8">
                    <span style={{ fontWeight: 500 }}>{issue.title}</span>
                    {issue.crmContext && (
                      <Tip text={`${issue.crmContext.account} · ${issue.crmContext.health}`}>
                        <span className="chip chip-ylw" style={{ fontSize: 9 }}><Ico n="brief" s={9} /> CRM</span>
                      </Tip>
                    )}
                  </div>
                </td>
                <td><StatusChip s={issue.status} /></td>
                <td><span className="chip chip-dim">{issue.points}</span></td>
                <td>
                  <div className="flex items-c gap-6">
                    <Av uid={issue.assignee} size="xs" />
                    <span style={{ fontSize: 11 }}>{USERS[issue.assignee]?.name.split(" ")[0]}</span>
                  </div>
                </td>
                <td>
                  <div className="flex gap-6">
                    {issue.chatCount > 0 && <span style={{ fontSize: 10, color: T.textMuted }}><Ico n="chat" s={10}/> {issue.chatCount}</span>}
                    {issue.prLinked && <Ico n="gitpr" s={10} c={T.success} />}
                    {issue.docLinked && <Ico n="book" s={10} c={T.accent} />}
                  </div>
                </td>
                <td>
                  {issue.branch
                    ? <span className="chip chip-dim" style={{ fontSize: 9 }}><Ico n="git" s={9}/> {issue.branch.split("/")[1]}</span>
                    : <span style={{ color: T.textMuted, fontSize: 10 }}>—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ══ ROADMAP ════════════════════════════════════════════════ */
/* ── Views sub-boards (must be top-level components so hooks are stable) ── */
const ScrumBoard = ({ T, setIssue }) => {
  const cols = ["todo", "in_progress", "review", "done"];
  const colLabels = { todo: "To Do", in_progress: "In Progress", review: "Review", done: "Done" };
  const colColors = { todo: T.textMuted, in_progress: T.accent, review: T.accentPurple, done: T.success };
  const [issues, setIssues] = useState(ISSUES);
  const [dragging, setDragging] = useState(null);
  return (
    <div>
      <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "12px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
        <span className="brg fw-7" style={{ fontSize: 13 }}>{SPRINT.name}</span>
        <span className="chip chip-teal" style={{ fontSize: 9 }}>active</span>
        <span style={{ fontSize: 11, color: T.textSub, flex: 1 }}>{SPRINT.goal}</span>
        <div style={{ width: 90 }}><ProgBar v={SPRINT.pointsDone} max={SPRINT.pointsTotal} c={T.accent} h={4} /></div>
        <span style={{ fontSize: 10, color: T.textMuted }}>{SPRINT.pointsDone}/{SPRINT.pointsTotal}pt</span>
      </div>
      <div style={{ display: "flex", gap: 10, overflowX: "auto" }}>
        {cols.map(col => {
          const colIssues = issues.filter(i => i.status === col);
          return (
            <div key={col} style={{ flex: "0 0 200px", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragging) { setIssues(p => p.map(i => i.id === dragging ? { ...i, status: col } : i)); setDragging(null); } }}>
              <div style={{ padding: "8px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: colColors[col] }} />
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted }}>{colLabels[col]}</span>
                <span style={{ fontSize: 10, marginLeft: "auto", background: T.surface3, padding: "1px 5px", borderRadius: 8, color: T.textMuted }}>{colIssues.length}</span>
              </div>
              <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {colIssues.map(iss => (
                  <div key={iss.id} draggable onDragStart={() => setDragging(iss.id)} onClick={() => setIssue(iss)}
                    style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 10px", cursor: "grab" }}>
                    <div className="flex items-c gap-6 mb-4"><Prio p={iss.priority} /><span style={{ fontSize: 10, color: T.accent, fontWeight: 700 }}>{iss.id}</span></div>
                    <div style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.4 }} className="trunc">{iss.title}</div>
                    <div className="flex items-c gap-6 mt-6">
                      <span style={{ fontSize: 10, color: T.textMuted }}>{iss.points}pt</span>
                      {iss.assignee && <Av uid={iss.assignee} size="xs" style={{ marginLeft: "auto" }} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="flex items-c jc-sb mb-8">
          <span className="brg fw-6" style={{ fontSize: 12 }}>Burndown · Sprint 12</span>
          <div className="flex gap-10" style={{ fontSize: 9, color: T.textMuted }}>
            <span className="flex items-c gap-4"><div style={{ width: 14, height: 1, borderTop: "2px dashed #333340" }} />Ideal</span>
            <span className="flex items-c gap-4"><div style={{ width: 14, height: 2, background: T.accent, borderRadius: 1 }} />Actual</span>
          </div>
        </div>
        <Burndown h={70} />
      </div>
    </div>
  );
};

const KanbanBoard = ({ T, setIssue }) => {
  const COLS = [
    { id: "todo",        label: "Backlog",     wip: null, color: T.textMuted },
    { id: "in_progress", label: "In Progress", wip: 3,    color: T.accent },
    { id: "review",      label: "Review",      wip: 2,    color: T.accentPurple },
    { id: "done",        label: "Done",        wip: null, color: T.success },
  ];
  const [issues, setIssues] = useState(ISSUES);
  const [dragging, setDragging] = useState(null);
  return (
    <div>
      <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 16px", marginBottom: 14, display: "flex", gap: 20, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: T.textMuted }}>WIP limits:</span>
        {COLS.filter(c => c.wip).map(c => {
          const cnt = issues.filter(i => i.status === c.id).length;
          const over = cnt > c.wip;
          return (
            <span key={c.id} style={{ fontSize: 11, color: over ? T.danger : T.textSub, fontWeight: over ? 700 : 400 }}>
              {c.label} <strong style={{ color: over ? T.danger : c.color }}>{cnt}/{c.wip}</strong>
              {over && <span style={{ color: T.danger, marginLeft: 4 }}>⚠ over limit</span>}
            </span>
          );
        })}
        <span style={{ marginLeft: "auto", fontSize: 10, color: T.textMuted }}>Avg cycle time: <strong style={{ color: T.accentPurple }}>3.2d</strong></span>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        {COLS.map(col => {
          const colIssues = issues.filter(i => i.status === col.id);
          const over = col.wip && colIssues.length > col.wip;
          return (
            <div key={col.id} style={{ flex: "0 0 190px", background: T.surface, border: `2px solid ${over ? T.danger : T.border}`, borderRadius: 8, overflow: "hidden", transition: ".15s" }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => { if (dragging) { setIssues(p => p.map(i => i.id === dragging ? { ...i, status: col.id } : i)); setDragging(null); } }}>
              <div style={{ padding: "8px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: col.color }} />
                <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", color: T.textMuted }}>{col.label}</span>
                {col.wip && <span style={{ marginLeft: "auto", fontSize: 10, color: over ? T.danger : T.textMuted, fontWeight: 700 }}>WIP {col.wip}</span>}
              </div>
              <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {colIssues.map(iss => (
                  <div key={iss.id} draggable onDragStart={() => setDragging(iss.id)} onClick={() => setIssue(iss)}
                    style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 6, padding: "8px 10px", cursor: "grab" }}>
                    <div className="flex items-c gap-5 mb-3">
                      <Prio p={iss.priority} />
                      <span style={{ fontSize: 10, color: T.accent, fontWeight: 700 }}>{iss.id}</span>
                      {iss.crmContext && <Ico n="brief" s={9} c={T.accentWarm} style={{ marginLeft: "auto" }} />}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.4 }} className="trunc">{iss.title}</div>
                    <div style={{ fontSize: 10, color: T.textMuted, marginTop: 5 }}>SLA: 5d</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="flex items-c jc-sb mb-8">
          <span className="brg fw-6" style={{ fontSize: 12 }}>Cycle time distribution</span>
          <span style={{ fontSize: 10, color: T.textMuted }}>p50: 2.8d · p85: 5.1d · p95: 9d</span>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 56 }}>
          {[2,5,9,12,8,6,4,3,2,1].map((v, i) => (
            <div key={i} style={{ flex: 1, height: `${(v/12)*54}px`, background: i < 4 ? T.success+"88" : i < 7 ? T.warn+"88" : T.danger+"88", borderRadius: "2px 2px 0 0" }} />
          ))}
        </div>
        <div className="flex jc-sb mt-2" style={{ fontSize: 9, color: T.textMuted }}><span>1d</span><span>5d</span><span>10d</span></div>
      </div>
    </div>
  );
};

const ShapeUpBoard = ({ T, setIssue }) => {
  const CYCLE_DAYS = 42, daysPast = 9;
  const pct = Math.round((daysPast / CYCLE_DAYS) * 100);
  const pitches = [
    { id: "RC-001", title: "Auth token refresh race condition", appetite: "S", status: "in_progress", team: ["u1","u2"], scope: "narrowed" },
    { id: "RC-004", title: "CRM pipeline v1",                  appetite: "M", status: "in_progress", team: ["u3"],       scope: "on-track" },
    { id: "RC-005", title: "IDE Monaco core",                  appetite: "L", status: "done",        team: ["u1","u4"],  scope: "shipped" },
  ];
  const APPETITE = { S: { label: "Small (1w)", color: T.success }, M: { label: "Medium (2w)", color: T.warn }, L: { label: "Large (6w)", color: T.danger } };
  return (
    <div>
      <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "14px 18px", marginBottom: 16 }}>
        <div className="flex items-c jc-sb mb-8">
          <div><span className="brg fw-7" style={{ fontSize: 13 }}>Cycle 3 · Build</span><span style={{ fontSize: 10, color: T.textMuted, marginLeft: 10 }}>Day {daysPast} of {CYCLE_DAYS} · Feb 28 – Apr 11</span></div>
          <span style={{ fontSize: 11, color: T.accentWarm, fontWeight: 700 }}>{pct}% through cycle</span>
        </div>
        <ProgBar v={daysPast} max={CYCLE_DAYS} c={T.accentWarm} h={6} />
        <div className="flex jc-sb mt-4" style={{ fontSize: 10, color: T.textMuted }}><span>▸ Build (6 weeks)</span><span>▸ Cooldown (Apr 12–25)</span></div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: T.textMuted, marginBottom: 10 }}>Pitches in this cycle</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {pitches.map(p => (
          <div key={p.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "14px 16px", cursor: "pointer" }}
            onClick={() => setIssue(ISSUES.find(i => i.id === p.id) || ISSUES[0])}>
            <div className="flex items-c gap-10 mb-6">
              <Prio p="high" />
              <span style={{ fontSize: 10, color: T.accent, fontWeight: 700 }}>{p.id}</span>
              <span className="brg fw-6" style={{ fontSize: 13, flex: 1 }}>{p.title}</span>
              <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: APPETITE[p.appetite].color+"18", color: APPETITE[p.appetite].color, fontWeight: 700 }}>{APPETITE[p.appetite].label}</span>
              <StatusChip s={p.status} />
            </div>
            <div className="flex items-c gap-10">
              <div className="flex gap-4">{p.team.map(uid => <Av key={uid} uid={uid} size="xs" />)}</div>
              <span style={{ fontSize: 10, color: T.textMuted }}>Scope: <strong style={{ color: p.scope === "narrowed" ? T.warn : p.scope === "shipped" ? T.success : T.textSub }}>{p.scope}</strong></span>
              <span style={{ fontSize: 10, color: T.textMuted, marginLeft: "auto" }}>Scope hammer available</span>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="brg fw-6" style={{ fontSize: 12, marginBottom: 10 }}>Cooldown queue</div>
        {ISSUES.filter(i => i.status === "todo").slice(0, 2).map(iss => (
          <div key={iss.id} className="flex items-c gap-8 mb-6" style={{ cursor: "pointer" }} onClick={() => setIssue(iss)}>
            <Prio p={iss.priority} />
            <span style={{ fontSize: 10, color: T.accent, fontWeight: 700 }}>{iss.id}</span>
            <span style={{ fontSize: 11, flex: 1 }} className="trunc">{iss.title}</span>
            <span style={{ fontSize: 10, color: T.textMuted }}>cooldown</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Views = ({ T, setIssue }) => {
  const [activeView, setActiveView] = useState("scrum");

  const VIEWS = {
    scrum: {
      label: "Scrum", icon: "⬡", color: T.accent,
      tagline: "The classic: predictable cycles, cross-functional, committed to sprints.",
      traits: [
        { trait: "Rhythm",     detail: "Fixed sprints (1–2 weeks), sprint planning, reviews, retrospectives." },
        { trait: "Planning",   detail: "Story pointing, velocity tracking, backlog refinement." },
        { trait: "Team Size",  detail: "5–9 per team, multiple squads in larger orgs." },
        { trait: "Artifacts",  detail: "Sprint board, burndown chart, velocity report, definition of done." },
        { trait: "Pain Point", detail: "Ceremonies feel administrative; tools become the source of truth instead of the work." },
      ],
      need: "Predictable sprint workflows, easy estimation, clear definition of done, minimal ceremony friction.",
      Board: ScrumBoard,
    },
    kanban: {
      label: "Kanban", icon: "◈", color: T.accentPurple,
      tagline: "Continuous delivery, ops-heavy, support rotations, or unpredictable work.",
      traits: [
        { trait: "Rhythm",     detail: "No fixed sprints. Work flows continuously based on priority and capacity." },
        { trait: "Planning",   detail: "WIP limits, cycle time focus, cumulative flow diagrams." },
        { trait: "Team Size",  detail: "Often smaller (3–6) or part of larger SRE/platform teams." },
        { trait: "Artifacts",  detail: "Kanban board with swimlanes, SLAs, cycle time histograms." },
        { trait: "Pain Point", detail: "Sprint-based tools force artificial boundaries. WIP limits are ignored or hard to enforce." },
      ],
      need: "No forced sprints, visual WIP limits, SLA tracking, fast prioritization, minimal overhead.",
      Board: KanbanBoard,
    },
    shapeup: {
      label: "Shape Up", icon: "◎", color: T.accentWarm,
      tagline: "Basecamp-inspired: six-week cycles, appetite-based, designer/developer pairs.",
      traits: [
        { trait: "Rhythm",     detail: "Fixed cycles (6 weeks), then 2 weeks cooldown. No daily standups in the traditional sense." },
        { trait: "Planning",   detail: '"Pitches" instead of user stories. Fixed time, variable scope.' },
        { trait: "Team Size",  detail: "Small, autonomous teams (2–4). Often used in product studios." },
        { trait: "Artifacts",  detail: "Pitch documents, cycle plans, scope hammers." },
        { trait: "Pain Point", detail: "Traditional agile tools force story points and daily updates. Shape-Up feels rebellious." },
      ],
      need: "No forced story points, pitch-based planning, fixed appetite, scope hammering, cooldown visibility.",
      Board: ShapeUpBoard,
    },
  };

  const V = VIEWS[activeView];
  const { Board } = V;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }} className="fade-in">

      {/* Left panel — view switcher */}
      <div style={{ width: 220, borderRight: `1px solid ${T.border}`, background: T.surface, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${T.border}` }}>
          <div className="brg fw-7" style={{ fontSize: 14, marginBottom: 2 }}>Views</div>
          <div style={{ fontSize: 10, color: T.textMuted }}>Choose your team's methodology</div>
        </div>
        <div style={{ flex: 1, padding: "8px 0" }}>
          {Object.entries(VIEWS).map(([key, v]) => (
            <div key={key} className={`nav-item${activeView === key ? " active" : ""}`} onClick={() => setActiveView(key)}>
              <span style={{ fontSize: 14, lineHeight: 1, color: v.color }}>{v.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{v.label}</div>
                <div style={{ fontSize: 10, color: T.textMuted }} className="trunc">{v.tagline.split(":")[0]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — traits + live board */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24, background: T.bg }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div className="flex items-c gap-10 mb-4">
            <span style={{ fontSize: 22, color: V.color }}>{V.icon}</span>
            <div>
              <div className="brg fw-7" style={{ fontSize: 20 }}>{V.label} View</div>
              <div style={{ fontSize: 12, color: T.textSub }}>{V.tagline}</div>
            </div>
          </div>
        </div>

        {/* Traits table */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
          {V.traits.map((row, i) => (
            <div key={row.trait} style={{ display: "flex", borderBottom: i < V.traits.length - 1 ? `1px solid ${T.border}` : "none" }}>
              <div style={{ width: 110, padding: "10px 14px", fontSize: 10, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0, background: T.surface2 }}>{row.trait}</div>
              <div style={{ padding: "10px 16px", fontSize: 12, color: T.textSub, lineHeight: 1.6 }}>{row.detail}</div>
            </div>
          ))}
        </div>

        {/* What they need */}
        <div style={{ background: V.color + "0d", border: `1px solid ${V.color}30`, borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: V.color, marginBottom: 4 }}>What this team needs from REACH</div>
          <div style={{ fontSize: 12, color: T.textSub, lineHeight: 1.7 }}>{V.need}</div>
        </div>

        {/* Live board for this view */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: T.textMuted, marginBottom: 12 }}>Live {V.label} board — every card is an issue</div>
          <Board T={T} setIssue={setIssue} />
        </div>
      </div>
    </div>
  );
};

/* ══ IDE ════════════════════════════════════════════════════ */
const IDE = ({ T, setIssue }) => {
  // ── LEFT RAIL STATE ── icon bar like images show
  const [leftPanel, setLeftPanel] = useState("explorer"); // explorer | search | git | extensions | plan | null
  const toggleLeft = (p) => setLeftPanel(prev => prev === p ? null : p);

  // ── RIGHT PANEL STATE ──
  const [rightTab, setRightTab]   = useState("ai");       // ai | terminal | preview
  const [rightOpen, setRightOpen] = useState(true);

  // ── EDITOR STATE ──
  const [activeFile, setActiveFile] = useState("api.ts");
  const [openTabs, setOpenTabs]     = useState([
    { name: "api.ts", dirty: true },
    { name: "Modal.tsx", dirty: false },
    { name: "useSubscription.ts", dirty: false, added: true },
  ]);
  const [openFolders, setOpenFolders] = useState({ src: true, app: true, components: false, lib: true, public: false, "supabase/functions": false });

  // ── PLAN STATE ──
  const [outputFidelity, setOutputFidelity] = useState("mvp");
  const [planSteps, setPlanSteps] = useState([
    { id: "translate", label: "Idea to Language",      phase: "TRANSLATE", status: "done",    checklist: ["Extract domain terms","Map to code principles","Generate PRD outline"] },
    { id: "prd",       label: "Product Requirements",  phase: "PRD",       status: "done",    checklist: ["Problem statement","Acceptance criteria","ADR decisions"] },
    { id: "plan",      label: "Dev Plan Generation",   phase: "PLAN",      status: "active",  checklist: ["Break PRD into 50 steps max","Each step: max 10 mini-tasks, clear input/output","Assign frontend / backend / API / infra labels","Pin reference doc to session context"] },
    { id: "code",      label: "Guided Implementation", phase: "CODE",      status: "pending", checklist: [] },
    { id: "ship",      label: "Deploy Pipeline",       phase: "SHIP",      status: "pending", checklist: [] },
  ]);
  const [devPlan] = useState([
    { n: 1, label: "App shell + routing",         domain: "FE", tags: ["Create Next.js app","Configure TypeScript","Set up Tailwind"],      status: "done" },
    { n: 2, label: "Supabase schema",             domain: "DB", tags: ["Issues table + RLS","Profiles + auth","Projects table"],           status: "done" },
    { n: 3, label: "API client + rate limiting",  domain: "BE", tags: ["Rate limiter util","Retry with backoff","Error boundary"],          status: "active" },
    { n: 4, label: "Issue board UI",              domain: "FE", tags: ["Kanban columns","Drag-and-drop","WIP limits"],                      status: "pending" },
    { n: 5, label: "AI chat + context",           domain: "AI", tags: ["OpenRouter wiring","PRD injection","Code snippet handler"],         status: "pending" },
    { n: 6, label: "Real-time sync",              domain: "API",tags: ["Supabase realtime","Optimistic updates","Conflict resolution"],     status: "pending" },
  ]);
  const [dragPlanIssue, setDragPlanIssue] = useState(null);
  const [newStepInput, setNewStepInput] = useState("");

  // ── AI STATE ──
  const [aiMsgs, setAiMsgs] = useState([
    { r: "system", c: "CONTEXT LOADED", detail: "Reference doc loaded: REACH-IDE-PRD-v1.md\nActive plan step: 3c\n\nI have your full project context. What do you want to build?" },
    { r: "user", c: "Wire up the Supabase real-time subscription for issue status changes" },
    { r: "assistant", c: `Based on your plan step 3c and the current api.ts structure, here is the subscription wiring:`, code: `const channel = supabase\n  .channel('issue-changes')\n  .on('postgres_changes',\n    { event: '*', schema: 'public', table: 'issues' },\n    (payload) => {\n      dispatch({ type: 'ISSUE_UPDATE', payload })\n    }\n  )\n  .subscribe()`, codeLang: "TypeScript", codeJustify: true },
    { r: "assistant", c: "This goes in your useIssues() hook. Want me to write the full hook with optimistic updates?" },
  ]);
  const [aiInput, setAiInput]   = useState("");
  const [thinking, setThinking] = useState(false);

  // ── TERMINAL STATE ──
  const [termLines] = useState([
    { t: "cmd",  c: "$ npm run dev" },
    { t: "out",  c: "> reach-ide@0.1.0 dev" },
    { t: "out",  c: "> next dev" },
    { t: "info", c: "- Local:   http://localhost:3000" },
    { t: "info", c: "- Network: http://192.168.1.5:3000" },
    { t: "ok",   c: "Ready in 1842ms" },
    { t: "blank", c: "$" },
    { t: "err",  c: "ESLint: 2 warnings in src/components/Modal.tsx" },
    { t: "err",  c: "Line 24: 'data' is assigned but never used  no-unused-vars" },
    { t: "err",  c: "Line 31: Missing dependency 'onClose'  react-hooks/exhaustive-deps" },
  ]);
  const [termInput, setTermInput] = useState("");

  // ── GIT STATE ──
  const [commitMsg, setCommitMsg] = useState("");
  const gitChanges = [
    { f: "api.ts", s: "M" },
    { f: "Modal.tsx", s: "M" },
    { f: "useSubscription.ts", s: "A" },
  ];

  // ── SEARCH STATE ──
  const [searchQ, setSearchQ] = useState("");
  const searchResults = searchQ ? [
    { file: "api.ts",   line: 18, code: "await throttle()" },
    { file: "api.ts",   line: 24, code: "requestCount++" },
    { file: "page.tsx", line: 11, code: "const { data }" },
  ] : [];

  // ── EXTENSIONS ──
  const [extCat, setExtCat]   = useState("All");
  const [extTier, setExtTier] = useState("All");
  const extensions = [
    { icon: "DB", name: "Supabase Studio", tier: "free", installs: "48k", cat: "Database", rating: 4.8, desc: "Visual table editor, query runner, auth manager" },
    { icon: "AI", name: "GitHub Copilot",  tier: "paid", installs: "2.1M",cat: "AI",       rating: 4.6, desc: "AI pair programmer with inline completions" },
    { icon: "LC", name: "ESLint",          tier: "free", installs: "890k",cat: "Linting",  rating: 4.9, desc: "Pluggable JS/TS linter with auto-fix" },
    { icon: "FT", name: "Prettier",        tier: "free", installs: "760k",cat: "Formatting",rating: 4.8, desc: "Opinionated code formatter" },
    { icon: "TW", name: "Tailwind IntelliSense", tier: "free", installs: "400k", cat: "CSS", rating: 4.9, desc: "Autocomplete and lint for Tailwind classes" },
    { icon: "GT", name: "GitLens",         tier: "Free+Paid", installs: "320k", cat: "Git", rating: 4.7, desc: "Supercharge Git inside the editor" },
    { icon: "DV", name: "DevOps Toolkit",  tier: "paid", installs: "92k", cat: "DevOps",   rating: 4.5, desc: "CI/CD status, deploy triggers, log tailing" },
    { icon: "AT", name: "API Testing",     tier: "free", installs: "180k",cat: "API Testing", rating: 4.6, desc: "REST client + contract testing built in" },
  ];
  const EXT_CATS  = ["All","AI","Database","Git","Linting","Formatting","CSS","API Testing","DevOps"];
  const EXT_TIERS = ["All","Free","Paid","Free+Paid"];
  const visibleExt = extensions.filter(e =>
    (extCat  === "All" || e.cat  === extCat) &&
    (extTier === "All" || e.tier === extTier)
  );

  // ── DOCS/PRD STATE ──
  const [docsTab, setDocsTab] = useState("editor"); // editor | preview | voice
  const PRD_CONTENT = `# REACH IDE - Product Requirements\n\n## Problem Statement\n\nDevelopers lose context switching between tools. This document pins the project vision.\n\n## Acceptance Criteria\n\n- Single browser tab replaces VS Code + Jira + Slack + Notion\n- AI never loses context of the plan\n- Non-developers can ship production code\n\n## Architecture Decision Records\n\n### ADR-001: Monaco Editor\n**Decision**: Use Monaco (VS Code engine) for the browser IDE\n**Reason**: LSP support, syntax highlighting for 80+ languages, proven at scale\n\n### ADR-002: Supabase over Firebase\n**Decision**: PostgreSQL + Row Level Security\n**Reason**: Relational model fits issue tracking, RLS handles multi-tenant auth`;

  const sendAI = () => {
    if (!aiInput.trim()) return;
    const msg = aiInput;
    setAiMsgs(p => [...p, { r: "user", c: msg }]);
    setAiInput("");
    setThinking(true);
    setTimeout(() => {
      setAiMsgs(p => [...p, { r: "assistant", c: "The `refreshPromise` pattern is correct. One edge case: a network error during refresh still clears the lock via `finally()` — intentional, callers get a clean retry. Add `toast.error('Session expired')` in your catch layer. @line 42 in interceptor.ts is where the retry queue fires." }]);
      setThinking(false);
    }, 1400);
  };

  const tree = [
    { name: "src", type: "dir", children: [
      { name: "app", type: "dir", children: [
        { name: "page.tsx", type: "file", ext: "ts", dot: T.danger },
        { name: "layout.tsx", type: "file", ext: "ts" },
        { name: "globals.css", type: "file", ext: "css" },
      ]},
      { name: "components", type: "dir", children: [
        { name: "Modal.tsx", type: "file", ext: "ts", dot: T.warn },
      ]},
      { name: "lib", type: "dir", children: [
        { name: "api.ts", type: "file", ext: "ts", dot: T.warn, linked: "RC-001" },
        { name: "supabase.ts", type: "file", ext: "ts" },
      ]},
    ]},
    { name: "public", type: "dir", children: [] },
    { name: "supabase/functions", type: "dir", children: [
      { name: "ai-chat/index.ts", type: "file", ext: "ts" },
      { name: "git-file-tree/index.ts", type: "file", ext: "ts" },
    ]},
    { name: "package.json", type: "file", ext: "json" },
    { name: "tsconfig.json", type: "file", ext: "json" },
    { name: ".env.local", type: "file", ext: "env" },
  ];

  const FileNode = ({ node, depth = 0 }) => {
    const isOpen = openFolders[node.name];
    const isActive = node.name === activeFile;
    const EXT_COLORS = { ts: "#3178C6", tsx: "#3178C6", css: "#6c4de6", json: "#e8965a", env: T.success };
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 5,
          padding: `3px ${8 + depth * 12}px`, cursor: "pointer", fontSize: 11,
          color: isActive ? T.accent : T.textSub,
          background: isActive ? T.glow : "transparent",
          borderLeft: isActive ? `2px solid ${T.accent}` : "2px solid transparent",
        }} onClick={() => {
          if (node.type === "dir") { setOpenFolders(p => ({ ...p, [node.name]: !p[node.name] })); return; }
          setActiveFile(node.name);
          if (!openTabs.find(t => t.name === node.name)) setOpenTabs(p => [...p, { name: node.name }]);
        }}>
          {node.type === "dir"
            ? <Ico n={isOpen ? "chevD" : "chevR"} s={9} c={T.textMuted} />
            : <span style={{ fontSize: 8, fontWeight: 800, color: EXT_COLORS[node.ext] || T.textMuted, width: 10, textAlign: "center", flexShrink: 0 }}>{(node.ext||"").slice(0,2).toUpperCase()}</span>
          }
          <span className="trunc flex-1" style={{ color: node.dot ? T.text : undefined }}>{node.name}</span>
          {node.dot && <div style={{ width: 6, height: 6, borderRadius: "50%", background: node.dot, flexShrink: 0 }} />}
          {node.linked && <span style={{ fontSize: 9, color: T.accent, background: T.glow, padding: "1px 4px", borderRadius: 3, flexShrink: 0 }}>{node.linked}</span>}
        </div>
        {node.type === "dir" && isOpen && (node.children||[]).map(c => <FileNode key={c.name} node={c} depth={depth+1} />)}
      </div>
    );
  };

  const CODE_CONTENT = `<span class="cm">// lib/api.ts</span>
<span class="cm">// RC-001: API client with rate limiting</span>

<span class="kw">const</span> <span class="fn">RATE_LIMIT</span> = <span class="num">100</span>; <span class="cm">// requests per minute</span>
<span class="kw">const</span> queue: <span class="tp">Array</span>&lt;() <span class="kw">=&gt;</span> <span class="tp">void</span>&gt; = []
<span class="kw">let</span> requestCount = <span class="num">0</span>

<span class="kw">function</span> <span class="fn">resetCounter</span>() {
  requestCount = <span class="num">0</span>
  <span class="kw">if</span> (queue.length &gt; <span class="num">0</span>) {
    <span class="kw">const</span> next = queue.<span class="fn">shift</span>()
    next?.()
  }
}

<span class="fn">setInterval</span>(resetCounter, <span class="num">60000</span>)

<span class="kw">async function</span> <span class="fn">throttle</span>(): <span class="tp">Promise</span>&lt;<span class="kw">void</span>&gt; {
  <span class="kw">if</span> (requestCount &lt; RATE_LIMIT) {
    requestCount++
    <span class="kw">return</span>
  }
  <span class="kw">return new</span> <span class="tp">Promise</span>(resolve =&gt; queue.<span class="fn">push</span>(resolve))
}

<span class="kw">export async function</span> <span class="fn">apiRequest</span>&lt;<span class="tp">T</span>&gt;(
  path: <span class="tp">string</span>,
  options: <span class="tp">RequestInit</span> = {},
  retries = <span class="num">3</span>
): <span class="tp">Promise</span>&lt;<span class="tp">T</span>&gt; {
  <span class="kw">await</span> <span class="fn">throttle</span>()
  <span class="kw">for</span> (<span class="kw">let</span> i = <span class="num">0</span>; i &lt; retries; i++) {
    <span class="kw">try</span> {`;

  const DOMAIN_COLOR = { FE: "#3ECFCF", BE: "#E8965A", DB: "#8B7CF8", AI: "#3EC98E", API: "#3ECFCF", INFRA: "#F26B6B" };
  const DOMAIN_TAGS  = ["FE: Frontend","BE: Backend","API: API","DB: Database","AI: AI/ML","INFRA: Infra"];

  // ── STATUS BAR ──
  const statusColor = { txt: T.bg, bg: T.accent };

  const LEFT_ICONS = [
    { id: "explorer",   icon: "[/]",  title: "Explorer" },
    { id: "search",     icon: "[?]",  title: "Search" },
    { id: "git",        icon: "[G]",  title: "Source Control" },
    { id: "extensions", icon: "[+]",  title: "Extensions" },
    { id: "plan",       icon: "[P]",  title: "Plan" },
  ];
  const BOTTOM_ICONS = [
    { id: "settings", icon: "[S]", title: "Settings" },
    { id: "user",     icon: "[U]", title: "User" },
  ];

  return (
    <div style={{ display: "flex", height: "100%", background: T.bg, overflow: "hidden", fontFamily: "'DM Mono', monospace", position: "relative" }}>

      {/* ── ICON RAIL (far left, 36px) ── */}
      <div style={{ width: 36, background: "#0B0B0D", borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "8px 0", flexShrink: 0 }}>
        {LEFT_ICONS.map(ic => (
          <button key={ic.id} title={ic.title} onClick={() => toggleLeft(ic.id)}
            style={{ width: 28, height: 28, borderRadius: 4, border: "none", background: leftPanel === ic.id ? T.accent : "transparent",
              color: leftPanel === ic.id ? "#fff" : T.textMuted, fontSize: 9, fontWeight: 800, cursor: "pointer", fontFamily: "'DM Mono', monospace",
              display: "flex", alignItems: "center", justifyContent: "center" }}>
            {ic.icon}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {BOTTOM_ICONS.map(ic => (
          <button key={ic.id} title={ic.title}
            style={{ width: 28, height: 28, borderRadius: 4, border: "none", background: "transparent",
              color: T.textMuted, fontSize: 9, fontWeight: 800, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>
            {ic.icon}
          </button>
        ))}
      </div>

      {/* ── LEFT PANEL (collapsible) ── */}
      {leftPanel && (
        <div style={{ width: 240, background: T.surface, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>

          {/* EXPLORER */}
          {leftPanel === "explorer" && (
            <>
              <div style={{ padding: "8px 12px 6px", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: T.textMuted }}>EXPLORER</div>
                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>REACH-IDE</div>
              </div>
              {/* Active issue context strip */}
              <div style={{ padding: "6px 12px", background: T.accent + "10", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}
                onClick={() => setIssue(ISSUES[0])}>
                <div style={{ fontSize: 9, color: T.accent, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>Active · RC-001</div>
                <div style={{ fontSize: 10, color: T.textSub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>Auth token refresh race condition</div>
                <div className="flex gap-8 mt-2">
                  <span style={{ fontSize: 9, color: T.textMuted }}>Step 3c / 50</span>
                  <span style={{ fontSize: 9, color: T.success }}>● PRD pinned</span>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
                {tree.map(n => <FileNode key={n.name} node={n} />)}
              </div>
            </>
          )}

          {/* SEARCH */}
          {leftPanel === "search" && (
            <>
              <div style={{ padding: "8px 12px", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textMuted, marginBottom: 6 }}>SEARCH</div>
                <input className="inp" style={{ fontSize: 11, marginBottom: 6 }} placeholder="Search in files …" value={searchQ} onChange={e => setSearchQ(e.target.value)} autoFocus />
                <input className="inp" style={{ fontSize: 11 }} placeholder="Replace …" />
              </div>
              {searchQ && <div style={{ padding: "6px 12px 4px", fontSize: 10, color: T.textMuted }}>{searchResults.length} results in {[...new Set(searchResults.map(r=>r.file))].length} files</div>}
              <div style={{ flex: 1, overflowY: "auto" }}>
                {[...new Set(searchResults.map(r => r.file))].map(file => (
                  <div key={file}>
                    <div style={{ padding: "5px 12px", fontSize: 10, fontWeight: 700, color: T.accent, background: T.surface2 }}>{file}</div>
                    {searchResults.filter(r => r.file === file).map((r, i) => (
                      <div key={i} style={{ padding: "4px 12px 4px 22px", fontSize: 11, cursor: "pointer", color: T.textSub, borderBottom: `1px solid ${T.border}10` }}
                        onMouseEnter={e => e.currentTarget.style.background = T.surface2}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        onClick={() => setActiveFile(r.file)}>
                        <span style={{ color: T.textMuted, marginRight: 8 }}>Line {r.line}:</span>{r.code}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* SOURCE CONTROL / GIT */}
          {leftPanel === "git" && (
            <>
              <div style={{ padding: "8px 12px 6px", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textMuted }}>SOURCE CONTROL</div>
                <div style={{ fontSize: 10, color: T.textSub, marginTop: 2 }}>{gitChanges.length} changes</div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
                {gitChanges.map(g => (
                  <div key={g.f} className="flex items-c gap-8" style={{ padding: "5px 14px", cursor: "pointer", fontSize: 11 }}
                    onMouseEnter={e => e.currentTarget.style.background = T.surface2}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ fontWeight: 800, color: g.s === "M" ? T.warn : g.s === "A" ? T.success : T.danger, width: 12, flexShrink: 0 }}>{g.s}</span>
                    <span className="trunc flex-1">{g.f}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "10px 12px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
                <input className="inp" style={{ fontSize: 11, marginBottom: 8 }} placeholder="Commit message …" value={commitMsg} onChange={e => setCommitMsg(e.target.value)} />
                <button className="btn btn-p w-full" style={{ justifyContent: "center", padding: 7, fontSize: 11 }}>Commit &amp; Push</button>
              </div>
            </>
          )}

          {/* EXTENSIONS */}
          {leftPanel === "extensions" && (
            <>
              <div style={{ padding: "8px 12px", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textMuted, marginBottom: 6 }}>EXTENSIONS</div>
                <input className="inp" style={{ fontSize: 11, marginBottom: 8 }} placeholder="Search extensions …" />
                <div style={{ fontSize: 9, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>CATEGORY</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                  {EXT_CATS.map(c => <button key={c} onClick={() => setExtCat(c)} className={`btn btn-xs ${extCat===c ? "btn-p" : "btn-g"}`} style={{ fontSize: 9 }}>{c}</button>)}
                </div>
                <div style={{ fontSize: 9, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>TIER</div>
                <div className="flex gap-4">
                  {EXT_TIERS.map(t => <button key={t} onClick={() => setExtTier(t)} className={`btn btn-xs ${extTier===t ? "btn-p" : "btn-g"}`} style={{ fontSize: 9 }}>{t}</button>)}
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
                {visibleExt.map(ext => (
                  <div key={ext.name} style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = T.surface2}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div className="flex gap-8 items-c mb-4">
                      <div style={{ width: 28, height: 28, borderRadius: 5, background: T.surface3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800, color: T.accent, flexShrink: 0 }}>{ext.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="flex items-c gap-5 mb-1">
                          <span style={{ fontWeight: 700, fontSize: 11 }}>{ext.name}</span>
                          <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: ext.tier === "paid" ? T.warn + "22" : ext.tier === "Free+Paid" ? T.accentPurple + "22" : T.success + "22", color: ext.tier === "paid" ? T.warn : ext.tier === "Free+Paid" ? T.accentPurple : T.success, fontWeight: 700 }}>{ext.tier}</span>
                        </div>
                        <div className="flex items-c gap-6" style={{ fontSize: 9, color: T.textMuted }}>
                          <span style={{ color: ext.cat === "AI" ? T.accent : ext.cat === "Database" ? T.accentPurple : T.textMuted, background: T.surface3, padding: "1px 5px", borderRadius: 3 }}>{ext.cat}</span>
                          <span>★ {ext.rating}</span>
                          <span>{ext.installs} installs</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: T.textMuted, lineHeight: 1.5 }}>{ext.desc}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* PLAN PIPELINE */}
          {leftPanel === "plan" && (
            <>
              <div style={{ padding: "8px 12px 6px", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: T.textMuted }}>PLAN</div>
                {planSteps.find(s => s.status === "active") && (
                  <div style={{ fontSize: 10, color: T.accent, fontWeight: 700, marginTop: 3 }}>
                    Step {planSteps.findIndex(s => s.status === "active") + 1}c: Active
                  </div>
                )}
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
                {/* Output fidelity */}
                <div style={{ padding: "4px 12px 8px" }}>
                  <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 800 }}>OUTPUT FIDELITY</div>
                  <div className="flex gap-4">
                    {["Wireframe","MVP","Production","Enterprise"].map(f => (
                      <button key={f} onClick={() => setOutputFidelity(f.toLowerCase())}
                        className={`btn btn-xs ${outputFidelity === f.toLowerCase() ? "btn-p" : "btn-g"}`}
                        style={{ fontSize: 9, flex: 1, justifyContent: "center" }}>{f}</button>
                    ))}
                  </div>
                </div>
                {/* Pipeline steps */}
                {planSteps.map((step, i) => (
                  <div key={step.id} style={{ padding: "6px 12px 10px", borderBottom: `1px solid ${T.border}`,
                    background: step.status === "active" ? T.accent + "08" : "transparent",
                    borderLeft: step.status === "active" ? `3px solid ${T.accent}` : "3px solid transparent" }}>
                    <div className="flex items-c gap-8 mb-4">
                      <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 3, fontWeight: 800,
                        background: step.status === "done" ? T.success + "20" : step.status === "active" ? T.accent + "20" : T.surface3,
                        color: step.status === "done" ? T.success : step.status === "active" ? T.accent : T.textMuted }}>
                        {step.phase}
                      </span>
                      <span style={{ fontSize: 10, color: T.textMuted, marginLeft: "auto" }}>
                        {step.status === "done" ? "DONE" : step.status === "active" ? "ACTIVE" : "PENDING"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: step.status === "pending" ? T.textMuted : T.text }}>{step.label}</div>
                    {step.checklist.length > 0 && step.status === "active" && (
                      <div style={{ marginTop: 8 }}>
                        {step.checklist.map((item, ci) => (
                          <div key={ci} className="flex gap-6 mb-4" style={{ fontSize: 10 }}>
                            <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${ci < 2 ? T.accent : T.border}`, background: ci < 2 ? T.accent + "20" : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {ci < 2 && <Ico n="check" s={8} c={T.accent} />}
                            </div>
                            <span style={{ color: ci < 2 ? T.textMuted : T.textSub, textDecoration: ci < 2 ? "line-through" : "none" }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {/* Overall progress */}
                <div style={{ padding: "10px 12px 0" }}>
                  <div className="flex items-c jc-sb mb-4" style={{ fontSize: 10 }}>
                    <span style={{ color: T.textMuted }}>Overall Progress</span>
                    <span style={{ fontWeight: 700, color: T.accent }}>42%</span>
                  </div>
                  <ProgBar v={42} max={100} c={T.accent} h={4} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── MAIN CENTER ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        {/* Menubar */}
        <div style={{ height: 26, background: "#0B0B0D", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", paddingLeft: 10, gap: 0, flexShrink: 0 }}>
          <div style={{ width: 22, height: 22, background: T.accent, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", marginRight: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>R</span>
          </div>
          <span style={{ fontSize: 10, color: T.textMuted, marginRight: 14, fontWeight: 700 }}>REACH IDE</span>
          {["File","Edit","View","Run","Terminal","Help"].map(m => (
            <span key={m} style={{ fontSize: 10, color: T.textMuted, padding: "0 8px", cursor: "pointer", lineHeight: "26px" }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface2}
              onMouseLeave={e => e.currentTarget.style.color = T.textMuted}>{m}</span>
          ))}
          <div style={{ flex: 1, textAlign: "center", fontSize: 10, color: T.textMuted }}>reach-ide / src / lib / api.ts</div>
          {/* Layout picker */}
          <div style={{ display: "flex", gap: 4, marginRight: 10, alignItems: "center" }}>
            <span style={{ fontSize: 9, color: T.textMuted }}>LAYOUT</span>
            {["[ ]","[| ]","[||]","[| |]","[-]","[--]"].map((l, i) => (
              <button key={i} style={{ fontSize: 9, background: i === 1 ? T.accent : "transparent", color: i === 1 ? "#fff" : T.textMuted, border: `1px solid ${i === 1 ? T.accent : T.border}`, borderRadius: 3, padding: "1px 5px", cursor: "pointer" }}>{l}</button>
            ))}
          </div>
          <button style={{ margin: "0 10px", fontSize: 10, fontWeight: 800, background: T.success, color: "#fff", border: "none", borderRadius: 4, padding: "3px 12px", cursor: "pointer" }}>Run</button>
        </div>

        {/* Tab bar — matches screenshots exactly */}
        <div style={{ height: 34, background: T.surface, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "stretch", flexShrink: 0, overflowX: "auto" }}>
          {/* File tabs */}
          {openTabs.map(tab => (
            <div key={tab.name} onClick={() => setActiveFile(tab.name)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 12px",
                borderRight: `1px solid ${T.border}`,
                background: activeFile === tab.name ? T.bg : "transparent",
                borderBottom: activeFile === tab.name ? `2px solid ${T.accent}` : "2px solid transparent",
                cursor: "pointer", flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: tab.added ? T.success : T.textMuted }}>[{tab.added ? "+" : tab.dirty ? "*" : "/"}]</span>
              <span style={{ fontSize: 11, color: activeFile === tab.name ? T.text : T.textMuted }}>{tab.name}</span>
              {tab.dirty && <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.warn, marginLeft: 2 }} />}
            </div>
          ))}
          <div style={{ width: 1, height: "100%", background: T.border, flexShrink: 0 }} />
          {/* Action tabs */}
          {[
            { id: "ai",        label: "[*] AI Chat" },
            { id: "terminal",  label: "$ Terminal" },
            { id: "preview",   label: "[>] Preview" },
            { id: "extension-tab", label: "[+] Extensions" },
            { id: "docs-tab",  label: "[D] Docs/PRD" },
            { id: "plan-tab",  label: "[P] Plan", badge: true },
          ].map(t => (
            <div key={t.id} onClick={() => { if (["ai","terminal","preview"].includes(t.id)) { setRightTab(t.id); setRightOpen(true); } else if (t.id === "extension-tab") toggleLeft("extensions"); else if (t.id === "docs-tab") toggleLeft("plan"); else if (t.id === "plan-tab") toggleLeft("plan"); }}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 10px",
                borderRight: `1px solid ${T.border}`,
                color: ((rightTab === t.id && rightOpen) || (t.id === "extension-tab" && leftPanel === "extensions") || (t.id === "docs-tab" && leftPanel === "plan") || (t.id === "plan-tab" && leftPanel === "plan")) ? T.accent : T.textMuted,
                borderBottom: ((rightTab === t.id && rightOpen)) ? `2px solid ${T.accent}` : "2px solid transparent",
                cursor: "pointer", fontSize: 10, flexShrink: 0 }}>
              {t.label}
              {t.badge && <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.warn }} />}
            </div>
          ))}
        </div>

        {/* Editor + breadcrumb */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Breadcrumb + actions */}
            <div style={{ height: 26, background: T.surface, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", paddingLeft: 12, gap: 8, flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: T.textMuted }}>{activeFile}</span>
              <div style={{ flex: 1 }} />
              <button className="btn btn-g btn-xs" style={{ fontSize: 10 }}>Justify Snippet</button>
              <button className="btn btn-xs" style={{ fontSize: 10, background: T.accent, color: "#fff", border: "none", borderRadius: 4, padding: "2px 10px" }}>Format</button>
            </div>
            {/* Code area */}
            <div style={{ flex: 1, overflowY: "auto", background: T.bg }}>
              <div style={{ display: "flex" }}>
                {/* Line numbers */}
                <div style={{ width: 36, flexShrink: 0, paddingTop: 8, paddingRight: 8, textAlign: "right", background: T.bg }}>
                  {Array.from({ length: 34 }, (_, i) => (
                    <div key={i+1} style={{ fontSize: 11, lineHeight: "20px", color: T.textMuted, userSelect: "none" }}>{i+1}</div>
                  ))}
                </div>
                {/* Code */}
                <pre style={{ flex: 1, margin: 0, padding: "8px 16px 8px 8px", fontSize: 12, lineHeight: "20px", overflowX: "auto", background: T.bg, color: T.text }}
                  dangerouslySetInnerHTML={{ __html: CODE_CONTENT }} />
              </div>
            </div>
            {/* Status bar */}
            <div style={{ height: 20, background: T.accent, display: "flex", alignItems: "center", paddingLeft: 10, gap: 16, flexShrink: 0 }}>
              <span style={{ fontSize: 9, color: "#fff", fontWeight: 700 }}>[G] main</span>
              <span style={{ fontSize: 9, color: "#fff" }}>0 errors 2 warnings</span>
              <span style={{ fontSize: 9, color: "#fff" }}>Step 3c / 50</span>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 9, color: "#ffffffcc" }}>Ln 1, Col 1</span>
              <span style={{ fontSize: 9, color: "#ffffffcc" }}>TypeScript</span>
              <span style={{ fontSize: 9, color: "#ffffffcc" }}>UTF-8</span>
              <span style={{ fontSize: 9, color: "#fff" }}>ESLint: Clean</span>
            </div>
          </div>

          {/* ── RIGHT PANEL (retractable) ── */}
          {rightOpen && (
            <div style={{ width: 360, borderLeft: `1px solid ${T.border}`, display: "flex", flexDirection: "column", flexShrink: 0, background: T.surface, overflow: "hidden" }}>
              {/* Right panel tabs */}
              <div style={{ height: 34, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "stretch", flexShrink: 0 }}>
                {[{ id: "ai", label: "[*] AI Chat" },{ id: "terminal", label: "$ Terminal" },{ id: "preview", label: "[>] Preview" }].map(t => (
                  <div key={t.id} onClick={() => setRightTab(t.id)}
                    style={{ display: "flex", alignItems: "center", padding: "0 10px", fontSize: 10, cursor: "pointer",
                      color: rightTab === t.id ? T.accent : T.textMuted,
                      borderBottom: rightTab === t.id ? `2px solid ${T.accent}` : "2px solid transparent",
                      borderRight: `1px solid ${T.border}`, flexShrink: 0 }}>{t.label}</div>
                ))}
                <div style={{ flex: 1 }} />
                <button onClick={() => setRightOpen(false)}
                  style={{ padding: "0 10px", background: "none", border: "none", color: T.textMuted, cursor: "pointer", fontSize: 12 }}>×</button>
              </div>

              {/* Context injection pills */}
              {rightTab === "ai" && (
                <>
                  <div style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 5, flexWrap: "wrap", flexShrink: 0 }}>
                    {[
                      { l: "PRD: v1 pinned", c: T.accent },
                      { l: "Step 3c active", c: T.accentPurple },
                      { l: `Context: ${activeFile}`, c: T.success },
                    ].map(p => (
                      <span key={p.l} style={{ fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 4, background: p.c + "20", color: p.c, border: `1px solid ${p.c}40` }}>{p.l}</span>
                    ))}
                    <button className="btn btn-xs btn-g" style={{ fontSize: 9, marginLeft: "auto" }}>+ Add context</button>
                  </div>
                  {/* Messages */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {aiMsgs.map((m, i) => {
                      if (m.r === "system") return (
                        <div key={i} style={{ background: T.success + "10", border: `1px solid ${T.success}30`, borderRadius: 8, padding: "8px 12px" }}>
                          <div style={{ fontSize: 9, fontWeight: 800, color: T.success, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>CONTEXT LOADED</div>
                          {m.detail.split("\n").map((line, li) => (
                            <div key={li} style={{ fontSize: 10, color: T.textSub, lineHeight: 1.6 }}>{line}</div>
                          ))}
                        </div>
                      );
                      return (
                        <div key={i} style={{ display: "flex", gap: 8, flexDirection: m.r === "user" ? "row-reverse" : "row" }}>
                          <div style={{
                            background: m.r === "user" ? T.accent : T.surface2,
                            color: m.r === "user" ? "#fff" : T.text,
                            border: m.r === "assistant" ? `1px solid ${T.border}` : "none",
                            borderRadius: 8, padding: "8px 11px", fontSize: 11.5, lineHeight: 1.65, maxWidth: "92%",
                          }}>
                            {m.c}
                            {m.code && (
                              <div style={{ marginTop: 8, background: "#0B0B0D", borderRadius: 6, padding: "10px 12px", position: "relative" }}>
                                <div className="flex items-c jc-sb mb-5">
                                  <span style={{ fontSize: 9, color: T.textMuted }}>{m.codeLang}</span>
                                  {m.codeJustify && <button className="btn btn-xs btn-g" style={{ fontSize: 9 }}>Justify</button>}
                                </div>
                                <pre style={{ margin: 0, fontSize: 10.5, lineHeight: 1.65, color: "#C8D3F5", fontFamily: "'DM Mono', monospace", overflowX: "auto", whiteSpace: "pre" }}>{m.code}</pre>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {thinking && (
                      <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: T.textMuted, animation: "pulse 1.2s infinite" }}>Thinking…</div>
                    )}
                  </div>
                  {/* Input */}
                  <div style={{ padding: "10px 12px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
                    <input className="inp" style={{ fontSize: 11, marginBottom: 8, width: "100%", boxSizing: "border-box" }}
                      placeholder="Ask AI… (Shift+Enter for new line)"
                      value={aiInput} onChange={e => setAiInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && sendAI()} />
                    <div className="flex gap-6 jc-sb">
                      <div className="flex gap-6">
                        {["Explain","Refactor","Write Test"].map(s => (
                          <button key={s} className="btn btn-g btn-xs" style={{ fontSize: 10 }} onClick={() => setAiInput(s)}>{s}</button>
                        ))}
                      </div>
                      <button className="btn btn-p btn-sm" onClick={sendAI} style={{ fontSize: 11 }}>Send</button>
                    </div>
                    <div style={{ fontSize: 9, color: T.textMuted, marginTop: 6 }}>PRD + Plan Step 3c + api.ts in context. AI will reference pinned doc.</div>
                  </div>
                </>
              )}

              {/* TERMINAL PANEL */}
              {rightTab === "terminal" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                  <div style={{ flex: 1, overflowY: "auto", padding: "8px 14px", background: "#0B0B0D" }}>
                    {termLines.map((line, i) => (
                      <div key={i} style={{ fontSize: 11, lineHeight: "18px", color: line.t === "err" ? T.danger : line.t === "ok" ? T.success : line.t === "info" ? T.accent : line.t === "cmd" ? T.text : T.textMuted, fontFamily: "'DM Mono', monospace" }}>
                        {line.c}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: "6px 14px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 8, background: "#0B0B0D", flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: T.accent }}>$</span>
                    <input value={termInput} onChange={e => setTermInput(e.target.value)}
                      style={{ flex: 1, background: "none", border: "none", color: T.text, fontSize: 11, fontFamily: "'DM Mono', monospace", outline: "none" }}
                      placeholder="Type a command …" onKeyDown={e => { if (e.key === "Enter") setTermInput(""); }} />
                    <button className="btn btn-xs btn-g" style={{ fontSize: 9 }}>npm run</button>
                    <button className="btn btn-xs btn-g" style={{ fontSize: 9 }}>npm run</button>
                    <button className="btn btn-xs btn-g" style={{ fontSize: 9 }}>git status</button>
                  </div>
                </div>
              )}

              {/* PREVIEW PANEL */}
              {rightTab === "preview" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: T.surface2 }}>
                  <div style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {["<",">"," refresh"].map((b,i) => <button key={i} className="btn btn-xs btn-g" style={{ fontSize: 10 }}>{b}</button>)}
                    <input className="inp flex-1" style={{ fontSize: 10 }} defaultValue="http://localhost:3000" />
                    <button className="btn btn-xs btn-g" style={{ fontSize: 10 }}>mobile</button>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                    <span style={{ fontSize: 28, color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>[&gt;]</span>
                    <div style={{ fontSize: 12, color: T.textMuted }}>localhost:3000</div>
                    <div style={{ fontSize: 10, color: T.textMuted }}>npm run dev to start server</div>
                    <div className="flex gap-8">
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: T.success + "20", color: T.success }}>Server: Running</span>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: T.accent + "20", color: T.accent }}>HMR: Active</span>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: T.surface3, color: T.textMuted }}>Build: 1842ms</span>
                    </div>
                    <button className="btn btn-p btn-sm" style={{ marginTop: 4 }}>Open in Browser</button>
                  </div>
                  <div style={{ padding: "6px 10px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 10, flexShrink: 0, fontSize: 9, color: T.textMuted }}>
                    <span style={{ color: T.success }}>Build OK</span>
                    <span>Bundle: 142kb gzip</span>
                    <span>Pages: 4</span>
                    <span>Next.js 14.2</span>
                    <span style={{ color: T.warn, marginLeft: "auto" }}>2 warnings</span>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Reopen right panel */}
          {!rightOpen && (
            <button onClick={() => setRightOpen(true)}
              style={{ width: 16, background: T.surface, border: "none", borderLeft: `1px solid ${T.border}`, cursor: "pointer", color: T.textMuted, fontSize: 10, writing: "vertical-rl" }}>
              ›
            </button>
          )}
        </div>
      </div>

      {/* ── PLAN VIEW — replaces center when plan tab is in editor area ── */}
      {/* Plan is surfaced via left panel [P] — handled above */}
    </div>
  );
};
/* ══ CHAT ═══════════════════════════════════════════════════ */
const Chat = ({ T, setIssue }) => {
  const [channels, setChannels]     = useState(CHANNELS);
  const [allMsgs, setAllMsgs]       = useState(MSGS);
  const [activeC, setActiveC]       = useState(CHANNELS[0]);
  const [input, setInput]           = useState("");
  const [showAtMenu, setShowAtMenu] = useState(false);
  const [replyTo, setReplyTo]       = useState(null);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [dragOverChannel, setDragOverChannel] = useState(null);
  const [dragIssueId, setDragIssueId]         = useState(null);
  const [chatView, setChatView]     = useState("messages"); // messages | files | pinned
  const messagesEndRef = useRef(null);

  // Extended messages with inline issue events (system cards)
  const [extMsgs, setExtMsgs] = useState({
    "general": [
      { id: 1, author: "u2", body: "Deploying RC-002 fix to staging now", ts: "9:14 AM" },
      { id: 2, author: "system", issueId: "RC-002", issueTitle: "Auth redirect after Google OAuth flow", event: "moved to Review", status: "review", ts: "9:15 AM",
        actions: ["View","Assign to me","Mark Done"] },
      { id: 3, author: "u3", body: "LGTM — checking the auth callback edge case", ts: "9:18 AM" },
      { id: 4, author: "u2", body: "Also kicked off RC-001 — taking the API client work", ts: "9:22 AM" },
      { id: 5, author: "system", issueId: "RC-001", issueTitle: "API client code generation with retry logic", event: "assigned to Sarah L.", status: "in_progress", ts: "9:22 AM",
        actions: ["View","Assign to me","Mark Done"] },
      { id: 6, author: "u4", body: "RC-003 is next for me after standup", ts: "9:45 AM" },
    ],
    "engineering": [],
    "done": [],
    "handoffs": [],
    "bugs": [],
    "pr-reviews": [],
  });

  const msgs = extMsgs[activeC.id] || [];

  const send = () => {
    if (!input.trim()) return;
    const m = { id: Date.now(), author: "u1", body: input, ts: "now", replyTo: replyTo?.id || null };
    setExtMsgs(p => ({ ...p, [activeC.id]: [...(p[activeC.id] || []), m] }));
    setInput(""); setShowAtMenu(false); setReplyTo(null);
  };

  const handleInput = (v) => {
    setInput(v);
    setShowAtMenu(v.split(" ").pop().startsWith("@") && v.length > 0);
  };

  const createChannel = () => {
    if (!newChannelName.trim()) return;
    const slug = newChannelName.toLowerCase().replace(/\s+/g, "-");
    const ch = { id: `c-${Date.now()}`, name: slug, unread: 0, type: "public" };
    setChannels(p => [...p, ch]);
    setExtMsgs(p => ({ ...p, [ch.id]: [] }));
    setActiveC(ch); setShowNewChannel(false); setNewChannelName("");
  };

  // Drop issue into channel — creates system message
  const dropIssueIntoChannel = (issueId, channelId) => {
    const iss = ISSUES.find(i => i.id === issueId);
    if (!iss) return;
    const m = { id: Date.now(), author: "system", issueId: iss.id, issueTitle: iss.title,
      event: "linked to channel", status: iss.status, ts: "now", actions: ["View","Assign to me","Mark Done"] };
    setExtMsgs(p => ({ ...p, [channelId]: [...(p[channelId] || []), m] }));
    setDragIssueId(null);
  };

  const CHANNEL_UNREAD = { general: 2, done: 4, handoffs: 1, bugs: 7 };

  return (
    <div style={{ display: "flex", height: "100%", background: T.bg }} className="fade-in">

      {/* ── LEFT: Channel list (220px) ── */}
      <div style={{ width: 220, background: T.surface, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>

        {/* Channels header */}
        <div style={{ padding: "10px 12px 4px" }}>
          <div className="flex items-c jc-sb" style={{ marginBottom: 4 }}>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: T.textMuted }}>CHANNELS</span>
            <button className="btn-ico" style={{ padding: 2 }} onClick={() => setShowNewChannel(p => !p)}>
              <Ico n="plus" s={11} c={T.textMuted} />
            </button>
          </div>

          {/* New channel form */}
          {showNewChannel && (
            <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 7, padding: 8, marginBottom: 6 }}>
              <input className="inp" style={{ fontSize: 11, marginBottom: 6 }} placeholder="channel-name" value={newChannelName}
                onChange={e => setNewChannelName(e.target.value)} onKeyDown={e => e.key === "Enter" && createChannel()} autoFocus />
              <div className="flex gap-6">
                <button className="btn btn-p btn-xs flex-1" style={{ justifyContent: "center" }} onClick={createChannel}>Create</button>
                <button className="btn btn-g btn-xs" onClick={() => setShowNewChannel(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Channel list */}
          {channels.filter(c => c.type !== "dm").map(ch => (
            <div key={ch.id}
              className={`nav-item${activeC.id === ch.id ? " active" : ""}`}
              onClick={() => setActiveC(ch)}
              onDragOver={e => { e.preventDefault(); setDragOverChannel(ch.id); }}
              onDragLeave={() => setDragOverChannel(null)}
              onDrop={() => { if (dragIssueId) { dropIssueIntoChannel(dragIssueId, ch.id); setActiveC(ch); } setDragOverChannel(null); }}
              style={{ gap: 6, border: `1px solid ${dragOverChannel === ch.id ? T.accent : "transparent"}`, transition: ".1s" }}>
              <span style={{ fontSize: 12, color: T.textMuted, lineHeight: 1, fontFamily: "'DM Mono', monospace" }}>#</span>
              <span className="trunc flex-1" style={{ fontSize: 12 }}>{ch.name}</span>
              {CHANNEL_UNREAD[ch.id] > 0 && <span className="badge">{CHANNEL_UNREAD[ch.id]}</span>}
            </div>
          ))}
        </div>

        <div style={{ height: 1, background: T.border, margin: "8px 10px" }} />

        {/* DMs */}
        <div style={{ padding: "0 12px 6px" }}>
          <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: T.textMuted, marginBottom: 6 }}>DIRECT</div>
          {Object.values(USERS).slice(1).map(u => (
            <div key={u.id} className="flex items-c gap-8" style={{ padding: "5px 6px", borderRadius: 6, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <Av uid={u.id} size="xs" showStatus />
              <span style={{ fontSize: 12 }}>{u.name.split(" ")[0]}</span>
            </div>
          ))}
        </div>

        {/* Drop zone at bottom */}
        <div style={{ margin: "auto 10px 10px", padding: "10px 12px", borderRadius: 8, border: `2px dashed ${T.border}`, fontSize: 10, color: T.textMuted, textAlign: "center", lineHeight: 1.5 }}
          onDragOver={e => { e.preventDefault(); setDragOverChannel("_drop"); }}
          onDragLeave={() => setDragOverChannel(null)}
          onDrop={() => { if (dragIssueId) dropIssueIntoChannel(dragIssueId, activeC.id); setDragOverChannel(null); }}>
          Drag any issue<br/>into a channel
        </div>
      </div>

      {/* ── CENTER: Messages ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>

        {/* Channel topbar */}
        <div style={{ height: 48, background: T.bg, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0 }}>
          {/* Title */}
          <span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Chat</span>
          <div style={{ flex: 1 }} />
          {/* Create issue + meeting actions */}
          <button className="btn btn-g btn-sm" style={{ fontSize: 11 }} onClick={() => {}}>
            <Ico n="video" s={11} /> Schedule Meeting
          </button>
          <button className="btn btn-g btn-sm" style={{ fontSize: 11 }} onClick={() => {}}>
            <Ico n="video" s={11} /> Join Standup
          </button>
          <button className="btn btn-p btn-sm" style={{ fontSize: 11, fontWeight: 700 }}>
            <Ico n="plus" s={11} /> + NEW ISSUE
          </button>
          {/* Member avatars */}
          <div className="flex" style={{ gap: -4 }}>
            {Object.values(USERS).map((u, i) => (
              <div key={u.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }}>
                <Av uid={u.id} size="sm" />
              </div>
            ))}
          </div>
        </div>

        {/* Channel sub-header */}
        <div style={{ height: 40, background: T.bg, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 14, color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>#</span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{activeC.name}</span>
          <span style={{ fontSize: 11, color: T.textMuted }}>· {Object.values(USERS).length} members</span>
          <div style={{ flex: 1 }} />
          {/* Tab pills */}
          {["Issues", "Files", "Pinned"].map(tab => (
            <button key={tab} onClick={() => setChatView(tab.toLowerCase())}
              style={{ padding: "4px 12px", fontSize: 11, background: chatView === tab.toLowerCase() ? T.surface2 : "none",
                border: `1px solid ${chatView === tab.toLowerCase() ? T.border : "transparent"}`,
                borderRadius: 6, color: chatView === tab.toLowerCase() ? T.text : T.textMuted, cursor: "pointer" }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Messages scroll area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
          {msgs.map((m, idx) => {
            // ── SYSTEM ISSUE CARD ──
            if (m.author === "system") {
              const statusColors = { review: T.accentPurple, in_progress: T.accent, done: T.success, todo: T.textMuted };
              return (
                <div key={m.id} style={{ padding: "4px 20px" }}>
                  <div className="flex items-c gap-8" style={{ marginBottom: 4 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: T.surface3, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: T.textMuted }}>O</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted }}>System</span>
                    <span style={{ fontSize: 10, color: T.textMuted }}>· {m.ts}</span>
                  </div>
                  <div style={{ marginLeft: 32, background: T.surface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", maxWidth: 480 }}>
                    <div className="flex items-c gap-8 mb-4">
                      <span style={{ fontSize: 10, color: T.accent, fontWeight: 800 }}>{m.issueId}</span>
                      <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, fontWeight: 800,
                        background: (statusColors[m.status] || T.textMuted) + "22",
                        color: statusColors[m.status] || T.textMuted }}>
                        {m.status === "in_progress" ? "In Progress" : m.status === "review" ? "Review" : m.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{m.issueTitle}</div>
                    <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 10 }}>{m.event}</div>
                    <div className="flex gap-8">
                      {m.actions.map(a => (
                        <button key={a} onClick={() => a === "View" && setIssue(ISSUES.find(i => i.id === m.issueId))}
                          className="btn btn-g btn-xs" style={{ fontSize: 10 }}>{a}</button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            // ── REGULAR MESSAGE ──
            const u = USERS[m.author];
            const parent = m.replyTo ? msgs.find(p => p.id === m.replyTo) : null;
            return (
              <div key={m.id} className="flex gap-10" style={{ padding: "5px 20px", position: "relative" }}
                onMouseEnter={e => { e.currentTarget.style.background = T.surface2; e.currentTarget.querySelector(".msg-actions").style.opacity = "1"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.querySelector(".msg-actions").style.opacity = "0"; }}>
                <Av uid={m.author} size="sm" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {parent && (
                    <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 3, paddingLeft: 8, borderLeft: `2px solid ${T.border}` }}>
                      ↩ {USERS[parent.author]?.name}: {parent.body?.substring(0, 60)}{parent.body?.length > 60 ? "…" : ""}
                    </div>
                  )}
                  <div className="flex items-c gap-8 mb-2">
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{u?.name}</span>
                    <span style={{ fontSize: 10, color: T.textMuted }}>{m.ts}</span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.65, color: T.text, fontFamily: "'DM Mono', monospace" }}>
                    {m.body.split(/(@RC-\d+)/).map((part, i) =>
                      part.match(/@RC-\d+/)
                        ? <span key={i} style={{ color: T.accent, fontWeight: 700, cursor: "pointer", background: T.glow, padding: "1px 4px", borderRadius: 3 }}
                            onClick={() => setIssue(ISSUES.find(is => is.id === part.slice(1)))}>{part}</span>
                        : part.split(/(@\w+)/).map((p2, j) =>
                            p2.startsWith("@") ? <span key={j} style={{ color: T.accentPurple, fontWeight: 600 }}>{p2}</span> : p2
                          )
                    )}
                  </div>
                </div>
                {/* Hover action bar */}
                <div className="msg-actions flex gap-4" style={{ position: "absolute", right: 20, top: 4, opacity: 0, transition: ".1s", background: T.surface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "2px 6px" }}>
                  <button className="btn-ico" style={{ padding: 3, border: "none" }} onClick={() => setReplyTo(m)} title="Reply">↩</button>
                  <button className="btn-ico" style={{ padding: 3, border: "none" }} title="React">+</button>
                </div>
              </div>
            );
          })}
          {msgs.length === 0 && (
            <div className="empty">
              <Ico n="chat" s={28} c={T.textMuted} />
              <div style={{ fontSize: 12 }}>No messages yet</div>
              <div style={{ fontSize: 11 }}>Start the conversation or drag an issue in from the right</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── COMPOSE BAR (matches screenshot exactly) ── */}
        <div style={{ padding: "10px 20px 14px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
          {/* @ autocomplete dropdown */}
          {showAtMenu && (
            <div style={{ background: T.surface, border: `1px solid ${T.borderStrong || T.border}`, borderRadius: 8, padding: 8, marginBottom: 8 }}>
              <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", padding: "2px 8px 6px" }}>Issues</div>
              {ISSUES.map(i => (
                <div key={i.id} className="flex gap-8 items-c" style={{ padding: "5px 8px", borderRadius: 5, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.surface2}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  onClick={() => { setInput(input.replace(/@\w*$/, `@${i.id} `)); setShowAtMenu(false); }}>
                  <Prio p={i.priority} />
                  <span style={{ fontSize: 10, color: T.accent, fontWeight: 700, width: 56, flexShrink: 0 }}>{i.id}</span>
                  <span style={{ fontSize: 11, color: T.textSub, flex: 1 }} className="trunc">{i.title}</span>
                  <StatusChip s={i.status} />
                </div>
              ))}
              <div style={{ height: 1, background: T.border, margin: "6px 0" }} />
              <div style={{ fontSize: 9, color: T.textMuted, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", padding: "2px 8px 6px" }}>People</div>
              {Object.values(USERS).map(u => (
                <div key={u.id} className="flex gap-8 items-c" style={{ padding: "5px 8px", borderRadius: 5, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.surface2}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  onClick={() => { setInput(input.replace(/@\w*$/, `@${u.name.split(" ")[0]} `)); setShowAtMenu(false); }}>
                  <Av uid={u.id} size="xs" showStatus />
                  <span style={{ fontSize: 11 }}>{u.name}</span>
                  <span style={{ fontSize: 10, color: T.textMuted, marginLeft: "auto" }}>{u.role}</span>
                </div>
              ))}
            </div>
          )}
          {/* Reply indicator */}
          {replyTo && (
            <div className="flex items-c gap-8" style={{ padding: "5px 12px", background: T.surface2, borderRadius: 6, marginBottom: 8, fontSize: 11 }}>
              <span style={{ color: T.textMuted }}>↩ Replying to {USERS[replyTo.author]?.name}:</span>
              <span style={{ flex: 1, color: T.textSub }} className="trunc">{replyTo.body?.substring(0, 60)}</span>
              <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", color: T.textMuted, cursor: "pointer" }}>×</button>
            </div>
          )}
          {/* Input */}
          <div className="flex items-c gap-10" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 14px" }}>
            <input value={input} onChange={e => handleInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
              style={{ flex: 1, background: "none", border: "none", color: T.text, fontSize: 13, fontFamily: "'DM Mono', monospace", outline: "none" }}
              placeholder={`Message #${activeC.name}  ·  Type @issue to link  ·  Drag an issue here`} />
            {/* Attachment icons */}
            <button className="btn-ico" style={{ border: "none", padding: 4 }} title="Emoji"><span style={{ fontSize: 14 }}>@</span></button>
            <button className="btn-ico" style={{ border: "none", padding: 4 }} title="Mention"><span style={{ fontSize: 14 }}>◎</span></button>
            <button className="btn-ico" style={{ border: "none", padding: 4 }} title="Attach file"><Ico n="plus" s={14} /></button>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Issues rail (all issues, drag-into-channel) ── */}
      <div style={{ width: 220, background: T.surface, borderLeft: `1px solid ${T.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "12px 14px 8px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em", color: T.textMuted }}>ISSUES</div>
          <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>Drag into channel →</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {ISSUES.map(iss => (
            <div key={iss.id}
              draggable
              onDragStart={() => setDragIssueId(iss.id)}
              onDragEnd={() => setDragIssueId(null)}
              onClick={() => setIssue(iss)}
              style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, cursor: "grab",
                background: dragIssueId === iss.id ? T.glow : "transparent",
                transition: ".1s" }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface2}
              onMouseLeave={e => e.currentTarget.style.background = dragIssueId === iss.id ? T.glow : "transparent"}>
              {/* Issue ID + status dot */}
              <div className="flex items-c gap-6 mb-3">
                <span style={{ fontSize: 10, color: T.accent, fontWeight: 800 }}>{iss.id}</span>
                <div style={{ flex: 1 }} />
                <div style={{ width: 7, height: 7, borderRadius: "50%",
                  background: iss.status === "in_progress" ? T.accent : iss.status === "done" ? T.success : iss.status === "review" ? T.accentPurple : T.textMuted }} />
              </div>
              {/* Title */}
              <div style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.4, color: T.text, marginBottom: 6 }} className="trunc">
                {iss.title}
              </div>
              {/* Assignee */}
              <div className="flex items-c gap-4">
                {iss.assignee && <Av uid={iss.assignee} size="xs" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};



/* ══ DOCS ═══════════════════════════════════════════════════ */
const Docs = ({ T }) => {
  const docs = [
    { id: "d1", title: "REACH Platform PRD", pinned: true, aiRef: true, status: "published", author: "u1", updated: "Mar 6", words: 4200 },
    { id: "d2", title: "Auth Token Refresh — Design Spec", pinned: false, aiRef: false, status: "published", author: "u2", updated: "Mar 5", words: 820, issue: "RC-001" },
    { id: "d3", title: "Cap Table Module Spec", pinned: false, aiRef: false, status: "draft", author: "u1", updated: "Mar 4", words: 3100 },
    { id: "d4", title: "Sprint 12 Retrospective", pinned: false, aiRef: false, status: "published", author: "u3", updated: "Mar 1", words: 560 },
  ];
  const [sel, setSel] = useState(docs[0]);
  const [editing, setEditing] = useState(false);

  return (
    <div style={{ display: "flex", height: "100%" }} className="fade-in">
      {/* Sidebar */}
      <div style={{ width: 260, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", background: T.surface, flexShrink: 0 }}>
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 8 }}>
          <input className="inp flex-1" style={{ fontSize: 11 }} placeholder="Search docs…" />
          <button className="btn btn-p btn-sm"><Ico n="plus" s={12}/></button>
        </div>
        {docs.map(doc => (
          <div key={doc.id} style={{ padding: "11px 14px", borderBottom: `1px solid ${T.border}`, cursor: "pointer",
            background: sel?.id === doc.id ? T.glow : "transparent", transition: ".1s" }}
            onClick={() => setSel(doc)}>
            <div className="flex gap-6 items-start mb-4">
              {doc.aiRef && <Ico n="pin" s={11} c={T.accent} style={{ flexShrink: 0, marginTop: 2 }} />}
              <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, color: sel?.id === doc.id ? T.accent : T.text }}>{doc.title}</span>
            </div>
            <div className="flex gap-6 items-c flex-wrap">
              <span className={`chip ${doc.status === "published" ? "chip-grn" : "chip-dim"} fs-9`}>{doc.status}</span>
              {doc.aiRef && <span className="chip chip-teal fs-9">AI ref</span>}
              {doc.issue && <span className="chip chip-teal fs-9">{doc.issue}</span>}
              <span style={{ fontSize: 10, color: T.textMuted }}>{doc.words}w · {doc.updated}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Content */}
      {sel && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: 10, background: T.surface, flexShrink: 0 }}>
            <span className="brg fw-6" style={{ fontSize: 14, flex: 1 }}>{sel.title}</span>
            <div className="flex items-c gap-8" style={{ fontSize: 11, color: T.textSub }}>
              <Av uid={sel.author} size="xs" />
              {USERS[sel.author]?.name}
              <span style={{ color: T.textMuted }}>· {sel.updated}</span>
            </div>
            <div style={{ width: 1, height: 20, background: T.border, margin: "0 4px" }} />
            <Tip text="Pin as AI reference">
              <button className="btn-ico"><Ico n="pin" s={13} c={sel.aiRef ? T.accent : T.textSub} /></button>
            </Tip>
            <button className="btn btn-g btn-sm" onClick={() => setEditing(!editing)}>
              <Ico n={editing ? "checkCircle" : "edit"} s={12} /> {editing ? "Preview" : "Edit"}
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "40px 56px", maxWidth: 860, margin: "0 auto", width: "100%" }}>
            {editing ? (
              <textarea className="inp w-full" style={{ height: 500, resize: "vertical", fontSize: 13, lineHeight: 1.8, fontFamily: "'DM Mono', monospace" }}
                defaultValue={`# ${sel.title}\n\nStart writing…`} />
            ) : (
              <>
                <h1 className="brg fw-8" style={{ fontSize: 28, marginBottom: 16, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{sel.title}</h1>
                <div className="flex gap-8 mb-24">
                  <span className={`chip ${sel.status === "published" ? "chip-grn" : "chip-dim"}`}>{sel.status}</span>
                  <span className="chip chip-dim">{sel.words} words</span>
                  {sel.aiRef && <span className="chip chip-teal"><Ico n="pin" s={9}/> AI Reference</span>}
                  {sel.issue && <span className="chip chip-teal">{sel.issue}</span>}
                </div>
                {sel.id === "d1" ? (
                  <div style={{ lineHeight: 1.85, color: T.textSub, fontSize: 13 }}>
                    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderLeft: `3px solid ${T.accent}`, borderRadius: 8, padding: "14px 20px", marginBottom: 24 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.accent, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>Core Principle</div>
                      The issue is not a database row. It is the thread that runs through every surface.
                      Open a PR — the issue is there. Open chat — the issue is there.
                      Write a doc — the issue is there. Open the IDE — the issue opened the file.
                    </div>
                    <h2 className="brg fw-6" style={{ fontSize: 18, marginBottom: 12, marginTop: 28, color: T.text }}>Architecture</h2>
                    <p style={{ marginBottom: 16 }}>REACH is a browser-runtime, local-first SaaS with multi-tenant isolation enforced at the database level via Supabase Row Level Security. There is no per-tenant server. The browser holds the full working state; Supabase is the sync layer.</p>
                    <h2 className="brg fw-6" style={{ fontSize: 18, marginBottom: 12, marginTop: 28, color: T.text }}>The @ System</h2>
                    <p>Every @mention creates a cross-surface link. @RC-001 in chat threads into the issue, surfaces in the IDE context, appears in the standup agenda, and updates the linked CRM account if one exists. This is the orchestration layer that separates REACH from a bundle of tools.</p>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: T.textSub, lineHeight: 1.85 }}>
                    Document content renders here with full Markdown — headings, code blocks, tables, and inline <span style={{ color: T.accent }}>@RC-001</span> issue references that cross-link on hover.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ══ STANDUPS ═══════════════════════════════════════════════ */
const Standups = ({ T, setIssue }) => {
  const [inCall, setInCall] = useState(false);
  const [notes, setNotes] = useState({ done: "", doing: "", blockers: "" });
  const [showSchedule, setShowSchedule] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("Daily Standup");
  const [meetingDate, setMeetingDate] = useState("2026-03-10");
  const [meetingTime, setMeetingTime] = useState("09:30");
  const [meetingDuration, setMeetingDuration] = useState("15");
  const [meetingType, setMeetingType] = useState("standup");
  const [copied, setCopied] = useState(false);
  const [attendees, setAttendees] = useState(Object.values(USERS).filter(u => u.role !== "guest"));
  const roomUrl = "https://reach.daily.co/standup-sprint12-abc123";

  const copyLink = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }} className="fade-in">
      {/* Header */}
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
        <div>
          <div className="brg fw-7" style={{ fontSize: 14 }}>Standups & Meetings</div>
          <div style={{ fontSize: 10, color: T.textSub, marginTop: 2 }}>Mon, Mar 9, 2026 · Sprint 12</div>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-g btn-sm" onClick={() => setShowAddMember(true)}>
          <Ico n="plus" s={11}/> Add Member
        </button>
        <button className="btn btn-g btn-sm" onClick={() => setShowSchedule(true)}>
          <Ico n="video" s={11}/> Schedule Meeting
        </button>
        <button className="btn btn-p btn-sm" onClick={() => setInCall(!inCall)}>
          <Ico n="video" s={12}/>
          {inCall ? "Leave call" : "Join Now"}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>

        {/* Share link bar — for external stakeholders */}
        <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
          <Ico n="globe" s={13} c={T.accentPurple} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>Meeting link — share with external stakeholders</div>
            <div style={{ fontSize: 10, color: T.textMuted, fontFamily: "'DM Mono', monospace" }}>{roomUrl}</div>
          </div>
          <button className="btn btn-g btn-sm" onClick={copyLink}>
            <Ico n="copy" s={11}/> {copied ? "Copied!" : "Copy link"}
          </button>
          <button className="btn btn-g btn-sm">
            <Ico n="send" s={11}/> Share via email
          </button>
        </div>

        {/* Schedule Modal */}
        {showSchedule && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
            <div className="flex items-c jc-sb mb-16">
              <div className="brg fw-6" style={{ fontSize: 14 }}>Schedule a Meeting</div>
              <button className="btn-ico" onClick={() => setShowSchedule(false)}><Ico n="x" s={13}/></button>
            </div>
            <div className="g2" style={{ gap: 12, marginBottom: 12 }}>
              <div>
                <label className="lbl">Meeting title</label>
                <input className="inp" value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} />
              </div>
              <div>
                <label className="lbl">Type</label>
                <select className="inp" value={meetingType} onChange={e => setMeetingType(e.target.value)}>
                  <option value="standup">Daily Standup</option>
                  <option value="planning">Sprint Planning</option>
                  <option value="retro">Retrospective</option>
                  <option value="refinement">Backlog Refinement</option>
                  <option value="review">Sprint Review</option>
                  <option value="ad-hoc">Ad-hoc Meeting</option>
                </select>
              </div>
              <div>
                <label className="lbl">Date</label>
                <input className="inp" type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
              </div>
              <div>
                <label className="lbl">Time</label>
                <input className="inp" type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} />
              </div>
              <div>
                <label className="lbl">Duration (min)</label>
                <select className="inp" value={meetingDuration} onChange={e => setMeetingDuration(e.target.value)}>
                  {["15","30","45","60","90"].map(d => <option key={d} value={d}>{d} min</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label className="lbl">Invite external stakeholders (email)</label>
              <div className="flex gap-8">
                <input className="inp flex-1" placeholder="stakeholder@company.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                <button className="btn btn-g btn-sm">Add</button>
              </div>
            </div>
            <div className="flex gap-8 mt-16">
              <button className="btn btn-p btn-sm" onClick={() => setShowSchedule(false)}>
                <Ico n="video" s={11}/> Create room & send invites
              </button>
              <button className="btn btn-g btn-sm" onClick={copyLink}>
                <Ico n="copy" s={11}/> Copy link to share
              </button>
              <button className="btn btn-g btn-sm" onClick={() => setShowSchedule(false)}>Cancel</button>
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMember && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, marginBottom: 16 }}>
            <div className="flex items-c jc-sb mb-14">
              <div className="brg fw-6" style={{ fontSize: 14 }}>Add Members to Standup</div>
              <button className="btn-ico" onClick={() => setShowAddMember(false)}><Ico n="x" s={13}/></button>
            </div>
            <div className="flex gap-8 mb-14">
              <input className="inp flex-1" placeholder="Search by name or email…" />
              <button className="btn btn-g btn-sm">Search</button>
            </div>
            <div style={{ marginBottom: 14 }}>
              {Object.values(USERS).map(u => (
                <div key={u.id} className="flex items-c gap-10 mb-8">
                  <Av uid={u.id} size="sm" showStatus />
                  <span style={{ fontSize: 12, flex: 1 }}>{u.name}</span>
                  <span className={`chip ${u.role === "admin" ? "chip-teal" : "chip-dim"}`}>{u.role}</span>
                  <button className="btn btn-g btn-xs">
                    {attendees.find(a => a.id === u.id) ? "✓ Added" : "+ Add"}
                  </button>
                </div>
              ))}
            </div>
            <button className="btn btn-p btn-sm" onClick={() => setShowAddMember(false)}>Done</button>
          </div>
        )}

        {/* Live call */}
        {inCall && (
          <div style={{ background: "#000", borderRadius: 10, marginBottom: 20, height: 260, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${T.border}`, position: "relative", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, width: "100%", height: "100%" }}>
              {attendees.slice(0, 4).map(u => (
                <div key={u.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, background: "#0D0D0F" }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: u.hue + "25", border: `2px solid ${u.hue}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 17, fontWeight: 700, color: u.hue, fontFamily: "'DM Mono', monospace" }}>{u.initials}</span>
                  </div>
                  <span style={{ fontSize: 11, color: "#EEEEF2", fontWeight: 600 }}>{u.name}</span>
                </div>
              ))}
            </div>
            <div style={{ position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8 }}>
              {["mic", "video", "maximize"].map(a => (
                <button key={a} style={{ width: 34, height: 34, borderRadius: "50%", background: "#ffffff18", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <Ico n={a} s={13} c="#fff" />
                </button>
              ))}
              <button onClick={() => setInCall(false)} style={{ width: 34, height: 34, borderRadius: "50%", background: "#DC2626", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Ico n="x" s={13} c="#fff" />
              </button>
            </div>
            <div style={{ position: "absolute", top: 10, right: 12, background: "#DC262699", padding: "3px 9px", borderRadius: 4, fontSize: 9, color: "#fff", fontWeight: 800 }}>● LIVE</div>
            <div style={{ position: "absolute", top: 10, left: 12, display: "flex", gap: 6 }}>
              <button style={{ background: "#ffffff18", border: "none", borderRadius: 4, padding: "4px 8px", fontSize: 9, color: "#fff", cursor: "pointer" }} onClick={copyLink}>
                <Ico n="copy" s={10} c="#fff" /> {copied ? "Copied!" : "Copy link"}
              </button>
            </div>
          </div>
        )}

        <div className="g2">
          {/* Pre-call notes */}
          <div className="card">
            <div className="brg fw-6" style={{ fontSize: 14, marginBottom: 16 }}>Pre-call notes</div>
            {[
              { key: "done",     label: "Finished?",    ph: "Closed RC-003 · pushed time trigger…" },
              { key: "doing",    label: "Working on?",  ph: "RC-001 token refresh · needs review…" },
              { key: "blockers", label: "Blocked?",     ph: "Waiting on token spec from Sam…" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label className="lbl">{f.label}</label>
                <textarea className="inp" rows={2} placeholder={f.ph} value={notes[f.key]}
                  onChange={e => setNotes(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ resize: "none", lineHeight: 1.65 }} />
              </div>
            ))}
            <button className="btn btn-g btn-sm w-full" style={{ justifyContent: "center" }}>Save notes</button>
          </div>

          <div className="flex col gap-14">
            {/* Pinned issues */}
            <div className="card">
              <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 12 }}>Pinned issues</div>
              {ISSUES.filter(i => i.status === "in_progress").map(issue => (
                <div key={issue.id} className="flex gap-8 items-c" style={{ padding: "9px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}
                  onClick={() => setIssue(issue)}>
                  <Prio p={issue.priority} />
                  <span style={{ fontSize: 11, flex: 1, fontWeight: 500 }}>{issue.title}</span>
                  <StatusChip s={issue.status} />
                </div>
              ))}
              <button className="btn btn-g btn-sm mt-10"><Ico n="plus" s={11}/> Pin issue</button>
            </div>

            {/* Attendance */}
            <div className="card">
              <div className="flex items-c jc-sb mb-12">
                <div className="brg fw-6" style={{ fontSize: 13 }}>Attendance ({attendees.length})</div>
                <button className="btn btn-g btn-xs" onClick={() => setShowAddMember(true)}><Ico n="plus" s={10}/> Add</button>
              </div>
              {attendees.map(u => (
                <div key={u.id} className="flex items-c gap-8 mb-8">
                  <Av uid={u.id} size="sm" showStatus />
                  <span style={{ fontSize: 12, flex: 1 }}>{u.name}</span>
                  <span className={`chip ${u.status === "active" ? "chip-grn" : "chip-dim"}`}>{u.status}</span>
                </div>
              ))}
            </div>

            {/* Upcoming meetings */}
            <div className="card">
              <div className="flex items-c jc-sb mb-12">
                <div className="brg fw-6" style={{ fontSize: 13 }}>Upcoming</div>
                <button className="btn btn-g btn-xs" onClick={() => setShowSchedule(true)}><Ico n="plus" s={10}/> Schedule</button>
              </div>
              {[
                { title: "Daily Standup", time: "Today 9:30 AM", type: "standup", live: true },
                { title: "Sprint Planning", time: "Mar 14 10:00 AM", type: "planning", live: false },
                { title: "Retrospective", time: "Mar 14 2:00 PM", type: "retro", live: false },
              ].map((m, i) => (
                <div key={i} className="flex items-c gap-10 mb-8" style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                  <Ico n="video" s={12} c={m.live ? T.success : T.textMuted} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{m.title}</div>
                    <div style={{ fontSize: 10, color: T.textMuted }}>{m.time}</div>
                  </div>
                  {m.live
                    ? <button className="btn btn-p btn-xs" onClick={() => setInCall(true)}>Join Now</button>
                    : <button className="btn btn-g btn-xs" onClick={copyLink}><Ico n="copy" s={10}/> Copy link</button>
                  }
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


/* ══ ANALYTICS ══════════════════════════════════════════════ */
const Analytics = ({ T, setIssue }) => {
  const pv = 24, ev = 18, ac = 16;
  const [audience, setAudience] = useState("all"); // all | dev | manager
  const [activeChart, setActiveChart] = useState("throughput");

  // ── mini chart helpers (all pure SVG/div, no deps) ──────────
  const LineChart = ({ data, color, h = 80, label }) => {
    const max = Math.max(...data);
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${h - (v / max) * (h - 8)}`).join(" ");
    const area = `0,${h} ${pts} ${100},${h}`;
    return (
      <svg width="100%" height={h} viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs>
          <linearGradient id={`lg-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#lg-${label})`} />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((v, i) => (
          <circle key={i} cx={(i / (data.length - 1)) * 100} cy={h - (v / max) * (h - 8)} r="2" fill={color} />
        ))}
      </svg>
    );
  };

  const BarChart = ({ data, color, h = 80, labels }) => {
    const max = Math.max(...data.map(d => Array.isArray(d) ? d.reduce((s,x)=>s+x,0) : d));
    const STACKED_COLORS = [color, T.accentPurple, T.textMuted];
    return (
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: h }}>
        {data.map((v, i) => {
          const vals = Array.isArray(v) ? v : [v];
          const total = vals.reduce((s,x)=>s+x,0);
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: h - 16 }}>
                {vals.map((seg, si) => (
                  <div key={si} style={{ width: "100%", height: `${(seg / max) * (h - 16)}px`, background: STACKED_COLORS[si], borderRadius: si === vals.length - 1 ? "3px 3px 0 0" : 0, minHeight: seg > 0 ? 2 : 0 }} />
                ))}
              </div>
              {labels && <span style={{ fontSize: 8, color: T.textMuted, textAlign: "center" }}>{labels[i]}</span>}
            </div>
          );
        })}
      </div>
    );
  };

  const ScatterPlot = ({ dots, h = 100 }) => {
    const maxX = Math.max(...dots.map(d => d.x));
    const maxY = Math.max(...dots.map(d => d.y));
    const p50 = dots.sort((a,b)=>a.y-b.y)[Math.floor(dots.length*0.5)]?.y || 0;
    const p85 = dots.sort((a,b)=>a.y-b.y)[Math.floor(dots.length*0.85)]?.y || 0;
    return (
      <svg width="100%" height={h} viewBox={`0 0 200 ${h}`} style={{ display: "block" }}>
        <line x1="0" y1={h - (p50 / maxY) * (h - 10)} x2="200" y2={h - (p50 / maxY) * (h - 10)} stroke={T.success} strokeWidth="0.8" strokeDasharray="3,3" opacity="0.6" />
        <line x1="0" y1={h - (p85 / maxY) * (h - 10)} x2="200" y2={h - (p85 / maxY) * (h - 10)} stroke={T.warn} strokeWidth="0.8" strokeDasharray="3,3" opacity="0.6" />
        {dots.map((d, i) => (
          <circle key={i} cx={(d.x / maxX) * 190 + 5} cy={h - (d.y / maxY) * (h - 10)} r="3"
            fill={d.y > p85 ? T.danger : d.y > p50 ? T.warn : T.accent} opacity="0.8" />
        ))}
        <text x="3" y={h - (p50 / maxY) * (h - 10) - 3} fill={T.success} fontSize="6">p50</text>
        <text x="3" y={h - (p85 / maxY) * (h - 10) - 3} fill={T.warn} fontSize="6">p85</text>
      </svg>
    );
  };

  const CFDChart = ({ h = 90 }) => {
    const weeks = 8;
    const todo =   [14,13,12,11,10, 9, 8, 7];
    const inprog = [ 4, 5, 6, 6, 5, 4, 5, 4];
    const done =   [ 2, 4, 4, 5, 7, 9,11,13];
    const colors = [T.textMuted, T.accent, T.success];
    const stacks = [todo, inprog, done];
    const totals = todo.map((_, i) => stacks.reduce((s, arr) => s + arr[i], 0));
    const maxT = Math.max(...totals);
    const areas = stacks.map((arr, si) => {
      const cumArr = arr.map((_, i) => stacks.slice(si).reduce((s, a) => s + a[i], 0));
      const pts = cumArr.map((v, i) => `${(i / (weeks - 1)) * 100},${h - (v / maxT) * (h - 4)}`).join(" ");
      const prev = si < stacks.length - 1 ? stacks[si+1].map((_, i) => stacks.slice(si+1).reduce((s,a)=>s+a[i],0)) : Array(weeks).fill(0);
      const ppts = prev.map((v, i) => `${(i / (weeks - 1)) * 100},${h - (v / maxT) * (h - 4)}`).reverse().join(" ");
      return { pts: `${pts} ${ppts}`, color: colors[si] };
    });
    return (
      <svg width="100%" height={h} viewBox={`0 0 100 ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
        {areas.map((a, i) => <polygon key={i} points={a.pts} fill={a.color} opacity="0.25" />)}
        {stacks.map((arr, si) => {
          const cumArr = arr.map((_, i) => stacks.slice(si).reduce((s, a) => s + a[i], 0));
          const pts = cumArr.map((v, i) => `${(i / (weeks - 1)) * 100},${h - (v / maxT) * (h - 4)}`).join(" ");
          return <polyline key={si} points={pts} fill="none" stroke={colors[si]} strokeWidth="1.2" />;
        })}
      </svg>
    );
  };

  const WIPAging = ({ issues }) => issues.map((iss, i) => {
    const pct = Math.min(iss.age / 14, 1);
    const color = iss.age > 7 ? T.danger : iss.age > 3 ? T.warn : T.success;
    return (
      <div key={i} style={{ marginBottom: 8 }}>
        <div className="flex items-c jc-sb mb-2" style={{ fontSize: 11 }}>
          <span style={{ color: T.accent, fontWeight: 600, cursor: "pointer" }} onClick={() => setIssue && setIssue(iss.issue)}>{iss.id}</span>
          <span style={{ color: color, fontWeight: 700 }}>{iss.age}d</span>
        </div>
        <div style={{ height: 5, background: T.surface3, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ width: `${pct * 100}%`, height: "100%", background: color, borderRadius: 3, transition: ".4s" }} />
        </div>
        <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }} className="trunc">{iss.title}</div>
      </div>
    );
  });

  // ── mock data for each chart ──────────────────────────────
  const throughputData = [3, 4, 3, 5, 4, 6, 4, 5, 6, 5, 7, 6];
  const prCycleData = [[4,2,1],[6,3,2],[3,1,1],[8,4,2],[5,2,1],[4,1,1],[7,3,2],[5,2,1]];
  const queueData = [[2,1,0],[1,2,1],[3,1,0],[2,1,1],[1,0,1]];
  const interruptData = [[5,1],[6,2],[4,3],[7,1],[5,2],[6,3],[4,1],[5,2]];
  const scatterDots = [
    {x:1,y:2},{x:2,y:3},{x:3,y:2},{x:4,y:5},{x:5,y:3},{x:6,y:2},{x:7,y:8},{x:8,y:3},
    {x:9,y:4},{x:10,y:2},{x:11,y:3},{x:12,y:12},{x:13,y:3},{x:14,y:4},{x:15,y:2},
  ];
  const wipIssues = [
    { id: "RC-001", title: "Auth token refresh race condition", age: 8, issue: ISSUES[0] },
    { id: "RC-002", title: "Dashboard latency > 2s on cold load", age: 4, issue: ISSUES[1] },
    { id: "RC-003", title: "Missed timezone on standup reminder", age: 2, issue: ISSUES[2] },
    { id: "RC-004", title: "Export CSV drops Unicode chars", age: 11, issue: ISSUES[3] },
  ];
  const predictData = [
    { label: "Q3'25", done: 84, changed: 10, missed: 6 },
    { label: "Q4'25", done: 79, changed: 14, missed: 7 },
    { label: "Q1'26", done: 88, changed: 8, missed: 4 },
  ];

  const CHARTS = [
    {
      id: "throughput", label: "Personal Throughput", who: "Developer",
      insight: "Am I maintaining a sustainable pace?",
      desc: "Issues closed per week — individual. Self-awareness without judgment. Input for performance reviews and personal goal setting.",
      render: () => (
        <>
          <LineChart data={throughputData} color={T.accent} h={90} label="throughput" />
          <div className="flex jc-sb mt-6" style={{ fontSize: 9, color: T.textMuted }}>
            <span>12 weeks ago</span><span>This week: <strong style={{color:T.accent}}>6 issues</strong></span>
          </div>
        </>
      ),
    },
    {
      id: "pr-cycle", label: "PR Cycle Time", who: "Developer",
      insight: "Where am I waiting?",
      desc: "Time from PR open → merged, split into: first review wait, review iteration, merge queue. Makes waiting visible and actionable.",
      render: () => (
        <>
          <BarChart data={prCycleData} color={T.accent} h={90} labels={["W1","W2","W3","W4","W5","W6","W7","W8"]} />
          <div className="flex gap-12 mt-6" style={{ fontSize: 9, color: T.textMuted }}>
            <span className="flex items-c gap-4"><div style={{width:8,height:8,borderRadius:2,background:T.accent}}/> First review</span>
            <span className="flex items-c gap-4"><div style={{width:8,height:8,borderRadius:2,background:T.accentPurple}}/> Iteration</span>
            <span className="flex items-c gap-4"><div style={{width:8,height:8,borderRadius:2,background:T.textMuted}}/> Merge queue</span>
          </div>
        </>
      ),
    },
    {
      id: "queue", label: "My Queue", who: "Developer",
      insight: "What's piling up?",
      desc: "Open issues assigned to me, stacked by priority. Prevents priority blindness when everything feels urgent.",
      render: () => (
        <>
          <BarChart data={queueData} color={T.danger} h={90} labels={["RC-001","RC-002","RC-003","RC-004","RC-005"]} />
          <div className="flex gap-12 mt-6" style={{ fontSize: 9, color: T.textMuted }}>
            <span className="flex items-c gap-4"><div style={{width:8,height:8,borderRadius:2,background:T.danger}}/> Critical</span>
            <span className="flex items-c gap-4"><div style={{width:8,height:8,borderRadius:2,background:T.accentPurple}}/> High</span>
            <span className="flex items-c gap-4"><div style={{width:8,height:8,borderRadius:2,background:T.textMuted}}/> Medium</span>
          </div>
        </>
      ),
    },
    {
      id: "interruption", label: "Interruption Burden", who: "Developer",
      insight: "Am I getting context-switched to death?",
      desc: "Unplanned work (bugs, hotfixes) vs. planned over time. Makes the cost of interruptions visible to both developer and manager.",
      render: () => (
        <>
          <BarChart data={interruptData} color={T.success} h={90} labels={["W1","W2","W3","W4","W5","W6","W7","W8"]} />
          <div className="flex gap-12 mt-6" style={{ fontSize: 9, color: T.textMuted }}>
            <span className="flex items-c gap-4"><div style={{width:8,height:8,borderRadius:2,background:T.success}}/> Planned</span>
            <span className="flex items-c gap-4"><div style={{width:8,height:8,borderRadius:2,background:T.accentPurple}}/> Unplanned</span>
          </div>
        </>
      ),
    },
    {
      id: "cycle-scatter", label: "Cycle Time Scatterplot", who: "Manager",
      insight: "What can we reliably promise?",
      desc: "Each dot = one completed issue. p50/p85 lines show predictable delivery range. Outliers above p85 kill forecasting.",
      render: () => (
        <>
          <ScatterPlot dots={scatterDots} h={100} />
          <div className="flex gap-16 mt-6" style={{ fontSize: 9, color: T.textMuted }}>
            <span className="flex items-c gap-4"><div style={{width:12,height:1,background:T.success}}/> p50: 3d</span>
            <span className="flex items-c gap-4"><div style={{width:12,height:1,background:T.warn}}/> p85: 5d</span>
            <span className="flex items-c gap-4"><div style={{width:8,height:8,borderRadius:"50%",background:T.danger}}/> Outlier</span>
          </div>
        </>
      ),
    },
    {
      id: "cfd", label: "Cumulative Flow", who: "Manager",
      insight: "Is flow smooth or choppy?",
      desc: "Stacked area — To Do, In Progress, Done — over time. If 'In Progress' grows while 'Done' flatlines, you're stuck.",
      render: () => (
        <>
          <CFDChart h={90} />
          <div className="flex gap-12 mt-6" style={{ fontSize: 9, color: T.textMuted }}>
            <span className="flex items-c gap-4"><div style={{width:8,height:8,borderRadius:2,background:T.success}}/> Done</span>
            <span className="flex items-c gap-4"><div style={{width:8,height:8,borderRadius:2,background:T.accent}}/> In Progress</span>
            <span className="flex items-c gap-4"><div style={{width:8,height:8,borderRadius:2,background:T.textMuted}}/> To Do</span>
          </div>
        </>
      ),
    },
    {
      id: "wip-aging", label: "WIP Aging", who: "Manager",
      insight: "What's been stuck too long?",
      desc: "How long each in-progress issue has sat open, with thresholds. Stale work is invisible work — this drags it into the light.",
      render: () => <WIPAging issues={wipIssues} />,
    },
    {
      id: "predictability", label: "Predictability Index", who: "Manager",
      insight: "Can we trust our forecasts?",
      desc: "% committed work completed vs. scope changed vs. missed per quarter. Executives hate surprises — this quantifies reliability.",
      render: () => (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {predictData.map(q => (
            <div key={q.label}>
              <div className="flex items-c jc-sb mb-2" style={{ fontSize: 10 }}>
                <span style={{ color: T.textSub, fontWeight: 700 }}>{q.label}</span>
                <span style={{ color: T.success, fontWeight: 700 }}>{q.done}% committed</span>
              </div>
              <div style={{ display: "flex", height: 12, borderRadius: 4, overflow: "hidden", gap: 1 }}>
                <div style={{ width: `${q.done}%`, background: T.success }} />
                <div style={{ width: `${q.changed}%`, background: T.warn }} />
                <div style={{ width: `${q.missed}%`, background: T.danger }} />
              </div>
              <div className="flex gap-12 mt-2" style={{ fontSize: 9, color: T.textMuted }}>
                <span>{q.changed}% changed</span><span>{q.missed}% missed</span>
              </div>
            </div>
          ))}
          <div className="flex gap-12 mt-4" style={{ fontSize: 9, color: T.textMuted }}>
            <span className="flex items-c gap-4"><div style={{width:8,height:8,borderRadius:2,background:T.success}}/> Completed</span>
            <span className="flex items-c gap-4"><div style={{width:8,height:8,borderRadius:2,background:T.warn}}/> Scope changed</span>
            <span className="flex items-c gap-4"><div style={{width:8,height:8,borderRadius:2,background:T.danger}}/> Missed</span>
          </div>
        </div>
      ),
    },
  ];

  const visible = audience === "all" ? CHARTS : CHARTS.filter(c => (audience === "dev" ? "Developer" : "Manager") === c.who);
  const activeC = CHARTS.find(c => c.id === activeChart) || CHARTS[0];

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }} className="fade-in">

      {/* Left: Chart list */}
      <div style={{ width: 220, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", background: T.surface, flexShrink: 0 }}>
        <div style={{ padding: "12px 14px 8px", borderBottom: `1px solid ${T.border}` }}>
          <div className="brg fw-7" style={{ fontSize: 14, marginBottom: 10 }}>Analytics</div>
          <div className="flex gap-4">
            {[["all","All"],["dev","Dev"],["manager","Mgr"]].map(([v,l]) => (
              <button key={v} className={`btn btn-xs ${audience === v ? "btn-p" : "btn-g"}`} style={{ flex: 1, justifyContent: "center", fontSize: 10 }} onClick={() => setAudience(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {/* EVM summary strip */}
          <div style={{ padding: "8px 14px", marginBottom: 4, borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: T.textMuted, marginBottom: 8 }}>Sprint 12 · EVM</div>
            {[
              { l: "PV (Planned)", v: `${pv}pt`, c: T.textSub },
              { l: "EV (Earned)", v: `${ev}pt`, c: T.accent },
              { l: "CPI", v: (ev/ac).toFixed(2), c: ev/ac >= 1 ? T.success : T.warn },
              { l: "SPI", v: (ev/pv).toFixed(2), c: ev/pv >= 1 ? T.success : T.warn },
            ].map(r => (
              <div key={r.l} className="flex jc-sb mb-3" style={{ fontSize: 10 }}>
                <span style={{ color: T.textMuted }}>{r.l}</span>
                <span style={{ color: r.c, fontWeight: 700 }}>{r.v}</span>
              </div>
            ))}
          </div>
          {visible.map(ch => (
            <div key={ch.id} className={`nav-item${activeChart === ch.id ? " active" : ""}`}
              onClick={() => setActiveChart(ch.id)}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600 }} className="trunc">{ch.label}</div>
                <div style={{ fontSize: 9, color: ch.who === "Developer" ? T.accent : T.accentPurple }}>{ch.who}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Active chart detail */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24, background: T.bg }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div className="flex items-c gap-10 mb-6">
            <span className="chip" style={{ background: activeC.who === "Developer" ? T.accent + "18" : T.accentPurple + "18", color: activeC.who === "Developer" ? T.accent : T.accentPurple, fontSize: 10 }}>{activeC.who}</span>
            <span style={{ fontSize: 9, color: T.textMuted, fontStyle: "italic" }}>"{activeC.insight}"</span>
          </div>
          <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 6 }}>{activeC.label}</div>
          <div style={{ fontSize: 12, color: T.textSub, maxWidth: 560, lineHeight: 1.7 }}>{activeC.desc}</div>
        </div>

        {/* Chart render */}
        <div className="card" style={{ marginBottom: 20 }}>
          {activeC.render()}
        </div>

        {/* Issue connection — every chart links back to the atomic unit */}
        <div style={{ background: T.surface, border: `1px solid ${T.accent}22`, borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
          <div className="flex items-c gap-8 mb-10">
            <Ico n="link" s={12} c={T.accent} />
            <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: T.accent }}>Issues driving this chart</span>
          </div>
          {ISSUES.slice(0, 3).map(iss => (
            <div key={iss.id} className="flex items-c gap-10" style={{ padding: "8px 0", borderBottom: `1px solid ${T.border}`, cursor: "pointer" }}
              onClick={() => setIssue(iss)}>
              <Prio p={iss.priority} />
              <span style={{ fontSize: 10, color: T.accent, fontWeight: 700, width: 58, flexShrink: 0 }}>{iss.id}</span>
              <span style={{ flex: 1, fontSize: 12 }} className="trunc">{iss.title}</span>
              <StatusChip s={iss.status} />
              <span style={{ fontSize: 10, color: T.textMuted }}>{iss.timeLogged}h</span>
              {iss.crmContext && <Ico n="brief" s={11} c={T.accentWarm} />}
            </div>
          ))}
        </div>

        {/* All 8 charts mini-grid overview */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: T.textMuted, marginBottom: 12 }}>All charts</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {CHARTS.map(ch => (
              <div key={ch.id} style={{
                border: `1px solid ${activeChart === ch.id ? T.accent : T.border}`,
                borderRadius: 8, padding: "12px 14px", cursor: "pointer", background: activeChart === ch.id ? T.accent + "08" : T.surface,
                transition: ".12s",
              }} onClick={() => setActiveChart(ch.id)}>
                <div style={{ fontSize: 9, color: ch.who === "Developer" ? T.accent : T.accentPurple, fontWeight: 700, marginBottom: 4 }}>{ch.who}</div>
                <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>{ch.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══ CRM ════════════════════════════════════════════════════ */
const CRM = ({ T, setIssue }) => {
  const [view, setView]         = useState("pipeline");
  const [deals, setDeals]       = useState(CRM_PIPELINE);
  const [dragging, setDragging] = useState(null);
  const [showNewDeal, setShowNewDeal]       = useState(false);
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [newDeal, setNewDeal]     = useState({ title: "", account: "", value: "", stage: "prospect", prob: 10, close: "" });
  const [newAccount, setNewAccount] = useState({ name: "", domain: "", industry: "", size: "startup", arr: "", health: "healthy" });
  const [newContact, setNewContact] = useState({ name: "", email: "", role: "", account: "", is_champion: false });
  const [contacts, setContacts]   = useState([
    { id: "c1", name: "Sarah Lin",    email: "sarah@northstar.io",   role: "CTO",          account: "a1", is_champion: true },
    { id: "c2", name: "Marcus Webb",  email: "marcus@apexvc.com",    role: "Partner",      account: "a2", is_champion: true },
    { id: "c3", name: "Priya Nair",   email: "priya@cascade.io",     role: "VP Eng",       account: "a3", is_champion: false },
    { id: "c4", name: "Tom Reyes",    email: "tom@cascade.io",       role: "Procurement",  account: "a3", is_champion: false },
    { id: "c5", name: "Dana Okafor",  email: "dana@orbitprotocol.io",role: "CEO",          account: "a4", is_champion: true },
  ]);

  const stages = ["prospect", "qualified", "proposal", "negotiation", "won", "lost"];
  const stageColors = { prospect: T.textMuted, qualified: T.accent, proposal: T.warn, negotiation: T.accentPurple, won: T.success, lost: T.danger };
  const totalPipeline = stages.filter(s => !["won","lost"].includes(s))
    .flatMap(s => deals[s] || []).reduce((sum, d) => sum + d.value, 0);

  const markWon = (stage, dealId) => {
    const deal = (deals[stage] || []).find(d => d.id === dealId);
    if (!deal) return;
    setDeals(p => ({
      ...p,
      [stage]: (p[stage] || []).filter(d => d.id !== dealId),
      won: [...(p.won || []), { ...deal }],
    }));
    // In real app: INSERT projects with budget = deal.value
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }} className="fade-in">
      {/* Header */}
      <div style={{ padding: "10px 20px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
        <div className="brg fw-6" style={{ fontSize: 14 }}>CRM</div>
        <span style={{ fontSize: 11, color: T.textSub }}>Pipeline: <strong style={{ color: T.text }}>${(totalPipeline/1000).toFixed(0)}k</strong></span>
        <div style={{ background: T.glowWarm, border: `1px solid ${T.accentWarm}30`, borderRadius: 6, padding: "3px 10px", display: "flex", alignItems: "center", gap: 5 }}>
          <Ico n="zap" s={10} c={T.accentWarm} />
          <span style={{ fontSize: 10, color: T.accentWarm, fontWeight: 600 }}>Won deal → auto-creates project + budget</span>
        </div>
        <div style={{ flex: 1 }} />
        <div className="flex gap-4">
          {["pipeline","accounts","contacts","cap-table"].map(v => (
            <button key={v} className={`btn btn-sm ${view===v?"btn-p":"btn-g"}`} onClick={() => setView(v)}>
              {v==="cap-table" ? "Cap Table" : v.charAt(0).toUpperCase()+v.slice(1)}
            </button>
          ))}
        </div>
        {view === "pipeline"  && <button className="btn btn-p btn-sm" onClick={() => setShowNewDeal(true)}><Ico n="plus" s={12}/> New Deal</button>}
        {view === "accounts"  && <button className="btn btn-p btn-sm" onClick={() => setShowNewAccount(true)}><Ico n="plus" s={12}/> New Account</button>}
        {view === "contacts"  && <button className="btn btn-p btn-sm" onClick={() => setShowNewContact(true)}><Ico n="plus" s={12}/> New Contact</button>}
      </div>

      {/* New Deal Modal */}
      {showNewDeal && (
        <div style={{ background: T.surface2, borderBottom: `1px solid ${T.border}`, padding: "16px 20px" }}>
          <div className="flex items-c jc-sb mb-14">
            <div className="brg fw-6" style={{ fontSize: 14 }}>New Deal</div>
            <button className="btn-ico" onClick={() => setShowNewDeal(false)}><Ico n="x" s={13}/></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label className="lbl">Deal title</label><input className="inp" placeholder="Platform expansion" value={newDeal.title} onChange={e => setNewDeal(p=>({...p,title:e.target.value}))} /></div>
            <div><label className="lbl">Account</label>
              <select className="inp" value={newDeal.account} onChange={e => setNewDeal(p=>({...p,account:e.target.value}))}>
                <option value="">Select account…</option>
                {CRM_ACCOUNTS.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </div>
            <div><label className="lbl">Value ($)</label><input className="inp" type="number" placeholder="50000" value={newDeal.value} onChange={e => setNewDeal(p=>({...p,value:Number(e.target.value)}))} /></div>
            <div><label className="lbl">Stage</label>
              <select className="inp" value={newDeal.stage} onChange={e => setNewDeal(p=>({...p,stage:e.target.value}))}>
                {stages.slice(0,-1).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="lbl">Probability (%)</label><input className="inp" type="number" min="0" max="100" value={newDeal.prob} onChange={e => setNewDeal(p=>({...p,prob:Number(e.target.value)}))} /></div>
            <div><label className="lbl">Close date</label><input className="inp" type="date" value={newDeal.close} onChange={e => setNewDeal(p=>({...p,close:e.target.value}))} /></div>
          </div>
          <div className="flex gap-8">
            <button className="btn btn-p btn-sm" onClick={() => {
              const id = "d" + Date.now();
              setDeals(prev => ({ ...prev, [newDeal.stage]: [...(prev[newDeal.stage]||[]), { id, ...newDeal }] }));
              setShowNewDeal(false); setNewDeal({ title:"",account:"",value:"",stage:"prospect",prob:10,close:"" });
            }}>Create Deal</button>
            <button className="btn btn-g btn-sm" onClick={() => setShowNewDeal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* New Account Modal */}
      {showNewAccount && (
        <div style={{ background: T.surface2, borderBottom: `1px solid ${T.border}`, padding: "16px 20px" }}>
          <div className="flex items-c jc-sb mb-14">
            <div className="brg fw-6" style={{ fontSize: 14 }}>New Account</div>
            <button className="btn-ico" onClick={() => setShowNewAccount(false)}><Ico n="x" s={13}/></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label className="lbl">Company name</label><input className="inp" placeholder="Acme Inc" value={newAccount.name} onChange={e => setNewAccount(p=>({...p,name:e.target.value}))} /></div>
            <div><label className="lbl">Domain</label><input className="inp" placeholder="acme.io" value={newAccount.domain} onChange={e => setNewAccount(p=>({...p,domain:e.target.value}))} /></div>
            <div><label className="lbl">Industry</label><input className="inp" placeholder="SaaS / FinTech…" value={newAccount.industry} onChange={e => setNewAccount(p=>({...p,industry:e.target.value}))} /></div>
            <div><label className="lbl">Size</label>
              <select className="inp" value={newAccount.size} onChange={e => setNewAccount(p=>({...p,size:e.target.value}))}>
                {["startup","smb","mid-market","enterprise"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="lbl">ARR ($)</label><input className="inp" type="number" placeholder="120000" value={newAccount.arr} onChange={e => setNewAccount(p=>({...p,arr:Number(e.target.value)}))} /></div>
            <div><label className="lbl">Health</label>
              <select className="inp" value={newAccount.health} onChange={e => setNewAccount(p=>({...p,health:e.target.value}))}>
                <option value="healthy">Healthy</option><option value="at-risk">At risk</option><option value="churned">Churned</option>
              </select>
            </div>
          </div>
          <div className="flex gap-8">
            <button className="btn btn-p btn-sm" onClick={() => setShowNewAccount(false)}>Create Account</button>
            <button className="btn btn-g btn-sm" onClick={() => setShowNewAccount(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* New Contact Modal */}
      {showNewContact && (
        <div style={{ background: T.surface2, borderBottom: `1px solid ${T.border}`, padding: "16px 20px" }}>
          <div className="flex items-c jc-sb mb-14">
            <div className="brg fw-6" style={{ fontSize: 14 }}>New Contact</div>
            <button className="btn-ico" onClick={() => setShowNewContact(false)}><Ico n="x" s={13}/></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div><label className="lbl">Full name</label><input className="inp" placeholder="Sarah Lin" value={newContact.name} onChange={e => setNewContact(p=>({...p,name:e.target.value}))} /></div>
            <div><label className="lbl">Email</label><input className="inp" type="email" placeholder="sarah@company.io" value={newContact.email} onChange={e => setNewContact(p=>({...p,email:e.target.value}))} /></div>
            <div><label className="lbl">Role / Title</label><input className="inp" placeholder="CTO" value={newContact.role} onChange={e => setNewContact(p=>({...p,role:e.target.value}))} /></div>
            <div><label className="lbl">Account</label>
              <select className="inp" value={newContact.account} onChange={e => setNewContact(p=>({...p,account:e.target.value}))}>
                <option value="">Select account…</option>
                {CRM_ACCOUNTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, paddingBottom: 2 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, cursor: "pointer" }}>
                <input type="checkbox" checked={newContact.is_champion} onChange={e => setNewContact(p=>({...p,is_champion:e.target.checked}))} />
                Champion / Decision maker
              </label>
            </div>
          </div>
          <div className="flex gap-8">
            <button className="btn btn-p btn-sm" onClick={() => {
              setContacts(prev => [...prev, { id:"c"+Date.now(), ...newContact }]);
              setShowNewContact(false); setNewContact({ name:"",email:"",role:"",account:"",is_champion:false });
            }}>Create Contact</button>
            <button className="btn btn-g btn-sm" onClick={() => setShowNewContact(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Account detail panel */}
      {selectedAccount && (
        <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "16px 20px" }}>
          <div className="flex items-c jc-sb mb-12">
            <div>
              <div className="brg fw-7" style={{ fontSize: 15 }}>{selectedAccount.name}</div>
              <div style={{ fontSize: 10, color: T.textMuted }}>{selectedAccount.tier} · {selectedAccount.renewal}</div>
            </div>
            <button className="btn-ico" onClick={() => setSelectedAccount(null)}><Ico n="x" s={13}/></button>
          </div>
          {/* Context rail — the REACH differentiator */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
            {[
              { label: "ARR", value: `$${(selectedAccount.arr/1000).toFixed(0)}k`, color: T.success },
              { label: "Open Issues", value: selectedAccount.openIssues, color: selectedAccount.openIssues > 2 ? T.danger : T.warn },
              { label: "Health", value: selectedAccount.health, color: selectedAccount.health === "healthy" ? T.success : T.danger },
              { label: "Contacts", value: selectedAccount.contacts, color: T.text },
            ].map(s => (
              <div key={s.label} style={{ background: T.surface2, borderRadius: 8, padding: "10px 14px", border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: T.textSub, marginBottom: 10 }}>
            <strong style={{ color: T.accentWarm }}>Context rail:</strong> Open issues, PR lag, and ARR in the same view. Sales and engineering see the same account health.
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-g btn-sm" onClick={() => setShowNewContact(true)}><Ico n="plus" s={11}/> Add Contact</button>
            <button className="btn btn-g btn-sm" onClick={() => setShowNewDeal(true)}><Ico n="plus" s={11}/> Add Deal</button>
            <button className="btn btn-p btn-sm">Open in Issues</button>
          </div>
        </div>
      )}

      {/* Pipeline */}
      {view === "pipeline" && (
        <div style={{ flex: 1, overflowX: "auto", display: "flex" }}>
          {stages.map(stage => (
            <div key={stage} style={{ width: 210, flexShrink: 0, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column" }}
              onDragOver={e => e.preventDefault()}
              onDrop={() => {
                if (!dragging) return;
                const [fromStage, dealId] = dragging.split("|");
                const deal = (deals[fromStage]||[]).find(d => d.id===dealId);
                if (!deal) return;
                setDeals(p => ({ ...p, [fromStage]: (p[fromStage]||[]).filter(d=>d.id!==dealId), [stage]: [...(p[stage]||[]), deal] }));
                setDragging(null);
              }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.border}`, background: T.surface, flexShrink: 0 }}>
                <div className="flex items-c gap-6 mb-2">
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: stageColors[stage] }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{stage}</span>
                  <span style={{ fontSize: 9, background: T.surface3, color: T.textMuted, padding: "1px 5px", borderRadius: 8 }}>{(deals[stage]||[]).length}</span>
                </div>
                <div style={{ fontSize: 11, color: T.textMuted }}>${((deals[stage]||[]).reduce((s,d)=>s+d.value,0)/1000).toFixed(0)}k</div>
              </div>
              <div style={{ flex: 1, padding: 8, overflowY: "auto" }}>
                {(deals[stage]||[]).map(deal => (
                  <div key={deal.id} className="deal" draggable onDragStart={() => setDragging(`${stage}|${deal.id}`)} onDragEnd={() => setDragging(null)}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>{deal.account}</div>
                    <div style={{ fontSize: 11, color: T.textSub, marginBottom: 8 }}>{deal.title}</div>
                    <div className="flex jc-sb" style={{ fontSize: 11 }}>
                      <span style={{ fontWeight: 800, color: T.success }}>${(deal.value/1000).toFixed(0)}k</span>
                      <span style={{ color: T.textMuted }}>{deal.prob}% · {deal.close}</span>
                    </div>
                    <ProgBar v={deal.prob} max={100} c={stageColors[stage]} h={3} />
                    {stage === "negotiation" && (
                      <button className="btn btn-p btn-xs mt-8 w-full" style={{ justifyContent: "center" }}
                        onClick={() => markWon(stage, deal.id)}>
                        Mark Won → creates project
                      </button>
                    )}
                    {stage === "won" && (
                      <div style={{ fontSize: 9, color: T.success, marginTop: 6, fontWeight: 700 }}>● Project created · Budget ${(deal.value/1000).toFixed(0)}k</div>
                    )}
                  </div>
                ))}
                <button className="btn btn-g btn-xs w-full mt-4" style={{ justifyContent: "center" }} onClick={() => { setNewDeal(p=>({...p,stage})); setShowNewDeal(true); }}>
                  <Ico n="plus" s={10}/> Add deal
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Accounts */}
      {view === "accounts" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table className="tbl">
            <thead><tr>
              <th>Account</th><th>Tier</th><th>ARR</th><th>Renewal</th><th>Open Issues</th><th>Health</th><th>Contacts</th><th></th>
            </tr></thead>
            <tbody>
              {CRM_ACCOUNTS.map(acc => (
                <tr key={acc.id} style={{ cursor: "pointer" }} onClick={() => setSelectedAccount(acc)}>
                  <td><span style={{ fontWeight: 700 }}>{acc.name}</span></td>
                  <td><span className="chip chip-dim">{acc.tier}</span></td>
                  <td><span style={{ fontWeight: 700, color: T.success }}>${(acc.arr/1000).toFixed(0)}k</span></td>
                  <td><span style={{ fontSize: 11, color: T.textMuted }}>{acc.renewal}</span></td>
                  <td>{acc.openIssues > 0 ? <span className={`chip ${acc.openIssues>2?"chip-red":"chip-ylw"}`}>{acc.openIssues} open</span> : <span className="chip chip-grn">Clean</span>}</td>
                  <td><span className={`chip ${acc.health==="healthy"?"chip-grn":"chip-red"}`}>{acc.health==="healthy"?"● Healthy":"⚠ At risk"}</span></td>
                  <td><span style={{ fontSize: 11, color: T.textMuted }}>{acc.contacts}</span></td>
                  <td><button className="btn btn-g btn-xs">Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Contacts */}
      {view === "contacts" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <table className="tbl">
            <thead><tr>
              <th>Name</th><th>Email</th><th>Role</th><th>Account</th><th>Champion</th><th>Last contact</th><th></th>
            </tr></thead>
            <tbody>
              {contacts.map(c => {
                const acc = CRM_ACCOUNTS.find(a => a.id === c.account);
                return (
                  <tr key={c.id} style={{ cursor: "pointer" }}>
                    <td><span style={{ fontWeight: 700 }}>{c.name}</span></td>
                    <td><span style={{ fontSize: 11, color: T.textMuted }}>{c.email}</span></td>
                    <td><span style={{ fontSize: 11 }}>{c.role}</span></td>
                    <td>{acc && <span className="chip chip-dim">{acc.name}</span>}</td>
                    <td>{c.is_champion && <span className="chip chip-teal">★ Champion</span>}</td>
                    <td><span style={{ fontSize: 10, color: T.textMuted }}>Mar 7, 2026</span></td>
                    <td><button className="btn btn-g btn-xs">View</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === "cap-table" && <CapTable T={T} inline />}
    </div>
  );
};

/* ══ TIME TRACKING ══════════════════════════════════════════ */
const Time = ({ T, setIssue }) => {
  const logs = [
    { issue: "RC-001", title: "Auth token refresh", h: 3.5, day: "Mon", color: T.accent },
    { issue: "RC-008", title: "CRDT offline queue", h: 6.0, day: "Tue", color: T.accentPurple },
    { issue: "RC-003", title: "Time trigger opt.",  h: 2.0, day: "Wed", color: T.success },
    { issue: "RC-007", title: "Video recording",   h: 4.0, day: "Thu", color: T.warn },
    { issue: "RC-001", title: "Auth token refresh", h: 2.5, day: "Fri", color: T.accent },
  ];
  const total = logs.reduce((s, l) => s + l.h, 0);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div style={{ padding: 28 }} className="fade-in">
      <div className="flex items-c jc-sb mb-20">
        <div>
          <div className="brg fw-7" style={{ fontSize: 20 }}>Time Tracking</div>
          <div style={{ fontSize: 11, color: T.textSub, marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <Ico n="zap" s={11} c={T.success} />
            Automatic — Postgres trigger starts/stops timers on status change
          </div>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-g btn-sm"><Ico n="chevL" s={12}/></button>
          <span style={{ fontSize: 11, color: T.textSub, alignSelf: "center" }}>Week of Mar 3</span>
          <button className="btn btn-g btn-sm"><Ico n="chevR" s={12}/></button>
          <button className="btn btn-p btn-sm"><Ico n="plus" s={12}/> Log manual</button>
        </div>
      </div>

      {/* Active timer */}
      <div className="card mb-16" style={{ border: `1px solid ${T.accent}33`, background: T.glow }}>
        <div className="flex items-c gap-14">
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: T.danger, animation: "pulse 1.5s infinite", flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>RC-001 — Auth token refresh race condition</div>
            <div style={{ fontSize: 10, color: T.textMuted, marginTop: 2 }}>Started 10:02 AM · Sprint 12 · auto-triggered by status change</div>
          </div>
          <div className="brg fw-8" style={{ fontSize: 24, color: T.accent, fontFamily: "'DM Mono', monospace" }}>2:14:07</div>
          <button className="btn btn-d btn-sm">Stop</button>
        </div>
      </div>

      <div className="g2 mb-16">
        {/* Weekly grid */}
        <div className="card">
          <div className="flex items-c jc-sb mb-14">
            <div className="brg fw-6" style={{ fontSize: 13 }}>This week</div>
            <span className="brg fw-7" style={{ fontSize: 18, color: T.accent }}>{total}h</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {days.map(day => {
              const dayLogs = logs.filter(l => l.day === day);
              const dayH = dayLogs.reduce((s, l) => s + l.h, 0);
              return (
                <div key={day} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 4, fontWeight: 700 }}>{day}</div>
                  <div style={{ height: 72, background: T.surface2, borderRadius: 5, border: `1px solid ${T.border}`, position: "relative", overflow: "hidden" }}>
                    {dayLogs.map((log, i) => (
                      <div key={i} style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: `${(log.h / 8) * 100}%`, background: log.color + "60", borderTop: `2px solid ${log.color}` }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, marginTop: 4, color: dayH > 0 ? T.text : T.textMuted }}>{dayH > 0 ? `${dayH}h` : "—"}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Time by project donut */}
        <div className="card">
          <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 14 }}>By issue</div>
          <div className="flex gap-16 items-c">
            <Donut segs={logs.map(l => ({ v: l.h, c: l.color }))} sz={80} inner={22} />
            <div style={{ flex: 1 }}>
              {logs.map(l => (
                <div key={l.issue + l.day} className="flex items-c gap-8 mb-6" style={{ cursor: "pointer" }}
                  onClick={() => setIssue(ISSUES.find(i => i.id === l.issue))}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: T.accent, fontWeight: 600, width: 52 }}>{l.issue}</span>
                  <span style={{ fontSize: 10, color: T.textSub, flex: 1 }} className="trunc">{l.title}</span>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{l.h}h</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}` }}>
          <div className="brg fw-6" style={{ fontSize: 13 }}>Time entries</div>
        </div>
        <table className="tbl">
          <thead><tr><th>Issue</th><th>Day</th><th>Hours</th><th>Project</th><th></th></tr></thead>
          <tbody>
            {logs.map((l, i) => (
              <tr key={i} style={{ cursor: "pointer" }} onClick={() => setIssue(ISSUES.find(is => is.id === l.issue))}>
                <td>
                  <div className="flex items-c gap-8">
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: l.color }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 10, color: T.accent }}>{l.issue}</div>
                      <div style={{ fontSize: 10, color: T.textMuted }}>{l.title}</div>
                    </div>
                  </div>
                </td>
                <td><span style={{ fontSize: 11 }}>{l.day}</span></td>
                <td><span style={{ fontWeight: 800, color: T.accent }}>{l.h}h</span></td>
                <td><span className="chip chip-dim">RC</span></td>
                <td><button className="btn-ico btn-sm"><Ico n="edit" s={11}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ══ CAP TABLE ══════════════════════════════════════════════ */
const CapTable = ({ T, inline = false }) => {
  const [view, setView] = useState("dashboard");
  const total = CAP.reduce((s, h) => s + h.shares, 0);
  const colors = [T.accent, T.accentPurple, T.warn, T.success, T.danger];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", ...(inline ? {} : {}) }} className={inline ? "" : "fade-in"}>
      {!inline && (
      <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, background: T.surface, display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
        <div className="brg fw-6" style={{ fontSize: 14 }}>Cap Table</div>
        <span style={{ fontSize: 11, color: T.textMuted }}>Acme Corp · C-Corp · Delaware</span>
        <div style={{ background: T.glowWarm, border: `1px solid ${T.accentWarm}30`, borderRadius: 6, padding: "4px 10px", display: "flex", alignItems: "center", gap: 6 }}>
          <Ico n="zap" s={11} c={T.accentWarm} />
          <span style={{ fontSize: 10, color: T.accentWarm, fontWeight: 600 }}>Replaces Carta for REACH workspaces</span>
        </div>
        <div style={{ flex: 1 }} />
        {["dashboard", "stakeholders", "transactions", "simulate"].map(v => (
          <button key={v} className={`btn btn-sm ${view === v ? "btn-p" : "btn-g"}`} onClick={() => setView(v)}>
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
        <button className="btn btn-g btn-sm"><Ico n="external" s={12}/> Investor portal</button>
      </div>
      )}
      {inline && (
        <div style={{ padding: "10px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 8, alignItems: "center", background: T.surface, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: T.textSub }}>Cap Table · Acme Corp · Delaware C-Corp</span>
          <div style={{ flex: 1 }} />
          {["dashboard", "stakeholders", "transactions", "simulate"].map(v => (
            <button key={v} className={`btn btn-sm ${view === v ? "btn-p" : "btn-g"}`} onClick={() => setView(v)}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
          <button className="btn btn-g btn-sm"><Ico n="external" s={12}/> Investor portal</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: 28 }}>
        {view === "dashboard" && (
          <>
            <div className="g4 mb-16">
              <StatCard label="Authorized" value="10M" sub="Total shares" color={T.accent} icon="layers" />
              <StatCard label="Issued" value="8.15M" sub="81.5% of authorized" color={T.text} icon="pie" />
              <StatCard label="409A value" value="$2.40" sub="Per common share" color={T.success} icon="dollar" />
              <StatCard label="Option pool" value="15%" sub="1.5M shares" color={T.warn} icon="pct" />
            </div>
            <div className="g2">
              <div className="card">
                <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 16 }}>Ownership</div>
                <div className="flex gap-20 items-c">
                  <Donut segs={CAP.map((h, i) => ({ v: h.shares, c: colors[i % colors.length] }))} sz={96} inner={28} />
                  <div style={{ flex: 1 }}>
                    {CAP.map((h, i) => (
                      <div key={h.name} className="flex items-c gap-8 mb-8">
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: colors[i % colors.length] }} />
                        <span style={{ flex: 1, fontSize: 11 }}>{h.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700 }}>{h.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 12 }}>Share classes</div>
                {[
                  { n: "Common", v: 4500000, c: T.accent },
                  { n: "Series A", v: 3000000, c: T.accentPurple },
                  { n: "ISO Options", v: 1500000, c: T.success },
                  { n: "Unissued", v: 1000000, c: T.surface4 },
                ].map(cls => (
                  <div key={cls.n} style={{ marginBottom: 10 }}>
                    <div className="flex jc-sb mb-3" style={{ fontSize: 11 }}>
                      <span style={{ fontWeight: 600 }}>{cls.n}</span>
                      <span style={{ color: T.textMuted }}>{(cls.v / 1e6).toFixed(1)}M</span>
                    </div>
                    <ProgBar v={cls.v} max={10000000} c={cls.c} h={5} />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {view === "stakeholders" && (
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
              <div className="brg fw-6" style={{ fontSize: 13 }}>All stakeholders</div>
              <button className="btn btn-p btn-sm"><Ico n="plus" s={12}/> Add</button>
            </div>
            <table className="tbl">
              <thead><tr><th>Name</th><th>Type</th><th>Shares</th><th>Class</th><th>Ownership</th><th>Vesting</th><th></th></tr></thead>
              <tbody>
                {CAP.map((h, i) => (
                  <tr key={h.name}>
                    <td><span style={{ fontWeight: 700 }}>{h.name}</span></td>
                    <td><span className="chip chip-dim">{h.type}</span></td>
                    <td><span style={{ fontWeight: 700 }}>{(h.shares / 1e6).toFixed(2)}M</span></td>
                    <td><span style={{ fontSize: 11, color: T.textSub }}>{h.cls}</span></td>
                    <td>
                      <div className="flex gap-8 items-c">
                        <ProgBar v={h.pct} max={100} c={colors[i % colors.length]} h={4} />
                        <span style={{ fontSize: 11, width: 36 }}>{h.pct}%</span>
                      </div>
                    </td>
                    <td><span style={{ fontSize: 11, color: T.textMuted }}>{h.vesting || "—"}</span></td>
                    <td><button className="btn btn-g btn-xs"><Ico n="external" s={10}/> Portal</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === "transactions" && (
          <div className="card" style={{ padding: 0 }}>
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
              <div className="brg fw-6" style={{ fontSize: 13 }}>Transaction ledger</div>
              <button className="btn btn-p btn-sm"><Ico n="plus" s={12}/> Record</button>
            </div>
            <table className="tbl">
              <thead><tr><th>Date</th><th>Type</th><th>From</th><th>To</th><th>Shares</th><th>Price</th><th>Total</th></tr></thead>
              <tbody>
                {[
                  { date: "2024-01-15", type: "Issuance", from: "—", to: "Alex Chen", shares: "2,500,000", price: "$0.0001", total: "$250" },
                  { date: "2024-01-15", type: "Issuance", from: "—", to: "Jordan Dale", shares: "2,000,000", price: "$0.0001", total: "$200" },
                  { date: "2025-03-01", type: "Issuance", from: "—", to: "Apex Ventures", shares: "3,000,000", price: "$3.20", total: "$9.6M" },
                  { date: "2025-06-01", type: "Grant", from: "Option Pool", to: "Sam Kim", shares: "150,000", price: "$2.40", total: "—" },
                ].map((tx, i) => (
                  <tr key={i}>
                    <td><span style={{ fontSize: 11 }}>{tx.date}</span></td>
                    <td><span className="chip chip-teal">{tx.type}</span></td>
                    <td><span style={{ fontSize: 11, color: T.textMuted }}>{tx.from}</span></td>
                    <td><span style={{ fontWeight: 600 }}>{tx.to}</span></td>
                    <td><span style={{ fontWeight: 700 }}>{tx.shares}</span></td>
                    <td><span style={{ color: T.textMuted }}>{tx.price}</span></td>
                    <td><span style={{ fontWeight: 700, color: T.success }}>{tx.total}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === "simulate" && (
          <div>
            <div className="card mb-16">
              <div className="brg fw-6" style={{ fontSize: 14, marginBottom: 16 }}>Round simulation</div>
              <div className="g3">
                <div><label className="lbl">Pre-money valuation</label><input className="inp" defaultValue="$15,000,000" /></div>
                <div><label className="lbl">Round size</label><input className="inp" defaultValue="$3,000,000" /></div>
                <div><label className="lbl">New option pool</label><input className="inp" defaultValue="10%" /></div>
              </div>
              <button className="btn btn-p mt-16">Run simulation →</button>
            </div>
            <div className="card">
              <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 12 }}>Post-money dilution preview</div>
              <div className="flex gap-4 mb-12">
                {[
                  { l: "Founders 38%", c: T.accent },
                  { l: "Investors 46%", c: T.accentPurple },
                  { l: "New pool 16%", c: T.warn },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, height: 28, background: s.c + "20", border: `1px solid ${s.c}40`, borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: s.c, fontWeight: 700 }}>{s.l}</div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: T.textSub, lineHeight: 1.7 }}>
                Anti-dilution protection, liquidation preferences, and conversion ratios computed automatically when you add real round terms. Connect to your CRM to link investor contacts.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ══ PULL REQUESTS ══════════════════════════════════════════ */
const PRs = ({ T, setIssue }) => {
  const prs = [
    { num: "#42", title: "fix: auth token refresh race condition", branch: "fix/auth-refresh", status: "open",   ci: "passing", issue: "RC-001", author: "u1", reviewers: ["u2"], age: "2d" },
    { num: "#41", title: "perf: time tracker trigger optimization", branch: "perf/time-trigger", status: "review",  ci: "passing", issue: "RC-003", author: "u1", reviewers: ["u2","u3"], age: "3d" },
    { num: "#40", title: "feat: offline CRDT implementation",      branch: "feat/offline-crdt", status: "open",   ci: "failing", issue: "RC-008", author: "u2", reviewers: ["u1"], age: "4d" },
    { num: "#39", title: "feat: Monaco editor integration",         branch: "feat/monaco",       status: "merged", ci: "passing", issue: "RC-005", author: "u2", reviewers: ["u1","u3"], age: "6d" },
  ];

  return (
    <div style={{ padding: 24 }} className="fade-in">
      <div className="flex items-c jc-sb mb-16">
        <div className="brg fw-7" style={{ fontSize: 20 }}>Pull Requests</div>
        <div className="flex gap-8">
          <button className="btn btn-g btn-sm"><Ico n="filter" s={12}/> Filter</button>
          <button className="btn btn-p btn-sm"><Ico n="git" s={12}/> New PR</button>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {prs.map(pr => (
          <div key={pr.num} style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 14, alignItems: "flex-start", cursor: "pointer", transition: ".1s" }}
            onMouseEnter={e => e.currentTarget.style.background = T.surface2}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            <Ico n="gitpr" s={16} c={pr.status === "merged" ? T.accentPurple : pr.status === "review" ? T.warn : T.success} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex gap-8 items-c mb-6">
                <span style={{ fontWeight: 700, fontSize: 13 }}>{pr.title}</span>
                <span className={`chip ${pr.status === "merged" ? "chip-prp" : pr.status === "review" ? "chip-ylw" : "chip-grn"}`}>{pr.status}</span>
                <span className={`chip ${pr.ci === "passing" ? "chip-grn" : "chip-red"}`}>CI: {pr.ci}</span>
              </div>
              <div className="flex gap-12" style={{ fontSize: 11, color: T.textMuted }}>
                <span>{pr.num}</span>
                <span className="flex items-c gap-4"><Ico n="git" s={10}/>{pr.branch}</span>
                <span style={{ color: T.accent, fontWeight: 600, cursor: "pointer" }} onClick={() => setIssue(ISSUES.find(i => i.id === pr.issue))}>{pr.issue}</span>
                <span>by {USERS[pr.author]?.name}</span>
                <span>{pr.age} ago</span>
              </div>
            </div>
            <div className="flex gap-4">
              {pr.reviewers.map(r => <Av key={r} uid={r} size="xs" />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ══ SETTINGS ═══════════════════════════════════════════════ */
const Settings = ({ T, theme, setTheme }) => {
  const isAdmin = true; // In real app: currentUser.role === 'admin'
  const [tab, setTab] = useState("workspace");
  const [mods, setMods] = useState({ ai: true, video: true, crm: true, time: true, cap: true, gifs: true, sla: false, byok: false });
  const [whoCanInvite, setWhoCanInvite] = useState("members");
  const [require2FA, setRequire2FA] = useState(false);
  const [samlEnabled, setSamlEnabled] = useState(false);

  // Member tabs (personal prefs only)
  const memberTabs = [
    { g: "Personal", items: ["profile", "preferences", "notifications", "security"] },
  ];
  // Admin tabs (member + workspace controls)
  const adminTabs = [
    { g: "Personal", items: ["profile", "preferences", "notifications", "security"] },
    { g: "Workspace", items: ["workspace", "members", "modules", "security-ws", "integrations", "billing", "audit"] },
  ];
  const settingsTabs = isAdmin ? adminTabs : memberTabs;

  return (
    <div style={{ display: "flex", height: "100%" }} className="fade-in">
      {/* Settings sidebar */}
      <div style={{ width: 200, borderRight: `1px solid ${T.border}`, padding: "14px 8px", background: T.surface, flexShrink: 0, overflowY: "auto" }}>
        {isAdmin && (
          <div style={{ background: T.glowWarm, border: `1px solid ${T.accentWarm}33`, borderRadius: 6, padding: "6px 10px", marginBottom: 12, fontSize: 10, color: T.accentWarm, fontWeight: 700 }}>
            ⚡ Admin mode
          </div>
        )}
        {settingsTabs.map(group => (
          <div key={group.g} className="nav-sect">
            <div className="nav-lbl">{group.g}</div>
            {group.items.map(s => (
              <div key={s} className={`nav-item${tab===s?" active":""}`} onClick={() => setTab(s)}
                style={{ textTransform: "capitalize", fontSize: 12 }}>
                {s === "security-ws" ? "Security" : s}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 36, maxWidth: 760 }}>

        {/* PROFILE */}
        {tab === "profile" && (
          <div>
            <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 24 }}>Profile</div>
            <div className="card mb-16">
              <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 16 }}>Identity</div>
              <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: T.accent + "22", border: `2px solid ${T.accent}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="brg fw-8" style={{ color: T.accent, fontSize: 20 }}>AC</span>
                </div>
                <button className="btn btn-g btn-sm">Upload photo</button>
              </div>
              <div className="g2" style={{ gap: 12, marginBottom: 14 }}>
                <div><label className="lbl">Display name</label><input className="inp" defaultValue="Alex Chen" /></div>
                <div><label className="lbl">Email</label><input className="inp" defaultValue="alex@acmecorp.io" /></div>
                <div><label className="lbl">Role / title</label><input className="inp" defaultValue="Lead Engineer" /></div>
                <div><label className="lbl">Timezone</label>
                  <select className="inp"><option>America/New_York</option><option>America/Los_Angeles</option><option>UTC</option></select>
                </div>
              </div>
              <button className="btn btn-p btn-sm">Save changes</button>
            </div>
          </div>
        )}

        {/* PREFERENCES (Member) */}
        {tab === "preferences" && (
          <div>
            <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 24 }}>Preferences</div>
            <div className="card mb-12">
              <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 14 }}>Appearance</div>
              <div className="setting-row">
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>Theme</div><div style={{ fontSize: 11, color: T.textSub }}>Dark or light — your call</div></div>
                <div className="flex gap-6">
                  {["dark","light"].map(m => (
                    <button key={m} className={`btn btn-sm ${theme===m?"btn-p":"btn-g"}`} onClick={() => setTheme(m)}>
                      <Ico n={m==="dark"?"moon":"sun"} s={12}/> {m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="setting-row">
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>Font size</div></div>
                <select className="inp" style={{ width: 120 }}><option>Default</option><option>Small</option><option>Large</option></select>
              </div>
            </div>
            <div className="card mb-12">
              <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 14 }}>Issue automations</div>
              {[
                { label: "Auto-assign to self on create", sub: "New issues auto-assigned to you", on: true },
                { label: "Move to In Progress on branch copy", sub: "Branch name copied → issue starts → timer auto-starts", on: true },
                { label: "Move to In Progress on open in IDE", sub: "Opening issue in IDE starts the timer", on: true },
              ].map(s => (
                <div key={s.label} className="setting-row">
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div><div style={{ fontSize: 11, color: T.textSub }}>{s.sub}</div></div>
                  <Tog on={s.on} set={() => {}} />
                </div>
              ))}
            </div>
            <div className="card">
              <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 14 }}>IDE behaviour</div>
              <div className="setting-row">
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>IDE layout</div></div>
                <select className="inp" style={{ width: 140 }}><option>2-pane</option><option>3-pane</option><option>Editor only</option></select>
              </div>
              <div className="setting-row">
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>Skill level</div><div style={{ fontSize: 11, color: T.textSub }}>Affects AI verbosity and tooltip depth</div></div>
                <select className="inp" style={{ width: 140 }}><option>Beginner</option><option selected>Intermediate</option><option>Expert</option></select>
              </div>
            </div>
          </div>
        )}

        {/* NOTIFICATIONS (Member) */}
        {tab === "notifications" && (
          <div>
            <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 24 }}>Notifications</div>
            <div className="card">
              {[
                { label: "Desktop", options: ["All", "Mentions only", "Off"] },
                { label: "Mobile", options: ["All", "Mentions only", "Off"] },
                { label: "Email digest", options: ["Daily", "Weekly", "Off"] },
              ].map(n => (
                <div key={n.label} className="setting-row">
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{n.label}</div>
                  <select className="inp" style={{ width: 140 }}>{n.options.map(o => <option key={o}>{o}</option>)}</select>
                </div>
              ))}
              {[
                { label: "Changelog updates", on: true },
                { label: "New team members", on: true },
                { label: "Deal stage changes (CRM)", on: true },
                { label: "Timer running > 8 hrs", on: true },
                { label: "Weekly time report", on: false },
              ].map(n => (
                <div key={n.label} className="setting-row">
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{n.label}</div>
                  <Tog on={n.on} set={() => {}} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECURITY (Member) */}
        {tab === "security" && (
          <div>
            <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 24 }}>Security</div>
            <div className="card mb-12">
              <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 14 }}>Password</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360 }}>
                <div><label className="lbl">Current password</label><input className="inp" type="password" /></div>
                <div><label className="lbl">New password</label><input className="inp" type="password" /></div>
                <div><label className="lbl">Confirm new password</label><input className="inp" type="password" /></div>
                <button className="btn btn-p btn-sm" style={{ width: "fit-content" }}>Update password</button>
              </div>
            </div>
            <div className="card">
              <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 14 }}>Two-factor authentication</div>
              <div className="setting-row">
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>Enable 2FA</div><div style={{ fontSize: 11, color: T.textSub }}>Authenticator app (TOTP)</div></div>
                <button className="btn btn-g btn-sm">Set up 2FA</button>
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACE (Admin only) */}
        {tab === "workspace" && isAdmin && (
          <div>
            <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 24 }}>Workspace</div>
            <div className="card mb-16">
              <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 16 }}>Identity</div>
              <div className="g2" style={{ gap: 12 }}>
                <div><label className="lbl">Workspace name</label><input className="inp" defaultValue="Acme Corp" /></div>
                <div><label className="lbl">Slug</label><input className="inp" defaultValue="acmecorp" /></div>
                <div><label className="lbl">Fiscal year start</label>
                  <select className="inp"><option>January</option><option>April</option><option>July</option><option>October</option></select>
                </div>
                <div><label className="lbl">Default timezone</label>
                  <select className="inp"><option>America/New_York</option><option>UTC</option></select>
                </div>
              </div>
              <div style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: T.glow, border: `1px solid ${T.accent}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span className="brg fw-8" style={{ color: T.accent, fontSize: 18 }}>A</span>
                </div>
                <button className="btn btn-g btn-sm">Upload logo</button>
              </div>
              <button className="btn btn-p btn-sm mt-16">Save changes</button>
            </div>
            <div className="card">
              <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 14 }}>Access & invitations</div>
              <div className="setting-row">
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>Who can invite members</div><div style={{ fontSize: 11, color: T.textSub }}>Controls invite button visibility for non-admins</div></div>
                <select className="inp" style={{ width: 130 }} value={whoCanInvite} onChange={e => setWhoCanInvite(e.target.value)}>
                  <option value="members">Members</option><option value="admins">Admins only</option>
                </select>
              </div>
              <div className="setting-row">
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>Invite links</div><div style={{ fontSize: 11, color: T.textSub }}>Allow shared invite links</div></div>
                <Tog on={true} set={() => {}} />
              </div>
              <div className="setting-row">
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>Allowed email domains</div><div style={{ fontSize: 11, color: T.textSub }}>Only these domains can join</div></div>
                <input className="inp" style={{ width: 200 }} placeholder="acmecorp.io, example.com" />
              </div>
            </div>
          </div>
        )}

        {/* MEMBERS (Admin only) */}
        {tab === "members" && isAdmin && (
          <div>
            <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 24 }}>Members</div>
            <div className="flex gap-8 mb-16">
              <input className="inp flex-1" placeholder="Invite by work email…" />
              <select className="inp" style={{ width: 110 }}><option>Member</option><option>Admin</option><option>Guest</option></select>
              <button className="btn btn-p">Invite</button>
            </div>
            <div className="card" style={{ padding: 0 }}>
              {Object.values(USERS).map(u => (
                <div key={u.id} className="flex gap-12 items-c" style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
                  <Av uid={u.id} size="sm" showStatus />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{u.name}</div>
                    <div style={{ fontSize: 10, color: T.textMuted }}>admin@acmecorp.io</div>
                  </div>
                  <span className={`chip ${u.role==="admin"?"chip-teal":u.role==="guest"?"chip-ylw":"chip-dim"}`}>{u.role}</span>
                  <select className="inp" style={{ width: 90, height: 26, fontSize: 10 }} defaultValue={u.role}>
                    <option>admin</option><option>member</option><option>guest</option>
                  </select>
                  {u.id !== "u1" && <button className="btn btn-d btn-xs"><Ico n="trash" s={11}/></button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODULES (Admin only) */}
        {tab === "modules" && isAdmin && (
          <div>
            <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 8 }}>Module toggles</div>
            <div style={{ fontSize: 11, color: T.textSub, marginBottom: 24 }}>Disabling a module removes it from all nav and renders for all members.</div>
            <div className="card">
              {[
                { k: "ai",    l: "AI features",     d: "IDE assist, @AI mentions, agents. Master toggle — disables all AI surfaces." },
                { k: "video", l: "Video standups",   d: "Daily.co rooms. Requires DAILY_API_KEY." },
                { k: "crm",   l: "CRM",              d: "Accounts, contacts, deal pipeline. Won deals auto-create projects." },
                { k: "time",  l: "Time tracking",    d: "Automatic (Postgres trigger) + manual logging." },
                { k: "cap",   l: "Cap table",        d: "Equity management. Stakeholders, grants, vesting, simulations." },
                { k: "gifs",  l: "GIFs in chat",     d: "GIF reactions. Admin-controlled workspace-wide." },
                { k: "sla",   l: "SLAs",             d: "Deadline automation rules on issues." },
                { k: "byok",  l: "BYOK marketing",   d: "Email campaigns via your own SendGrid/SES key." },
              ].map(({ k, l, d }) => (
                <div key={k} className="setting-row">
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 11, color: T.textSub }}>{d}</div>
                  </div>
                  <Tog on={mods[k]} set={v => setMods(p => ({ ...p, [k]: v }))} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECURITY-WS (Admin only) */}
        {tab === "security-ws" && isAdmin && (
          <div>
            <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 24 }}>Security</div>
            <div className="card mb-12">
              <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 14 }}>Authentication</div>
              <div className="setting-row">
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>Require 2FA for all members</div><div style={{ fontSize: 11, color: T.textSub }}>Members without 2FA are blocked at login</div></div>
                <Tog on={require2FA} set={setRequire2FA} />
              </div>
              <div className="setting-row">
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>Google SSO</div><div style={{ fontSize: 11, color: T.textSub }}>Allow sign-in with Google</div></div>
                <Tog on={true} set={() => {}} />
              </div>
              <div className="setting-row">
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>SAML / Okta (Enterprise)</div><div style={{ fontSize: 11, color: T.textSub }}>Enterprise SSO. Add metadata URL.</div></div>
                <div className="flex gap-8 items-c">
                  <Tog on={samlEnabled} set={setSamlEnabled} />
                  {samlEnabled && <input className="inp" style={{ width: 220 }} placeholder="https://okta.com/metadata.xml" />}
                </div>
              </div>
              <div className="setting-row">
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>Session duration</div></div>
                <select className="inp" style={{ width: 130 }}><option>7 days</option><option>30 days</option><option>90 days</option></select>
              </div>
            </div>
            <div className="card">
              <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 14 }}>Data retention</div>
              {[
                { label: "Message retention", defaultVal: "Forever" },
                { label: "File retention",    defaultVal: "Forever" },
                { label: "Doc retention",     defaultVal: "Forever" },
              ].map(r => (
                <div key={r.label} className="setting-row">
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.label}</div>
                  <select className="inp" style={{ width: 130 }}><option>Forever</option><option>90 days</option><option>30 days</option></select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* INTEGRATIONS (Admin only) */}
        {tab === "integrations" && isAdmin && (
          <div>
            <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 24 }}>Integrations</div>
            {[
              { n: "GitHub",              icon: "git",    d: "Repo connection for IDE, PRs, branch awareness.",    connected: true  },
              { n: "Claude / OpenRouter", icon: "zap",    d: "AI chat in IDE. Seeded with PRD + active issue.",    connected: true  },
              { n: "Daily.co",            icon: "video",  d: "Video standup rooms. Requires Daily API key.",       connected: false },
              { n: "Google SSO",          icon: "globe",  d: "One-click sign-in for all workspace members.",       connected: false },
              { n: "SAML / Okta",        icon: "shield", d: "Enterprise SSO. Business+ plan.",                   connected: false },
              { n: "SendGrid",            icon: "send",   d: "BYOK email campaigns. Provide your own API key.",   connected: false },
              { n: "Slack (webhook)",    icon: "chat",   d: "Post issue events and standup summaries to Slack.",  connected: false },
            ].map(int => (
              <div key={int.n} className="card mb-8">
                <div className="flex gap-14 items-c">
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: int.connected ? T.glow : T.surface2, border: `1px solid ${int.connected ? T.accent+"33" : T.border}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Ico n={int.icon} s={16} c={int.connected ? T.accent : T.textMuted} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{int.n}</div>
                    <div style={{ fontSize: 11, color: T.textSub }}>{int.d}</div>
                  </div>
                  {int.connected ? <span className="chip chip-grn">Connected</span> : <button className="btn btn-g btn-sm">Connect</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AUDIT (Admin only) */}
        {tab === "audit" && isAdmin && (
          <div>
            <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 24 }}>Audit Log</div>
            <div className="card" style={{ padding: 0 }}>
              {[
                { action: "settings.update", actor: "Alex Chen", detail: "gifs_enabled: true → false", time: "Mar 9, 10:14 AM" },
                { action: "member.invite",   actor: "Alex Chen", detail: "Invited dev@acmecorp.io as Member", time: "Mar 9, 9:02 AM" },
                { action: "module.toggle",   actor: "Alex Chen", detail: "cap_table enabled", time: "Mar 8, 3:44 PM" },
                { action: "member.role",     actor: "Alex Chen", detail: "Sam Park → admin", time: "Mar 7, 2:12 PM" },
                { action: "settings.update", actor: "Alex Chen", detail: "who_can_invite: members → admins", time: "Mar 6, 11:30 AM" },
              ].map((e, i) => (
                <div key={i} className="flex gap-12 items-c" style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 9, background: T.surface3, color: T.textMuted, padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{e.action}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12 }}>{e.detail}</div>
                    <div style={{ fontSize: 10, color: T.textMuted }}>{e.actor}</div>
                  </div>
                  <div style={{ fontSize: 10, color: T.textMuted, flexShrink: 0 }}>{e.time}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "billing" && isAdmin && (
          <div>
            <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 24 }}>Billing</div>
            <div className="card mb-12">
              <div className="flex items-c jc-sb">
                <div>
                  <div className="brg fw-6" style={{ fontSize: 14 }}>Pro plan</div>
                  <div style={{ fontSize: 11, color: T.textSub }}>5 seats · $49/mo · Renews Apr 1, 2026</div>
                </div>
                <button className="btn btn-p btn-sm">Upgrade to Business</button>
              </div>
            </div>
            <div className="card">
              <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 14 }}>Seat usage</div>
              <ProgBar v={4} max={5} c={T.accent} h={6} />
              <div style={{ fontSize: 11, color: T.textSub, marginTop: 8 }}>4 of 5 seats used · <button className="btn btn-g btn-xs" style={{ display: "inline" }}>Add seat</button></div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

const AdminPanel = ({ T }) => {
  const [tab, setTab] = useState("tenants");
  const [featureFlags, setFeatureFlags] = useState([
    { name: "ai_agents",      desc: "AI agents as teammates",              enabled: false, rollout: 0,   status: "inactive" },
    { name: "video_standups", desc: "Daily.co video standup rooms",        enabled: true,  rollout: 100, status: "stable"   },
    { name: "hipaa_mode",     desc: "HIPAA compliance controls",           enabled: true,  rollout: 5,   status: "stable"   },
    { name: "byok_marketing", desc: "Bring-your-own-key email sends",      enabled: true,  rollout: 25,  status: "canary"   },
    { name: "local_files",    desc: "File System Access API for IDE",      enabled: true,  rollout: 50,  status: "canary"   },
  ]);
  const [impersonating, setImpersonating] = useState(null);

  const mockTenants = [
    { id: "t1", name: "Acme Corp",       plan: "Pro",        users: 5,  status: "healthy",   created: "Jan 2026" },
    { id: "t2", name: "Northstar Labs",  plan: "Business",   users: 12, status: "healthy",   created: "Dec 2025" },
    { id: "t3", name: "Orbit Protocol",  plan: "Starter",    users: 2,  status: "at-risk",   created: "Feb 2026" },
    { id: "t4", name: "Cascade Systems", plan: "Enterprise", users: 44, status: "healthy",   created: "Oct 2025" },
  ];

  return (
    <div style={{ display: "flex", height: "100%" }} className="fade-in">
      {/* God mode sidebar */}
      <div style={{ width: 200, borderRight: `1px solid ${T.border}`, padding: "14px 8px", background: T.surface, flexShrink: 0 }}>
        <div style={{ background: "#DC262620", border: "1px solid #DC262640", borderRadius: 6, padding: "6px 10px", marginBottom: 14, fontSize: 10, color: "#F87171", fontWeight: 800 }}>
          ⚡ GOD MODE — /admin
        </div>
        {[
          { id: "tenants",  label: "All Tenants" },
          { id: "health",   label: "System Health" },
          { id: "flags",    label: "Feature Flags" },
          { id: "config",   label: "Platform Config" },
          { id: "audit-pl", label: "Audit Log (All)" },
        ].map(s => (
          <div key={s.id} className={`nav-item${tab===s.id?" active":""}`} onClick={() => setTab(s.id)} style={{ fontSize: 12 }}>{s.label}</div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 36, maxWidth: 900 }}>
        {impersonating && (
          <div style={{ background: "#DC262620", border: "1px solid #DC2626", borderRadius: 8, padding: "10px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <Ico n="shield" s={14} c="#F87171" />
            <span style={{ fontSize: 12, color: "#F87171", fontWeight: 600 }}>Impersonating: {impersonating}</span>
            <button className="btn btn-d btn-xs" onClick={() => setImpersonating(null)}>Exit impersonation</button>
          </div>
        )}

        {tab === "tenants" && (
          <div>
            <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 8 }}>All Tenants</div>
            <div style={{ fontSize: 11, color: T.textSub, marginBottom: 20 }}>Cross-tenant view. All queries use SERVICE_ROLE_KEY. RLS bypassed.</div>
            <div className="card" style={{ padding: 0 }}>
              <table className="tbl">
                <thead><tr><th>Tenant</th><th>Plan</th><th>Users</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
                <tbody>
                  {mockTenants.map(t => (
                    <tr key={t.id}>
                      <td><span style={{ fontWeight: 700 }}>{t.name}</span></td>
                      <td><span className="chip chip-dim">{t.plan}</span></td>
                      <td><span style={{ fontSize: 11 }}>{t.users}</span></td>
                      <td><span className={`chip ${t.status==="healthy"?"chip-grn":"chip-red"}`}>{t.status}</span></td>
                      <td><span style={{ fontSize: 11, color: T.textMuted }}>{t.created}</span></td>
                      <td>
                        <div className="flex gap-6">
                          <button className="btn btn-g btn-xs" onClick={() => setImpersonating(t.name)}>Impersonate</button>
                          <button className="btn btn-d btn-xs">Suspend</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "health" && (
          <div>
            <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 24 }}>System Health</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Total tenants", value: "4",       color: T.text },
                { label: "Active users (24h)", value: "23", color: T.success },
                { label: "DB connections", value: "12/100", color: T.success },
                { label: "Edge fn latency", value: "84ms",  color: T.success },
                { label: "Realtime subs",  value: "47",     color: T.text },
                { label: "Error rate",     value: "0.02%",  color: T.success },
              ].map(s => (
                <div key={s.label} style={{ background: T.surface2, borderRadius: 8, padding: "14px 16px", border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 6 }}>{s.label}</div>
                  <div className="brg fw-7" style={{ fontSize: 20, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            <div className="card">
              <div className="brg fw-6" style={{ fontSize: 13, marginBottom: 12 }}>Supabase services</div>
              {[
                { name: "Postgres", status: "operational" },
                { name: "Auth", status: "operational" },
                { name: "Realtime", status: "operational" },
                { name: "Edge Functions", status: "operational" },
                { name: "Storage", status: "operational" },
              ].map(s => (
                <div key={s.name} className="flex items-c jc-sb mb-8">
                  <span style={{ fontSize: 12 }}>{s.name}</span>
                  <span className="chip chip-grn">● {s.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "flags" && (
          <div>
            <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 8 }}>Feature Flags</div>
            <div style={{ fontSize: 11, color: T.textSub, marginBottom: 20 }}>Controls which features are available across all tenants. Rollout % = percentage of tenants that see the feature.</div>
            <div className="card">
              {featureFlags.map((f, i) => (
                <div key={f.name} className="setting-row" style={{ alignItems: "flex-start", flexDirection: "column", gap: 10 }}>
                  <div className="flex items-c jc-sb w-full">
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace" }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: T.textSub }}>{f.desc}</div>
                    </div>
                    <div className="flex gap-8 items-c">
                      <span className={`chip ${f.status==="stable"?"chip-grn":f.status==="canary"?"chip-ylw":"chip-dim"}`}>{f.status}</span>
                      <Tog on={f.enabled} set={v => setFeatureFlags(prev => prev.map((fl,j) => j===i ? {...fl,enabled:v} : fl))} />
                    </div>
                  </div>
                  <div className="flex items-c gap-10 w-full">
                    <span style={{ fontSize: 10, color: T.textMuted }}>Rollout:</span>
                    <input type="range" min="0" max="100" value={f.rollout}
                      onChange={e => setFeatureFlags(prev => prev.map((fl,j) => j===i ? {...fl,rollout:Number(e.target.value)} : fl))}
                      style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, minWidth: 32 }}>{f.rollout}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "config" && (
          <div>
            <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 24 }}>Platform Config</div>
            <div className="card">
              {[
                { label: "Default plan for new tenants", type: "select", options: ["free","starter","pro"], val: "free" },
                { label: "Trial period (days)", type: "number", val: "30" },
                { label: "Max tenants per email", type: "number", val: "3" },
                { label: "File upload limit (MB)", type: "number", val: "100" },
                { label: "Rate limit per minute", type: "number", val: "1000" },
                { label: "Session timeout (days)", type: "number", val: "7" },
                { label: "CDN provider", type: "select", options: ["cloudflare","fastly","akamai"], val: "cloudflare" },
                { label: "Email provider", type: "select", options: ["sendgrid","ses","postmark"], val: "sendgrid" },
              ].map(c => (
                <div key={c.label} className="setting-row">
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</div>
                  {c.type === "select"
                    ? <select className="inp" style={{ width: 150 }} defaultValue={c.val}>{c.options.map(o => <option key={o}>{o}</option>)}</select>
                    : <input className="inp" type="number" defaultValue={c.val} style={{ width: 100 }} />
                  }
                </div>
              ))}
              <button className="btn btn-p btn-sm mt-16">Save platform config</button>
            </div>
          </div>
        )}

        {tab === "audit-pl" && (
          <div>
            <div className="brg fw-7" style={{ fontSize: 20, marginBottom: 8 }}>Global Audit Log</div>
            <div style={{ fontSize: 11, color: T.textSub, marginBottom: 20 }}>All admin actions across all tenants. Impersonation sessions are logged here.</div>
            <div className="card" style={{ padding: 0 }}>
              {[
                { action: "impersonate.start", tenant: "Acme Corp",  actor: "platform_owner", detail: "Started impersonation session", time: "Mar 9, 11:20 AM" },
                { action: "flag.update",        tenant: "all",        actor: "platform_owner", detail: "video_standups rollout_pct: 50 → 100", time: "Mar 8, 4:15 PM" },
                { action: "tenant.suspend",     tenant: "TestCorp",   actor: "platform_owner", detail: "Tenant suspended — ToS violation", time: "Mar 7, 9:00 AM" },
                { action: "config.update",      tenant: "global",     actor: "platform_owner", detail: "trial_period_days: 14 → 30", time: "Mar 6, 2:30 PM" },
                { action: "tenant.create",      tenant: "Orbit Protocol", actor: "self-serve", detail: "New tenant registered", time: "Feb 28, 8:44 AM" },
              ].map((e, i) => (
                <div key={i} className="flex gap-12 items-c" style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: 9, background: T.surface3, color: T.textMuted, padding: "2px 6px", borderRadius: 4, fontWeight: 700, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{e.action}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12 }}>{e.detail}</div>
                    <div style={{ fontSize: 10, color: T.textMuted }}>{e.tenant} · {e.actor}</div>
                  </div>
                  <div style={{ fontSize: 10, color: T.textMuted, flexShrink: 0 }}>{e.time}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SearchModal = ({ T, onClose, setIssue }) => {
  const [q, setQ] = useState("");
  const results = q.length > 1
    ? ISSUES.filter(i => i.title.toLowerCase().includes(q.toLowerCase()) || i.id.toLowerCase().includes(q.toLowerCase()))
    : ISSUES.slice(0, 5);

  return (
    <div className="modal-ov" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div style={{ display: "flex", gap: 10, padding: 16, borderBottom: `1px solid ${T.border}`, alignItems: "center" }}>
          <Ico n="search" s={16} c={T.textMuted} />
          <input autoFocus className="inp flex-1" style={{ border: "none", background: "none", fontSize: 14, padding: 0, height: "auto" }}
            placeholder="Search issues, docs, people…" value={q} onChange={e => setQ(e.target.value)} />
          <kbd style={{ fontSize: 10, background: T.surface3, color: T.textMuted, padding: "2px 6px", borderRadius: 4 }}>ESC</kbd>
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          <div style={{ padding: "8px 16px 4px", fontSize: 9, color: T.textMuted, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.14em" }}>Issues</div>
          {results.map(issue => (
            <div key={issue.id} style={{ display: "flex", gap: 10, padding: "10px 16px", cursor: "pointer", alignItems: "center", transition: ".1s" }}
              onMouseEnter={e => e.currentTarget.style.background = T.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              onClick={() => { setIssue(issue); onClose(); }}>
              <Prio p={issue.priority} />
              <span style={{ fontSize: 10, color: T.textMuted, width: 58, flexShrink: 0, fontWeight: 700 }}>{issue.id}</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{issue.title}</span>
              <StatusChip s={issue.status} />
              {issue.crmContext && <Ico n="brief" s={11} c={T.accentWarm} />}
            </div>
          ))}
        </div>
        <div style={{ padding: "8px 16px", borderTop: `1px solid ${T.border}`, display: "flex", gap: 20, fontSize: 10, color: T.textMuted }}>
          <span>↑↓ Navigate</span><span>↵ Open</span><span>ESC Close</span>
        </div>
      </div>
    </div>
  );
};

/* ══ ROOT ═══════════════════════════════════════════════════ */
export default function Reach() {
  const [page, setPage] = useState("marketing");
  const [theme, setTheme] = useState("dark");
  const [route, setRoute] = useState("dashboard");
  const [issue, setIssue] = useState(null);
  const [search, setSearch] = useState(false);
  const [onboarded, setOnboarded] = useState(false);

  const T = THEMES[theme];

  // Inject fonts + CSS
  useEffect(() => {
    injectFonts();
    let el = document.getElementById("reach-css");
    if (!el) { el = document.createElement("style"); el.id = "reach-css"; document.head.appendChild(el); }
    el.textContent = CSS(T);
  }, [theme]);

  // Keyboard shortcuts
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearch(true); }
      if (e.key === "Escape") { setIssue(null); setSearch(false); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  if (page === "marketing") return <Marketing T={T} gotoAuth={(m) => setPage(m)} theme={theme} setTheme={setTheme} />;
  if (page === "signin" || page === "signup") return <AuthPage T={T} mode={page} setPage={(p) => { if (p === "app") { if (page === "signup") setPage("onboarding"); else setPage("app"); } else setPage(p); }} />;
  if (page === "onboarding" && !onboarded) return <Onboarding T={T} onComplete={() => { setOnboarded(true); setPage("app"); }} />;

  const PAGES = {
    "dashboard":    <Dashboard T={T} setRoute={setRoute} setIssue={setIssue} />,
    "issues":       <Issues T={T} setIssue={setIssue} />,
    "inbox":        <Dashboard T={T} setRoute={setRoute} setIssue={setIssue} />,
    "drafts":       <Docs T={T} />,
    "members":      <Settings T={T} theme={theme} setTheme={setTheme} />,
    "sprint-board": <SprintBoard T={T} setIssue={setIssue} />,
    "backlog":      <Backlog T={T} setIssue={setIssue} />,
    "views":         <Views T={T} setIssue={setIssue} />,
    "ide":          <IDE T={T} setIssue={setIssue} />,
    "prs":          <PRs T={T} setIssue={setIssue} />,
    "docs":         <Docs T={T} />,
    "chat":         <Chat T={T} setIssue={setIssue} />,
    "standups":     <Standups T={T} setIssue={setIssue} />,
    "analytics":    <Analytics T={T} setIssue={setIssue} />,
    "crm":          <CRM T={T} setIssue={setIssue} />,
    "time":         <Time T={T} setIssue={setIssue} />,
    "settings":     <Settings T={T} theme={theme} setTheme={setTheme} />,
    "cap-table":    <CapTable T={T} inline={false} />,
    "roadmap":      <Backlog T={T} setIssue={setIssue} />,
    "marketing":    <Marketing T={T} gotoAuth={(m) => setPage(m)} theme={theme} setTheme={setTheme} />,
    "admin":        <AdminPanel T={T} />,
  };

  return (
    <div className="app" style={{ background: T.bg, color: T.text, fontFamily: "'DM Mono', monospace" }}>
      <div className="app-body">
        <Sidebar T={T} route={route} nav={setRoute} />
        <div className="main">
          <Topbar T={T} route={route} theme={theme} setTheme={setTheme} onSearch={() => setSearch(true)} onIssue={setIssue} />
          <div className="content" style={{ background: T.bg }}>
            {PAGES[route] || PAGES["dashboard"]}
          </div>
        </div>
      </div>

      {/* Overlays */}
      {issue && <IssuePanel issue={issue} T={T} onClose={() => setIssue(null)} />}
      {search && <SearchModal T={T} onClose={() => setSearch(false)} setIssue={(i) => { setIssue(i); setSearch(false); }} />}
    </div>
  );
}
