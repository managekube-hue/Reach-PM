import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

const pillars = [
  {
    id: "work",
    label: "WORK",
    sub: "Get things done",
    color: "#47BFFF",
    accent: "#1D8ED6",
    icon: "â¬¡",
    children: [
      { name: "Sprint Board", tag: "Kanban Â· Scrum Â· Hybrid" },
      { name: "My Tasks", tag: "Personal queue" },
      { name: "Backlog", tag: "Groomed Â· Prioritized" },
      { name: "Roadmap", tag: "Now Â· Next Â· Later" },
      { name: "Shape Up", tag: "6-week cycles" },
    ],
  },
  {
    id: "insights",
    label: "INSIGHTS",
    sub: "Understand and improve",
    color: "#47C8FF",
    accent: "#0090C8",
    icon: "â—ˆ",
    children: [
      { name: "Analytics", tag: "EVM Â· Velocity Â· CPI Â· SPI" },
      { name: "Reports", tag: "Cost Â· Progress Â· Cycle time" },
      { name: "Dashboard", tag: "Portfolio health" },
      { name: "Burn-down", tag: "Sprint progress" },
      { name: "Risk Register", tag: "Live risk surface" },
    ],
  },
  {
    id: "structure",
    label: "STRUCTURE",
    sub: "Configure and manage",
    color: "#FF7847",
    accent: "#C84400",
    icon: "â—Ž",
    children: [
      { name: "Projects", tag: "WBS Â· Baseline Â· Budget" },
      { name: "Members", tag: "Roles Â· Permissions Â· Teams" },
      { name: "Clients", tag: "Stakeholders Â· External deps" },
      { name: "Tags", tag: "Taxonomy Â· Labels Â· Types" },
      { name: "Settings", tag: "Cost rates Â· Integrations" },
    ],
  },
];

const issueStages = [
  { id: "born", label: "BORN", detail: "Created in Backlog Â· ID assigned Â· Timestamped", symbol: "â—‰" },
  { id: "refined", label: "REFINED", detail: "Acceptance criteria Â· Story pointed Â· Dependencies", symbol: "â—ˆ" },
  { id: "assigned", label: "ASSIGNED", detail: "Owner selected Â· Appears in My Tasks", symbol: "â—Ž" },
  { id: "started", label: "IN PROGRESS", detail: "WIP count increments Â· Timer starts", symbol: "â–¶" },
  { id: "coded", label: "CODED", detail: "AI generates boilerplate Â· PR created Â· Issue â†” PR linked", symbol: "âŒ¥" },
  { id: "reviewed", label: "REVIEWED", detail: "PR reviewed Â· Changes merged Â· CI passes", symbol: "âœ“" },
  { id: "documented", label: "DOCUMENTED", detail: "AI generates docs Â· Docs linked to issue", symbol: "âŠž" },
  { id: "shipped", label: "SHIPPED", detail: "Deployed Â· Stakeholders notified Â· Analytics updated", symbol: "â¬¡" },
];

const integrations = [
  { label: "Chat", detail: "Drag issue â†’ notify + discuss + update", dir: "â†“" },
  { label: "IDE", detail: "Drag issue â†’ AI boilerplate â†’ PR", dir: "â†“" },
  { label: "Docs", detail: "Drag issue â†’ AI documentation", dir: "â†“" },
  { label: "Boards", detail: "Drag issue â†’ status change â†’ WIP update", dir: "â†“" },
  { label: "Analytics", detail: "Every move â†’ EVM recalculates", dir: "â†“" },
];

