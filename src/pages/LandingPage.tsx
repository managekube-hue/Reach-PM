import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Hero from "../components/ui/hero-button-expendable";
import CelestialSphere from "../components/ui/celestial-sphere";
import GenerativeMountainScene from "../components/ui/mountain-scene";
import { Terminal, GitPullRequest, LayoutDashboard, BrainCircuit, Users, Bot, MessageSquare } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("WORK");

  // The Command Matrix definitions
  const matrix = {
    WORK: {
      color: "#3ECFCF",
      title: "Tactical Execution",
      desc: "Kanban, Scrum, Shape Up, and issue-driven development connected natively to your codebase.",
      preview: "SELECT * FROM issues WHERE status = 'in_progress' AND assignee = @me;",
      icon: <Terminal className="w-5 h-5" />
    },
    INSIGHTS: {
      color: "#8B7CF8",
      title: "Real-time Analytics",
      desc: "Earned Value Management (EVM), precise Burndown charts, and cost tracking out of the box.",
      preview: "SELECT cpi, spi, sprint_velocity FROM platform_analytics WHERE project_id = @active;",
      icon: <LayoutDashboard className="w-5 h-5" />
    },
    STRUCTURE: {
      color: "#E8965A",
      title: "Architectural Clarity",
      desc: "Deep permission matrices, global mentions, client pipelines, and Git integration.",
      preview: "GRANT ALL ON SCHEMA public TO platform_owner;",
      icon: <GitPullRequest className="w-5 h-5" />
    }
  };

  const activeData = matrix[activeTab as keyof typeof matrix];

  return (
    <div className="min-h-screen bg-[#080809] text-white font-dm-mono selection:bg-[#3ECFCF] selection:text-[#080809]">
      
      {/* 1. Top Section - Expanded Hero Component */}
      <Hero />

      {/* 2. The Command Matrix */}
      <section className="relative py-20 sm:py-32 px-4 sm:px-6 lg:px-8 border-b border-[#222226] max-w-7xl mx-auto z-10 w-full relative">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
          
          {/* Left Menu (Command Palette vibe) */}
          <div className="lg:col-span-4 flex flex-col gap-2">
            <div className="text-xs text-[#54545E] uppercase tracking-widest mb-4 font-bricolage">System Modules</div>
            {Object.keys(matrix).map((key) => {
              const isActive = activeTab === key;
              const data = matrix[key as keyof typeof matrix];
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex items-center justify-between p-4 rounded-xl text-left transition-all duration-300 border ${
                    isActive 
                      ? "bg-[#141416] border-[#2E2E34] text-white" 
                      : "bg-transparent border-transparent text-[#9898A8] hover:bg-[#0E0E10] hover:text-[#C8C8C0]"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span style={{ color: isActive ? data.color : "#54545E" }}>{data.icon}</span>
                    <span className="font-bricolage font-bold tracking-wide">{key}</span>
                  </div>
                  {isActive && <motion.div layoutId="indicator" className="w-2 h-2 rounded-full" style={{ background: data.color }} />}
                </button>
              );
            })}
          </div>

          {/* Right Preview Pane (IDE Vibe) */}
          <div className="lg:col-span-8 bg-[#0E0E10]/90 backdrop-blur-sm rounded-2xl border border-[#222226] overflow-hidden shadow-2xl h-[400px] flex flex-col relative group">
            <div className="flex items-center gap-2 border-b border-[#222226] px-4 py-3 bg-[#141416]/90 relative z-20">
              <div className="w-3 h-3 rounded-full bg-[#222226]"></div>
              <div className="w-3 h-3 rounded-full bg-[#222226]"></div>
              <div className="w-3 h-3 rounded-full bg-[#222226]"></div>
              <div className="ml-4 text-xs tracking-wider text-[#54545E] cursor-default">~/{activeTab.toLowerCase()}.sh</div>
            </div>
            
            <div className="p-8 flex-1 flex flex-col justify-center relative z-20">
              <motion.h3 
                key={activeData.title}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="text-3xl font-bricolage font-bold mb-4 drop-shadow-md" style={{ color: activeData.color }}
              >
                {activeData.title}
              </motion.h3>
              <motion.p key={activeData.desc} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="text-[#eeeef2] text-lg max-w-md leading-relaxed mb-8 drop-shadow-md">
                {activeData.desc}
              </motion.p>
              
              <motion.div key={activeData.preview} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-[#080809]/80 backdrop-blur-md p-4 rounded-lg border border-[#222226] font-dm-mono text-sm text-[#C8C8C0] shadow-inner">
                <span className="text-[#E8965A]">➜</span> <span className="text-[#3ECFCF]">~/reach</span> {activeData.preview}
              </motion.div>
            </div>

            {/* Background shader transitioning based on tab */}
            <div className="absolute inset-0 z-0 opacity-40 transition-opacity duration-1000 group-hover:opacity-60 pointer-events-none" style={{ maskImage: 'linear-gradient(to bottom, transparent, black)' }}>
              <CelestialSphere 
                hue={activeTab === 'WORK' ? 190 : activeTab === 'INSIGHTS' ? 250 : 25} 
                speed={0.4} 
                zoom={1.2} 
                particleSize={3.0} 
              />
            </div>
          </div>
        </div>
      </section>

      {/* 3. The Living Entities Visual */}
      <section className="relative py-24 sm:py-32 px-4 border-b border-[#222226] overflow-hidden min-h-[600px] flex items-center">
        {/* Generative Mountain Scene taking up the background */}
        <div className="absolute inset-0 opacity-30 z-0 pointer-events-none mask-image-bottom" style={{ maskImage: 'linear-gradient(to top, transparent, black)' }}>
          <GenerativeMountainScene />
        </div>
        
        <div className="max-w-6xl mx-auto relative z-10 w-full">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl sm:text-5xl font-bricolage font-bold text-white tracking-tight drop-shadow-lg">
              Not just tickets. <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E8965A] to-[#F26B6B]">Living Entities.</span>
            </h2>
            <p className="text-[#e4e4e7] text-lg max-w-2xl mx-auto font-medium drop-shadow">
              Other tools fragment your product lifecycle across scattered apps.<br/><br/>
              <strong className="text-[#3ECFCF] font-bold text-xl drop-shadow-md">REACH unifies your CRM, issue tracking, QA, and cost management into one cohesive mesh.</strong>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="bg-[#141416]/80 backdrop-blur-sm border border-[#222226] hover:border-[#3ECFCF]/50 transition-colors p-8 rounded-2xl shadow-xl">
              <div className="w-12 h-12 rounded-lg bg-[#222226] flex items-center justify-center mb-6 shadow-inner">
                <Bot className="w-6 h-6 text-[#3ECFCF]" />
              </div>
              <h4 className="text-xl font-bricolage font-bold text-white mb-2">Native AI Surface</h4>
              <p className="text-[#9898A8] text-sm">Not an add-on. Agents review your PRs, query EVM metrics, and draft issues seamlessly right in the sub-thread.</p>
            </div>
            
            <div className="bg-[#141416]/80 backdrop-blur-sm border border-[#222226] hover:border-[#8B7CF8]/50 transition-colors p-8 rounded-2xl relative overflow-hidden group shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-[#8B7CF8]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="w-12 h-12 rounded-lg bg-[#222226] flex items-center justify-center mb-6 relative z-10 shadow-inner">
                <Users className="w-6 h-6 text-[#8B7CF8]" />
              </div>
              <h4 className="text-xl font-bricolage font-bold text-white mb-2 relative z-10">Multi-player Hub</h4>
              <p className="text-[#9898A8] text-sm relative z-10">Live presence, active IDE focus sessions, and automated thread routing per issue. Say goodbye to scattered DMs.</p>
            </div>
            
            <div className="bg-[#141416]/80 backdrop-blur-sm border border-[#222226] hover:border-[#E8965A]/50 transition-colors p-8 rounded-2xl shadow-xl">
              <div className="w-12 h-12 rounded-lg bg-[#222226] flex items-center justify-center mb-6 shadow-inner">
                <MessageSquare className="w-6 h-6 text-[#E8965A]" />
              </div>
              <h4 className="text-xl font-bricolage font-bold text-white mb-2">Deep CRM</h4>
              <p className="text-[#9898A8] text-sm">Revenue tied directly to tasks. Track ARR, Deals, and Stakeholder visibility in one unified PostgreSQL database.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Footer & Developer Lang */}
      <footer className="py-20 text-center relative overflow-hidden bg-[#080809]">
        <div className="relative z-10 space-y-6">
          <h2 className="text-3xl font-bricolage font-bold text-white">Initialize the Core.</h2>
          <div className="flex justify-center gap-4 text-[#3ECFCF] font-dm-mono text-xs max-w-md mx-auto flex-wrap">
            <span className="px-3 py-1 bg-[#1A1A1D] rounded-md border border-[#2E2E34] hover:bg-[#3ECFCF]/10 hover:border-[#3ECFCF] transition-colors cursor-default">[Agile]</span>
            <span className="px-3 py-1 bg-[#1A1A1D] rounded-md border border-[#2E2E34] hover:bg-[#3ECFCF]/10 hover:border-[#3ECFCF] transition-colors cursor-default">[Shape Up]</span>
            <span className="px-3 py-1 bg-[#1A1A1D] rounded-md border border-[#2E2E34] hover:bg-[#3ECFCF]/10 hover:border-[#3ECFCF] transition-colors cursor-default">[Cost Tracking]</span>
            <span className="px-3 py-1 bg-[#1A1A1D] rounded-md border border-[#2E2E34] hover:bg-[#3ECFCF]/10 hover:border-[#3ECFCF] transition-colors cursor-default">[Burndown]</span>
          </div>
          <p className="text-[#54545E] text-sm mt-8">© {new Date().getFullYear()} REACH Platform. Unified Architecture.</p>
        </div>
      </footer>

    </div>
  );
}





