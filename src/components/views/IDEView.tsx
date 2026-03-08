import { useState, useEffect, useRef, useCallback } from "react";

// ============================================================
// REACH IDE - Browser-based unified development environment
// The missing translation layer: Idea -> PRD -> Plan -> Code -> Ship
// ============================================================

const T = {
  bg: "#0A0A0C",
  bgPanel: "#0F0F12",
  bgSurface: "#141418",
  bgHover: "#1C1C22",
  bgActive: "#1E1E26",
  border: "#1E1E28",
  borderHi: "#2C2C3C",
  text: "#E2E2DC",
  textSub: "#7878A0",
  textMute: "#3A3A52",
  accent: "#47BFFF",
  accentDim: "rgba(71,191,255,0.12)",
  accentGlow: "rgba(71,191,255,0.24)",
  blue: "#4AAFFF",
  blueDim: "rgba(74,175,255,0.1)",
  orange: "#FF7840",
  orangeDim: "rgba(255,120,64,0.1)",
  red: "#FF4455",
  redDim: "rgba(255,68,85,0.1)",
  green: "#3EFF8A",
  greenDim: "rgba(62,255,138,0.1)",
  purple: "#9966FF",
  purpleDim: "rgba(153,102,255,0.1)",
  yellow: "#FFD044",
};

// ============================================================
// MOCK DATA
// ============================================================
const MOCK_FILES = [
  { name: "src", type: "dir", open: true, children: [
    { name: "app", type: "dir", open: true, children: [
      { name: "page.tsx", type: "file", lang: "tsx", modified: true },
      { name: "layout.tsx", type: "file", lang: "tsx" },
      { name: "globals.css", type: "file", lang: "css" },
    ]},
    { name: "components", type: "dir", open: false, children: [
      { name: "Button.tsx", type: "file", lang: "tsx" },
      { name: "Modal.tsx", type: "file", lang: "tsx", modified: true },
      { name: "IssueCard.tsx", type: "file", lang: "tsx" },
    ]},
    { name: "lib", type: "dir", open: false, children: [
      { name: "supabase.ts", type: "file", lang: "ts" },
      { name: "api.ts", type: "file", lang: "ts", modified: true },
    ]},
  ]},
  { name: "public", type: "dir", open: false, children: [] },
  { name: "package.json", type: "file", lang: "json" },
  { name: "tsconfig.json", type: "file", lang: "json" },
  { name: ".env.local", type: "file", lang: "env" },
];

const CODE_FILES = {
  "page.tsx": `// app/page.tsx
// RC-001: Main dashboard page

// import { Suspense } from 'react';
// IssueBoard component (src/components/IssueBoard.tsx)
// createServerClient from lib/supabase

export default async function DashboardPage() {
  const supabase = createServerClient();
  
  const { data: issues, error } = await supabase
    .from('issues')
    .select('*, assignee:profiles(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch issues:', error);
    return <div>Error loading issues</div>;
  }

  return (
    <main className="flex min-h-screen flex-col">
      <Suspense fallback={<div>Loading...</div>}>
        <IssueBoard initialIssues={issues ?? []} />
      </Suspense>
    </main>
  );
}`,
  "api.ts": `// lib/api.ts
// RC-001: API client with rate limiting

const RATE_LIMIT = 100; // requests per minute
const queue: Array<() => void> = [];
let requestCount = 0;

function resetCounter() {
  requestCount = 0;
  if (queue.length > 0) {
    const next = queue.shift();
    next?.();
  }
}

setInterval(resetCounter, 60000);

async function throttle(): Promise<void> {
  if (requestCount < RATE_LIMIT) {
    requestCount++;
    return;
  }
  return new Promise(resolve => queue.push(resolve));
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retries = 3
): Promise<T> {
  await throttle();
  
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(
        process.env.NEXT_PUBLIC_API_URL + path,
        {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        }
      );
      
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json() as Promise<T>;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise(r =>
        setTimeout(r, 1000 * Math.pow(2, i))
      );
    }
  }
  throw new Error('Max retries exceeded');
}`,
  "supabase.ts": `// lib/supabase.ts
// Supabase client factory
// Uses: supabase-js createClient (installed via npm)
// Types: generated via: npx supabase gen types typescript

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

export function createServerClient() {
  // supabase.createClient(SUPABASE_URL, SERVICE_KEY)
  return { from: (table: string) => ({ select: () => Promise.resolve({ data: [], error: null }) }) }
}

export function createBrowserClient() {
  // supabase.createClient(SUPABASE_URL, ANON_KEY)
  return { from: (table: string) => ({ select: () => Promise.resolve({ data: [], error: null }) }) }
}`,
};

const PLAN_STEPS = [
  { id: 1, phase: "TRANSLATE", title: "Idea to Language", status: "done", substeps: [
    { id: "1a", text: "User describes idea in plain language", done: true },
    { id: "1b", text: "AI maps to domain vocabulary (Agile / PMBOK / DevOps)", done: true },
    { id: "1c", text: "Produces glossary of terms used in this project", done: true },
  ]},
  { id: 2, phase: "PRD", title: "Product Requirements", status: "done", substeps: [
    { id: "2a", text: "Define problem statement with acceptance criteria", done: true },
    { id: "2b", text: "Identify user personas and primary flows", done: true },
    { id: "2c", text: "Write non-functional requirements (perf, security, scale)", done: true },
  ]},
  { id: 3, phase: "PLAN", title: "Dev Plan Generation", status: "active", substeps: [
    { id: "3a", text: "Break PRD into 50 executable steps max", done: true },
    { id: "3b", text: "Each step: max 10 mini-tasks, clear input/output", done: true },
    { id: "3c", text: "Assign frontend / backend / API / infra labels", done: false },
    { id: "3d", text: "Pin reference doc to session context", done: false },
  ]},
  { id: 4, phase: "CODE", title: "Guided Implementation", status: "pending", substeps: [
    { id: "4a", text: "Step-by-step code with justifier", done: false },
    { id: "4b", text: "Lint check + codebase weight before commit", done: false },
    { id: "4c", text: "AI review on assign to file", done: false },
  ]},
  { id: 5, phase: "SHIP", title: "Deploy Pipeline", status: "pending", substeps: [
    { id: "5a", text: "Build preview on localhost", done: false },
    { id: "5b", text: "Vercel / edge deploy trigger", done: false },
    { id: "5c", text: "Post-deploy smoke test", done: false },
  ]},
];

const TERMINAL_LINES = [
  { type: "cmd", text: "npm run dev" },
  { type: "out", text: "> reach-ide@0.1.0 dev" },
  { type: "out", text: "> next dev" },
  { type: "info", text: "  - Local:        http://localhost:3000" },
  { type: "info", text: "  - Network:       http://192.168.1.5:3000" },
  { type: "success", text: "  Ready in 1842ms" },
  { type: "cmd", text: "" },
  { type: "warn", text: "ESLint: 2 warnings in src/components/Modal.tsx" },
  { type: "err", text: "  Line 24: 'data' is assigned but never used  no-unused-vars" },
  { type: "err", text: "  Line 31: Missing dependency 'onClose'  react-hooks/exhaustive-deps" },
];

const EXTENSIONS = [
  { id: "e1", name: "Supabase Studio", cat: "Database", tier: "free", rating: 4.8, desc: "Visual table editor, query runner, auth manager", icon: "DB", installs: "48k" },
  { id: "e2", name: "GitHub Copilot", cat: "AI", tier: "paid", rating: 4.6, desc: "AI pair programmer with inline completions", icon: "AI", installs: "2.1M" },
  { id: "e3", name: "ESLint", cat: "Linting", tier: "free", rating: 4.9, desc: "Pluggable JS/TS linter with auto-fix", icon: "LC", installs: "890k" },
  { id: "e4", name: "Prettier", cat: "Formatting", tier: "free", rating: 4.8, desc: "Opinionated code formatter", icon: "FT", installs: "760k" },
  { id: "e5", name: "Tailwind IntelliSense", cat: "CSS", tier: "free", rating: 4.9, desc: "Autocomplete for Tailwind classes", icon: "TW", installs: "1.2M" },
  { id: "e6", name: "Thunder Client", cat: "API Testing", tier: "hybrid", rating: 4.7, desc: "Lightweight REST client, no Postman needed", icon: "TC", installs: "320k" },
  { id: "e7", name: "GitLens", cat: "Git", tier: "hybrid", rating: 4.8, desc: "Git blame, history, and code authorship inline", icon: "GL", installs: "940k" },
  { id: "e8", name: "Docker", cat: "DevOps", tier: "free", rating: 4.5, desc: "Manage containers and compose files", icon: "DK", installs: "580k" },
];

