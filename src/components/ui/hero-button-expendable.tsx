"use client"

import { useState, useEffect } from "react"
import { X, Check, ArrowRight, BarChart3, Globe2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { GodRays, MeshGradient } from "@paper-design/shaders-react"

export default function Hero() {
  const [isExpanded, setIsExpanded] = useState(false)
  const [formStep, setFormStep] = useState<"idle" | "submitting" | "success">("idle")

  const handleExpand = () => setIsExpanded(true)
  
  const handleClose = () => {
    setIsExpanded(false)
    // Reset form after a brief delay so the user doesn't see it reset while closing
    setTimeout(() => setFormStep("idle"), 500)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormStep("submitting")
    // Simulate API call
    setTimeout(() => {
      setFormStep("success")
    }, 1500)
  }

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "unset"
    }
    return () => { document.body.style.overflow = "unset" }
  }, [isExpanded])

  return (
    <>
      <div className="relative flex min-h-[80vh] flex-col items-center justify-center overflow-hidden bg-transparent px-4 sm:px-6 py-12 sm:py-20 transition-colors duration-300 w-full rounded-2xl border border-[#222226]">
        
        {/* GodRays Background - Adjusted to be subtle in both modes */}
        <div className="absolute inset-0 pointer-events-none rounded-2xl overflow-hidden">
          <GodRays
            colorBack="#00000000"
            // Using slightly transparent grays/whites to work on both dark/light backgrounds
            colors={["#3ECFCF20", "#1D8ED620", "#71717a40", "#52525b40"]}
            colorBloom="#3ECFCF"
            offsetX={0.85}
            offsetY={-1}
            intensity={0.5}
            spotty={0.45}
            midSize={10}
            midIntensity={0}
            density={0.38}
            bloom={0.3}
            speed={0.5}
            scale={1.6}
            frame={3332042.8159981333}
            style={{
              height: "100%",
              width: "100%",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-6 sm:gap-8 text-center max-w-5xl mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center rounded-full border border-[#222226] bg-[#0E0E10]/80 px-3 py-1 text-sm font-medium text-[#C8C8C0] backdrop-blur-sm shadow-xl"
          >
            <span className="flex h-2 w-2 rounded-full bg-[#3ECFCF] mr-2 shadow-[0_0_8px_rgba(62,207,207,0.8)]"></span>
            REACH: Autonomous Product IDE
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-extrabold tracking-tight text-white !leading-[1.1] font-bricolage"
          >
            Everything is an issue. <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#3ECFCF] to-[#1D8ED6]">
              The issue is the thread.
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl md:text-2xl text-[#9898A8] max-w-3xl px-4 leading-relaxed font-dm-mono font-light"
          >
            Stop wrestling with disconnected tools. REACH natively merges code, chat, video, and analytics straight into your sprint board.
          </motion.p>

          <AnimatePresence initial={false}>
            {!isExpanded && (
              <motion.div className="inline-block relative mt-8 z-20">
                {/* The expanding background element */}
                <motion.div
                  style={{ borderRadius: "100px" }}
                  layout
                  layoutId="cta-card"
                  className="absolute inset-0 bg-[#3ECFCF] shadow-[0_0_24px_rgba(62,207,207,0.4)]"
                />
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  layout={false}
                  onClick={handleExpand}
                  className="relative flex items-center gap-2 h-14 px-8 py-3 text-lg font-bold text-[#080809] tracking-wide hover:opacity-90 transition-opacity font-bricolage z-30 cursor-pointer"
                >
                  INITIALIZE WORKSPACE
                  <ArrowRight className="w-5 h-5 flex-shrink-0" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Expanded Modal Overlay */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              layoutId="cta-card"
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              style={{ borderRadius: "24px" }}
              layout
              className="relative flex h-[90vh] max-h-[800px] w-full max-w-6xl overflow-hidden bg-[#0E0E10] border border-[#222226] sm:rounded-[24px] shadow-2xl"
            >
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 pointer-events-none opacity-20"
              >
                <MeshGradient
                  speed={0.6}
                  colors={["#0E0E10", "#141416", "#1D8ED6", "#1A1A1D"]} 
                  distortion={0.8}
                  swirl={0.1}
                  grainMixer={0.15}
                  grainOverlay={0}
                  style={{ height: "100%", width: "100%" }}
                />
              </motion.div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={handleClose}
                className="absolute right-6 top-6 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-[#1A1A1D] border border-[#2E2E34] text-[#C8C8C0] transition-colors hover:bg-[#2E2E34] hover:text-white"
              >
                <X className="h-5 w-5" />
              </motion.button>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="relative z-10 flex flex-col lg:flex-row h-full w-full mx-auto overflow-y-auto lg:overflow-hidden"
              >
                {/* Modal content left */}
                <div className="flex-1 flex flex-col justify-center p-8 sm:p-12 lg:p-16 gap-8 text-white border-r border-[#222226]/50">
                  <div className="space-y-4">
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bricolage font-bold leading-tight tracking-tight">
                      Deploy the IDE
                    </h2>
                    <p className="text-[#9898A8] text-lg font-dm-mono max-w-md">
                      Get immediate access to the entire REACH suite. Native Git, Slack-style Chat, EVM Analytics.
                    </p>
                  </div>

                  <div className="space-y-6">
                    <div className="flex gap-4 items-start">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#1A1A1D] flex items-center justify-center border border-[#2E2E34]">
                        <BarChart3 className="w-5 h-5 text-[#3ECFCF]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Earned Value Management</h3>
                        <p className="text-[#54545E] text-sm leading-relaxed mt-1 font-dm-mono">
                          Native CPI, SPI, and Burndown tracked via automated task commits.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4 items-start">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[#1A1A1D] flex items-center justify-center border border-[#2E2E34]">
                        <Globe2 className="w-5 h-5 text-[#E8965A]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Integrated Realtime Chat</h3>
                        <p className="text-[#54545E] text-sm leading-relaxed mt-1 font-dm-mono">
                          Chat threads permanently bound to the active issue context.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Right */}
                <div className="flex-1 flex items-center justify-center p-4 sm:p-12 lg:p-16 bg-[#080809]">
                  <div className="w-full max-w-md">
                    {formStep === "success" ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center justify-center text-center h-[400px] space-y-6"
                      >
                        <div className="w-20 h-20 bg-[#3EC98E]/20 rounded-full flex items-center justify-center border border-[#3EC98E]">
                          <Check className="w-8 h-8 text-[#3EC98E]" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-white mb-2 font-bricolage">Workspace Initialized</h3>
                          <p className="text-[#9898A8] font-dm-mono text-sm shadow">Connecting to database...</p>
                        </div>
                        <button 
                          onClick={() => window.location.href="/app"}
                          className="px-6 py-2 bg-[#3ECFCF] hover:bg-[#3ECFCF]/80 text-[#080809] rounded-lg transition-colors text-sm font-bold font-bricolage uppercase mt-4"
                        >
                          Enter Dashboard
                        </button>
                      </motion.div>
                    ) : (
                      <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1 mb-8">
                          <h3 className="text-2xl font-bold text-white font-bricolage">Create Tenant</h3>
                          <p className="text-sm text-[#54545E] font-dm-mono">Initialize a dedicated single-tenant shard.</p>
                        </div>

                        <div className="space-y-4 font-dm-mono text-sm">
                          <div>
                            <label className="block text-xs font-medium text-[#C8C8C0] mb-1.5 uppercase tracking-wider">
                              Email Address
                            </label>
                            <input
                              required type="email" placeholder="admin@domain.com"
                              className="w-full px-4 py-3 rounded-md bg-[#141416] border border-[#222226] text-white placeholder:text-[#54545E] focus:outline-none focus:border-[#3ECFCF] transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[#C8C8C0] mb-1.5 uppercase tracking-wider">
                              Workspace Slug
                            </label>
                            <div className="relative">
                              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[#54545E]">reach.app/</span>
                              <input
                                required type="text" placeholder="acme-corp"
                                className="w-full pl-[90px] pr-4 py-3 rounded-md bg-[#141416] border border-[#222226] text-white placeholder:text-[#54545E] focus:outline-none focus:border-[#3ECFCF] transition-all"
                              />
                            </div>
                          </div>
                        </div>

                        <button
                          disabled={formStep === "submitting"}
                          type="submit"
                          className="w-full flex items-center justify-center px-8 py-3.5 rounded-md bg-[#3ECFCF] text-[#080809] font-bold hover:bg-[#3ECFCF]/90 transition-all disabled:opacity-50 mt-6 font-bricolage uppercase tracking-wide cursor-pointer"
                        >
                          {formStep === "submitting" ? (
                             <span className="flex items-center gap-2">
                               <span className="h-4 w-4 border-2 border-[#080809] border-t-transparent rounded-full animate-spin"></span>
                               Provisioning...
                             </span>
                          ) : "Provision Workspace"}
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
