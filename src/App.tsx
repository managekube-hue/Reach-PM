import { useState, useEffect, useRef } from "react";
import IdeApp from "./components/views/IDEView";
import { useWebRTC } from "./hooks/useWebRTC";
import { useReachStore } from "./store/useReachStore";
import { supabase } from "./lib/supabase";

function VideoPlayer({ stream, muted = false, style, ...props }: any) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  return <video ref={videoRef} autoPlay playsInline muted={muted} style={{ width: "100%", height: "100%", objectFit: "cover", ...style }} {...props} />;
}

// ============================================================
// THEME SYSTEM
// ============================================================
const THEMES = {
  dark: {
    bg: "#07070A", bgSecondary: "#0E0E12", bgTertiary: "#141418",
    bgHover: "#1A1A20", border: "#1E1E28", borderStrong: "#2A2A38",
    text: "#E8E8E2", textSecondary: "#8080A0", textMuted: "#404058",
    accent: "#47BFFF", accentDim: "rgba(71,191,255,0.12)", accentText: "#47BFFF",
    blue: "#47BFFF", orange: "#FF7040", red: "#FF4040", green: "#40FF90",
    purple: "#A060FF", yellow: "#FFD040",
    shadow: "0 2px 8px rgba(0,0,0,0.6)", shadowLg: "0 16px 48px rgba(0,0,0,0.7)",
  },
  light: {
    bg: "#F2F2EE", bgSecondary: "#FFFFFF", bgTertiary: "#EAEAE6",
    bgHover: "#E4E4E0", border: "#D8D8D2", borderStrong: "#C0C0BA",
    text: "#16161A", textSecondary: "#505060", textMuted: "#909098",
    accent: "#0060A8", accentDim: "rgba(0,96,168,0.10)", accentText: "#0060A8",
    blue: "#0060A8", orange: "#B83000", red: "#B82000", green: "#006828",
    purple: "#6020C0", yellow: "#806000",
    shadow: "0 2px 8px rgba(0,0,0,0.08)", shadowLg: "0 16px 48px rgba(0,0,0,0.14)",
  },
};

// ============================================================
// DATA
// ============================================================
const ISSUES = [
  { id:"RC-001", title:"API client code generation with retry logic", status:"in_progress", priority:"high", points:5, assignee:"SL", project:"Core", tags:["backend","api"], pr:"#42", time:"2h 14m", pillar:"work", files:["src/api/client.ts","src/api/retry.ts"] },
  { id:"RC-002", title:"Auth redirect after Google OAuth flow", status:"review", priority:"high", points:3, assignee:"MK", project:"Core", tags:["auth","bug"], pr:"#38", time:"4h 02m", pillar:"work", files:["src/auth/Login.tsx","src/lib/supabase.ts"] },
  { id:"RC-003", title:"Kanban WIP limit enforcement UI", status:"todo", priority:"medium", points:8, assignee:"JP", project:"Platform", tags:["frontend"], pr:null, time:"0m", pillar:"work", files:[] },
  { id:"RC-004", title:"EVM cost performance index dashboard", status:"todo", priority:"medium", points:13, assignee:"AL", project:"Analytics", tags:["analytics","evm"], pr:null, time:"0m", pillar:"insights", files:[] },
  { id:"RC-005", title:"Real-time presence cursors in editor", status:"done", priority:"low", points:5, assignee:"SL", project:"IDE", tags:["realtime","collab"], pr:"#35", time:"6h 30m", pillar:"work", files:["src/ide/Editor.tsx"] },
  { id:"RC-006", title:"Sprint burn-down chart auto-generation", status:"in_progress", priority:"high", points:8, assignee:"MK", project:"Analytics", tags:["analytics","sprint"], pr:"#44", time:"1h 48m", pillar:"insights", files:["src/analytics/Burndown.tsx"] },
  { id:"RC-007", title:"Role-based permission matrix for projects", status:"todo", priority:"medium", points:5, assignee:"JP", project:"Platform", tags:["permissions"], pr:null, time:"0m", pillar:"structure", files:[] },
  { id:"RC-008", title:"Drag-and-drop issue -> chat channel binding", status:"todo", priority:"high", points:13, assignee:null, project:"Core", tags:["dnd","chat"], pr:null, time:"0m", pillar:"work", files:[] },
];

const MEMBERS = [
  { id:"SL", name:"Sarah L.", role:"Frontend Eng", status:"active", color:"#47BFFF" },
  { id:"MK", name:"Marcus K.", role:"Backend Eng", status:"active", color:"#FF7040" },
  { id:"JP", name:"Jordan P.", role:"Full Stack", status:"away", color:"#C8FF00" },
  { id:"AL", name:"Alex L.", role:"PM", status:"active", color:"#FF47C0" },
];

const CHANNELS = [
  { id:"general", name:"general", unread:2 },
  { id:"engineering", name:"engineering", unread:0 },
  { id:"done", name:"done", unread:4 },
  { id:"handoffs", name:"handoffs", unread:1 },
  { id:"bugs", name:"bugs", unread:7 },
  { id:"pr-reviews", name:"pr-reviews", unread:0 },
];

const STATUS = { todo:{label:"Todo",color:"#404058"}, in_progress:{label:"In Progress",color:"#47BFFF"}, review:{label:"Review",color:"#C8FF00"}, done:{label:"Done",color:"#40FF90"} };
const PRIORITY = { high:{label:"High",sym:"^^",color:"#FF4040"}, medium:{label:"Med",sym:"^",color:"#FFD040"}, low:{label:"Low",sym:"v",color:"#404058"} };

const NAV = [
  { pillar:"WORK", pillarKey:"accent", items:[
    { id:"home", label:"Home", icon:"~" },
    { id:"board", label:"Sprint Board", icon:"#" },
    { id:"backlog", label:"Backlog", icon:"=" },
    { id:"mytasks", label:"My Tasks", icon:"o" },
    { id:"roadmap", label:"Roadmap", icon:">" },
    { id:"ide", label:"Code & PRs", icon:"/", badge:3 },
    { id:"ideapp", label:"IDE", icon:"[/]" },
    { id:"docs", label:"Docs", icon:"[]" },
    { id:"chat", label:"Chat", icon:"*", badge:14 },
    { id:"standup", label:"Standups", icon:"o", badge:1 },
  ]},
  { pillar:"INSIGHTS", pillarKey:"blue", items:[
    { id:"dashboard", label:"Dashboard", icon:"@" },
    { id:"analytics", label:"Analytics", icon:"~" },
    { id:"reports", label:"Reports", icon:"$" },
  ]},
  { pillar:"STRUCTURE", pillarKey:"orange", items:[
    { id:"projects", label:"Projects", icon:"#" },
    { id:"members", label:"Members", icon:"o" },
    { id:"clients", label:"Clients", icon:"x" },
    { id:"settings", label:"Settings", icon:"%" },
  ]},
];

// ============================================================
// MICRO COMPONENTS
// ============================================================
function Avatar({ id, size=28, color }: any) {
  const m = MEMBERS.find(m=>m.id===id);
  const bg = m?.color || color || "#505060";
  return <div style={{ width:size,height:size,borderRadius:"50%",background:bg+"28",border:`1.5px solid ${bg}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.37,fontWeight:700,color:bg,flexShrink:0,fontFamily:"inherit" }}>{id?.slice(0,2)}</div>;
}

function Dot({ status }) {
  const c = {active:"#40FF90",away:"#FFD040",offline:"#404058"}[status]||"#404058";
  return <div style={{ width:7,height:7,borderRadius:"50%",background:c,boxShadow:status==="active"?`0 0 5px ${c}`:"none" }} />;
}

function Tag({ label, color, t }: any) {
  return <span style={{ fontSize:10,padding:"2px 7px",background:color?color+"18":t.bgTertiary,color:color||t.textMuted,borderRadius:3,letterSpacing:"0.04em",border:`1px solid ${color?color+"30":t.border}` }}>{label}</span>;
}

function Btn({ children, accent, t, onClick, small }: any) {
  return <button onClick={onClick} style={{ background:accent?t.accentDim:"none",border:`1px solid ${accent?t.accent:t.border}`,color:accent?t.accentText:t.textSecondary,borderRadius:5,padding:small?"4px 10px":"7px 14px",fontSize:small?10:12,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.05em",fontWeight:accent?700:400,transition:"all 0.15s",whiteSpace:"nowrap" }}>{children}</button>;
}

function SectionLabel({ children, t, style }: any) {
  return <div style={{ fontSize:9,letterSpacing:"0.2em",color:t.textMuted,textTransform:"uppercase",marginBottom:10,fontFamily:"inherit" }}>{children}</div>;
}

function Card({ children, t, style={} }: any) {
  return <div style={{ background:t.bgSecondary,border:`1px solid ${t.border}`,borderRadius:8,padding:20,...style }}>{children}</div>;
}

function KPICard({ label, value, sub, trend, up, t }) {
  return (
    <Card t={t}>
      <SectionLabel t={t}>{label}</SectionLabel>
      <div style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:32,color:t.text,lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:11,color:t.textMuted,marginTop:4 }}>{sub}</div>
      <div style={{ fontSize:11,color:up?t.green:t.red,marginTop:6 }}>{trend}</div>
    </Card>
  );
}

function IssuePill({ issue, t, onClick, draggable, onDragStart }: any) {
  return (
    <div
      draggable={draggable} onDragStart={onDragStart} onClick={onClick}
      style={{ background:t.bgSecondary,border:`1px solid ${t.border}`,borderRadius:7,padding:"11px 14px",cursor:draggable?"grab":"pointer",transition:"all 0.15s",userSelect:"none" }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=t.borderStrong;e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=t.shadow;}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="none";}}
    >
      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:6 }}>
        <span style={{ fontSize:10,color:t.accent,letterSpacing:"0.08em" }}>{issue.id}</span>
        <div style={{ display:"flex",gap:6 }}>
          <span style={{ fontSize:10,color:PRIORITY[issue.priority].color }}>{PRIORITY[issue.priority].sym}</span>
          <span style={{ fontSize:10,color:t.textMuted }}>{issue.points}pt</span>
        </div>
      </div>
      <div style={{ fontSize:13,color:t.text,lineHeight:1.4,marginBottom:8 }}>{issue.title}</div>
      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div style={{ display:"flex",gap:4 }}>
          {issue.tags.slice(0,2).map(tag=><Tag key={tag} label={tag} t={t}/>)}
        </div>
        <div style={{ display:"flex",gap:6,alignItems:"center" }}>
          {issue.pr&&<span style={{ fontSize:10,color:t.blue }}>{issue.pr}</span>}
          {issue.assignee&&<Avatar id={issue.assignee} size={20}/>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MINI CHART COMPONENTS
// ============================================================
function SparkLine({ data, color, width=80, height=32 }) {
  if(!data||data.length<2) return null;
  const max=Math.max(...data), min=Math.min(...data);
  const range=max-min||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*width},${height-((v-min)/range*(height-4)+2)}`).join(" ");
  return <svg width={width} height={height}><polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

function BarChart({ data, color, t, width=200, height=60 }) {
  const max=Math.max(...data.map(d=>d.v))||1;
  const bw=Math.floor(width/data.length)-4;
  return (
    <svg width={width} height={height+20}>
      {data.map((d,i)=>{
        const bh=Math.max(2,(d.v/max)*(height-8));
        return (
          <g key={i}>
            <rect x={i*(bw+4)} y={height-bh} width={bw} height={bh} fill={color} rx={2} opacity={0.85}/>
            <text x={i*(bw+4)+bw/2} y={height+14} textAnchor="middle" fontSize={9} fill={t.textMuted} fontFamily="inherit">{d.l}</text>
          </g>
        );
      })}
    </svg>
  );
}

function DonutChart({ segments, size=80 }) {
  let offset=0;
  const r=30, cx=40, cy=40, circ=2*Math.PI*r;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1E1E28" strokeWidth="12"/>
      {segments.map((s,i)=>{
        const dash=s.pct/100*circ;
        const el=<circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="12" strokeDasharray={`${dash} ${circ-dash}`} strokeDashoffset={-offset*circ/100+circ/4} strokeLinecap="round"/>;
        offset+=s.pct;
        return el;
      })}
    </svg>
  );
}

// ============================================================
// MODULE: LANDING / HOME
// ============================================================
function Home({ t, setModule }) {
  const done=ISSUES.filter(i=>i.status==="done").length;
  const inProg=ISSUES.filter(i=>i.status==="in_progress").length;
  const pct=Math.round(done/ISSUES.length*100);

  return (
    <div style={{ padding:"32px 40px",overflowY:"auto",height:"100%" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      
      {/* Hero */}
      <div style={{ marginBottom:40,animation:"fadeUp 0.4s ease both" }}>
        <div style={{ fontSize:10,color:t.textMuted,letterSpacing:"0.2em",marginBottom:6 }}>MONDAY, MARCH 10 . SPRINT 12</div>
        <h1 style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:"clamp(28px,4vw,42px)",color:t.text,lineHeight:1.1,marginBottom:8 }}>
          Good morning, <span style={{ color:t.accent }}>Alex.</span>
        </h1>
        <p style={{ fontSize:14,color:t.textSecondary,lineHeight:1.7,maxWidth:500 }}>
          You have <strong style={{ color:t.text }}>3 issues in progress</strong>, 1 standup in 20 minutes, and 2 PRs waiting for your review.
        </p>
      </div>

      {/* Quick actions */}
      <div style={{ display:"flex",gap:10,marginBottom:36,flexWrap:"wrap",animation:"fadeUp 0.4s 0.05s ease both",opacity:0 }}>
        {[
          { label:"+ New Issue", key:"board", accent:true },
          { label:"[B] Sprint Board", key:"board" },
          { label:"[/] Code & PRs", key:"ide" },
          { label:"[o] Join Standup", key:"standup", special:"#FF4040" },
          { label:"[D] Open Docs", key:"docs" },
        ].map(a=>(
          <button key={a.key+a.label} onClick={()=>setModule(a.key)} style={{
            background:a.accent?t.accentDim:a.special?a.special+"18":"none",
            border:`1px solid ${a.accent?t.accent:a.special||t.border}`,
            color:a.accent?t.accentText:a.special||t.textSecondary,
            borderRadius:6,padding:"8px 16px",fontSize:12,cursor:"pointer",
            fontFamily:"inherit",fontWeight:a.accent||a.special?700:400,
            letterSpacing:"0.05em",
          }}>{a.label}</button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:16 }}>
        {/* Sprint progress */}
        <Card t={t} style={{ animation:"fadeUp 0.4s 0.1s ease both",opacity:0 }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20 }}>
            <div>
              <SectionLabel t={t}>SPRINT 12 PROGRESS</SectionLabel>
              <div style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:28,color:t.text }}>{pct}%</div>
              <div style={{ fontSize:12,color:t.textMuted }}>6 days remaining . {done} of {ISSUES.length} done</div>
            </div>
            <DonutChart size={72} segments={[
              { pct:pct, color:t.accent },
              { pct:Math.round(inProg/ISSUES.length*100), color:t.blue },
              { pct:100-pct-Math.round(inProg/ISSUES.length*100), color:t.border },
            ]}/>
          </div>
          {/* Progress bar per column */}
          {Object.entries(STATUS).map(([key,meta])=>{
            const cnt=ISSUES.filter(i=>i.status===key).length;
            const p=Math.round(cnt/ISSUES.length*100);
            return (
              <div key={key} style={{ marginBottom:10 }}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ fontSize:12,color:t.text }}>{meta.label}</span>
                  <span style={{ fontSize:11,color:t.textMuted }}>{cnt}</span>
                </div>
                <div style={{ height:3,background:t.bgTertiary,borderRadius:2,overflow:"hidden" }}>
                  <div style={{ width:`${p}%`,height:"100%",background:meta.color,borderRadius:2,transition:"width 0.8s ease" }}/>
                </div>
              </div>
            );
          })}
        </Card>

        {/* Right column */}
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          {/* Standup alert */}
          <div style={{ background:t.red+"12",border:`1px solid ${t.red}40`,borderRadius:8,padding:16,animation:"fadeUp 0.4s 0.12s ease both",opacity:0 }}>
            <div style={{ fontSize:10,color:t.red,letterSpacing:"0.12em",marginBottom:4 }}>STANDUP IN 20 MIN</div>
            <div style={{ fontSize:14,fontWeight:700,color:t.text,marginBottom:8 }}>Daily . Eng Team</div>
            <div style={{ display:"flex",marginBottom:10 }}>
              {MEMBERS.slice(0,3).map((m,i)=><div key={m.id} style={{ marginLeft:i>0?-8:0 }}><Avatar id={m.id} size={26}/></div>)}
              <div style={{ marginLeft:-8,width:26,height:26,borderRadius:"50%",background:t.bgTertiary,border:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:t.textMuted }}>+1</div>
            </div>
            <Btn accent t={t} onClick={()=>setModule("standup")}>Join Now {"->"}</Btn>
          </div>

          {/* My PRs */}
          <Card t={t} style={{ animation:"fadeUp 0.4s 0.15s ease both",opacity:0 }}>
            <SectionLabel t={t}>MY PRs WAITING</SectionLabel>
            {ISSUES.filter(i=>i.pr&&i.status==="review").map(i=>(
              <div key={i.id} onClick={()=>setModule("ide")} style={{ padding:"8px 0",borderBottom:`1px solid ${t.border}`,cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center" }}
                onMouseEnter={e=>e.currentTarget.style.opacity="0.7"}
                onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                <div>
                  <div style={{ fontSize:11,color:t.accent }}>{i.pr} . {i.id}</div>
                  <div style={{ fontSize:12,color:t.text }}>{i.title.slice(0,32)}...</div>
                </div>
                <span style={{ fontSize:10,padding:"2px 7px",background:t.yellow+"20",color:t.yellow,borderRadius:3 }}>Review</span>
              </div>
            ))}
          </Card>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16 }}>
        {/* Recent issues */}
        <Card t={t} style={{ animation:"fadeUp 0.4s 0.18s ease both",opacity:0 }}>
          <SectionLabel t={t}>MY ISSUES</SectionLabel>
          {ISSUES.filter(i=>i.assignee==="AL").slice(0,3).map(i=>(
            <div key={i.id} style={{ display:"flex",gap:8,alignItems:"flex-start",marginBottom:10 }}>
              <div style={{ width:6,height:6,borderRadius:"50%",background:STATUS[i.status].color,marginTop:5,flexShrink:0 }}/>
              <div>
                <div style={{ fontSize:11,color:t.accent }}>{i.id}</div>
                <div style={{ fontSize:12,color:t.text,lineHeight:1.3 }}>{i.title.slice(0,45)}...</div>
              </div>
            </div>
          ))}
        </Card>

        {/* EVM snapshot */}
        <Card t={t} style={{ animation:"fadeUp 0.4s 0.2s ease both",opacity:0 }}>
          <SectionLabel t={t}>EVM SNAPSHOT</SectionLabel>
          {[["PV","$1,400",t.blue],["EV","$1,456",t.accent],["AC","$1,400",t.orange]].map(([k,v,c])=>(
            <div key={k} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8 }}>
              <span style={{ fontSize:11,color:t.textMuted }}>{k}</span>
              <div style={{ display:"flex",alignItems:"center",gap:6 }}>
                <div style={{ width:60,height:3,background:t.bgTertiary,borderRadius:2,overflow:"hidden" }}>
                  <div style={{ width:parseInt(v.replace(/\D/g,""))/14+"px",maxWidth:"100%",height:"100%",background:c }}/>
                </div>
                <span style={{ fontSize:12,fontWeight:700,color:c,width:52,textAlign:"right" }}>{v}</span>
              </div>
            </div>
          ))}
          <div style={{ marginTop:12,paddingTop:12,borderTop:`1px solid ${t.border}`,display:"flex",gap:16 }}>
            {[["CPI","1.04",true],["SPI","1.04",true]].map(([k,v,up])=>(
              <div key={k}><div style={{ fontSize:10,color:t.textMuted }}>{k}</div><div style={{ fontSize:18,fontWeight:700,color:up?t.green:t.red }}>{v}</div></div>
            ))}
          </div>
        </Card>

        {/* Velocity */}
        <Card t={t} style={{ animation:"fadeUp 0.4s 0.22s ease both",opacity:0 }}>
          <SectionLabel t={t}>VELOCITY . LAST 6 SPRINTS</SectionLabel>
          <div style={{ display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:4 }}>
            <div style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:28,color:t.text }}>42</div>
            <span style={{ fontSize:11,color:t.green }}>+12%</span>
          </div>
          <BarChart t={t} color={t.accent} width={180} height={50} data={[{v:28,l:"S7"},{v:34,l:"S8"},{v:30,l:"S9"},{v:38,l:"S10"},{v:40,l:"S11"},{v:42,l:"S12"}]}/>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// MODULE: SPRINT BOARD