const EXT_CATS = ["All", "AI", "Database", "Git", "Linting", "Formatting", "CSS", "API Testing", "DevOps"];

// ============================================================
// LAYOUT MODES
// ============================================================
const LAYOUTS = {
  single: { cols: "1fr", rows: "1fr", panes: 1 },
  sideBySide: { cols: "1fr 1fr", rows: "1fr", panes: 2 },
  triple: { cols: "1fr 1fr 1fr", rows: "1fr", panes: 3 },
  quad: { cols: "1fr 1fr", rows: "1fr 1fr", panes: 4 },
  mainSide: { cols: "2fr 1fr", rows: "1fr", panes: 2 },
  topBottom: { cols: "1fr", rows: "1fr 1fr", panes: 2 },
};

// ============================================================
// SMALL COMPONENTS
// ============================================================
function Ico({ children, size = 13, color, style = {} }) {
  return <span style={{ fontSize: size, color: color || T.textSub, lineHeight: 1, ...style }}>{children}</span>;
}

function Pill({ children, color, small }: any) {
  return (
    <span style={{
      fontSize: small ? 9 : 10, padding: small ? "1px 5px" : "2px 7px",
      background: (color || T.accent) + "18",
      color: color || T.accent,
      borderRadius: 3, letterSpacing: "0.05em",
      border: `1px solid ${(color || T.accent)}30`,
      whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function Btn({ children, accent, danger, small, onClick, style = {}, disabled }: any) {
  const bg = accent ? T.accentDim : danger ? T.redDim : "transparent";
  const border = accent ? T.accent : danger ? T.red : T.border;
  const color = accent ? T.accent : danger ? T.red : T.textSub;
  return (
    <button onClick={onClick} disabled={disabled} style={{
      background: bg, border: `1px solid ${border}`, color,
      borderRadius: 5, padding: small ? "4px 9px" : "6px 13px",
      fontSize: small ? 10 : 12, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "inherit", letterSpacing: "0.04em",
      opacity: disabled ? 0.4 : 1, transition: "all 0.15s",
      whiteSpace: "nowrap", ...style,
    }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.borderColor = accent ? T.accent : danger ? T.red : T.borderHi; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = border; }}
    >{children}</button>
  );
}

function TabBar({ tabs, active, onSelect, t = T, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", borderBottom: `1px solid ${T.border}`, background: T.bgPanel, minHeight: 34, paddingLeft: 4 }}>
      <div style={{ display: "flex", flex: 1, overflowX: "auto" }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => onSelect(tab.id)} style={{
            background: active === tab.id ? T.bgSurface : "transparent",
            border: "none", borderBottom: active === tab.id ? `2px solid ${T.accent}` : "2px solid transparent",
            color: active === tab.id ? T.text : T.textSub,
            padding: "6px 14px", fontSize: 11, cursor: "pointer",
            fontFamily: "inherit", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
          }}>
            {tab.icon && <span style={{ fontSize: 11 }}>{tab.icon}</span>}
            {tab.label}
            {tab.modified && <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.orange, display: "inline-block" }} />}
            {tab.badge && <Pill color={T.orange} small>{tab.badge}</Pill>}
          </button>
        ))}
      </div>
      {right && <div style={{ padding: "0 8px", display: "flex", gap: 4 }}>{right}</div>}
    </div>
  );
}