export default function LandingApp() {
const [activePillar, setActivePillar] = useState<any>(null);
const [activeStage, setActiveStage] = useState<any>(null);
const [view, setView] = useState("architecture"); // architecture | lifecycle | pillars
  
const navigate = useNavigate();

  return (
    <div style={{
      background: "#0A0A0A",
      minHeight: "100vh",
      fontFamily: "'Space Mono', 'Courier New', monospace",
      color: "#E8E8E0",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        .nav-btn {
          background: transparent;
          border: 1px solid #2A2A2A;
          color: #888;
          padding: 8px 18px;
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.15em;
          cursor: pointer;
          transition: all 0.2s;
          text-transform: uppercase;
        }
        .nav-btn:hover { border-color: #555; color: #E8E8E0; }
        .nav-btn.active { border-color: #47BFFF; color: #47BFFF; background: rgba(71,191,255,0.08); }

        .pillar-card {
          background: #111;
          border: 1px solid #1E1E1E;
          border-radius: 4px;
          padding: 28px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }
        .pillar-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: var(--accent);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.3s ease;
        }
        .pillar-card:hover::before, .pillar-card.active::before { transform: scaleX(1); }
        .pillar-card:hover { border-color: #333; background: #141414; transform: translateY(-2px); }
        .pillar-card.active { border-color: #333; background: #141414; transform: translateY(-2px); }

        .child-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #1A1A1A;
          font-size: 13px;
          animation: fadeIn 0.3s ease forwards;
          opacity: 0;
        }
        .child-item:last-child { border-bottom: none; }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .stage-node {
          display: flex;
          align-items: flex-start;
          gap: 16px;
          padding: 14px 0;
          cursor: pointer;
          transition: all 0.2s;
          border-left: 2px solid transparent;
          padding-left: 16px;
          margin-left: -16px;
        }
        .stage-node:hover { border-left-color: #47BFFF; }
        .stage-node.active { border-left-color: #47BFFF; }

        .stage-line {
          position: absolute;
          left: 27px;
          top: 0;
          bottom: 0;
          width: 1px;
          background: linear-gradient(to bottom, transparent, #2A2A2A 10%, #2A2A2A 90%, transparent);
        }

        .integration-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #111;
          border: 1px solid #1E1E1E;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .integration-row:hover { border-color: #2A2A2A; background: #141414; }

        .issue-core {
          background: #111;
          border: 1px solid #2A2A2A;
          border-radius: 6px;
          padding: 24px;
          position: relative;
        }

        .metric-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #161616;
          border: 1px solid #222;
          border-radius: 3px;
          padding: 5px 10px;
          font-size: 11px;
          color: #888;
          margin: 4px;
          font-family: 'Space Mono', monospace;
        }

        .glow-text {
          text-shadow: 0 0 30px currentColor;
        }

        .pulse {
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .grid-bg {
          background-image: 
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 32px 32px;
        }

        .tag-pill {
          font-size: 10px;
          padding: 3px 8px;
          border-radius: 2px;
          background: rgba(255,255,255,0.05);
          color: #666;
          letter-spacing: 0.05em;
          font-family: 'Space Mono', monospace;
        }

        .section-label {
          font-size: 10px;
          letter-spacing: 0.2em;
          color: #444;
          text-transform: uppercase;
          margin-bottom: 16px;
          font-family: 'Space Mono', monospace;
        }

        scrollbar-width: thin;
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #333; }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #1A1A1A",
        padding: "0 40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
        background: "#0A0A0A",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 28, height: 28,
            background: "#47BFFF",
            borderRadius: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 14, color: "#0A0A0A", fontWeight: 700 }}>R</span>
          </div>
          <span style={{
            fontFamily: "'Syne', sans-serif",
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: "0.05em",
          }}>REACH</span>
          <span style={{ color: "#333", fontSize: 20, margin: "0 4px" }}>|</span>
          <span style={{ fontSize: 11, color: "#555", letterSpacing: "0.1em" }}>PLATFORM ARCHITECTURE</span>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          {[
            { id: "architecture", label: "Architecture" },
            { id: "lifecycle", label: "Issue Lifecycle" },
            { id: "pillars", label: "Pillars" },
          ].map(v => (
            <button
              key={v.id}
              className={`nav-btn ${view === v.id ? "active" : ""}`}
              onClick={() => setView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>

          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {["WORK", "INSIGHTS", "STRUCTURE"].map((p, i) => (
              <span key={p} className="metric-chip" style={{ color: ["#47BFFF","#47C8FF","#FF7847"][i] }}>
                {p}
              </span>
            ))}
            <button 
              onClick={() => navigate('/auth')} 
              style={{ marginLeft: 16, background: "#47BFFF", color: "#0A0A0A", border: "none", padding: "6px 16px", borderRadius: 4, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "'Space Mono', monospace" }}
            >
              Sign In / Up &rarr;
            </button>
          </div>
        </div>

      {/* ARCHITECTURE VIEW */}
      {view === "architecture" && (
        <div className="grid-bg" style={{ padding: "48px 40px", minHeight: "calc(100vh - 56px)" }}>
          {/* Hero statement */}
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.3em", color: "#444", marginBottom: 16, fontFamily: "Space Mono" }}>
              THE ATOMIC UNIT OF DEVELOPMENT
            </div>
            <h1 style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: "clamp(42px, 6vw, 72px)",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1,
              color: "#E8E8E0",
              marginBottom: 12,
            }}>
              Everything begins with<br />
              <span style={{ color: "#47BFFF" }} className="glow-text">a single issue.</span>
            </h1>
            <p style={{ color: "#555", fontSize: 15, maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
              From user problem to production shipped â€” one object, infinite surface area. 
              Built for developers who speak in issues, not tickets.
            </p>
          </div>

          {/* Central Issue Object */}
          <div style={{ maxWidth: 900, margin: "0 auto 64px", position: "relative" }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div className="section-label">THE ISSUE OBJECT</div>
            </div>
            
            <div className="issue-core">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 11, color: "#47BFFF", letterSpacing: "0.1em", marginBottom: 6 }}>K-COR-001</div>
                  <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700 }}>
                    API client code generation
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="tag-pill" style={{ color: "#47C8FF", background: "rgba(71,200,255,0.08)" }}>IN PROGRESS</span>
                  <span className="tag-pill">5 pts</span>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 0, borderTop: "1px solid #1A1A1A", paddingTop: 16 }}>
                {[
                  ["Assignee", "@sarah"],
                  ["Sprint", "Sprint 12"],
                  ["Files", "src/auth/Login.tsx +2"],
                  ["PR", "#42 Â· CI: Passing"],
                  ["Time", "2h 14m tracked"],
                  ["EV", "$840 / $1,200 BAC"],
                ].map(([k, v]) => (
                  <div key={k} style={{ width: "33.33%", padding: "10px 0", borderBottom: "1px solid #1A1A1A" }}>
                    <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", marginBottom: 4 }}>{k}</div>
                    <div style={{ fontSize: 13, color: "#C8C8C0" }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #1A1A1A" }}>
                <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", marginBottom: 10 }}>SURFACES IT LIVES IN</div>
                <div style={{ display: "flex", flexWrap: "wrap" }}>
                  {integrations.map(int => (
                    <div key={int.label} className="metric-chip" style={{ margin: 4 }}>
                      <span style={{ color: "#47BFFF" }}>â¬¡</span>
                      <span style={{ color: "#C8C8C0" }}>{int.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Three Pillars */}
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 32 }}>
              <div className="section-label">THE THREE PARENT PILLARS</div>
              <p style={{ fontSize: 13, color: "#555" }}>Everything is a child of one of these. No exceptions.</p>
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              {pillars.map((p) => (
                <div
                  key={p.id}
                  className={`pillar-card ${activePillar === p.id ? "active" : ""}`}
                  style={{ "--accent": p.color }}
                  onClick={() => setActivePillar(activePillar === p.id ? null : p.id)}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                    <div>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>{p.icon}</div>
                      <div style={{
                        fontFamily: "'Syne', sans-serif",
                        fontWeight: 800,
                        fontSize: 22,
                        color: p.color,
                        letterSpacing: "0.02em",
                      }}>{p.label}</div>
                      <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>"{p.sub}"</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#333" }}>{activePillar === p.id ? "â–²" : "â–¼"}</div>
                  </div>

                  {activePillar === p.id && (
                    <div style={{ borderTop: "1px solid #1E1E1E", paddingTop: 16 }}>
                      {p.children.map((c, ci) => (
                        <div key={c.name} className="child-item" style={{ animationDelay: `${ci * 50}ms` }}>
                          <span style={{ fontSize: 13, color: "#C8C8C0" }}>{c.name}</span>
                          <span className="tag-pill">{c.tag}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {activePillar !== p.id && (
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {p.children.map(c => (
                        <span key={c.name} style={{ fontSize: 11, color: "#444", marginRight: 8 }}>{c.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom differentiation */}
          <div style={{ maxWidth: 900, margin: "48px auto 0", borderTop: "1px solid #1A1A1A", paddingTop: 40 }}>
            <div className="section-label" style={{ textAlign: "center", marginBottom: 28 }}>WHY THIS BEATS LINEAR</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, background: "#1A1A1A" }}>
              {[
                { label: "Linear", sub: "Fast row", note: "Static issue. No integration story." },
                { label: "Jira", sub: "Enterprise bolt-ons", note: "Complex but fragmented." },
                { label: "GitHub", sub: "PR-centric", note: "Code first, PM second." },
                { label: "REACH", sub: "Living entity", note: "Issue IS the integration hub.", accent: "#47BFFF" },
              ].map(c => (
                <div key={c.label} style={{
                  background: "#0A0A0A",
                  padding: 24,
                  borderTop: c.accent ? `2px solid ${c.accent}` : "2px solid transparent",
                }}>
                  <div style={{
                    fontFamily: "'Syne', sans-serif",
                    fontSize: 16,
                    fontWeight: 700,
                    color: c.accent || "#444",
                    marginBottom: 6,
                  }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: "#555", marginBottom: 8 }}>{c.sub}</div>
                  <div style={{ fontSize: 12, color: c.accent ? "#888" : "#333", lineHeight: 1.5 }}>{c.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LIFECYCLE VIEW */}
      {view === "lifecycle" && (
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", minHeight: "calc(100vh - 56px)" }}>
          {/* Stage list */}
          <div style={{ borderRight: "1px solid #1A1A1A", padding: "40px 32px", overflowY: "auto", position: "relative" }}>
            <div className="section-label">ISSUE LIFECYCLE</div>
            <p style={{ fontSize: 12, color: "#444", marginBottom: 32, lineHeight: 1.6 }}>
              Every issue follows a path from idea to archived artifact. Click a stage to explore.
            </p>
            <div style={{ position: "relative", paddingLeft: 16 }}>
              <div className="stage-line" />
              {issueStages.map((stage, i) => (
                <div
                  key={stage.id}
                  className={`stage-node ${activeStage === stage.id ? "active" : ""}`}
                  onClick={() => setActiveStage(activeStage === stage.id ? null : stage.id)}
                >
                  <div style={{
                    width: 32, height: 32,
                    borderRadius: "50%",
                    background: activeStage === stage.id ? "#47BFFF" : "#111",
                    border: `1px solid ${activeStage === stage.id ? "#47BFFF" : "#2A2A2A"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14,
                    color: activeStage === stage.id ? "#0A0A0A" : "#555",
                    flexShrink: 0,
                    zIndex: 1,
                    transition: "all 0.2s",
                  }}>{stage.symbol}</div>
                  <div>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      color: activeStage === stage.id ? "#47BFFF" : "#888",
                      marginBottom: 4,
                      transition: "color 0.2s",
                    }}>{stage.label}</div>
                    <div style={{ fontSize: 11, color: "#444", lineHeight: 1.5 }}>{stage.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stage detail panel */}
          <div className="grid-bg" style={{ padding: "40px 48px" }}>
            {!activeStage && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
                <div style={{ fontSize: 48, opacity: 0.15 }}>â¬¡</div>
                <div style={{ fontSize: 13, color: "#444", textAlign: "center" }}>
                  Select a stage to see what happens<br />to the issue at that moment.
                </div>
              </div>
            )}

            {activeStage && (() => {
              const stage = issueStages.find(s => s.id === activeStage);
              const stageDetails = {
                born: {
                  triggers: ["Backlog item created", "Auto-ID generated (K-COR-NNN)", "Creator recorded", "Timestamp set"],
                  notifications: ["Reporter", "Project lead (if configured)"],
                  updates: ["Backlog count", "Project issue count"],
                  pillars: ["STRUCTURE", "WORK"],
                },
                refined: {
                  triggers: ["Acceptance criteria written", "Story points estimated", "Tags applied", "Dependencies linked"],
                  notifications: ["Assignee (if set)", "Team members watching"],
                  updates: ["Sprint capacity", "Velocity forecast"],
                  pillars: ["WORK", "INSIGHTS"],
                },
                assigned: {
                  triggers: ["Owner selected from Members", "Appears in My Tasks", "Team notified"],
                  notifications: ["Assignee: 'You have a new issue'", "Reporter: 'Work assigned'"],
                  updates: ["Member workload", "Team capacity view"],
                  pillars: ["WORK", "STRUCTURE"],
                },
                started: {
                  triggers: ["Drag to In Progress", "WIP counter increments", "Timer auto-starts", "Board recolors if WIP limit hit"],
                  notifications: ["PM: velocity tracking active", "Stakeholders (if configured)"],
                  updates: ["Cycle time clock starts", "EVM: AC begins accumulating", "Sprint burn-down"],
                  pillars: ["WORK", "INSIGHTS"],
                },
                coded: {
                  triggers: ["Drag issue â†’ IDE", "AI generates boilerplate from description", "Code written", "PR created & linked"],
                  notifications: ["PR reviewers notified", "Code owners alerted", "CI/CD triggered", "#pr-reviews channel"],
                  updates: ["Issue shows linked PR", "Code & PRs module", "File change log"],
                  pillars: ["WORK"],
                },
                reviewed: {
                  triggers: ["PR review requested", "Comments added", "Changes requested / Approved", "CI passes", "Merge"],
                  notifications: ["All reviewers", "Author", "Downstream team"],
                  updates: ["Issue moves to verification", "Code merged", "PR closed"],
                  pillars: ["WORK", "INSIGHTS"],
                },
                documented: {
                  triggers: ["Drag issue â†’ Docs", "AI generates from issue + PR diff", "Docs published & linked"],
                  notifications: ["Doc owners", "Stakeholders subscribed to feature"],
                  updates: ["Issue shows Docs artifact", "Documentation index"],
                  pillars: ["WORK", "STRUCTURE"],
                },
                shipped: {
                  triggers: ["Deployed to production", "Verification complete", "Status â†’ DONE", "Timer stops", "All artifacts finalized"],
                  notifications: ["All stakeholders", "Reporter: 'âœ… Your feature is live'", "Team: 'ðŸŽ‰ Shipped'"],
                  updates: ["Velocity +points", "Cycle time average", "Throughput", "Member contributions", "EVM: EV updated", "Audit log finalized"],
                  pillars: ["WORK", "INSIGHTS", "STRUCTURE"],
                },
              };
              const detail = stageDetails[activeStage] || {};
              return (
                <div>
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                      <div style={{
                        width: 48, height: 48,
                        background: "#47BFFF",
                        borderRadius: 6,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 22, color: "#0A0A0A",
                      }}>{stage.symbol}</div>
                      <div>
                        <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: "-0.01em" }}>{stage.label}</div>
                        <div style={{ fontSize: 12, color: "#555" }}>{stage.detail}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {detail.pillars?.map(p => {
                        const pData = pillars.find(pl => pl.label === p);
                        return (
                          <span key={p} className="metric-chip" style={{ color: pData?.color }}>
                            {pData?.icon} {p}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                    {[
                      { heading: "TRIGGERS", items: detail.triggers, color: "#47BFFF" },
                      { heading: "NOTIFICATIONS", items: detail.notifications, color: "#47C8FF" },
                      { heading: "UPDATES", items: detail.updates, color: "#FF7847" },
                    ].map(section => (
                      <div key={section.heading} style={{
                        background: "#111",
                        border: "1px solid #1A1A1A",
                        borderTop: `2px solid ${section.color}`,
                        borderRadius: 4,
                        padding: 20,
                      }}>
                        <div style={{ fontSize: 10, letterSpacing: "0.2em", color: section.color, marginBottom: 14 }}>{section.heading}</div>
                        {section.items?.map((item, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "flex-start" }}>
                            <span style={{ color: section.color, marginTop: 2, flexShrink: 0, fontSize: 12 }}>â–¸</span>
                            <span style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>{item}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 24, padding: 20, background: "#111", border: "1px solid #1A1A1A", borderRadius: 4 }}>
                    <div className="section-label">INTEGRATION SURFACE AT THIS STAGE</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {integrations.map(int => (
                        <div key={int.label} style={{
                          background: "#161616",
                          border: "1px solid #222",
                          borderRadius: 3,
                          padding: "8px 14px",
                          fontSize: 12,
                        }}>
                          <div style={{ color: "#C8C8C0", marginBottom: 3 }}>{int.label}</div>
                          <div style={{ fontSize: 11, color: "#444" }}>{int.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* PILLARS VIEW */}
      {view === "pillars" && (
        <div style={{ padding: "48px 40px", minHeight: "calc(100vh - 56px)" }} className="grid-bg">
          <div style={{ maxWidth: 1000, margin: "0 auto" }}>
            <div style={{ textAlign: "center", marginBottom: 56 }}>
              <div className="section-label">INFORMATION ARCHITECTURE</div>
              <h2 style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: 42,
                fontWeight: 800,
                letterSpacing: "-0.02em",
              }}>Three pillars. No orphaned features.</h2>
              <p style={{ color: "#555", fontSize: 14, marginTop: 12 }}>
                Every UI element maps to exactly one pillar. Industry language, developer instinct.
              </p>
            </div>

            {pillars.map((pillar, pi) => (
              <div key={pillar.id} style={{ marginBottom: 48 }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  marginBottom: 24,
                  paddingBottom: 20,
                  borderBottom: `1px solid ${pillar.color}22`,
                }}>
                  <div style={{
                    width: 56, height: 56,
                    background: `${pillar.color}14`,
                    border: `1px solid ${pillar.color}44`,
                    borderRadius: 6,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 26, color: pillar.color,
                  }}>{pillar.icon}</div>
                  <div>
                    <div style={{
                      fontFamily: "'Syne', sans-serif",
                      fontWeight: 800,
                      fontSize: 32,
                      color: pillar.color,
                      letterSpacing: "0.01em",
                      lineHeight: 1,
                    }}>{pillar.label}</div>
                    <div style={{ fontSize: 14, color: "#555", marginTop: 4 }}>"{pillar.sub}"</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
                  {pillar.children.map((child, ci) => (
                    <div key={child.name} style={{
                      background: "#111",
                      border: "1px solid #1A1A1A",
                      borderRadius: 4,
                      padding: 20,
                      borderTop: `2px solid ${pillar.color}`,
                      transition: "all 0.2s",
                    }}>
                      <div style={{
                        fontFamily: "'Syne', sans-serif",
                        fontSize: 15,
                        fontWeight: 700,
                        marginBottom: 8,
                        color: "#C8C8C0",
                      }}>{child.name}</div>
                      <div style={{ fontSize: 11, color: "#444", lineHeight: 1.5 }}>{child.tag}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* The principle */}
            <div style={{
              marginTop: 16,
              padding: 32,
              background: "#111",
              border: "1px solid #1A1A1A",
              borderRadius: 4,
              display: "grid",
              gridTemplateColumns: "1fr 2px 1fr",
              gap: 32,
              alignItems: "center",
            }}>
              <div>
                <div className="section-label">THE PRINCIPLE</div>
                <p style={{ fontSize: 14, color: "#888", lineHeight: 1.8 }}>
                  Linear wins on speed. Jira wins on enterprise breadth. GitHub wins on native code.
                  <br /><br />
                  REACH wins on <strong style={{ color: "#47BFFF" }}>meaning</strong> â€” every action is anchored to an issue, 
                  every issue is anchored to a pillar, every pillar is anchored to developer language.
                </p>
              </div>
              <div style={{ background: "#1A1A1A", height: "100%" }} />
              <div>
                <div className="section-label">THE NICHE</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    ["Not AI alone", "AI is a surface, not the product"],
                    ["Not tickets", "Issues are living entities"],
                    ["Not methodology-first", "Agile Â· Scrum Â· Shape Up Â· Kanban Â· Waterfall â€” all native"],
                    ["Developer vocabulary", "EVM, CPI, CPM, WIP, AON â€” real terms"],
                  ].map(([bold, rest]) => (
                    <div key={bold} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <span style={{ color: "#47BFFF", flexShrink: 0, marginTop: 1 }}>â–¸</span>
                      <span style={{ fontSize: 13, color: "#888" }}>
                        <strong style={{ color: "#C8C8C0" }}>{bold}</strong> â€” {rest}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