// ============================================================
function Board({ t }) {
  const cols=["todo","in_progress","review","done"];
  const [issues,setIssues]=useState(ISSUES);
  const [drag,setDrag]=useState(null);
  const [sel,setSel]=useState(null);

  const grouped=cols.reduce((a,c)=>({...a,[c]:issues.filter(i=>i.status===c)}),[]);

  const velData=[28,34,30,38,40,42];
  const burnIdeal=[42,36,30,24,18,12,6,0];
  const burnActual=[42,38,32,28];

  return (
    <div style={{ display:"flex",flexDirection:"column",height:"100%",overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"14px 24px",borderBottom:`1px solid ${t.border}`,background:t.bgSecondary,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div>
          <div style={{ fontSize:10,color:t.textMuted,letterSpacing:"0.12em",marginBottom:2 }}>SPRINT 12 . MAR 3-17</div>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <span style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:700,fontSize:18,color:t.text }}>Sprint Board</span>
            <span style={{ fontSize:11,padding:"2px 8px",background:t.accentDim,color:t.accent,borderRadius:3 }}>IN PROGRESS</span>
          </div>
        </div>
        <div style={{ display:"flex",gap:24,alignItems:"center" }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:22,color:t.text }}>42</div>
            <div style={{ fontSize:9,color:t.textMuted,letterSpacing:"0.08em" }}>PTS TOTAL</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:22,color:t.accent }}>28</div>
            <div style={{ fontSize:9,color:t.textMuted,letterSpacing:"0.08em" }}>COMPLETE</div>
          </div>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:22,color:t.text }}>6d</div>
            <div style={{ fontSize:9,color:t.textMuted,letterSpacing:"0.08em" }}>REMAIN</div>
          </div>
          {/* Mini burn-down */}
          <div style={{ position:"relative" }}>
            <svg width={120} height={48} viewBox="0 0 120 48">
              <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#40FF90" stopOpacity="0.15"/><stop offset="100%" stopColor="#40FF90" stopOpacity="0"/></linearGradient></defs>
              {burnIdeal.map((v,i,arr)=>{
                if(i===arr.length-1)return null;
                const x1=i/7*120,y1=v/42*40+4,x2=(i+1)/7*120,y2=arr[i+1]/42*40+4;
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={t.borderStrong} strokeWidth={1} strokeDasharray="3,2"/>;
              })}
              <polyline points={burnActual.map((v,i)=>`${i/7*120},${v/42*40+4}`).join(" ")} fill="none" stroke={t.accent} strokeWidth={2} strokeLinecap="round"/>
              {burnActual.map((v,i)=><circle key={i} cx={i/7*120} cy={v/42*40+4} r={2.5} fill={t.accent}/>)}
              <text x={0} y={48} fontSize={8} fill={t.textMuted} fontFamily="inherit">Burn-down</text>
            </svg>
          </div>
        </div>
      </div>

      {/* Columns */}
      <div style={{ display:"flex",flex:1,overflow:"auto" }}>
        {cols.map((col,ci)=>{
          const meta=STATUS[col];
          const colIssues=grouped[col];
          const wip=col==="in_progress"&&colIssues.length>=3;
          return (
            <div key={col}
              onDragOver={e=>e.preventDefault()}
              onDrop={()=>{if(drag)setIssues(p=>p.map(i=>i.id===drag?{...i,status:col}:i));setDrag(null);}}
              style={{ flex:1,minWidth:220,borderRight:ci<cols.length-1?`1px solid ${t.border}`:"none",display:"flex",flexDirection:"column",background:wip?t.orange+"06":"transparent" }}
            >
              <div style={{ padding:"12px 14px 10px",borderBottom:`2px solid ${meta.color}`,display:"flex",justifyContent:"space-between",alignItems:"center",position:"sticky",top:0,background:t.bg,zIndex:2 }}>
                <div style={{ display:"flex",alignItems:"center",gap:7 }}>
                  <div style={{ width:6,height:6,borderRadius:"50%",background:meta.color,boxShadow:`0 0 6px ${meta.color}` }}/>
                  <span style={{ fontSize:11,fontWeight:700,letterSpacing:"0.1em",color:t.text }}>{meta.label.toUpperCase()}</span>
                  {wip&&<span style={{ fontSize:9,color:t.orange,background:t.orange+"18",borderRadius:3,padding:"1px 5px" }}>WIP LIMIT</span>}
                </div>
                <span style={{ fontSize:11,color:t.textMuted }}>{colIssues.length}</span>
              </div>
              <div style={{ padding:10,display:"flex",flexDirection:"column",gap:8,overflowY:"auto",flex:1 }}>
                {colIssues.map(issue=>(
                  <IssuePill key={issue.id} issue={issue} t={t} draggable onDragStart={()=>setDrag(issue.id)} onClick={()=>setSel(issue)}/>
                ))}
                {colIssues.length===0&&<div style={{ border:`2px dashed ${t.border}`,borderRadius:6,padding:"28px 12px",textAlign:"center",color:t.textMuted,fontSize:11 }}>Drop here</div>}
              </div>
            </div>
          );
        })}
      </div>

      {sel&&<IssueDetail issue={sel} t={t} onClose={()=>setSel(null)}/>}
    </div>
  );
}