// ============================================================
// SYNTAX HIGHLIGHTER (simple rule-based)
// ============================================================
function highlight(line, lang) {
  if (!line.trim()) return <span>&nbsp;</span>;

  const kw = ["import", "export", "from", "const", "let", "var", "function", "async", "await", "return", "if", "else", "for", "while", "class", "interface", "type", "extends", "implements", "new", "throw", "try", "catch", "default", "null", "undefined", "true", "false", "of", "in", "typeof", "void"];
  const tokens = [];
  let i = 0;
  const src = line;

  // Comments
  if (src.trim().startsWith("//")) return <span style={{ color: "#5A7A40" }}>{src}</span>;
  if (src.trim().startsWith("*") || src.trim().startsWith("/*")) return <span style={{ color: "#5A7A40" }}>{src}</span>;

  // Simple token split
  const parts = src.split(/(\s+|[{}()[\],;:<>]|"[^"]*"|'[^']*'|`[^`]*`)/);
  return (
    <span>
      {parts.map((part, idx) => {
        if (!part) return null;
        if (part.startsWith('"') || part.startsWith("'") || part.startsWith("`"))
          return <span key={idx} style={{ color: "#E09060" }}>{part}</span>;
        if (kw.includes(part.trim()))
          return <span key={idx} style={{ color: "#70A0FF" }}>{part}</span>;
        if (/^[A-Z][a-zA-Z]+/.test(part.trim()))
          return <span key={idx} style={{ color: "#C8A0FF" }}>{part}</span>;
        if (/^\d+$/.test(part.trim()))
          return <span key={idx} style={{ color: "#FF9050" }}>{part}</span>;
        if (["(", ")", "{", "}", "[", "]"].includes(part.trim()))
          return <span key={idx} style={{ color: "#888" }}>{part}</span>;
        return <span key={idx} style={{ color: T.text }}>{part}</span>;
      })}
    </span>
  );
}

// ============================================================
// FILE TREE
// ============================================================
function FileTree({ files, depth = 0, onSelect, activeFile }) {
  const [open, setOpen] = useState({});

  return (
    <div>
      {files.map(f => (
        <div key={f.name}>
          <div
            onClick={() => {
              if (f.type === "dir") setOpen(p => ({ ...p, [f.name]: !p[f.name] }));
              else onSelect(f.name);
            }}
            style={{
              padding: `4px 8px 4px ${12 + depth * 14}px`,
              fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
              color: activeFile === f.name ? T.accent : T.textSub,
              background: activeFile === f.name ? T.accentDim : "transparent",
              borderLeft: activeFile === f.name ? `2px solid ${T.accent}` : "2px solid transparent",
              transition: "all 0.1s",
            }}
            onMouseEnter={e => { if (activeFile !== f.name) e.currentTarget.style.background = T.bgHover; }}
            onMouseLeave={e => { if (activeFile !== f.name) e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ fontSize: 10, color: T.textMute, flexShrink: 0 }}>
              {f.type === "dir" ? (open[f.name] || f.open ? "v" : ">") : ""}
            </span>
            <span style={{ fontSize: 10, color: f.type === "dir" ? T.blue : f.lang === "tsx" || f.lang === "ts" ? T.blue : f.lang === "css" ? T.purple : T.textSub }}>
              {f.type === "dir" ? "[/]" : f.lang === "tsx" || f.lang === "ts" ? "[ts]" : f.lang === "json" ? "[{}]" : "[f]"}
            </span>
            <span style={{ flex: 1 }}>{f.name}</span>
            {f.modified && <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.orange, flexShrink: 0 }} />}
          </div>
          {f.type === "dir" && (open[f.name] || (f.open && open[f.name] !== false)) && f.children && (
            <FileTree files={f.children} depth={depth + 1} onSelect={onSelect} activeFile={activeFile} />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// CODE EDITOR PANE
// ============================================================
function CodePane({ file, onJustify }) {
  const code = CODE_FILES[file] || `// ${file}\n// Select a file from the tree to edit`;
  const lines = code.split("\n");
  const [cursor, setCursor] = useState({ line: 0, col: 0 });
  const [selected, setSelected] = useState(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: T.bg }}>
      {/* Editor toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", borderBottom: `1px solid ${T.border}`, background: T.bgPanel, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: T.textSub }}>{file}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <Btn small onClick={() => onJustify && onJustify(code, file)}>Justify Snippet</Btn>
          <Btn small accent>Format</Btn>
        </div>
      </div>

      {/* Code area */}
      <div style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
        <div style={{ fontFamily: "ui-monospace,'Cascadia Code','Fira Code',monospace", fontSize: 13, lineHeight: 1.75, minWidth: "max-content" }}>
          {lines.map((line, i) => (
            <div key={i}
              onClick={() => setCursor({ line: i, col: 0 })}
              style={{
                display: "flex", background: cursor.line === i ? T.bgHover : "transparent",
                transition: "background 0.05s", cursor: "text",
              }}
              onMouseEnter={e => { if (cursor.line !== i) e.currentTarget.style.background = T.bgActive; }}
              onMouseLeave={e => { if (cursor.line !== i) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ width: 48, textAlign: "right", paddingRight: 16, color: cursor.line === i ? T.textSub : T.textMute, fontSize: 11, userSelect: "none", flexShrink: 0, paddingTop: 1 }}>
                {i + 1}
              </span>
              <span style={{ flex: 1, paddingRight: 24, whiteSpace: "pre" }}>
                {highlight(line, "ts")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "3px 12px", background: T.bgSurface, borderTop: `1px solid ${T.border}`, fontSize: 10, color: T.textSub, flexShrink: 0 }}>
        <span>Ln {cursor.line + 1}, Col {cursor.col + 1}</span>
        <span>TypeScript</span>
        <span>UTF-8</span>
        <span style={{ marginLeft: "auto", color: T.green }}>ESLint: Clean</span>
      </div>
    </div>
  );
}

// ============================================================
// AI CHAT PANE
// ============================================================
function AIPane({ context, planStep }: any) {
  const [messages, setMessages] = useState([
    { role: "system", text: `Reference doc loaded: REACH-IDE-PRD-v1.md\nActive plan step: ${planStep || "3c - Assign frontend/backend labels"}\n\nI have your full project context. What do you want to build?` },
    { role: "user", text: "Wire up the Supabase real-time subscription for issue status changes" },
    { role: "assistant", text: `Based on your plan step 3c and the current api.ts structure, here is the subscription wiring:\n\n[CODE]\nconst channel = supabase\n  .channel('issue-changes')\n  .on('postgres_changes',\n    { event: '*', schema: 'public', table: 'issues' },\n    (payload) => {\n      dispatch({ type: 'ISSUE_UPDATE', payload })\n    }\n  )\n  .subscribe()\n[/CODE]\n\nThis goes in your useIssues() hook. Want me to write the full hook, or justify this snippet against your codebase first?` },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef();

  const send = async () => {
    if (!input.trim() || thinking) return;
    const msg = input; setInput(""); setThinking(true);
    setMessages(p => [...p, { role: "user", text: msg }]);
    await new Promise(r => setTimeout(r, 1100));
    const responses = [
      "Checking your codebase pattern first... Your existing hooks in lib/api.ts use a functional pattern with TypeScript generics. I'll match that style.\n\nShould I write this as a custom hook (useIssueSubscription) or wire it directly into your existing useIssues hook?",
      "I see you're asking about " + msg.slice(0, 30) + "...\n\nBefore generating code, let me reference the pinned PRD. Your acceptance criteria says real-time updates must debounce at 200ms and handle offline reconnection. I'll include both in the implementation.",
      "Done. I've generated the snippet. Use 'Justify Snippet' to check it against your current codebase weight and lint rules before committing.",
    ];
    setMessages(p => [...p, { role: "assistant", text: responses[Math.floor(Math.random() * responses.length)] }]);
    setThinking(false);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: T.bgPanel }}>
      {/* Context badge */}
      <div style={{ padding: "7px 12px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Pill color={T.accent}>PRD: v1 pinned</Pill>
        <Pill color={T.blue}>Step 3c active</Pill>
        <Pill color={T.green}>Context: api.ts</Pill>
        <button style={{ marginLeft: "auto", background: "none", border: `1px solid ${T.border}`, color: T.textSub, borderRadius: 4, padding: "2px 8px", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>+ Add context</button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.map((m, i) => {
          if (m.role === "system") return (
            <div key={i} style={{ padding: "8px 12px", background: T.accentDim, border: `1px solid ${T.accent}30`, borderRadius: 6, fontSize: 11, color: T.textSub, whiteSpace: "pre-wrap" }}>
              <span style={{ color: T.accent, display: "block", marginBottom: 4, fontSize: 9, letterSpacing: "0.1em" }}>CONTEXT LOADED</span>
              {m.text}
            </div>
          );
          const isUser = m.role === "user";
          // Render code blocks
          const parts = m.text.split(/(\[CODE\][\s\S]*?\[\/CODE\])/g);
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: isUser ? "flex-end" : "flex-start" }}>
              <div style={{ maxWidth: "92%", padding: "9px 12px", background: isUser ? T.blueDim : T.bgSurface, border: `1px solid ${isUser ? T.blue + "40" : T.border}`, borderRadius: isUser ? "12px 12px 3px 12px" : "3px 12px 12px 12px", fontSize: 13, color: T.text, lineHeight: 1.6 }}>
                {parts.map((part, pi) => {
                  if (part.startsWith("[CODE]")) {
                    const code = part.replace("[CODE]", "").replace("[/CODE]", "").trim();
                    return (
                      <div key={pi} style={{ margin: "8px 0", background: T.bg, border: `1px solid ${T.borderHi}`, borderRadius: 5, overflow: "hidden" }}>
                        <div style={{ padding: "4px 10px", background: T.bgSurface, borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 9, color: T.textSub }}>TypeScript</span>
                          <Btn small>Justify</Btn>
                        </div>
                        <pre style={{ padding: "10px 12px", fontSize: 11, fontFamily: "ui-monospace,monospace", color: T.blue, overflowX: "auto", margin: 0 }}>{code}</pre>
                      </div>
                    );
                  }
                  return <span key={pi}>{part}</span>;
                })}
              </div>
            </div>
          );
        })}
        {thinking && (
          <div style={{ display: "flex", gap: 5, padding: "10px 12px" }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: T.accent, animation: `pulse 1s ${i * 0.2}s infinite` }} />)}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 12px", borderTop: `1px solid ${T.border}` }}>
        <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 8, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask AI... (Shift+Enter for new line)"
            rows={2}
            style={{ background: "none", border: "none", outline: "none", fontSize: 13, color: T.text, fontFamily: "inherit", resize: "none", lineHeight: 1.5 }}
          />
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <Btn small>Explain</Btn>
            <Btn small>Refactor</Btn>
            <Btn small>Write Test</Btn>
            <Btn small accent onClick={send}>Send</Btn>
          </div>
        </div>
        <div style={{ fontSize: 9, color: T.textMute, marginTop: 5, textAlign: "center" }}>
          PRD + Plan Step 3c + api.ts in context. AI will reference pinned doc.
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TERMINAL PANE
// ============================================================
function TerminalPane() {
  const [lines, setLines] = useState(TERMINAL_LINES);
  const [input, setInput] = useState("");
  const endRef = useRef();

  const runCmd = () => {
    if (!input.trim()) return;
    const cmd = input; setInput("");
    setLines(p => [...p, { type: "cmd", text: cmd }]);
    // Simulate response
    setTimeout(() => {
      if (cmd.includes("npm")) {
        setLines(p => [...p, { type: "info", text: "Installing dependencies..." }, { type: "success", text: "Done in 2.1s" }]);
      } else if (cmd.includes("git")) {
        setLines(p => [...p, { type: "out", text: "On branch main" }, { type: "success", text: "nothing to commit, working tree clean" }]);
      } else {
        setLines(p => [...p, { type: "out", text: `command not found: ${cmd.split(" ")[0]}` }]);
      }
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 300);
  };

  const typeColor = { cmd: T.accent, out: T.textSub, info: T.blue, success: T.green, warn: T.yellow, err: T.red };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#080810", fontFamily: "ui-monospace,'Cascadia Code',monospace" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", fontSize: 12, lineHeight: 1.6 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ color: typeColor[l.type] || T.textSub }}>
            {l.type === "cmd" && <span style={{ color: T.accent }}>$ </span>}
            {l.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", alignItems: "center", borderTop: `1px solid ${T.border}`, padding: "6px 14px", gap: 8 }}>
        <span style={{ color: T.accent, fontSize: 12 }}>$</span>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && runCmd()}
          placeholder="Type a command..."
          style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 12, color: T.text, fontFamily: "inherit" }}
        />
        {/* Quick commands */}
        <div style={{ display: "flex", gap: 4 }}>
          {["npm run dev", "npm run build", "git status", "npx prisma migrate dev"].map(cmd => (
            <button key={cmd} onClick={() => { setInput(cmd); }} style={{ background: T.bgSurface, border: `1px solid ${T.border}`, color: T.textSub, borderRadius: 3, padding: "2px 7px", fontSize: 9, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>{cmd.split(" ").slice(0, 2).join(" ")}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LOCALHOST PREVIEW PANE
// ============================================================
function PreviewPane() {
  const [url, setUrl] = useState("http://localhost:3000");
  const [loading, setLoading] = useState(false);
  const [zoom, setZoom] = useState("desktop");

  const widths = { mobile: 375, tablet: 768, desktop: "100%" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: T.bgPanel }}>
      {/* URL bar */}
      <div style={{ padding: "6px 10px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["<", ">", "refresh"].map(a => <button key={a} style={{ background: "none", border: `1px solid ${T.border}`, color: T.textSub, borderRadius: 4, padding: "3px 8px", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{a}</button>)}
        </div>
        <input value={url} onChange={e => setUrl(e.target.value)} style={{ flex: 1, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 4, padding: "4px 10px", fontSize: 11, color: T.text, fontFamily: "inherit", outline: "none" }} />
        <div style={{ display: "flex", gap: 3 }}>
          {["mobile", "tablet", "desktop"].map(z => (
            <button key={z} onClick={() => setZoom(z)} style={{ background: zoom === z ? T.accentDim : "none", border: `1px solid ${zoom === z ? T.accent : T.border}`, color: zoom === z ? T.accent : T.textSub, borderRadius: 4, padding: "3px 8px", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>{z}</button>
          ))}
        </div>
      </div>

      {/* Preview frame */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: zoom !== "desktop" ? 16 : 0, background: zoom !== "desktop" ? T.bgSurface : T.bg }}>
        <div style={{ width: widths[zoom], maxWidth: "100%", height: "100%", background: T.bg, border: zoom !== "desktop" ? `1px solid ${T.border}` : "none", borderRadius: zoom !== "desktop" ? 8 : 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 32, opacity: 0.2 }}>[&gt;]</div>
          <div style={{ fontSize: 14, color: T.textSub, textAlign: "center" }}>
            localhost:3000<br />
            <span style={{ fontSize: 11, color: T.textMute }}>npm run dev to start server</span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Pill color={T.green}>Server: Running</Pill>
            <Pill color={T.blue}>HMR: Active</Pill>
            <Pill color={T.accent}>Build: 1842ms</Pill>
          </div>
          <Btn small accent>Open in Browser</Btn>
        </div>
      </div>

      {/* Build output */}
      <div style={{ padding: "6px 12px", borderTop: `1px solid ${T.border}`, fontSize: 10, color: T.textMute, display: "flex", gap: 12 }}>
        <span style={{ color: T.green }}>Build OK</span>
        <span>Bundle: 142kb gzip</span>
        <span>Pages: 4</span>
        <span style={{ color: T.yellow }}>2 warnings</span>
        <span style={{ marginLeft: "auto" }}>Next.js 14.2</span>
      </div>
    </div>
  );
}

// ============================================================
// PLAN / TRANSLATION MODULE
// ============================================================
function PlanModule() {
  const [steps, setSteps] = useState(PLAN_STEPS);
  const [activeStep, setActiveStep] = useState(3);
  const [fidelity, setFidelity] = useState("mvp");
  const [idea, setIdea] = useState("A unified project management + IDE tool for developers who don't want to switch between Jira, VS Code, Slack, and Confluence.");
  const [translating, setTranslating] = useState(false);
  const [translated, setTranslated] = useState(true);

  const phaseColors = { TRANSLATE: T.purple, PRD: T.blue, PLAN: T.accent, CODE: T.orange, SHIP: T.green };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* Left: Steps */}
      <div style={{ width: 280, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", background: T.bgPanel }}>
        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9, color: T.textMute, letterSpacing: "0.18em", marginBottom: 8 }}>OUTPUT FIDELITY</div>
          <div style={{ display: "flex", gap: 4 }}>
            {[["wireframe", "Wireframe"], ["mvp", "MVP"], ["production", "Production"], ["enterprise", "Enterprise"]].map(([key, label]) => (
              <button key={key} onClick={() => setFidelity(key)} style={{ flex: 1, background: fidelity === key ? T.accentDim : "none", border: `1px solid ${fidelity === key ? T.accent : T.border}`, color: fidelity === key ? T.accent : T.textMute, borderRadius: 4, padding: "4px 2px", fontSize: 9, cursor: "pointer", fontFamily: "inherit", letterSpacing: "0.04em" }}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {steps.map((step, si) => {
            const color = phaseColors[step.phase];
            const isActive = step.id === activeStep;
            return (
              <div key={step.id} onClick={() => setActiveStep(step.id)} style={{ borderBottom: `1px solid ${T.border}`, cursor: "pointer", background: isActive ? color + "0C" : "transparent", borderLeft: `3px solid ${isActive ? color : "transparent"}`, transition: "all 0.15s" }}>
                <div style={{ padding: "12px 14px 8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Pill color={color}>{step.phase}</Pill>
                    <span style={{ fontSize: 9, padding: "2px 6px", background: step.status === "done" ? T.greenDim : step.status === "active" ? T.accentDim : T.bgSurface, color: step.status === "done" ? T.green : step.status === "active" ? T.accent : T.textMute, borderRadius: 3 }}>{step.status.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 13, color: isActive ? T.text : T.textSub }}>{step.title}</div>
                </div>
                {isActive && (
                  <div style={{ padding: "0 14px 12px" }}>
                    {step.substeps.map(sub => (
                      <div key={sub.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                        <div style={{ width: 14, height: 14, borderRadius: "50%", border: `1.5px solid ${sub.done ? T.green : T.borderHi}`, background: sub.done ? T.green : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2, cursor: "pointer" }}
                          onClick={e => { e.stopPropagation(); setSteps(prev => prev.map(s => s.id === step.id ? { ...s, substeps: s.substeps.map(ss => ss.id === sub.id ? { ...ss, done: !ss.done } : ss) } : s)); }}>
                          {sub.done && <span style={{ fontSize: 8, color: T.bg }}>v</span>}
                        </div>
                        <span style={{ fontSize: 11, color: sub.done ? T.textMute : T.textSub, textDecoration: sub.done ? "line-through" : "none", lineHeight: 1.4 }}>{sub.text}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Progress */}
        <div style={{ padding: 14, borderTop: `1px solid ${T.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 10, color: T.textSub }}>Overall Progress</span>
            <span style={{ fontSize: 10, color: T.accent }}>42%</span>
          </div>
          <div style={{ height: 4, background: T.bgSurface, borderRadius: 2 }}>
            <div style={{ width: "42%", height: "100%", background: T.accent, borderRadius: 2 }} />
          </div>
        </div>
      </div>

      {/* Right: Active step detail */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        {activeStep === 1 && (
          <div>
            <div style={{ fontSize: 9, color: T.purple, letterSpacing: "0.18em", marginBottom: 8 }}>STEP 1 - TRANSLATE</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 20, lineHeight: 1.2 }}>Plain English to Dev Language</h2>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: T.textSub, marginBottom: 8 }}>YOUR IDEA</div>
              <textarea value={idea} onChange={e => setIdea(e.target.value)} rows={4} style={{ width: "100%", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "12px", fontSize: 13, color: T.text, fontFamily: "inherit", resize: "none", outline: "none", lineHeight: 1.6 }} />
              <Btn accent onClick={() => { setTranslating(true); setTimeout(() => { setTranslating(false); setTranslated(true); }, 1200); }} style={{ marginTop: 8 }}>
                {translating ? "Translating..." : "Translate to Dev Language"}
              </Btn>
            </div>

            {translated && (
              <div style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 8, padding: 20 }}>
                <div style={{ fontSize: 11, color: T.accent, letterSpacing: "0.1em", marginBottom: 14 }}>TRANSLATED VOCABULARY</div>
                {[
                  ["Unified tool", "Monorepo SaaS app with shared component library", T.blue],
                  ["Switch between tools", "Context fragmentation - solved by unified data model", T.purple],
                  ["Project management", "Issue tracking + kanban + roadmap + EVM metrics", T.accent],
                  ["IDE inside browser", "Monaco Editor (VS Code engine) + LSP server via WebSocket", T.orange],
                  ["Real-time sync", "Supabase Realtime + Postgres row-level security", T.green],
                  ["AI assistance", "OpenRouter API + context injection + pinned PRD", T.yellow],
                ].map(([raw, mapped, color]) => (
                  <div key={raw} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12, padding: "10px 12px", background: T.bg, border: `1px solid ${T.border}`, borderRadius: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: T.textMute, marginBottom: 3 }}>Plain language</div>
                      <div style={{ fontSize: 13, color: T.textSub }}>{raw}</div>
                    </div>
                    <span style={{ color: T.textMute, marginTop: 16 }}>-&gt;</span>
                    <div style={{ flex: 2 }}>
                      <div style={{ fontSize: 11, color: color, marginBottom: 3 }}>Dev term</div>
                      <div style={{ fontSize: 13, color: T.text }}>{mapped}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeStep === 2 && (
          <div>
            <div style={{ fontSize: 9, color: T.blue, letterSpacing: "0.18em", marginBottom: 8 }}>STEP 2 - PRD</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 20 }}>Product Requirements Document</h2>
            {[
              { label: "Problem Statement", content: "Developers lose 40% of productive time context-switching between PM tools, IDEs, communication platforms, and documentation. No single tool speaks both PM and dev language." },
              { label: "Acceptance Criteria", content: "1. Issue creation to code commit in <3 tool switches\n2. AI context persists across plan steps without drift\n3. Non-developers can translate idea to PRD without dev knowledge\n4. Enterprise: SOC2 Type II compliant data handling" },
              { label: "Tech Stack", content: "Frontend: Next.js 14 + TypeScript + Tailwind\nBackend: Supabase (Postgres + Realtime + Auth + Storage)\nAI: OpenRouter (Claude Sonnet / GPT-4o)\nDeploy: Vercel + Supabase Edge Functions\nIDE: Monaco Editor + CodeMirror 6" },
              { label: "Non-Functional Requirements", content: "Performance: <200ms p95 API response\nSecurity: RLS on all tables, no PII in AI context\nScale: 10k concurrent users on Hobby plan\nAccessibility: WCAG 2.1 AA" },
            ].map(section => (
              <div key={section.label} style={{ marginBottom: 16, background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "8px 14px", background: T.bgPanel, borderBottom: `1px solid ${T.border}`, fontSize: 10, color: T.blue, letterSpacing: "0.1em" }}>{section.label.toUpperCase()}</div>
                <div style={{ padding: 14, fontSize: 13, color: T.textSub, lineHeight: 1.7, whiteSpace: "pre-line" }}>{section.content}</div>
              </div>
            ))}
          </div>
        )}

        {activeStep === 3 && (
          <div>
            <div style={{ fontSize: 9, color: T.accent, letterSpacing: "0.18em", marginBottom: 8 }}>STEP 3 - PLAN (ACTIVE)</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, marginBottom: 8 }}>50-Step Dev Plan</h2>
            <p style={{ fontSize: 13, color: T.textSub, marginBottom: 20, lineHeight: 1.6 }}>Each step has max 10 mini-tasks. Pinned reference doc is attached to every AI session. Steps are labeled by domain to prevent AI context drift.</p>

            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {[["FE", "Frontend", T.blue], ["BE", "Backend", T.orange], ["API", "API", T.purple], ["DB", "Database", T.green], ["AI", "AI/ML", T.yellow], ["INFRA", "Infra", T.red]].map(([key, label, color]) => (
                <Pill key={key} color={color}>{key}: {label}</Pill>
              ))}
            </div>

            {[
              { n: 1, domain: "FE", title: "App shell + routing", tasks: ["Create Next.js app", "Configure TypeScript", "Set up Tailwind"], done: true },
              { n: 2, domain: "DB", title: "Supabase schema", tasks: ["Issues table + RLS", "Profiles + auth", "Projects table"], done: true },
              { n: 3, domain: "BE", title: "API client + rate limiting", tasks: ["Rate limiter util", "Retry with backoff", "Error boundary"], done: false, active: true },
              { n: 4, domain: "FE", title: "Issue board UI", tasks: ["Kanban columns", "Drag-and-drop", "WIP limits"], done: false },
              { n: 5, domain: "AI", title: "AI chat + context", tasks: ["OpenRouter wiring", "PRD injection", "Code snippet handler"], done: false },
            ].map(step => {
              const domainColors = { FE: T.blue, BE: T.orange, API: T.purple, DB: T.green, AI: T.yellow, INFRA: T.red };
              const c = domainColors[step.domain];
              return (
                <div key={step.n} style={{ marginBottom: 10, background: step.active ? T.accentDim : T.bgSurface, border: `1px solid ${step.active ? T.accent : T.border}`, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: step.done ? T.greenDim : step.active ? T.accentDim : T.bgPanel, border: `1.5px solid ${step.done ? T.green : step.active ? T.accent : T.borderHi}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: step.done ? T.green : step.active ? T.accent : T.textMute, flexShrink: 0 }}>
                      {step.done ? "v" : step.n}
                    </div>
                    <Pill color={c}>{step.domain}</Pill>
                    <span style={{ fontSize: 13, color: T.text, flex: 1 }}>{step.title}</span>
                    {step.active && <Pill color={T.accent}>ACTIVE</Pill>}
                    <Btn small accent={step.active}>Open in AI</Btn>
                  </div>
                  <div style={{ padding: "0 14px 10px 52px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {step.tasks.map(task => (
                      <span key={task} style={{ fontSize: 10, padding: "3px 8px", background: T.bgPanel, border: `1px solid ${T.border}`, borderRadius: 3, color: T.textSub }}>{task}</span>
                    ))}
                  </div>
                </div>
              );
            })}

            <div style={{ marginTop: 12, padding: 14, background: T.bgSurface, border: `1px solid ${T.borderHi}`, borderRadius: 8, textAlign: "center" }}>
              <span style={{ fontSize: 12, color: T.textMute }}>45 more steps . Click to generate full 50-step plan from PRD</span>
              <div style={{ marginTop: 8 }}><Btn accent>Generate Full Plan</Btn></div>
            </div>
          </div>
        )}

        {activeStep >= 4 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60%", flexDirection: "column", gap: 12, opacity: 0.4 }}>
            <div style={{ fontSize: 40 }}>--</div>
            <div style={{ fontSize: 16, color: T.text }}>Complete Steps 1-3 first</div>
            <div style={{ fontSize: 13, color: T.textSub }}>The plan gates unlock in order</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CODE JUSTIFIER MODAL
// ============================================================
function JustifierModal({ code, file, onClose }) {
  const [checking, setChecking] = useState(true);
  const [results, setResults] = useState(null);

  useEffect(() => {
    setTimeout(() => {
      setChecking(false);
      setResults({
        lint: [
          { line: 7, rule: "no-unused-vars", msg: "'error' is defined but never used", sev: "warn" },
          { line: 18, rule: "react-hooks/exhaustive-deps", msg: "Missing dependency: 'dispatch'", sev: "error" },
        ],
        weight: { lines: 42, tokens: 380, bundleImpact: "+1.2kb", duplicates: 0 },
        similar: ["src/lib/api.ts (67% similar)", "src/hooks/useRequest.ts (34% similar)"],
        verdict: "warn",
      });
    }, 1400);
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={onClose}>
      <div style={{ background: T.bgPanel, border: `1px solid ${T.borderHi}`, borderRadius: 10, width: 640, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.8)" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 9, color: T.accent, letterSpacing: "0.15em", marginBottom: 3 }}>SNIPPET JUSTIFIER</div>
            <div style={{ fontSize: 15, color: T.text, fontWeight: 700 }}>{file}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.textSub, cursor: "pointer", fontSize: 20 }}>x</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {checking ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: T.textSub }}>
              <div style={{ fontSize: 24, marginBottom: 12, animation: "spin 1s linear infinite" }}>--</div>
              <div>Checking lint, weight, and codebase overlap...</div>
            </div>
          ) : results && (
            <div>
              {/* Verdict */}
              <div style={{ padding: 14, background: results.verdict === "pass" ? T.greenDim : results.verdict === "warn" ? T.accentDim : T.redDim, border: `1px solid ${results.verdict === "pass" ? T.green : results.verdict === "warn" ? T.accent : T.red}30`, borderRadius: 8, marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 24 }}>{results.verdict === "pass" ? "[v]" : results.verdict === "warn" ? "[!]" : "[x]"}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: results.verdict === "pass" ? T.green : results.verdict === "warn" ? T.accent : T.red, marginBottom: 3 }}>
                    {results.verdict === "pass" ? "Ready to commit" : results.verdict === "warn" ? "2 warnings - review before committing" : "Errors must be fixed first"}
                  </div>
                  <div style={{ fontSize: 12, color: T.textSub }}>Checked against codebase rules and existing patterns</div>
                </div>
              </div>

              {/* Lint */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: T.textSub, letterSpacing: "0.1em", marginBottom: 8 }}>LINT RESULTS</div>
                {results.lint.map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, padding: "8px 12px", background: T.bgSurface, border: `1px solid ${l.sev === "error" ? T.red + "40" : T.yellow + "40"}`, borderRadius: 5, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: l.sev === "error" ? T.red : T.yellow, width: 36, flexShrink: 0 }}>{l.sev.toUpperCase()}</span>
                    <span style={{ fontSize: 11, color: T.textMute, width: 32, flexShrink: 0 }}>L{l.line}</span>
                    <span style={{ fontSize: 12, color: T.text, flex: 1 }}>{l.msg}</span>
                    <span style={{ fontSize: 10, color: T.textMute }}>{l.rule}</span>
                  </div>
                ))}
              </div>

              {/* Weight */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: T.textSub, letterSpacing: "0.1em", marginBottom: 8 }}>CODEBASE WEIGHT</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                  {[["Lines", results.weight.lines], ["Tokens", results.weight.tokens], ["Bundle", results.weight.bundleImpact], ["Duplicates", results.weight.duplicates]].map(([k, v]) => (
                    <div key={k} style={{ padding: "10px 12px", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 5, textAlign: "center" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: T.text }}>{v}</div>
                      <div style={{ fontSize: 10, color: T.textMute }}>{k}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Similar files */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, color: T.textSub, letterSpacing: "0.1em", marginBottom: 8 }}>SIMILAR IN CODEBASE</div>
                {results.similar.map(s => (
                  <div key={s} style={{ padding: "7px 12px", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 5, marginBottom: 6, fontSize: 12, color: T.textSub, fontFamily: "monospace" }}>{s}</div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10 }}>
                <Btn danger onClick={onClose}>Discard</Btn>
                <Btn onClick={onClose}>Assign to Conversation</Btn>
                <Btn onClick={onClose}>Ask AI to Review</Btn>
                <Btn accent onClick={onClose}>Commit to File</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// EXTENSIONS PANEL
// ============================================================
function ExtensionsPanel() {
  const [cat, setCat] = useState("All");
  const [tier, setTier] = useState("all");
  const [search, setSearch] = useState("");
  const [installed, setInstalled] = useState(["e3", "e4", "e5"]);

  const filtered = EXTENSIONS.filter(e => {
    if (cat !== "All" && e.cat !== cat) return false;
    if (tier !== "all" && e.tier !== tier) return false;
    if (search && !e.name.toLowerCase().includes(search.toLowerCase()) && !e.desc.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const tierColor = { free: T.green, paid: T.orange, hybrid: T.blue };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: T.bgPanel }}>
      {/* Search + filters */}
      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}` }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search extensions..." style={{ width: "100%", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 6, padding: "7px 12px", fontSize: 12, color: T.text, fontFamily: "inherit", outline: "none", marginBottom: 10 }} />

        {/* Category grid - not just text search */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: T.textMute, letterSpacing: "0.12em", marginBottom: 6 }}>CATEGORY</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {EXT_CATS.map(c => (
              <button key={c} onClick={() => setCat(c)} style={{ background: cat === c ? T.accentDim : T.bgSurface, border: `1px solid ${cat === c ? T.accent : T.border}`, color: cat === c ? T.accent : T.textSub, borderRadius: 4, padding: "3px 9px", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{c}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9, color: T.textMute, letterSpacing: "0.12em", marginBottom: 6 }}>TIER</div>
          <div style={{ display: "flex", gap: 4 }}>
            {[["all", "All", T.textSub], ["free", "Free", T.green], ["paid", "Paid", T.orange], ["hybrid", "Free+Paid", T.blue]].map(([key, label, color]) => (
              <button key={key} onClick={() => setTier(key)} style={{ background: tier === key ? color + "18" : T.bgSurface, border: `1px solid ${tier === key ? color : T.border}`, color: tier === key ? color : T.textSub, borderRadius: 4, padding: "3px 9px", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {filtered.map(ext => {
          const isInstalled = installed.includes(ext.id);
          return (
            <div key={ext.id} style={{ padding: "12px 16px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 12, alignItems: "flex-start" }}
              onMouseEnter={e => e.currentTarget.style.background = T.bgHover}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <div style={{ width: 36, height: 36, borderRadius: 6, background: T.bgSurface, border: `1px solid ${T.borderHi}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: T.textSub, fontWeight: 700, flexShrink: 0, fontFamily: "monospace" }}>{ext.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 3 }}>
                  <span style={{ fontSize: 13, color: T.text, fontWeight: 600 }}>{ext.name}</span>
                  <Pill color={tierColor[ext.tier]} small>{ext.tier}</Pill>
                  <span style={{ fontSize: 10, color: T.textMute }}>{ext.installs} installs</span>
                </div>
                <div style={{ fontSize: 11, color: T.textSub, marginBottom: 6, lineHeight: 1.4 }}>{ext.desc}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Pill color={T.textMute} small>{ext.cat}</Pill>
                  <span style={{ fontSize: 10, color: T.yellow }}>{"*".repeat(Math.round(ext.rating))} {ext.rating}</span>
                </div>
              </div>
              <Btn small accent={!isInstalled} onClick={() => setInstalled(p => isInstalled ? p.filter(id => id !== ext.id) : [...p, ext.id])}>
                {isInstalled ? "Installed" : "Install"}
              </Btn>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// DOCS + DOCX IMPORT
// ============================================================
function DocsPanel() {
  const [mode, setMode] = useState("editor");
  const [content, setContent] = useState(`# REACH IDE - Product Requirements\n\n## Problem Statement\n\nDevelopers lose context switching between tools. This document pins the project vision.\n\n## Acceptance Criteria\n\n- Single browser tab replaces VS Code + Jira + Slack + Notion\n- AI never loses context of the plan\n- Non-developers can ship production code\n\n## Architecture Decision Records\n\n### ADR-001: Monaco Editor\n**Decision**: Use Monaco (VS Code engine) for the browser IDE\n**Reason**: LSP support, syntax highlighting for 80+ languages, proven at scale\n\n### ADR-002: Supabase over Firebase\n**Decision**: PostgreSQL + Row Level Security\n**Reason**: Relational model fits issue tracking, RLS handles multi-tenant auth`);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: T.bgPanel }}>
      <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.border}`, display: "flex", gap: 8, alignItems: "center" }}>
        <Pill color={T.accent}>PINNED: PRD v1</Pill>
        <Pill color={T.green}>AI Reference Active</Pill>
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <Btn small onClick={() => fileRef.current.click()}>Import .docx / .md</Btn>
          <input ref={fileRef} type="file" accept=".docx,.md,.txt" style={{ display: "none" }} onChange={() => { setImporting(true); setTimeout(() => setImporting(false), 800); }} />
          {["editor", "preview", "voice"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ background: mode === m ? T.accentDim : "none", border: `1px solid ${mode === m ? T.accent : T.border}`, color: mode === m ? T.accent : T.textSub, borderRadius: 4, padding: "4px 9px", fontSize: 10, cursor: "pointer", fontFamily: "inherit" }}>{m}</button>
          ))}
        </div>
      </div>

      {mode === "voice" ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: T.redDim, border: `2px solid ${T.red}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, cursor: "pointer", animation: "pulse 2s infinite" }}>[mic]</div>
          <div style={{ fontSize: 14, color: T.textSub }}>Click to start voice instruction</div>
          <div style={{ fontSize: 12, color: T.textMute }}>Speech will be transcribed and appended to this document</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn small>PowerShell Guide</Btn>
            <Btn small>CLI Reference</Btn>
            <Btn small accent>Start Recording</Btn>
          </div>
        </div>
      ) : mode === "editor" ? (
        <textarea value={content} onChange={e => setContent(e.target.value)} style={{ flex: 1, background: "none", border: "none", outline: "none", padding: "20px 32px", fontSize: 13, color: T.text, fontFamily: "ui-monospace,monospace", lineHeight: 1.8, resize: "none" }} />
      ) : (
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 48px", maxWidth: 720, margin: "0 auto", width: "100%" }}>
          {content.split("\n").map((line, i) => {
            if (line.startsWith("# ")) return <h1 key={i} style={{ fontSize: 26, fontWeight: 800, color: T.text, marginBottom: 12, marginTop: 20, lineHeight: 1.2 }}>{line.slice(2)}</h1>;
            if (line.startsWith("## ")) return <h2 key={i} style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 10, marginTop: 18, borderBottom: `1px solid ${T.border}`, paddingBottom: 8 }}>{line.slice(3)}</h2>;
            if (line.startsWith("### ")) return <h3 key={i} style={{ fontSize: 14, fontWeight: 700, color: T.accent, marginBottom: 6, marginTop: 14 }}>{line.slice(4)}</h3>;
            if (line.startsWith("**") && line.endsWith("**")) return <div key={i} style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4 }}>{line.slice(2, -2)}</div>;
            if (line.startsWith("- ")) return <div key={i} style={{ fontSize: 13, color: T.textSub, lineHeight: 1.7, paddingLeft: 16, marginBottom: 3 }}>. {line.slice(2)}</div>;
            if (line === "") return <div key={i} style={{ height: 6 }} />;
            return <p key={i} style={{ fontSize: 13, color: T.textSub, lineHeight: 1.8, marginBottom: 6 }}>{line}</p>;
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN PANE CONTENT ROUTER
// ============================================================
function PaneContent({ paneId, activeFile, onFileSelect, onJustify, initialTab }) {
  const [paneTab, setPaneTab] = useState(initialTab || (paneId === 0 ? "code" : paneId === 1 ? "ai" : "terminal"));

  useEffect(() => {
    if (paneId === 0 && initialTab) {
      setPaneTab(initialTab);
    }
  }, [initialTab, paneId]);

  const tabs = [
    { id: "code", label: activeFile || "Editor", icon: "[/]", modified: activeFile === "api.ts" || activeFile === "Modal.tsx" },
    { id: "ai", label: "AI Chat", icon: "[*]" },
    { id: "terminal", label: "Terminal", icon: "$" },
    { id: "preview", label: "Preview", icon: "[>]" },
    { id: "extensions", label: "Extensions", icon: "[+]" },
    { id: "docs", label: "Docs/PRD", icon: "[D]" },
    { id: "plan", label: "Plan", icon: "[P]", badge: "!" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <TabBar tabs={tabs} active={paneTab} onSelect={setPaneTab} right={
        <div style={{ display: "flex", gap: 4 }}>
          <button title="Split pane" style={{ background: "none", border: "none", color: T.textMute, cursor: "pointer", fontSize: 12, padding: "2px 5px" }}>|</button>
        </div>
      } />
      <div style={{ flex: 1, overflow: "hidden" }}>
        {paneTab === "code" && <CodePane file={activeFile || "page.tsx"} onJustify={onJustify} />}
        {paneTab === "ai" && <AIPane planStep="3c" />}
        {paneTab === "terminal" && <TerminalPane />}
        {paneTab === "preview" && <PreviewPane />}
        {paneTab === "extensions" && <ExtensionsPanel />}
        {paneTab === "docs" && <DocsPanel />}
        {paneTab === "plan" && <PlanModule />}
      </div>
    </div>
  );
}

// ============================================================
// ROOT IDE
// ============================================================
export default function IdeApp() {
  const [activeFile, setActiveFile] = useState("api.ts");
  const [sidebarTab, setSidebarTab] = useState("files");
  const [primaryTab, setPrimaryTab] = useState("code");
  const [layout, setLayout] = useState("mainSide");
  const [justifierState, setJustifierState] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap";
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch (e) {} };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search || "");
    const tab = params.get("tab");
    const tabMap = {
      code: { pane: "code", sidebar: "files" },
      ai: { pane: "ai", sidebar: "files" },
      terminal: { pane: "terminal", sidebar: "git" },
      preview: { pane: "preview", sidebar: "search" },
      extensions: { pane: "extensions", sidebar: "extensions" },
      docs: { pane: "docs", sidebar: "files" },
      plan: { pane: "plan", sidebar: "plan" },
    };

    if (tab && tabMap[tab]) {
      setPrimaryTab(tabMap[tab].pane);
      setSidebarTab(tabMap[tab].sidebar);
      setSidebarOpen(true);
    }
  }, []);

  const handleJustify = (code, file) => setJustifierState({ code, file });

  const lyt = LAYOUTS[layout];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.bg, color: T.text, fontFamily: "ui-monospace,'Cascadia Code','Source Code Pro',Menlo,Consolas,monospace", fontSize: 13 }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; height: 3px; }
        ::-webkit-scrollbar-thumb { background: ${T.borderHi}; border-radius: 2px; }
        input::placeholder, textarea::placeholder { color: ${T.textMute}; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* TITLE BAR */}
      <div style={{ height: 36, background: T.bgPanel, borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", padding: "0 12px", gap: 12, flexShrink: 0, userSelect: "none" }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}>
          <div style={{ width: 20, height: 20, background: T.accent, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: T.bg }}>R</div>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", fontFamily: "'Syne',sans-serif" }}>REACH IDE</span>
        </div>

        {/* Menu bar */}
        {["File", "Edit", "View", "Run", "Terminal", "Help"].map(m => (
          <button key={m} style={{ background: "none", border: "none", color: T.textSub, cursor: "pointer", fontSize: 11, padding: "2px 7px", fontFamily: "inherit" }}
            onMouseEnter={e => { e.currentTarget.style.background = T.bgHover; e.currentTarget.style.color = T.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.textSub; }}>
            {m}
          </button>
        ))}

        {/* Center: file path */}
        <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: T.textMute }}>
          reach-ide / src / lib / {activeFile}
        </div>

        {/* Layout switcher */}
        <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
          <button
            onClick={() => window.location.assign("/")}
            style={{
              background: "none",
              border: `1px solid ${T.border}`,
              color: T.textSub,
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 10,
              padding: "2px 7px",
              marginRight: 6,
              fontFamily: "inherit",
            }}
          >
            Back to REACH
          </button>
          <span style={{ fontSize: 9, color: T.textMute, marginRight: 4 }}>LAYOUT</span>
          {[
            ["single", "[ ]"],
            ["mainSide", "[| ]"],
            ["sideBySide", "[||]"],
            ["triple", "[|||]"],
            ["quad", "[..]"],
            ["topBottom", "[-]"],
          ].map(([key, icon]) => (
            <button key={key} onClick={() => setLayout(key)} title={key} style={{ background: layout === key ? T.accentDim : "none", border: `1px solid ${layout === key ? T.accent : T.border}`, color: layout === key ? T.accent : T.textMute, borderRadius: 3, padding: "2px 6px", fontSize: 9, cursor: "pointer", fontFamily: "monospace" }}>{icon}</button>
          ))}
        </div>

        {/* Run button */}
        <button style={{ background: T.greenDim, border: `1px solid ${T.green}50`, color: T.green, borderRadius: 5, padding: "3px 12px", fontSize: 10, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, marginLeft: 8 }}>
          Run
        </button>
      </div>

      {/* MAIN AREA */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* ACTIVITY BAR */}
        <div style={{ width: 44, background: T.bgPanel, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 0", gap: 4, flexShrink: 0 }}>
          {[
            ["files", "[/]", "Files"],
            ["search", "[?]", "Search"],
            ["git", "[G]", "Source Control"],
            ["extensions", "[+]", "Extensions"],
            ["plan", "[P]", "Plan"],
          ].map(([id, icon, title]) => (
            <button key={id} onClick={() => { setSidebarTab(id); setSidebarOpen(p => sidebarTab === id ? !p : true); }} title={title} style={{ width: 36, height: 36, background: sidebarTab === id && sidebarOpen ? T.accentDim : "none", border: `1px solid ${sidebarTab === id && sidebarOpen ? T.accent : "transparent"}`, color: sidebarTab === id && sidebarOpen ? T.accent : T.textSub, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
              {icon}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {[["[S]", "Settings"], ["[U]", "Account"]].map(([icon, title]) => (
            <button key={title} title={title} style={{ width: 36, height: 36, background: "none", border: "1px solid transparent", color: T.textMute, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 12 }}>{icon}</button>
          ))}
        </div>

        {/* SIDEBAR PANEL */}
        {sidebarOpen && (
          <div style={{ width: 220, background: T.bgPanel, borderRight: `1px solid ${T.border}`, display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
            <div style={{ padding: "8px 12px 6px", borderBottom: `1px solid ${T.border}`, fontSize: 9, color: T.textMute, letterSpacing: "0.15em" }}>
              {sidebarTab === "files" ? "EXPLORER" : sidebarTab === "extensions" ? "EXTENSIONS" : sidebarTab === "plan" ? "PLAN" : sidebarTab === "git" ? "SOURCE CONTROL" : "SEARCH"}
            </div>

            {sidebarTab === "files" && (
              <div style={{ overflowY: "auto", flex: 1, paddingTop: 4 }}>
                <div style={{ padding: "4px 12px", fontSize: 9, color: T.textMute, letterSpacing: "0.1em", display: "flex", justifyContent: "space-between" }}>
                  <span>REACH-IDE</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["[+]", "[/+]", "[R]"].map(ic => <span key={ic} style={{ cursor: "pointer" }}>{ic}</span>)}
                  </div>
                </div>
                <FileTree files={MOCK_FILES} onSelect={setActiveFile} activeFile={activeFile} />
              </div>
            )}

            {sidebarTab === "git" && (
              <div style={{ overflowY: "auto", flex: 1, padding: 10 }}>
                <div style={{ fontSize: 10, color: T.textSub, marginBottom: 8 }}>3 changes</div>
                {[["M", "src/lib/api.ts", T.yellow], ["M", "src/components/Modal.tsx", T.yellow], ["A", "src/hooks/useSubscription.ts", T.green]].map(([status, file, color]) => (
                  <div key={file} style={{ display: "flex", gap: 8, padding: "5px 8px", fontSize: 11, alignItems: "center", cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.background = T.bgHover}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <span style={{ color, fontWeight: 700, flexShrink: 0, width: 12 }}>{status}</span>
                    <span style={{ color: T.textSub, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.split("/").pop()}</span>
                  </div>
                ))}
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                  <input placeholder="Commit message..." style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 4, padding: "6px 8px", fontSize: 11, color: T.text, fontFamily: "inherit", outline: "none" }} />
                  <Btn small accent>Commit & Push</Btn>
                </div>
              </div>
            )}

            {sidebarTab === "plan" && (
              <div style={{ overflowY: "auto", flex: 1 }}>
                <div style={{ padding: "8px 12px 4px", fontSize: 10, color: T.accent }}>Step 3c: Active</div>
                {PLAN_STEPS.map(s => (
                  <div key={s.id} style={{ padding: "6px 12px", borderBottom: `1px solid ${T.border}`, cursor: "pointer", opacity: s.status === "pending" ? 0.4 : 1 }}
                    onMouseEnter={e => e.currentTarget.style.background = T.bgHover}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <div style={{ fontSize: 10, color: s.status === "done" ? T.green : s.status === "active" ? T.accent : T.textMute }}>{s.phase}</div>
                    <div style={{ fontSize: 12, color: T.text }}>{s.title}</div>
                  </div>
                ))}
              </div>
            )}

            {sidebarTab === "extensions" && <ExtensionsPanel />}

            {sidebarTab === "search" && (
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                <input placeholder="Search in files..." style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 4, padding: "6px 8px", fontSize: 11, color: T.text, fontFamily: "inherit", outline: "none" }} />
                <input placeholder="Replace..." style={{ background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 4, padding: "6px 8px", fontSize: 11, color: T.text, fontFamily: "inherit", outline: "none" }} />
                <div style={{ fontSize: 11, color: T.textMute, padding: "4px 0" }}>3 results in 2 files</div>
                {[["api.ts", "Line 18: await throttle()"], ["api.ts", "Line 24: requestCount++"], ["page.tsx", "Line 11: const { data }"]].map(([file, match]) => (
                  <div key={match} style={{ padding: "6px 8px", background: T.bgSurface, border: `1px solid ${T.border}`, borderRadius: 4, cursor: "pointer" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = T.accent}
                    onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
                    <div style={{ fontSize: 10, color: T.blue, marginBottom: 2 }}>{file}</div>
                    <div style={{ fontSize: 11, color: T.textSub, fontFamily: "monospace" }}>{match}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* EDITOR PANE GRID */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: lyt.cols, gridTemplateRows: lyt.rows, overflow: "hidden" }}>
          {Array.from({ length: lyt.panes }).map((_, i) => (
            <div key={i} style={{ overflow: "hidden", borderRight: i % (lyt.cols.split(" ").length) < lyt.cols.split(" ").length - 1 ? `1px solid ${T.border}` : "none", borderBottom: i < lyt.panes - lyt.cols.split(" ").length ? `1px solid ${T.border}` : "none" }}>
              <PaneContent paneId={i} initialTab={i === 0 ? primaryTab : undefined} activeFile={i === 0 ? activeFile : i === 1 ? "ai" : "terminal"} onFileSelect={setActiveFile} onJustify={handleJustify} />
            </div>
          ))}
        </div>
      </div>

      {/* STATUS BAR */}
      <div style={{ height: 22, background: T.accent, display: "flex", alignItems: "center", padding: "0 12px", gap: 16, fontSize: 10, color: T.bg, flexShrink: 0 }}>
        <span style={{ fontWeight: 700 }}>[G] main</span>
        <span>0 errors 2 warnings</span>
        <span>Step 3c / 50</span>
        <div style={{ flex: 1 }} />
        <span>TypeScript</span>
        <span>UTF-8</span>
        <span>localhost:3000</span>
        <span style={{ fontWeight: 700 }}>REACH IDE v0.1</span>
      </div>

      {/* JUSTIFIER MODAL */}
      {justifierState && (
        <JustifierModal code={justifierState.code} file={justifierState.file} onClose={() => setJustifierState(null)} />
      )}
    </div>
  );
}