// ============================================================
// ISSUE DETAIL PANEL
// ============================================================
function IssueDetail({ issue, t, onClose }) {
  return (
    <div style={{ position:"absolute",right:0,top:0,bottom:0,width:440,background:t.bgSecondary,borderLeft:`1px solid ${t.border}`,boxShadow:t.shadowLg,display:"flex",flexDirection:"column",zIndex:50,animation:"slideIn 0.2s ease" }}>
      <style>{`@keyframes slideIn{from{transform:translateX(16px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
      <div style={{ padding:"14px 18px",borderBottom:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          <span style={{ fontSize:11,color:t.accent,letterSpacing:"0.08em" }}>{issue.id}</span>
          <span style={{ fontSize:10,padding:"2px 7px",background:STATUS[issue.status].color+"20",color:STATUS[issue.status].color,borderRadius:3 }}>{STATUS[issue.status].label}</span>
        </div>
        <button onClick={onClose} style={{ background:"none",border:"none",color:t.textMuted,cursor:"pointer",fontSize:20,lineHeight:1,padding:"0 4px" }}>x</button>
      </div>
      <div style={{ padding:20,overflowY:"auto",flex:1 }}>
        <h2 style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:700,fontSize:17,color:t.text,lineHeight:1.35,marginBottom:18 }}>{issue.title}</h2>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:1,background:t.border,border:`1px solid ${t.border}`,borderRadius:6,overflow:"hidden",marginBottom:18 }}>
          {[["Assignee",issue.assignee?MEMBERS.find(m=>m.id===issue.assignee)?.name:"Unassigned"],["Priority",PRIORITY[issue.priority].label],["Points",`${issue.points} pts`],["Time",issue.time||"0m"],["Project",issue.project],["Pillar",issue.pillar?.toUpperCase()]].map(([k,v])=>(
            <div key={k} style={{ padding:"9px 13px",background:t.bgSecondary }}><div style={{ fontSize:9,color:t.textMuted,letterSpacing:"0.1em",marginBottom:3 }}>{k.toUpperCase()}</div><div style={{ fontSize:13,color:t.text }}>{v}</div></div>
          ))}
        </div>
        {issue.files.length>0&&(
          <div style={{ marginBottom:16 }}>
            <SectionLabel t={t}>FILES CHANGED</SectionLabel>
            {issue.files.map(f=>(
              <div key={f} style={{ padding:"6px 10px",background:t.bgTertiary,border:`1px solid ${t.border}`,borderRadius:4,fontSize:11,color:t.blue,marginBottom:4,fontFamily:"monospace" }}>{f}</div>
            ))}
          </div>
        )}
        {issue.pr&&(
          <div style={{ padding:"10px 14px",background:t.bgTertiary,border:`1px solid ${t.border}`,borderLeft:`3px solid ${t.blue}`,borderRadius:6,marginBottom:16 }}>
            <div style={{ fontSize:11,color:t.blue,marginBottom:3 }}>[/] PR {issue.pr} . Open</div>
            <div style={{ display:"flex",gap:8 }}>
              <span style={{ fontSize:10,padding:"2px 6px",background:t.green+"18",color:t.green,borderRadius:3 }}>CI Passing</span>
              <span style={{ fontSize:10,padding:"2px 6px",background:t.yellow+"18",color:t.yellow,borderRadius:3 }}>1 Review needed</span>
            </div>
          </div>
        )}
        <SectionLabel t={t}>ACTIVITY</SectionLabel>
        {[["SL","moved to In Progress","9:22 AM"],["AL","added to Sprint 12","Yesterday"],["SL","created this issue","Mar 1"]].map((a,i)=>(
          <div key={i} style={{ display:"flex",gap:10,alignItems:"flex-start",marginBottom:10 }}>
            <Avatar id={a[0]} size={22}/>
            <div>
              <span style={{ fontSize:12,color:t.text }}>{MEMBERS.find(m=>m.id===a[0])?.name}</span>
              <span style={{ fontSize:12,color:t.textMuted }}> {a[1]}</span>
              <div style={{ fontSize:10,color:t.textMuted,marginTop:1 }}>{a[2]}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding:14,borderTop:`1px solid ${t.border}` }}>
        <div style={{ display:"flex",gap:8,background:t.bgTertiary,border:`1px solid ${t.border}`,borderRadius:6,padding:"8px 12px",alignItems:"center" }}>
          <Avatar id="AL" size={22}/>
          <input placeholder="Comment or @mention..." style={{ flex:1,background:"none",border:"none",outline:"none",fontSize:13,color:t.text,fontFamily:"inherit" }}/>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MODULE: IDE + CODE & PRs
// ============================================================
const CODE_SAMPLE=`// src/api/client.ts
// RC-001: API client with retry logic

// RateLimiter from ./rate-limiter (inline below)

interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
}

export class ApiClient {
  private retryCount = 3;
  private rateLimiter = new RateLimiter(100, 60000);

  constructor(private baseUrl: string) {}

  async request<T>(config: RequestConfig): Promise<T> {
    for (let i = 0; i < this.retryCount; i++) {
      await this.rateLimiter.wait();
      try {
        const res = await fetch(\`\${this.baseUrl}\${config.path}\`, {
          method: config.method,
          headers: { 'Content-Type': 'application/json' },
          body: config.body ? JSON.stringify(config.body) : undefined,
        });
        if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
        return res.json() as Promise<T>;
      } catch (err) {
        if (i === this.retryCount - 1) throw err;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
    throw new Error('Max retries exceeded');
  }

  get<T>(path: string) {
    return this.request<T>({ method: 'GET', path });
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>({ method: 'POST', path, body });
  }
}`;

const PRS=[
  { id:"#42",title:"feat: API client with rate limiting + retry",author:"SL",status:"open",ci:"passing",reviews:1,needed:2,issue:"RC-001",additions:148,deletions:12,files:["src/api/client.ts","src/api/retry.ts","src/api/__tests__/client.test.ts"],comments:[{user:"MK",text:"Love the exponential backoff. One thing -- should we cap the max delay?",line:24}] },
  { id:"#44",title:"feat: sprint burn-down chart component",author:"MK",status:"open",ci:"passing",reviews:0,needed:2,issue:"RC-006",additions:94,deletions:3,files:["src/analytics/Burndown.tsx"],comments:[] },
  { id:"#38",title:"fix: Google OAuth redirect after callback",author:"MK",status:"review",ci:"failing",reviews:2,needed:2,issue:"RC-002",additions:22,deletions:8,files:["src/auth/Login.tsx","src/lib/supabase.ts"],comments:[{user:"SL",text:"Cookie SameSite fix looks right. Can you add a test?",line:14}] },
  { id:"#35",title:"feat: real-time cursor presence in editor",author:"SL",status:"merged",ci:"passing",reviews:2,needed:2,issue:"RC-005",additions:201,deletions:45,files:["src/ide/Editor.tsx"],comments:[] },
];

function IDE({ t }) {
  const [tab,setTab]=useState("prs"); // prs | code | ai
  const [selPR,setSelPR]=useState(PRS[0]);
  const [aiInput,setAiInput]=useState("");
  const [aiMessages,setAiMessages]=useState([{role:"assistant",text:"I have RC-001 context loaded. The API client needs rate limiting and retry logic. I've generated a starting implementation -- want me to add tests or explain the backoff strategy?"}]);
  const [activeFile,setActiveFile]=useState("src/api/client.ts");
  const [sending,setSending]=useState(false);

  const sendAI=async()=>{
    if(!aiInput.trim()||sending)return;
    const msg=aiInput; setAiInput(""); setSending(true);
    setAiMessages(p=>[...p,{role:"user",text:msg}]);
    await new Promise(r=>setTimeout(r,900));
    setAiMessages(p=>[...p,{role:"assistant",text:`Based on RC-001 and the current implementation: ${msg.toLowerCase().includes("test")?"Here's a test for the retry logic:\n\n```ts\nit('retries on 500 error', async () => {\n  const client = new ApiClient('https://api.test');\n  mockFetch.mockRejectedValueOnce(new Error('HTTP 500'));\n  mockFetch.mockResolvedValueOnce({ ok:true, json:()=>({id:1}) });\n  const result = await client.get('/users/1');\n  expect(result).toEqual({ id: 1 });\n  expect(mockFetch).toHaveBeenCalledTimes(2);\n});\n```":"The exponential backoff pattern (1s -> 2s -> 4s) is standard. You could cap it at 30s with `Math.min(30000, 1000 * Math.pow(2, i))` to avoid overly long waits on flaky networks."}`}]);
    setSending(false);
  };

  const ciColor=(ci)=>ci==="passing"?t.green:ci==="failing"?t.red:t.yellow;

  return (
    <div style={{ display:"flex",height:"100%",overflow:"hidden" }}>
      {/* Left: PR list */}
      <div style={{ width:260,borderRight:`1px solid ${t.border}`,display:"flex",flexDirection:"column",background:t.bgSecondary }}>
        <div style={{ padding:"14px 16px 10px",borderBottom:`1px solid ${t.border}` }}>
          <div style={{ display:"flex",gap:4,marginBottom:10 }}>
            {["prs","code","ai"].map(id=>(
              <button key={id} onClick={()=>setTab(id)} style={{ flex:1,background:tab===id?t.accentDim:"none",border:`1px solid ${tab===id?t.accent:t.border}`,color:tab===id?t.accentText:t.textMuted,borderRadius:4,padding:"5px 0",fontSize:10,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.08em" }}>
                {id==="prs"?"PRs":id==="code"?"FILES":"AI"}
              </button>
            ))}
          </div>
        </div>
        
        {tab==="prs"&&(
          <div style={{ overflowY:"auto",flex:1 }}>
            {PRS.map(pr=>(
              <div key={pr.id} onClick={()=>setSelPR(pr)} style={{ padding:"12px 14px",borderBottom:`1px solid ${t.border}`,cursor:"pointer",background:selPR?.id===pr.id?t.accentDim:"transparent",borderLeft:`2px solid ${selPR?.id===pr.id?t.accent:"transparent"}`,transition:"all 0.12s" }}
                onMouseEnter={e=>{if(selPR?.id!==pr.id)e.currentTarget.style.background=t.bgHover;}}
                onMouseLeave={e=>{if(selPR?.id!==pr.id)e.currentTarget.style.background="transparent";}}>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ fontSize:10,color:t.blue }}>{pr.id}</span>
                  <span style={{ fontSize:9,padding:"1px 6px",background:pr.status==="merged"?t.purple+"20":pr.status==="open"?t.green+"20":t.yellow+"20",color:pr.status==="merged"?t.purple:pr.status==="open"?t.green:t.yellow,borderRadius:10 }}>{pr.status}</span>
                </div>
                <div style={{ fontSize:12,color:t.text,lineHeight:1.35,marginBottom:6 }}>{pr.title}</div>
                <div style={{ display:"flex",gap:6,alignItems:"center" }}>
                  <Avatar id={pr.author} size={18}/>
                  <div style={{ width:6,height:6,borderRadius:"50%",background:ciColor(pr.ci),boxShadow:`0 0 4px ${ciColor(pr.ci)}` }}/>
                  <span style={{ fontSize:10,color:t.textMuted }}>CI</span>
                  <span style={{ fontSize:10,color:t.textMuted,marginLeft:"auto" }}>{pr.reviews}/{pr.needed} reviews</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab==="code"&&(
          <div style={{ overflowY:"auto",flex:1,padding:"8px 0" }}>
            <SectionLabel t={t} style={{ padding:"0 14px" }}>FILE TREE</SectionLabel>
            {["src/api/client.ts","src/api/retry.ts","src/api/__tests__/client.test.ts","src/auth/Login.tsx","src/lib/supabase.ts","src/ide/Editor.tsx","src/analytics/Burndown.tsx"].map(f=>(
              <div key={f} onClick={()=>setActiveFile(f)} style={{ padding:"6px 14px",fontSize:11,color:activeFile===f?t.accent:t.textSecondary,background:activeFile===f?t.accentDim:"transparent",cursor:"pointer",fontFamily:"monospace",borderLeft:`2px solid ${activeFile===f?t.accent:"transparent"}`,display:"flex",alignItems:"center",gap:6 }}
                onMouseEnter={e=>{if(activeFile!==f)e.currentTarget.style.background=t.bgHover;}}
                onMouseLeave={e=>{if(activeFile!==f)e.currentTarget.style.background="transparent";}}>
                <span style={{ fontSize:9,opacity:0.5 }}>{f.endsWith(".test.ts")?"":f.endsWith(".tsx")?"":"[/]"}</span>
                {f.split("/").pop()}
              </div>
            ))}
          </div>
        )}

        {tab==="ai"&&(
          <div style={{ flex:1,display:"flex",flexDirection:"column" }}>
            <div style={{ padding:"8px 14px",background:t.accentDim,borderBottom:`1px solid ${t.border}` }}>
              <div style={{ fontSize:10,color:t.accent,marginBottom:2 }}>CONTEXT LOADED</div>
              <div style={{ fontSize:11,color:t.text }}>RC-001 . src/api/client.ts</div>
            </div>
            <div style={{ overflowY:"auto",flex:1,padding:"10px 14px",display:"flex",flexDirection:"column",gap:8 }}>
              {aiMessages.map((m,i)=>(
                <div key={i} style={{ padding:"8px 10px",background:m.role==="user"?t.accentDim:t.bgTertiary,border:`1px solid ${m.role==="user"?t.accent+"40":t.border}`,borderRadius:6,fontSize:12,color:t.text,lineHeight:1.5,fontFamily:m.text.includes("```")?"monospace":"inherit",whiteSpace:"pre-wrap",wordBreak:"break-word" }}>{m.text}</div>
              ))}
              {sending&&<div style={{ fontSize:12,color:t.textMuted,padding:"6px 10px" }}>Thinking...</div>}
            </div>
            <div style={{ padding:10,borderTop:`1px solid ${t.border}` }}>
              <div style={{ display:"flex",gap:6 }}>
                <input value={aiInput} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendAI()} placeholder="Ask about this code..." style={{ flex:1,background:t.bgTertiary,border:`1px solid ${t.border}`,borderRadius:5,padding:"6px 10px",fontSize:12,color:t.text,fontFamily:"inherit",outline:"none" }}/>
                <Btn accent t={t} small onClick={sendAI}>{"->"}</Btn>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right: code / PR detail */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
        {tab!=="prs"?(
          /* Code editor view */
          <div style={{ flex:1,overflow:"hidden",display:"flex",flexDirection:"column" }}>
            <div style={{ padding:"10px 20px",borderBottom:`1px solid ${t.border}`,background:t.bgSecondary,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                <span style={{ fontSize:11,color:t.blue,fontFamily:"monospace" }}>{activeFile}</span>
                <span style={{ fontSize:9,padding:"2px 6px",background:t.accentDim,color:t.accent,borderRadius:3 }}>RC-001</span>
              </div>
              <div style={{ display:"flex",gap:8 }}>
                <Btn t={t} small>Format</Btn>
                <Btn t={t} small>Run Tests</Btn>
                <Btn accent t={t} small>Create PR</Btn>
              </div>
            </div>
            <div style={{ flex:1,overflowY:"auto",padding:"0" }}>
              <div style={{ fontFamily:"'JetBrains Mono','Fira Code',monospace",fontSize:13,lineHeight:1.8,background:t.bg }}>
                {CODE_SAMPLE.split("\n").map((line,i)=>(
                  <div key={i} style={{ display:"flex",gap:0,":hover":{background:t.bgHover} }}
                    onMouseEnter={e=>e.currentTarget.style.background=t.bgHover}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <span style={{ width:48,textAlign:"right",paddingRight:16,color:t.textMuted,fontSize:11,userSelect:"none",flexShrink:0,paddingTop:0 }}>{i+1}</span>
                    <span style={{ flex:1,paddingRight:20,color:
                      line.startsWith("//")?"#6A8A44":
                      line.includes("class ")||line.includes("interface ")||line.includes("export")?"#C8A0FF":
                      line.includes("async ")||line.includes("await ")||line.includes("return ")||line.includes("const ")||line.includes("private ")?"#47BFFF":
                      line.includes("'")||line.includes("`")?"#FF9A47":
                      t.text,
                      whiteSpace:"pre",
                    }}>{line||" "}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ):(
          /* PR detail */
          selPR&&<div style={{ flex:1,overflowY:"auto" }}>
            <div style={{ padding:"16px 24px",borderBottom:`1px solid ${t.border}`,background:t.bgSecondary }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12 }}>
                <div>
                  <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:6 }}>
                    <span style={{ fontSize:11,color:t.blue }}>{selPR.id}</span>
                    <span style={{ fontSize:10,padding:"2px 7px",background:selPR.status==="merged"?t.purple+"20":selPR.status==="open"?t.green+"20":t.yellow+"20",color:selPR.status==="merged"?t.purple:selPR.status==="open"?t.green:t.yellow,borderRadius:10 }}>{selPR.status.toUpperCase()}</span>
                    <div style={{ width:7,height:7,borderRadius:"50%",background:ciColor(selPR.ci),boxShadow:`0 0 5px ${ciColor(selPR.ci)}` }}/>
                    <span style={{ fontSize:10,color:t.textMuted }}>CI {selPR.ci}</span>
                  </div>
                  <h2 style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:700,fontSize:18,color:t.text,marginBottom:6 }}>{selPR.title}</h2>
                  <div style={{ display:"flex",gap:12,alignItems:"center" }}>
                    <Avatar id={selPR.author} size={22}/>
                    <span style={{ fontSize:12,color:t.textSecondary }}>{MEMBERS.find(m=>m.id===selPR.author)?.name}</span>
                    <span style={{ fontSize:10,padding:"2px 7px",background:t.accentDim,color:t.accent,borderRadius:3 }}>{selPR.issue}</span>
                  </div>
                </div>
                <div style={{ display:"flex",gap:8 }}>
                  <Btn t={t}>Request Changes</Btn>
                  <Btn accent t={t}>Approve & Merge</Btn>
                </div>
              </div>
              <div style={{ display:"flex",gap:16 }}>
                <span style={{ fontSize:12,color:t.green }}>+{selPR.additions}</span>
                <span style={{ fontSize:12,color:t.red }}>-{selPR.deletions}</span>
                <span style={{ fontSize:12,color:t.textMuted }}>{selPR.files.length} files</span>
                <span style={{ fontSize:12,color:t.textMuted }}>{selPR.reviews}/{selPR.needed} reviews</span>
              </div>
            </div>

            {/* Files changed */}
            <div style={{ padding:"16px 24px",borderBottom:`1px solid ${t.border}` }}>
              <SectionLabel t={t}>FILES CHANGED</SectionLabel>
              {selPR.files.map(f=>(
                <div key={f} style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 12px",background:t.bgSecondary,border:`1px solid ${t.border}`,borderRadius:4,marginBottom:6 }}>
                  <span style={{ fontSize:12,color:t.blue,fontFamily:"monospace" }}>{f}</span>
                  <div style={{ display:"flex",gap:8 }}>
                    <span style={{ fontSize:10,color:t.green }}>+{Math.floor(Math.random()*80+10)}</span>
                    <span style={{ fontSize:10,color:t.red }}>-{Math.floor(Math.random()*20)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Diff preview */}
            <div style={{ padding:"16px 24px",borderBottom:`1px solid ${t.border}` }}>
              <SectionLabel t={t}>DIFF PREVIEW . {selPR.files[0]}</SectionLabel>
              <div style={{ fontFamily:"monospace",fontSize:12,background:t.bgTertiary,border:`1px solid ${t.border}`,borderRadius:6,overflow:"hidden" }}>
                {[["+ ","export class ApiClient {",t.green+"18",t.green],["+ ","  private retryCount = 3;",t.green+"18",t.green],["+ ","  private rateLimiter = new RateLimiter(100, 60000);",t.green+"18",t.green],["  ","",null,t.textMuted],["+ ","  async request<T>(config: RequestConfig): Promise<T> {",t.green+"18",t.green],["+ ","    for (let i = 0; i < this.retryCount; i++) {",t.green+"18",t.green],["- ","    return fetch(this.baseUrl + config.path);",t.red+"18",t.red],["+ ","      await this.rateLimiter.wait();",t.green+"18",t.green]].map(([prefix,line,bg,color],i)=>(
                  <div key={i} style={{ display:"flex",gap:0,background:bg||"transparent",borderBottom:`1px solid ${t.border}` }}>
                    <span style={{ width:24,textAlign:"center",color,flexShrink:0,fontWeight:700 }}>{prefix}</span>
                    <span style={{ flex:1,padding:"2px 8px",color,whiteSpace:"pre" }}>{line}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Comments */}
            {selPR.comments.length>0&&(
              <div style={{ padding:"16px 24px" }}>
                <SectionLabel t={t}>REVIEW COMMENTS</SectionLabel>
                {selPR.comments.map((c,i)=>(
                  <div key={i} style={{ background:t.bgSecondary,border:`1px solid ${t.border}`,borderRadius:6,padding:14,marginBottom:10 }}>
                    <div style={{ display:"flex",gap:10,marginBottom:8,alignItems:"center" }}>
                      <Avatar id={c.user} size={24}/>
                      <span style={{ fontSize:13,color:t.text }}>{MEMBERS.find(m=>m.id===c.user)?.name}</span>
                      <span style={{ fontSize:10,color:t.textMuted,marginLeft:"auto" }}>Line {c.line}</span>
                    </div>
                    <div style={{ fontSize:13,color:t.textSecondary,lineHeight:1.5 }}>{c.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MODULE: DOCS
// ============================================================
const DOCS=[
  { id:"d1",title:"API Client Documentation",issue:"RC-001",author:"SL",updated:"2h ago",status:"published",content:`# API Client\n\nThe API client provides rate limiting and automatic retries with exponential backoff.\n\n## Installation\n\`\`\`bash\nnpm install @reach/api-client\n\`\`\`\n\n## Usage\n\`\`\`typescript\nconst client = new ApiClient('https://api.example.com');\nconst users = await client.get('/users');\n\`\`\`` },
  { id:"d2",title:"Authentication Flow",issue:"RC-002",author:"MK",updated:"Yesterday",status:"draft",content:`# Auth Flow\n\nGoogle OAuth 2.0 with Supabase backend.\n\n## Flow\n1. User clicks "Sign in with Google"\n2. OAuth redirect to Google\n3. Callback to /auth/callback\n4. Exchange code for session` },
  { id:"d3",title:"Sprint Ceremonies Guide",issue:null,author:"AL",updated:"Mar 5",status:"published",content:`# Sprint Ceremonies\n\nStandardized guides for all Scrum ceremonies.` },
  { id:"d4",title:"EVM Calculations Reference",issue:"RC-004",author:"AL",updated:"Mar 3",status:"draft",content:`# Earned Value Management\n\nReference for EVM calculations.` },
];

function Docs({ t }) {
  const [sel,setSel]=useState(DOCS[0]);
  const [editing,setEditing]=useState(false);
  const [content,setContent]=useState(DOCS[0].content);

  return (
    <div style={{ display:"flex",height:"100%",overflow:"hidden" }}>
      {/* Doc list */}
      <div style={{ width:260,borderRight:`1px solid ${t.border}`,background:t.bgSecondary,display:"flex",flexDirection:"column" }}>
        <div style={{ padding:"14px 16px",borderBottom:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <SectionLabel t={t}>DOCUMENTS</SectionLabel>
          <Btn accent t={t} small>+ New</Btn>
        </div>
        <div style={{ overflowY:"auto",flex:1 }}>
          {DOCS.map(doc=>(
            <div key={doc.id} onClick={()=>{setSel(doc);setContent(doc.content);setEditing(false);}} style={{ padding:"12px 14px",borderBottom:`1px solid ${t.border}`,cursor:"pointer",background:sel?.id===doc.id?t.accentDim:"transparent",borderLeft:`2px solid ${sel?.id===doc.id?t.accent:"transparent"}` }}
              onMouseEnter={e=>{if(sel?.id!==doc.id)e.currentTarget.style.background=t.bgHover;}}
              onMouseLeave={e=>{if(sel?.id!==doc.id)e.currentTarget.style.background="transparent";}}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                <span style={{ fontSize:10,padding:"1px 6px",background:doc.status==="published"?t.green+"18":t.yellow+"18",color:doc.status==="published"?t.green:t.yellow,borderRadius:3 }}>{doc.status}</span>
                {doc.issue&&<span style={{ fontSize:10,color:t.accent }}>{doc.issue}</span>}
              </div>
              <div style={{ fontSize:13,color:t.text,marginBottom:4,lineHeight:1.3 }}>{doc.title}</div>
              <div style={{ fontSize:10,color:t.textMuted }}>{doc.author} . {doc.updated}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Doc content */}
      {sel&&(
        <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
          <div style={{ padding:"12px 24px",borderBottom:`1px solid ${t.border}`,background:t.bgSecondary,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <div style={{ display:"flex",gap:10,alignItems:"center" }}>
              <h2 style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:700,fontSize:16,color:t.text }}>{sel.title}</h2>
              {sel.issue&&<span style={{ fontSize:10,padding:"2px 7px",background:t.accentDim,color:t.accent,borderRadius:3 }}>{sel.issue}</span>}
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <Btn t={t} small onClick={()=>setEditing(e=>!e)}>{editing?"Preview":"Edit"}</Btn>
              <Btn t={t} small>Share</Btn>
              <Btn accent t={t} small>{sel.status==="draft"?"Publish":"Published v"}</Btn>
            </div>
          </div>
          <div style={{ flex:1,overflowY:"auto",padding:"28px 48px" }}>
            {editing?(
              <textarea value={content} onChange={e=>setContent(e.target.value)} style={{ width:"100%",height:"100%",background:"none",border:"none",outline:"none",fontSize:14,color:t.text,fontFamily:"'Space Mono',monospace",lineHeight:1.8,resize:"none" }}/>
            ):(
              <div style={{ maxWidth:680 }}>
                {content.split("\n").map((line,i)=>{
                  if(line.startsWith("# "))return <h1 key={i} style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:28,color:t.text,marginBottom:16,marginTop:24 }}>{line.slice(2)}</h1>;
                  if(line.startsWith("## "))return <h2 key={i} style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:700,fontSize:20,color:t.text,marginBottom:12,marginTop:20 }}>{line.slice(3)}</h2>;
                  if(line.startsWith("```"))return null;
                  if(line.startsWith("1.")||line.startsWith("2.")||line.startsWith("3.")||line.startsWith("4."))return <div key={i} style={{ padding:"4px 0 4px 16px",fontSize:14,color:t.textSecondary,lineHeight:1.7 }}>{line}</div>;
                  if(line==="")return <div key={i} style={{ height:8 }}/>;
                  return <p key={i} style={{ fontSize:14,color:t.textSecondary,lineHeight:1.8,marginBottom:8 }}>{line}</p>;
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MODULE: CHAT
// ============================================================
const INIT_MESSAGES={
  general:[
    { id:1,user:"SL",time:"9:14 AM",text:"Deploying RC-002 fix to staging now",system:false },
    { id:2,system:true,time:"9:15 AM",issueId:"RC-002",action:"moved to Review" },
    { id:3,user:"MK",time:"9:18 AM",text:"LGTM -- checking the auth callback edge case",system:false },
    { id:4,user:"SL",time:"9:22 AM",text:"Also kicked off RC-001 -- taking the API client work",system:false },
  ],
  bugs:[
    { id:1,system:true,time:"8:02 AM",issueId:"RC-002",action:"flagged as bug . Priority: High" },
    { id:2,user:"AL",time:"8:10 AM",text:"Reproducing locally. Happens only on Safari.",system:false },
    { id:3,user:"MK",time:"8:34 AM",text:"Found it -- cookie SameSite attribute missing on callback",system:false },
  ],
  handoffs:[
    { id:1,system:true,time:"Yesterday",issueId:"RC-005",action:"handed off to DevOps" },
    { id:2,user:"MK",time:"Yesterday",text:"RC-005 accepted . Deployment scheduled 06:00 UTC",system:false },
  ],
  engineering:[],done:[],["pr-reviews"]:[],
};

function Chat({ t }) {
  const [ch,setCh]=useState("general");
  const [msgs,setMsgs]=useState(INIT_MESSAGES);
  const [input,setInput]=useState("");
  const [over,setOver]=useState(false);
  const endRef=useRef();

  const send=()=>{
    if(!input.trim())return;
    setMsgs(p=>({...p,[ch]:[...(p[ch]||[]),{id:Date.now(),user:"AL",time:"Now",text:input,system:false}]}));
    setInput("");
    setTimeout(()=>endRef.current?.scrollIntoView({behavior:"smooth"}),50);
  };

  const drop=(e)=>{
    e.preventDefault(); setOver(false);
    const id=e.dataTransfer.getData("issueId");
    const issue=ISSUES.find(i=>i.id===id);
    if(!issue)return;
    setMsgs(p=>({...p,[ch]:[...(p[ch]||[]),{id:Date.now(),system:true,time:"Now",issueId:issue.id,action:`dropped into #${ch}`,issueFull:issue}]}));
  };

  return (
    <div style={{ display:"flex",height:"100%",overflow:"hidden" }}>
      {/* Channels */}
      <div style={{ width:220,borderRight:`1px solid ${t.border}`,background:t.bgSecondary,display:"flex",flexDirection:"column" }}>
        <div style={{ padding:"12px 14px 8px",borderBottom:`1px solid ${t.border}` }}>
          <SectionLabel t={t}>CHANNELS</SectionLabel>
          {CHANNELS.map(c=>(
            <button key={c.id} onClick={()=>setCh(c.id)} style={{ width:"100%",background:ch===c.id?t.accentDim:"none",border:"none",borderLeft:`2px solid ${ch===c.id?t.accent:"transparent"}`,color:ch===c.id?t.accentText:t.textSecondary,padding:"6px 10px",borderRadius:4,cursor:"pointer",fontFamily:"inherit",fontSize:13,display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:1,textAlign:"left" }}
              onMouseEnter={e=>{if(ch!==c.id)e.currentTarget.style.background=t.bgHover;}}
              onMouseLeave={e=>{if(ch!==c.id)e.currentTarget.style.background="none";}}>
              <span># {c.name}</span>
              {c.unread>0&&<span style={{ fontSize:9,fontWeight:700,background:t.accent,color:t.bg,borderRadius:10,padding:"1px 5px" }}>{c.unread}</span>}
            </button>
          ))}
        </div>
        <div style={{ padding:"8px 14px",borderTop:`1px solid ${t.border}`,marginTop:"auto" }}>
          <SectionLabel t={t}>DIRECT</SectionLabel>
          {MEMBERS.map(m=>(
            <button key={m.id} style={{ width:"100%",background:"none",border:"none",cursor:"pointer",padding:"5px 10px",borderRadius:4,display:"flex",gap:8,alignItems:"center",marginBottom:1,textAlign:"left" }}
              onMouseEnter={e=>e.currentTarget.style.background=t.bgHover}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{ position:"relative" }}><Avatar id={m.id} size={22}/><div style={{ position:"absolute",bottom:-1,right:-1 }}><Dot status={m.status}/></div></div>
              <span style={{ fontSize:12,color:t.textSecondary }}>{m.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>
        <div style={{ padding:10,borderTop:`1px solid ${t.border}` }}>
          <div style={{ border:`2px dashed ${t.border}`,borderRadius:6,padding:"10px",textAlign:"center",fontSize:10,color:t.textMuted,lineHeight:1.6 }}>Drag issue<br/>{"->"} channel</div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",position:"relative" }}
        onDragOver={e=>{e.preventDefault();setOver(true);}}
        onDragLeave={()=>setOver(false)}
        onDrop={drop}>
        <div style={{ padding:"13px 22px",borderBottom:`1px solid ${t.border}`,background:t.bgSecondary,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <span style={{ fontSize:18,color:t.textMuted }}>#</span>
            <span style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:700,fontSize:16,color:t.text }}>{ch}</span>
          </div>
          <div style={{ display:"flex",gap:6 }}>
            {["Issues","Files","Search"].map(a=><Btn key={a} t={t} small>{a}</Btn>)}
          </div>
        </div>

        {over&&<div style={{ position:"absolute",inset:0,zIndex:10,background:t.accentDim,border:`2px dashed ${t.accent}`,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:4 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:36,marginBottom:8 }}>[H]</div>
            <div style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:700,fontSize:18,color:t.accent }}>Drop issue into #{ch}</div>
          </div>
        </div>}

        <div style={{ flex:1,overflowY:"auto",padding:"16px 22px",display:"flex",flexDirection:"column",gap:2 }}>
          {(msgs[ch]||[]).length===0&&<div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:t.textMuted,fontSize:13 }}>Drag an issue here to start</div>}
          {(msgs[ch]||[]).map((m,i)=>{
            if(m.system){
              const issue=m.issueFull||ISSUES.find(iss=>iss.id===m.issueId);
              return (
                <div key={m.id} style={{ padding:"8px 0",display:"flex",gap:12 }}>
                  <div style={{ width:28,height:28,borderRadius:"50%",background:t.accentDim,border:`1px solid ${t.accent}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:t.accent,flexShrink:0 }}>[H]</div>
                  <div>
                    <div style={{ fontSize:11,color:t.textMuted,marginBottom:6 }}><span style={{ color:t.accent }}>System</span> . {m.time}</div>
                    {issue&&<div style={{ background:t.bgSecondary,border:`1px solid ${t.border}`,borderLeft:`3px solid ${t.accent}`,borderRadius:6,padding:"10px 14px",maxWidth:400 }}>
                      <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                        <span style={{ fontSize:10,color:t.accent }}>{issue.id}</span>
                        <span style={{ fontSize:10,padding:"1px 6px",background:STATUS[issue.status].color+"22",color:STATUS[issue.status].color,borderRadius:3 }}>{STATUS[issue.status].label}</span>
                      </div>
                      <div style={{ fontSize:13,color:t.text,marginBottom:6 }}>{issue.title}</div>
                      <div style={{ fontSize:11,color:t.textMuted,marginBottom:8 }}>{m.action}</div>
                      <div style={{ display:"flex",gap:6 }}>
                        {["View","Assign to me","Mark Done"].map(a=><Btn key={a} t={t} small>{a}</Btn>)}
                      </div>
                    </div>}
                  </div>
                </div>
              );
            }
            const prev=msgs[ch][i-1];
            const grp=prev&&!prev.system&&prev.user===m.user;
            return (
              <div key={m.id} style={{ padding:grp?"1px 0 1px 40px":"6px 0",display:"flex",gap:12 }}>
                {!grp&&<Avatar id={m.user} size={28}/>}
                <div>
                  {!grp&&<div style={{ display:"flex",gap:8,marginBottom:2 }}>
                    <span style={{ fontSize:13,fontWeight:700,color:t.text }}>{MEMBERS.find(mb=>mb.id===m.user)?.name||m.user}</span>
                    <span style={{ fontSize:10,color:t.textMuted }}>{m.time}</span>
                  </div>}
                  <div style={{ fontSize:14,color:t.textSecondary,lineHeight:1.5 }}>{m.text}</div>
                </div>
              </div>
            );
          })}
          <div ref={endRef}/>
        </div>

        <div style={{ padding:"10px 22px",borderTop:`1px solid ${t.border}`,background:t.bgSecondary }}>
          <div style={{ display:"flex",gap:10,alignItems:"center",background:t.bgTertiary,border:`1px solid ${t.border}`,borderRadius:8,padding:"9px 14px" }}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder={`Message #${ch} . @mention . drag issue here`} style={{ flex:1,background:"none",border:"none",outline:"none",fontSize:14,color:t.text,fontFamily:"inherit" }}/>
            <div style={{ display:"flex",gap:8 }}>
              {["@","[H]",""].map(ic=><button key={ic} style={{ background:"none",border:"none",color:t.textMuted,cursor:"pointer",fontSize:16 }}>{ic}</button>)}
            </div>
          </div>
        </div>
      </div>

      {/* Issue quick-drag */}
      <div style={{ width:190,borderLeft:`1px solid ${t.border}`,background:t.bgSecondary,padding:"12px 10px",overflowY:"auto" }}>
        <SectionLabel t={t}>DRAG TO CHANNEL</SectionLabel>
        {ISSUES.slice(0,6).map(issue=>(
          <div key={issue.id} draggable onDragStart={e=>e.dataTransfer.setData("issueId",issue.id)} style={{ padding:"8px 10px",marginBottom:6,background:t.bgTertiary,border:`1px solid ${t.border}`,borderRadius:5,cursor:"grab",transition:"all 0.15s" }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=t.accent}
            onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}>
            <div style={{ fontSize:9,color:t.accent,letterSpacing:"0.08em",marginBottom:3 }}>{issue.id}</div>
            <div style={{ fontSize:11,color:t.text,lineHeight:1.3 }}>{issue.title.slice(0,36)}...</div>
            <div style={{ marginTop:4,display:"flex",justifyContent:"space-between" }}>
              <div style={{ width:5,height:5,borderRadius:"50%",background:STATUS[issue.status].color,marginTop:3 }}/>
              {issue.assignee&&<Avatar id={issue.assignee} size={16}/>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MODULE: STANDUPS + VIDEO (STUN/TURN simulated)
// ============================================================
const MEETINGS=[
  { id:"m1",title:"Daily Standup . Eng",type:"standup",time:"9:30 AM",date:"Today",members:["SL","MK","JP","AL"],recurring:"Daily",status:"upcoming" },
  { id:"m2",title:"Sprint Planning . Sprint 13",type:"planning",time:"2:00 PM",date:"Today",members:["SL","MK","JP","AL"],recurring:"Bi-weekly",status:"scheduled" },
  { id:"m3",title:"Backlog Refinement",type:"refinement",time:"11:00 AM",date:"Tomorrow",members:["AL","JP"],recurring:"Weekly",status:"scheduled" },
  { id:"m4",title:"Sprint Retrospective",type:"retro",time:"4:00 PM",date:"Mar 17",members:["SL","MK","JP","AL"],recurring:"Bi-weekly",status:"scheduled" },
];

function Standup({ t }: any) {
const [inCall,setInCall]=useState(false);
const [muted,setMuted]=useState(false);
const [videoOff,setVideoOff]=useState(false);
const [activeIssue,setActiveIssue]=useState<any>(null);
const [selMeeting,setSelMeeting]=useState(MEETINGS[0]);
const [standupNotes,setStandupNotes]=useState<any>({SL:{done:"Completed PR review on RC-002",doing:"Working on RC-001 API client",blockers:"None"},MK:{done:"Fixed OAuth callback bug",doing:"RC-006 burn-down chart",blockers:"Need design review"},JP:{done:"",doing:"RC-003 WIP limits",blockers:"Waiting on RC-001"},AL:{done:"Sprint review prep",doing:"RC-004 EVM dashboard",blockers:"None"}});

const { localStream, remoteStreams } = useWebRTC(
  null,
  "AL",
  "Alex L.",
  selMeeting.id,
  "workspace-root",
  inCall && !videoOff
);

const typeColor: any={standup:t.red,planning:t.blue,refinement:t.accent,retro:t.purple};

  return (
    <div style={{ display:"flex",height:"100%",overflow:"hidden" }}>
      {/* Meeting list */}
      <div style={{ width:260,borderRight:`1px solid ${t.border}`,background:t.bgSecondary,display:"flex",flexDirection:"column" }}>
        <div style={{ padding:"14px 16px",borderBottom:`1px solid ${t.border}`,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <SectionLabel t={t}>MEETINGS</SectionLabel>
          <Btn accent t={t} small>+ Schedule</Btn>
        </div>
        <div style={{ overflowY:"auto",flex:1 }}>
          {MEETINGS.map(m=>(
            <div key={m.id} onClick={()=>setSelMeeting(m)} style={{ padding:"12px 14px",borderBottom:`1px solid ${t.border}`,cursor:"pointer",background:selMeeting?.id===m.id?t.accentDim:"transparent",borderLeft:`2px solid ${selMeeting?.id===m.id?t.accent:"transparent"}` }}
              onMouseEnter={e=>{if(selMeeting?.id!==m.id)e.currentTarget.style.background=t.bgHover;}}
              onMouseLeave={e=>{if(selMeeting?.id!==m.id)e.currentTarget.style.background="transparent";}}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                <span style={{ fontSize:10,padding:"2px 6px",background:typeColor[m.type]+"18",color:typeColor[m.type],borderRadius:3 }}>{m.type.toUpperCase()}</span>
                <span style={{ fontSize:10,color:t.textMuted }}>{m.date} . {m.time}</span>
              </div>
              <div style={{ fontSize:13,color:t.text,marginBottom:6 }}>{m.title}</div>
              <div style={{ display:"flex",gap:-4 }}>
                {m.members.map((id,i)=><div key={id} style={{ marginLeft:i>0?-6:0 }}><Avatar id={id} size={20}/></div>)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden" }}>
        {!inCall?(
          /* Pre-call view */
          <div style={{ flex:1,overflowY:"auto",padding:"28px 36px" }}>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:10,color:typeColor[selMeeting.type],letterSpacing:"0.15em",marginBottom:6 }}>{selMeeting.type.toUpperCase()} . {selMeeting.recurring}</div>
              <h1 style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:28,color:t.text,marginBottom:8 }}>{selMeeting.title}</h1>
              <div style={{ display:"flex",gap:16,alignItems:"center",marginBottom:20 }}>
                <span style={{ fontSize:14,color:t.textSecondary }}> {selMeeting.date} at {selMeeting.time}</span>
                <div style={{ display:"flex" }}>
                  {selMeeting.members.map((id,i)=><div key={id} style={{ marginLeft:i>0?-8:0 }}><Avatar id={id} size={28}/></div>)}
                </div>
              </div>
              <div style={{ display:"flex",gap:10 }}>
                <button onClick={()=>setInCall(true)} style={{ background:t.green,border:"none",color:t.bg,borderRadius:8,padding:"12px 28px",fontSize:14,cursor:"pointer",fontFamily:"inherit",fontWeight:700,letterSpacing:"0.05em",boxShadow:`0 4px 16px ${t.green}44` }}>
                  {">"} Join Meeting
                </button>
                <Btn t={t}>Copy Link</Btn>
                <Btn t={t}>Add to Calendar</Btn>
              </div>
            </div>

            {/* Standup notes pre-fill */}
            {selMeeting.type==="standup"&&(
              <div>
                <Card t={t} style={{ marginBottom:16 }}>
                  <SectionLabel t={t}>PRE-FILL STANDUP NOTES</SectionLabel>
                  <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
                    {["SL","AL"].map(uid=>(
                      <div key={uid}>
                        <div style={{ display:"flex",gap:8,alignItems:"center",marginBottom:8 }}>
                          <Avatar id={uid} size={24}/>
                          <span style={{ fontSize:13,fontWeight:700,color:t.text }}>{MEMBERS.find(m=>m.id===uid)?.name}</span>
                        </div>
                        {["done","doing","blockers"].map(field=>(
                          <div key={field} style={{ marginBottom:6 }}>
                            <div style={{ fontSize:9,color:t.textMuted,letterSpacing:"0.12em",marginBottom:3 }}>{field==="done"?"[v] DONE":field==="doing"?" DOING":" BLOCKERS"}</div>
                            <input value={standupNotes[uid][field]} onChange={e=>setStandupNotes(p=>({...p,[uid]:{...p[uid],[field]:e.target.value}}))} style={{ width:"100%",background:t.bgTertiary,border:`1px solid ${t.border}`,borderRadius:4,padding:"6px 10px",fontSize:12,color:t.text,fontFamily:"inherit",outline:"none" }}/>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </Card>

                <Card t={t}>
                  <SectionLabel t={t}>LINKED ISSUES . SPRINT 12</SectionLabel>
                  {ISSUES.filter(i=>i.status!=="done").slice(0,4).map(i=>(
                    <div key={i.id} style={{ display:"flex",gap:10,alignItems:"center",marginBottom:8 }}>
                      <div style={{ width:6,height:6,borderRadius:"50%",background:STATUS[i.status].color,flexShrink:0 }}/>
                      <span style={{ fontSize:11,color:t.accent,width:60,flexShrink:0 }}>{i.id}</span>
                      <span style={{ fontSize:12,color:t.text,flex:1 }}>{i.title.slice(0,50)}...</span>
                      {i.assignee&&<Avatar id={i.assignee} size={20}/>}
                    </div>
                  ))}
                </Card>
              </div>
            )}
          </div>
        ):(
          /* In-call view */
          <div style={{ flex:1,display:"flex",flexDirection:"column",background:t.bg,overflow:"hidden" }}>
            {/* Video grid */}
            <div style={{ flex:1,padding:16,display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"1fr 1fr",gap:8,overflow:"hidden" }}>
              {MEMBERS.map((m,i)=>(
                <div key={m.id} style={{ borderRadius:10,overflow:"hidden",position:"relative",background:t.bgTertiary,border:`1px solid ${t.border}`,display:"flex",alignItems:"center",justifyContent:"center" }}>
                    {/* Real Video Stream from STUN or Simulated avatar */}
                    {m.id === "AL" && localStream ? (
                      <VideoPlayer stream={localStream} muted={true} style={{ transform: "scaleX(-1)" }} />
                    ) : remoteStreams.has(m.id) ? (
                      <VideoPlayer stream={remoteStreams.get(m.id)} />
                    ) : (
                      <>
                        <div style={{ position:"absolute",inset:0,background:`linear-gradient(135deg, ${m.color}10 0%, ${t.bgTertiary} 100%)` }}/>
                        <Avatar id={m.id} size={56}/>
                      </>
                    )}
                  {/* Active speaker indicator */}
                  {i===0&&<div style={{ position:"absolute",inset:0,border:`2px solid ${t.accent}`,borderRadius:10,pointerEvents:"none" }}/>}
                  <div style={{ position:"absolute",bottom:10,left:12,display:"flex",alignItems:"center",gap:6 }}>
                    <div style={{ width:6,height:6,borderRadius:"50%",background:t.green,boxShadow:`0 0 6px ${t.green}` }}/>
                    <span style={{ fontSize:12,color:"#FFF",fontWeight:600,textShadow:"0 1px 3px #000" }}>{m.name}</span>
                    {i===1&&muted&&<span style={{ fontSize:10,background:"#CC000088",color:"#FFF",borderRadius:3,padding:"1px 5px" }}>MUTED</span>}
                  </div>
                  {/* Screen share simulation for self */}
                  {i===0&&!videoOff&&(
                    <div style={{ position:"absolute",top:8,right:8 }}>
                      <div style={{ width:40,height:26,background:t.bgSecondary,border:`1px solid ${t.borderStrong}`,borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:t.textMuted }}>SHARE</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Standup panel overlay */}
            <div style={{ background:t.bgSecondary,borderTop:`1px solid ${t.border}`,padding:"12px 20px",display:"flex",gap:16,alignItems:"flex-start",maxHeight:160,overflowY:"auto" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:10,color:t.accent,letterSpacing:"0.12em",marginBottom:8 }}>NOW SPEAKING . Sarah L.</div>
                <div style={{ display:"flex",gap:12 }}>
                  {["done","doing","blockers"].map(field=>(
                    <div key={field} style={{ flex:1,background:t.bgTertiary,border:`1px solid ${t.border}`,borderRadius:6,padding:"8px 10px" }}>
                      <div style={{ fontSize:9,color:t.textMuted,letterSpacing:"0.1em",marginBottom:4 }}>{field==="done"?"[v] DONE":field==="doing"?" DOING":" BLOCKER"}</div>
                      <div style={{ fontSize:12,color:t.text,lineHeight:1.4 }}>{standupNotes["SL"][field]||<span style={{ color:t.textMuted }}>--</span>}</div>
                    </div>
                  ))}
                </div>
              </div>
              {activeIssue&&(
                <div style={{ width:200,background:t.bgTertiary,border:`1px solid ${t.accent}40`,borderRadius:6,padding:10 }}>
                  <div style={{ fontSize:10,color:t.accent,marginBottom:4 }}>{activeIssue.id}</div>
                  <div style={{ fontSize:12,color:t.text }}>{activeIssue.title.slice(0,60)}...</div>
                </div>
              )}
            </div>

            {/* Call controls */}
            <div style={{ background:t.bgTertiary,padding:"12px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:`1px solid ${t.border}` }}>
              <div style={{ fontSize:12,color:t.textMuted }}> Encrypted . STUN/TURN . 4 participants</div>
              <div style={{ display:"flex",gap:10 }}>
                {[
                  { label:muted?"":"",action:()=>setMuted(p=>!p),active:muted },
                  { label:videoOff?"":"",action:()=>setVideoOff(p=>!p),active:videoOff },
                  { label:"",action:()=>{},active:false },
                  { label:"[H]",action:()=>setActiveIssue(ISSUES[0]),active:!!activeIssue },
                ].map((c,i)=>(
                  <button key={i} onClick={c.action} style={{ width:44,height:44,borderRadius:"50%",background:c.active?t.orange+"22":t.bgSecondary,border:`1px solid ${c.active?t.orange:t.border}`,color:c.active?t.orange:t.text,fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>{c.label}</button>
                ))}
                <button onClick={()=>setInCall(false)} style={{ background:t.red,border:"none",color:"#FFF",borderRadius:24,padding:"0 24px",height:44,fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:700 }}>End</button>
              </div>
              <div style={{ fontSize:12,color:t.textMuted }}>1:24:07</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// MODULE: DASHBOARD
// ============================================================
function Dashboard({ t }) {
  const done=ISSUES.filter(i=>i.status==="done").length;
  const inProg=ISSUES.filter(i=>i.status==="in_progress").length;
  const velHistory=[28,34,30,38,40,42];
  const cycleData=[{v:3.8,l:"S9"},{v:4.2,l:"S10"},{v:3.5,l:"S11"},{v:3.2,l:"S12"}];

  return (
    <div style={{ padding:"24px 32px",overflowY:"auto",height:"100%" }}>
      <div style={{ marginBottom:20 }}>
        <SectionLabel t={t}>SPRINT 12 . PORTFOLIO</SectionLabel>
        <h1 style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:26,color:t.text }}>Dashboard</h1>
      </div>

      {/* KPIs */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16 }}>
        <KPICard t={t} label="VELOCITY" value="42" sub="pts this sprint" trend="^ +12% vs last" up={true}/>
        <KPICard t={t} label="CPI" value="1.04" sub="cost performance" trend="^ under budget" up={true}/>
        <KPICard t={t} label="CYCLE TIME" value="3.2d" sub="avg per issue" trend="v -0.4d improved" up={true}/>
        <KPICard t={t} label="AT RISK" value="2" sub="issues flagged" trend="^ from 0 watch" up={false}/>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:12,marginBottom:12 }}>
        {/* Burn-down */}
        <Card t={t}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16 }}>
            <div>
              <SectionLabel t={t}>BURN-DOWN . SPRINT 12</SectionLabel>
              <div style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:22,color:t.text }}>14 pts remaining</div>
            </div>
            <div style={{ display:"flex",gap:12,fontSize:11 }}>
              <span style={{ color:t.borderStrong }}>-- Ideal</span>
              <span style={{ color:t.accent }}>-- Actual</span>
            </div>
          </div>
          <svg width="100%" height={100} viewBox="0 0 400 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="accentFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={t.accent} stopOpacity="0.2"/>
                <stop offset="100%" stopColor={t.accent} stopOpacity="0"/>
              </linearGradient>
            </defs>
            {/* Grid */}
            {[0,25,50,75,100].map(y=><line key={y} x1={0} y1={y} x2={400} y2={y} stroke={t.border} strokeWidth={0.5}/>)}
            {/* Ideal */}
            <polyline points="0,0 400,100" fill="none" stroke={t.borderStrong} strokeWidth={1.5} strokeDasharray="6,3"/>
            {/* Actual */}
            <polyline points="0,0 57,10 114,22 171,34 228,40" fill="none" stroke={t.accent} strokeWidth={2.5} strokeLinecap="round"/>
            <polygon points="0,0 57,10 114,22 171,34 228,40 228,100 0,100" fill="url(#accentFill)"/>
          </svg>
        </Card>

        {/* Donut breakdown */}
        <Card t={t}>
          <SectionLabel t={t}>ISSUE BREAKDOWN</SectionLabel>
          <div style={{ display:"flex",alignItems:"center",gap:16 }}>
            <DonutChart size={80} segments={[
              { pct:Math.round(done/ISSUES.length*100), color:t.green },
              { pct:Math.round(inProg/ISSUES.length*100), color:t.accent },
              { pct:100-Math.round(done/ISSUES.length*100)-Math.round(inProg/ISSUES.length*100), color:t.borderStrong },
            ]}/>
            <div>
              {Object.entries(STATUS).map(([k,v])=>{
                const cnt=ISSUES.filter(i=>i.status===k).length;
                return <div key={k} style={{ display:"flex",alignItems:"center",gap:8,marginBottom:6 }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:v.color }}/>
                  <span style={{ fontSize:12,color:t.text }}>{v.label}</span>
                  <span style={{ fontSize:12,color:t.textMuted,marginLeft:"auto" }}>{cnt}</span>
                </div>;
              })}
            </div>
          </div>
        </Card>
      </div>

      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12 }}>
        {/* Velocity trend */}
        <Card t={t}>
          <SectionLabel t={t}>VELOCITY TREND</SectionLabel>
          <BarChart t={t} color={t.accent} width={180} height={60} data={velHistory.map((v,i)=>({v,l:`S${7+i}`}))}/>
        </Card>

        {/* Cycle time */}
        <Card t={t}>
          <SectionLabel t={t}>CYCLE TIME (DAYS)</SectionLabel>
          <BarChart t={t} color={t.blue} width={140} height={60} data={cycleData}/>
        </Card>

        {/* EVM */}
        <Card t={t}>
          <SectionLabel t={t}>EARNED VALUE</SectionLabel>
          {[["PV","$1,400",t.borderStrong,100],["EV","$1,456",t.accent,104],["AC","$1,400",t.blue,100]].map(([k,v,c,w])=>(
            <div key={k} style={{ marginBottom:10 }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:3 }}>
                <span style={{ fontSize:11,color:t.textMuted }}>{k}</span>
                <span style={{ fontSize:12,fontWeight:700,color:c }}>{v}</span>
              </div>
              <div style={{ height:3,background:t.bgTertiary,borderRadius:2 }}>
                <div style={{ width:`${Math.min(w,104)}%`,maxWidth:"100%",height:"100%",background:c,borderRadius:2 }}/>
              </div>
            </div>
          ))}
          <div style={{ display:"flex",gap:12,marginTop:12,paddingTop:10,borderTop:`1px solid ${t.border}` }}>
            {[["CV","+$56",true],["SPI","1.04",true]].map(([k,v,up])=>(
              <div key={k}><div style={{ fontSize:10,color:t.textMuted }}>{k}</div><div style={{ fontSize:18,fontWeight:800,color:up?t.green:t.red,fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif" }}>{v}</div></div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// MODULE: BACKLOG
// ============================================================
function Backlog({ t }) {
  const [filter,setFilter]=useState("all");
  const [sel,setSel]=useState(null);
  const filtered=filter==="all"?ISSUES:ISSUES.filter(i=>i.pillar===filter);
  const pillarC={work:t.accent,insights:t.blue,structure:t.orange};

  return (
    <div style={{ display:"flex",flexDirection:"column",height:"100%",overflow:"hidden" }}>
      <div style={{ padding:"13px 22px",borderBottom:`1px solid ${t.border}`,background:t.bgSecondary,display:"flex",gap:8,alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div style={{ display:"flex",gap:4 }}>
          {["all","work","insights","structure"].map(f=>(
            <button key={f} onClick={()=>setFilter(f)} style={{ background:filter===f?t.accentDim:"none",border:`1px solid ${filter===f?t.accent:t.border}`,color:filter===f?t.accentText:t.textSecondary,borderRadius:4,padding:"5px 12px",fontSize:10,cursor:"pointer",fontFamily:"inherit",letterSpacing:"0.08em",textTransform:"uppercase" }}>{f}</button>
          ))}
        </div>
        <div style={{ display:"flex",gap:8,alignItems:"center" }}>
          <span style={{ fontSize:12,color:t.textMuted }}>{filtered.length} issues</span>
          <Btn accent t={t} small>+ Issue</Btn>
        </div>
      </div>
      <div style={{ flex:1,overflowY:"auto",position:"relative" }}>
        <table style={{ width:"100%",borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:t.bgSecondary,position:"sticky",top:0,zIndex:1 }}>
              {["","ID","Title","Status","Priority","Assignee","Points","Pillar","PR","Time"].map(h=>(
                <th key={h} style={{ padding:"9px 14px",textAlign:"left",fontSize:9,color:t.textMuted,letterSpacing:"0.12em",borderBottom:`1px solid ${t.border}`,fontWeight:600,whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(issue=>{
              const s=STATUS[issue.status];
              return (
                <tr key={issue.id} style={{ borderBottom:`1px solid ${t.border}`,cursor:"pointer",transition:"background 0.1s" }}
                  onMouseEnter={e=>e.currentTarget.style.background=t.bgHover}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                  onClick={()=>setSel(issue)}>
                  <td style={{ padding:"9px 14px",width:20 }}><div style={{ width:6,height:6,borderRadius:"50%",background:s.color }}/></td>
                  <td style={{ padding:"9px 14px",fontSize:11,color:t.accent,letterSpacing:"0.06em",whiteSpace:"nowrap" }}>{issue.id}</td>
                  <td style={{ padding:"9px 14px",fontSize:13,color:t.text,maxWidth:300 }}>{issue.title}</td>
                  <td style={{ padding:"9px 14px" }}><span style={{ fontSize:10,padding:"2px 7px",background:s.color+"1A",color:s.color,borderRadius:3 }}>{s.label}</span></td>
                  <td style={{ padding:"9px 14px",fontSize:12,color:PRIORITY[issue.priority].color }}>{PRIORITY[issue.priority].sym}</td>
                  <td style={{ padding:"9px 14px" }}>{issue.assignee?<Avatar id={issue.assignee} size={22}/>:<span style={{ fontSize:11,color:t.textMuted }}>--</span>}</td>
                  <td style={{ padding:"9px 14px",fontSize:12,color:t.textMuted }}>{issue.points}pt</td>
                  <td style={{ padding:"9px 14px" }}><span style={{ fontSize:10,color:pillarC[issue.pillar]||t.textMuted,letterSpacing:"0.06em" }}>{issue.pillar?.toUpperCase()}</span></td>
                  <td style={{ padding:"9px 14px",fontSize:11,color:t.blue }}>{issue.pr||"--"}</td>
                  <td style={{ padding:"9px 14px",fontSize:11,color:t.textMuted }}>{issue.time}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sel&&<IssueDetail issue={sel} t={t} onClose={()=>setSel(null)}/>}
      </div>
    </div>
  );
}

// ============================================================
// MODULE: MY TASKS
// ============================================================
function MyTasks({ t }) {
  const mine=ISSUES.filter(i=>i.assignee==="AL");
  const groups={today:mine.filter(i=>i.status==="in_progress"),upcoming:mine.filter(i=>i.status==="todo"),completed:mine.filter(i=>i.status==="done")};

  return (
    <div style={{ padding:"24px 32px",overflowY:"auto",height:"100%" }}>
      <div style={{ marginBottom:24 }}>
        <SectionLabel t={t}>WORK . PERSONAL</SectionLabel>
        <h1 style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:26,color:t.text }}>My Tasks</h1>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr",gap:16 }}>
        <div>
          {[["IN PROGRESS",groups.today,t.blue],["TODO",groups.upcoming,t.textMuted],["DONE",groups.completed,t.green]].map(([label,items,color])=>(
            <div key={label} style={{ marginBottom:24 }}>
              <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:10 }}>
                <div style={{ width:8,height:8,borderRadius:"50%",background:color }}/>
                <SectionLabel t={t}>{label}</SectionLabel>
                <span style={{ fontSize:10,color:t.textMuted }}>({items.length})</span>
              </div>
              {items.map(i=>(
                <div key={i.id} style={{ display:"flex",gap:12,alignItems:"flex-start",padding:"10px 14px",background:t.bgSecondary,border:`1px solid ${t.border}`,borderRadius:7,marginBottom:6,transition:"all 0.15s",cursor:"pointer" }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=t.borderStrong;e.currentTarget.style.transform="translateX(3px)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=t.border;e.currentTarget.style.transform="translateX(0)";}}>
                  <div style={{ width:14,height:14,borderRadius:"50%",border:`2px solid ${color}`,marginTop:2,flexShrink:0,background:i.status==="done"?color:"transparent" }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13,color:i.status==="done"?t.textMuted:t.text,textDecoration:i.status==="done"?"line-through":"none",marginBottom:4 }}>{i.title}</div>
                    <div style={{ display:"flex",gap:8 }}>
                      <span style={{ fontSize:10,color:t.accent }}>{i.id}</span>
                      {i.tags.slice(0,2).map(tag=><Tag key={tag} label={tag} t={t}/>)}
                      {i.time!=="0m"&&<span style={{ fontSize:10,color:t.textMuted }}> {i.time}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize:11,color:t.textMuted }}>{i.points}pt</span>
                </div>
              ))}
              {items.length===0&&<div style={{ fontSize:12,color:t.textMuted,padding:"10px 14px" }}>Nothing here</div>}
            </div>
          ))}
        </div>

        {/* Focus block */}
        <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
          <Card t={t}>
            <SectionLabel t={t}>THIS WEEK</SectionLabel>
            {[["Mon","RC-004 EVM dashboard",t.blue],["Tue","RC-004 continued",t.blue],["Wed","Sprint review prep",t.accent],["Thu","Standup + backlog",t.textMuted],["Fri","Sprint demo",t.orange]].map(([day,task,c])=>(
              <div key={day} style={{ display:"flex",gap:10,marginBottom:8,alignItems:"center" }}>
                <span style={{ fontSize:10,color:t.textMuted,width:28,flexShrink:0 }}>{day}</span>
                <div style={{ flex:1,height:28,background:c+"18",border:`1px solid ${c}30`,borderRadius:4,display:"flex",alignItems:"center",padding:"0 8px",fontSize:11,color:c }}>{task}</div>
              </div>
            ))}
          </Card>
          <Card t={t}>
            <SectionLabel t={t}>TIME TRACKED TODAY</SectionLabel>
            <div style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:32,color:t.text }}>3h 42m</div>
            <div style={{ fontSize:12,color:t.textMuted,marginBottom:12 }}>Goal: 6h . 62%</div>
            <div style={{ height:4,background:t.bgTertiary,borderRadius:2 }}>
              <div style={{ width:"62%",height:"100%",background:t.accent,borderRadius:2 }}/>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MODULE: ROADMAP
// ============================================================
function Roadmap({ t }) {
  const now=[ISSUES[0],ISSUES[1],ISSUES[5]];
  const next=[ISSUES[2],ISSUES[3]];
  const later=[ISSUES[6],ISSUES[7]];
  const pillarC={work:t.accent,insights:t.blue,structure:t.orange};

  return (
    <div style={{ padding:"24px 32px",overflowY:"auto",height:"100%" }}>
      <div style={{ marginBottom:24 }}>
        <SectionLabel t={t}>WORK . PLANNING</SectionLabel>
        <h1 style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:26,color:t.text }}>Roadmap</h1>
      </div>

      {/* Timeline vis */}
      <Card t={t} style={{ marginBottom:20 }}>
        <SectionLabel t={t}>TIMELINE . Q1 2025</SectionLabel>
        <div style={{ position:"relative",paddingTop:30 }}>
          {/* Month markers */}
          {["Jan","Feb","Mar","Apr"].map((m,i)=>(
            <div key={m} style={{ position:"absolute",top:0,left:`${i*25}%`,fontSize:9,color:t.textMuted,letterSpacing:"0.1em" }}>{m}</div>
          ))}
          <div style={{ height:1,background:t.border,marginBottom:12 }}/>
          {ISSUES.slice(0,6).map((issue,i)=>{
            const left=5+i*6;
            const width=8+issue.points*1.5;
            const top=i%3*22;
            return (
              <div key={issue.id} style={{ position:"relative",height:22,marginBottom:2 }}>
                <div title={`${issue.id}: ${issue.title}`} style={{ position:"absolute",left:`${left}%`,width:`${width}%`,height:18,background:pillarC[issue.pillar]||t.accent,borderRadius:9,opacity:0.85,cursor:"pointer",display:"flex",alignItems:"center",padding:"0 8px",transition:"all 0.15s",overflow:"hidden" }}
                  onMouseEnter={e=>e.currentTarget.style.opacity="1"}
                  onMouseLeave={e=>e.currentTarget.style.opacity="0.85"}>
                  <span style={{ fontSize:9,color:t.bg,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{issue.id} {issue.title.slice(0,20)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Now/Next/Later swimlanes */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12 }}>
        {[["NOW",now,t.accent,"Active sprint work"],["NEXT",next,t.blue,"Planned for next sprint"],["LATER",later,t.textMuted,"Backlog -- not yet sized"]].map(([label,items,color,desc])=>(
          <div key={label} style={{ background:t.bgSecondary,border:`1px solid ${t.border}`,borderTop:`2px solid ${color}`,borderRadius:8,padding:16 }}>
            <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
              <span style={{ fontSize:12,fontWeight:700,color,letterSpacing:"0.08em" }}>{label}</span>
              <span style={{ fontSize:10,color:t.textMuted }}>{items.length}</span>
            </div>
            <div style={{ fontSize:11,color:t.textMuted,marginBottom:14 }}>{desc}</div>
            {items.map(i=>(
              <div key={i.id} style={{ marginBottom:8,padding:"9px 11px",background:t.bgTertiary,border:`1px solid ${t.border}`,borderRadius:6,cursor:"pointer" }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=color}
                onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}>
                <div style={{ fontSize:10,color,marginBottom:3 }}>{i.id}</div>
                <div style={{ fontSize:12,color:t.text,lineHeight:1.3 }}>{i.title.slice(0,50)}...</div>
                <div style={{ display:"flex",justifyContent:"space-between",marginTop:6 }}>
                  <Tag label={i.pillar.toUpperCase()} color={pillarC[i.pillar]} t={t}/>
                  {i.assignee?<Avatar id={i.assignee} size={18}/>:<span style={{ fontSize:10,color:t.textMuted }}>Unassigned</span>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MODULE: ANALYTICS
// ============================================================
function Analytics({ t }) {
  return (
    <div style={{ padding:"24px 32px",overflowY:"auto",height:"100%" }}>
      <div style={{ marginBottom:20 }}>
        <SectionLabel t={t}>INSIGHTS . DATA</SectionLabel>
        <h1 style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:26,color:t.text }}>Analytics</h1>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12 }}>
        <Card t={t}>
          <SectionLabel t={t}>CUMULATIVE FLOW . 4 WEEKS</SectionLabel>
          <svg width="100%" height={120} viewBox="0 0 400 120" preserveAspectRatio="none">
            {[
              {pts:"0,100 100,90 200,85 300,80 400,76",color:t.green+"88"},
              {pts:"0,100 100,95 200,88 300,85 400,80",color:t.accent+"88"},
              {pts:"0,105 100,100 200,96 300,90 400,88",color:t.blue+"88"},
              {pts:"0,115 100,110 200,108 300,105 400,100",color:t.borderStrong+"88"},
            ].map((l,i)=><polyline key={i} points={l.pts} fill="none" stroke={l.color} strokeWidth={2} strokeLinecap="round"/>)}
            {["Todo","In Prog","Review","Done"].map((l,i)=><text key={l} x={360} y={[100,80,88,76][i]} fontSize={9} fill={[t.borderStrong,t.blue,t.accent,t.green][i]} fontFamily="inherit">{l}</text>)}
          </svg>
        </Card>
        <Card t={t}>
          <SectionLabel t={t}>THROUGHPUT . ISSUES / WEEK</SectionLabel>
          <BarChart t={t} color={t.purple} width={300} height={80} data={[{v:4,l:"W1"},{v:6,l:"W2"},{v:5,l:"W3"},{v:8,l:"W4"},{v:7,l:"W5"},{v:9,l:"W6"}]}/>
        </Card>
        <Card t={t}>
          <SectionLabel t={t}>LEAD TIME DISTRIBUTION</SectionLabel>
          <svg width="100%" height={100} viewBox="0 0 300 100" preserveAspectRatio="none">
            {[{x:20,h:20},{x:50,h:35},{x:80,h:55},{x:110,h:80},{x:140,h:95},{x:170,h:70},{x:200,h:45},{x:230,h:25},{x:260,h:10}].map((b,i)=>(
              <rect key={i} x={b.x} y={100-b.h} width={22} height={b.h} fill={t.blue} rx={2} opacity={0.8}/>
            ))}
          </svg>
          <div style={{ fontSize:11,color:t.textMuted }}>Avg: 3.2d . P95: 8.4d</div>
        </Card>
        <Card t={t}>
          <SectionLabel t={t}>MEMBER CONTRIBUTION</SectionLabel>
          {MEMBERS.map(m=>{
            const pts=ISSUES.filter(i=>i.assignee===m.id).reduce((s,i)=>s+i.points,0);
            const pct=Math.round(pts/42*100);
            return (
              <div key={m.id} style={{ display:"flex",gap:10,alignItems:"center",marginBottom:10 }}>
                <Avatar id={m.id} size={24}/>
                <div style={{ flex:1 }}>
                  <div style={{ display:"flex",justifyContent:"space-between",marginBottom:3 }}>
                    <span style={{ fontSize:12,color:t.text }}>{m.name}</span>
                    <span style={{ fontSize:11,color:m.color }}>{pts}pt</span>
                  </div>
                  <div style={{ height:3,background:t.bgTertiary,borderRadius:2 }}>
                    <div style={{ width:`${pct}%`,height:"100%",background:m.color,borderRadius:2 }}/>
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// MODULE: MEMBERS
// ============================================================
function Members({ t }) {
  return (
    <div style={{ padding:"24px 32px",overflowY:"auto",height:"100%" }}>
      <div style={{ marginBottom:20 }}>
        <SectionLabel t={t}>STRUCTURE . TEAM</SectionLabel>
        <h1 style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:26,color:t.text }}>Members</h1>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
        {MEMBERS.map(m=>{
          const myIssues=ISSUES.filter(i=>i.assignee===m.id);
          return (
            <Card key={m.id} t={t} style={{ display:"flex",gap:16 }}>
              <div style={{ position:"relative" }}>
                <Avatar id={m.id} size={52}/>
                <div style={{ position:"absolute",bottom:1,right:1 }}><Dot status={m.status}/></div>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:700,fontSize:16,color:t.text }}>{m.name}</div>
                <div style={{ fontSize:12,color:t.textMuted,marginBottom:12 }}>{m.role} . {m.status}</div>
                <div style={{ display:"flex",gap:16,marginBottom:12 }}>
                  {[["Issues",myIssues.length],["Points",myIssues.reduce((s,i)=>s+i.points,0)],["Done",myIssues.filter(i=>i.status==="done").length]].map(([k,v])=>(
                    <div key={k}><div style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:700,fontSize:18,color:t.text }}>{v}</div><div style={{ fontSize:10,color:t.textMuted }}>{k}</div></div>
                  ))}
                </div>
                <SparkLine data={[2,4,3,5,4,6,5]} color={m.color} width={100} height={24}/>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// STUB
// ============================================================
function Stub({ label, t }) {
  return (
    <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100%",flexDirection:"column",gap:12,opacity:0.4 }}>
      <div style={{ fontSize:52,color:t.textMuted }}>[H]</div>
      <div style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:700,fontSize:22,color:t.text }}>{label}</div>
      <div style={{ fontSize:13,color:t.textMuted }}>Module in progress</div>
    </div>
  );
}

// ============================================================
// ROOT APP
// ============================================================
export default function MainApp({ session }: any) {
const initStore = useReachStore(state => state.initStore);

useEffect(() => {
  if (session) {
    // Get the tenant_id and role from JWT claims
    const tenantId = session.user.app_metadata?.tenant_id || session.user.user_metadata?.tenant_id;
    const role = session.user.app_metadata?.user_role || session.user.user_metadata?.user_role || 'member';
    if (tenantId) {
      initStore(tenantId, session.user.id, role);
    }
  }
}, [session, initStore]);

const isIdeRoute = window.location.pathname === "/ide";

// Check if store is hydrating, but only block UI if we genuinely need tenant info first
const tenantId = useReachStore(state => state.tenantId);
if (!tenantId) {
  return <div style={{ height: "100vh", background: "#07070A", display: "flex", alignItems: "center", justifyContent: "center", color: "#8080A0" }}>Loading Workspace...</div>;
}
  
if (isIdeRoute) {
  return <IdeApp />;
}

useEffect(()=>{
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;700;800&display=swap';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  },[]);

  const [theme,setTheme]=useState("dark");
  const [mod,setMod]=useState("home");
  const [collapsed,setCollapsed]=useState(false);
  const [cmd,setCmd]=useState(false);
  const [showShortcuts,setShowShortcuts]=useState(false);
  const t=THEMES[theme];

  useEffect(()=>{
    const h=e=>{
      const isMeta = e.metaKey || e.ctrlKey;
      if(isMeta && e.key === "/") { e.preventDefault(); setShowShortcuts(p=>!p); return; }
      if(isMeta && e.key === "1") { e.preventDefault(); setMod("home"); return; }
      if(isMeta && e.key === "2") { e.preventDefault(); setMod("board"); return; }
      if(isMeta && e.key === "3") { e.preventDefault(); setMod("ide"); return; }
      if(isMeta && e.key === "4") { e.preventDefault(); setMod("chat"); return; }
      if(isMeta && e.key === "5") { e.preventDefault(); setMod("docs"); return; }
      if(isMeta && e.key === "6") { e.preventDefault(); setMod("dashboard"); return; }
      if(isMeta && e.key === "7") { e.preventDefault(); setMod("analytics"); return; }
      if(isMeta && e.key.toLowerCase() === "b") { e.preventDefault(); setCollapsed(p=>!p); return; }
      if(isMeta && e.key === "`") { e.preventDefault(); window.location.assign("/ide?tab=terminal"); return; }
      if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();setCmd(p=>!p);}
      if(e.key==="Escape"){
        setCmd(false);
        setShowShortcuts(false);
      }
    };

    if(mod==="ideapp") {
      window.location.assign("/ide");
    }

    window.addEventListener("keydown",h);
    return()=>window.removeEventListener("keydown",h);
  },[mod]);

  const pillarKey={accent:t.accent,blue:t.blue,orange:t.orange};

  const MODULES={
    home:<Home t={t} setModule={setMod}/>,
    board:<Board t={t}/>,
    backlog:<Backlog t={t}/>,
    mytasks:<MyTasks t={t}/>,
    roadmap:<Roadmap t={t}/>,
    ide:<IDE t={t}/>,
    docs:<Docs t={t}/>,
    chat:<Chat t={t}/>,
    standup:<Standup t={t}/>,
    dashboard:<Dashboard t={t}/>,
    analytics:<Analytics t={t}/>,
    reports:<Stub label="Reports" t={t}/>,
    projects:<Stub label="Projects" t={t}/>,
    members:<Members t={t}/>,
    clients:<Stub label="Clients" t={t}/>,
    settings:<Stub label="Settings" t={t}/>,
  };

  const allItems=NAV.flatMap(s=>s.items);
  const activeItem=allItems.find(i=>i.id===mod);

  return (
    <div style={{ display:"flex",height:"100vh",overflow:"hidden",background:t.bg,color:t.text,fontFamily:"'Space Mono',ui-monospace,'Cascadia Code','Source Code Pro',Menlo,Consolas,monospace",transition:"background 0.25s,color 0.25s" }}>
      <style>{`
        /* fonts loaded via link tag */
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-thumb{background:${t.borderStrong};border-radius:2px;}
        input::placeholder{color:${t.textMuted};}
        textarea::placeholder{color:${t.textMuted};}
      `}</style>

      {/* SIDEBAR */}
      <div style={{ width:collapsed?48:216,background:t.bgSecondary,borderRight:`1px solid ${t.border}`,display:"flex",flexDirection:"column",transition:"width 0.2s cubic-bezier(0.16,1,0.3,1)",overflow:"hidden",flexShrink:0 }}>
        {/* Logo */}
        <div style={{ height:50,display:"flex",alignItems:"center",padding:collapsed?"0 12px":"0 14px",borderBottom:`1px solid ${t.border}`,justifyContent:"space-between",flexShrink:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:9 }}>
            <div style={{ width:26,height:26,background:t.accent,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,color:t.bg,fontWeight:700,flexShrink:0 }}>R</div>
            {!collapsed&&<span style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:800,fontSize:15,letterSpacing:"0.03em" }}>REACH</span>}
          </div>
          {!collapsed&&<button onClick={()=>setCollapsed(true)} style={{ background:"none",border:"none",color:t.textMuted,cursor:"pointer",fontSize:13,padding:"0 2px" }}></button>}
        </div>
        {collapsed&&<button onClick={()=>setCollapsed(false)} style={{ background:"none",border:"none",color:t.textMuted,cursor:"pointer",padding:"8px 0",fontSize:13,borderBottom:`1px solid ${t.border}`,textAlign:"center" }}></button>}

        {/* Search */}
        {!collapsed&&(
          <button onClick={()=>setCmd(true)} style={{ margin:"8px 8px 2px",background:t.bgTertiary,border:`1px solid ${t.border}`,borderRadius:5,padding:"6px 10px",display:"flex",alignItems:"center",gap:6,cursor:"pointer",color:t.textMuted,fontSize:11,flexShrink:0 }}>
            <span style={{ flex:1,textAlign:"left" }}>Search...</span>
            <span style={{ fontSize:9,background:t.bgHover,borderRadius:3,padding:"1px 4px" }}>K</span>
          </button>
        )}

        {/* Nav */}
        <nav style={{ flex:1,overflowY:"auto",padding:"4px 0" }}>
          {NAV.map(section=>(
            <div key={section.pillar} style={{ marginBottom:2 }}>
              {!collapsed&&<div style={{ padding:"8px 14px 3px",fontSize:8,letterSpacing:"0.2em",color:pillarKey[section.pillarKey],fontWeight:700 }}>{section.pillar}</div>}
              {section.items.map(item=>(
                <button key={item.id} onClick={()=>setMod(item.id)} title={collapsed?item.label:undefined} style={{ width:"100%",textAlign:"left",background:mod===item.id?t.accentDim:"none",border:"none",borderLeft:`2px solid ${mod===item.id?t.accent:"transparent"}`,cursor:"pointer",fontFamily:"inherit",padding:collapsed?"8px 0":"7px 14px",display:"flex",alignItems:"center",gap:collapsed?0:8,color:mod===item.id?t.accentText:t.textSecondary,fontSize:12,transition:"all 0.1s",justifyContent:collapsed?"center":"flex-start" }}
                  onMouseEnter={e=>{if(mod!==item.id)e.currentTarget.style.background=t.bgHover;}}
                  onMouseLeave={e=>{if(mod!==item.id)e.currentTarget.style.background="none";}}>
                  <span style={{ fontSize:collapsed?15:12,flexShrink:0 }}>{item.icon}</span>
                  {!collapsed&&<><span style={{ flex:1 }}>{item.label}</span>{item.badge&&<span style={{ fontSize:8,background:t.orange,color:"#fff",borderRadius:10,padding:"1px 4px",minWidth:16,textAlign:"center" }}>{item.badge}</span>}</>}
                </button>
              ))}
            </div>
          ))}
        </nav>

          {/* Bottom */}
          <div style={{ borderTop:`1px solid ${t.border}`,padding:"8px" }}>
            <button onClick={()=>setTheme(p=>p==="dark"?"light":"dark")} style={{ width:"100%",background:t.bgTertiary,border:`1px solid ${t.border}`,borderRadius:5,padding:"6px",cursor:"pointer",color:t.textSecondary,fontSize:collapsed?15:11,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:5, marginBottom: 8 }}>
              {theme==="dark"?"*":"O"}
              {!collapsed&&<span>{theme==="dark"?"Light":"Dark"}</span>}
            </button>
            <button onClick={() => supabase.auth.signOut()} style={{ width:"100%",background:'none',border:'none',cursor:"pointer",color:t.textSecondary,fontSize:collapsed?15:11,fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:5 }}>
              [!]{!collapsed&&<span>Log Out</span>}
            </button>
            {!collapsed&&<div style={{ display:"flex",gap:8,alignItems:"center",padding:"8px 2px 0" }}>
              <Avatar id="AL" size={26}/>
              <div><div style={{ fontSize:11,color:t.text }}>{session?.user?.user_metadata?.display_name || 'Alex L.'}</div><div style={{ fontSize:9,color:t.textMuted }}>{useReachStore.getState().role.toUpperCase()} . RC-CORE</div></div>
            </div>}
          </div>
      </div>

      {/* MAIN */}
      <div style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",position:"relative" }}>
        {/* Topbar */}
        <div style={{ height:50,borderBottom:`1px solid ${t.border}`,display:"flex",alignItems:"center",padding:"0 22px",justifyContent:"space-between",background:t.bgSecondary,flexShrink:0 }}>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            {activeItem&&<span style={{ fontFamily:"-apple-system,'Segoe UI',system-ui,BlinkMacSystemFont,sans-serif",fontWeight:700,fontSize:16,color:t.text }}>{activeItem.label}</span>}
          </div>
          <div style={{ display:"flex",gap:8,alignItems:"center" }}>
            <Btn accent t={t} small onClick={()=>setMod("board")}>+ New Issue</Btn>
            <div style={{ display:"flex" }}>
              {MEMBERS.slice(0,4).map((m,i)=><div key={m.id} style={{ marginLeft:i>0?-6:0 }}><Avatar id={m.id} size={26}/></div>)}
            </div>
          </div>
        </div>

        {/* Module */}
        <div style={{ flex:1,overflow:"hidden",position:"relative" }}>
          {MODULES[mod]||<Stub label={mod} t={t}/>}
        </div>
      </div>

      {/* CMD PALETTE */}
      {cmd&&(
        <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:"18vh",zIndex:1000 }} onClick={()=>setCmd(false)}>
          <div style={{ background:t.bgSecondary,border:`1px solid ${t.borderStrong}`,borderRadius:10,width:540,overflow:"hidden",boxShadow:t.shadowLg }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:"11px 14px",borderBottom:`1px solid ${t.border}`,display:"flex",gap:8,alignItems:"center" }}>
              <span style={{ color:t.textMuted }}></span>
              <input autoFocus placeholder="Search issues, pages, members..." style={{ flex:1,background:"none",border:"none",outline:"none",fontSize:14,color:t.text,fontFamily:"inherit" }}/>
              <span style={{ fontSize:10,color:t.textMuted,background:t.bgTertiary,borderRadius:3,padding:"2px 5px" }}>ESC</span>
            </div>
            <div style={{ maxHeight:340,overflowY:"auto" }}>
              <div style={{ padding:"7px 14px",fontSize:9,color:t.textMuted,letterSpacing:"0.15em" }}>RECENT ISSUES</div>
              {ISSUES.slice(0,4).map(i=>(
                <div key={i.id} style={{ padding:"9px 14px",display:"flex",gap:10,alignItems:"center",cursor:"pointer" }}
                  onMouseEnter={e=>e.currentTarget.style.background=t.bgHover}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                  onClick={()=>{setMod("board");setCmd(false);}}>
                  <span style={{ fontSize:10,color:t.accent,width:58,flexShrink:0 }}>{i.id}</span>
                  <span style={{ fontSize:13,color:t.text,flex:1 }}>{i.title}</span>
                  <div style={{ width:6,height:6,borderRadius:"50%",background:STATUS[i.status].color }}/>
                </div>
              ))}
              <div style={{ padding:"7px 14px",fontSize:9,color:t.textMuted,letterSpacing:"0.15em",borderTop:`1px solid ${t.border}` }}>PAGES</div>
              {allItems.map(item=>(
                <div key={item.id} style={{ padding:"8px 14px",display:"flex",gap:10,alignItems:"center",cursor:"pointer" }}
                  onMouseEnter={e=>e.currentTarget.style.background=t.bgHover}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                  onClick={()=>{setMod(item.id);setCmd(false);}}>
                  <span style={{ color:t.textMuted,fontSize:12 }}>{item.icon}</span>
                  <span style={{ fontSize:13,color:t.text }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SHORTCUTS */}
      {showShortcuts&&(
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1100 }} onClick={()=>setShowShortcuts(false)}>
          <div style={{ width:520, background:t.bgSecondary, border:`1px solid ${t.borderStrong}`, borderRadius:10, boxShadow:t.shadowLg, overflow:"hidden" }} onClick={e=>e.stopPropagation()}>
            <div style={{ padding:"12px 14px", borderBottom:`1px solid ${t.border}`, fontSize:13, fontWeight:700, color:t.text }}>Keyboard Shortcuts</div>
            <div style={{ padding:14, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              {[
                ["Ctrl/Cmd+1","Home"],
                ["Ctrl/Cmd+2","Sprint Board"],
                ["Ctrl/Cmd+3","Code & PRs"],
                ["Ctrl/Cmd+4","Chat"],
                ["Ctrl/Cmd+5","Docs"],
                ["Ctrl/Cmd+6","Dashboard"],
                ["Ctrl/Cmd+7","Analytics"],
                ["Ctrl/Cmd+B","Toggle Sidebar"],
                ["Ctrl/Cmd+K","Command Palette"],
                ["Ctrl/Cmd+`","IDE Terminal"],
                ["Ctrl/Cmd+/","Toggle Shortcuts"],
                ["Esc","Close overlays"],
              ].map(([k,v])=>(
                <div key={k} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", background:t.bgTertiary, border:`1px solid ${t.border}`, borderRadius:6, padding:"8px 10px" }}>
                  <span style={{ color:t.textSub, fontSize:12 }}>{v}</span>
                  <span style={{ color:t.accent, fontSize:11 }}>{k}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

