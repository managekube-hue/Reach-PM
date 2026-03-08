import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function OnboardingPage({ session }: any) {
  const [step, setStep] = useState(1);
  const [idea, setIdea] = useState("");
  const [plan, setPlan] = useState("");
  const [loading, setLoading] = useState(false);
  const [model, setModel] = useState("anthropic/claude-3-5-sonnet");
  const [pat, setPat] = useState("");
  const navigate = useNavigate();

  const handleGeneratePlan = async () => {
    if (!idea.trim()) return;
    setLoading(true);
    
    // Simulate generation for frontend testing. 
    // In production, this calls the 'onboarding-bootstrap' Edge Function
    setTimeout(() => {
      setPlan(`## Foundation Plan
### Stage 1: MVP Foundation
- Setup database schema
- Implement user authentication
- Build core component shells

### Stage 2: Feature Integration
- Connect WebRTC mesh for chat and video
- Deploy local-first IDB CRDT engine
- Wire up Sprint Board analytics

**Budget Estimate:** $400 - $800 (4 weeks)`);
      setLoading(false);
      setStep(2);
    }, 1800);
  };

  const finishOnboarding = async () => {
    setLoading(true);
    // Here we would securely save the PAT to the `encrypted_secrets` table
    setTimeout(() => {
      setLoading(false);
      navigate('/app');
    }, 800);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#07070A', color: '#E8E8E2', alignItems: 'center', justifyContent: 'center', fontFamily: '"Syne", sans-serif' }}>
      <div style={{ width: 600, padding: 40, background: '#0E0E12', border: '1px solid #1E1E28', borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.7)' }}>
        
        {step === 1 && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#47BFFF' }}>Step 1: Describe your idea</h2>
            <p style={{ color: '#8080A0', fontSize: 14 }}>Let's generate your Foundation Plan instantly before configuring any technical details.</p>
            <textarea 
              value={idea}
              onChange={e => setIdea(e.target.value)}
              placeholder="e.g. A multi-tenant project management platform with local-first features and WebRTC video..."
              style={{ width: '100%', height: 120, padding: '12px 16px', background: '#141418', border: '1px solid #2A2A38', borderRadius: 6, color: '#fff', outline: 'none', fontFamily: 'inherit', resize: 'none' }}
            />
            <button onClick={handleGeneratePlan} disabled={loading || !idea} style={{ background: '#47BFFF', color: '#07070A', border: 'none', padding: '14px', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: (loading||!idea) ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Generating Ghost Bootstrap...' : 'Generate Plan'}
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#47BFFF' }}>Step 2: Choose your model</h2>
            <div style={{ background: '#141418', padding: 20, borderRadius: 6, border: '1px solid #2A2A38', fontSize: 13, color: '#E8E8E2', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {plan}
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#8080A0', marginBottom: 6 }}>Select Intelligence Engine</label>
              <select value={model} onChange={e => setModel(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: '#141418', border: '1px solid #2A2A38', borderRadius: 6, color: '#fff', outline: 'none' }}>
                <option value="anthropic/claude-3-5-sonnet">Claude 3.5 Sonnet (Recommended)</option>
                <option value="openai/gpt-4o">OpenAI GPT-4o</option>
                <option value="google/gemini-pro">Google Gemini Pro</option>
              </select>
            </div>

            <button onClick={() => setStep(3)} style={{ background: '#47BFFF', color: '#07070A', border: 'none', padding: '14px', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Confirm & Continue
            </button>
          </div>
        )}

        {step === 3 && (
          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: '#47BFFF' }}>Step 3: Initialize the Lifeline</h2>
            <p style={{ color: '#8080A0', fontSize: 14 }}>To apply AI solutions directly to your codebase, securely provide your GitHub PAT. We use Zero-Knowledge encryption.</p>
            
            <div>
              <label style={{ display: 'block', fontSize: 12, color: '#8080A0', marginBottom: 6 }}>GitHub Personal Access Token (Classic or Fine-Grained)</label>
              <input required type="password" value={pat} onChange={e => setPat(e.target.value)} placeholder="ghp_xxxxxxxxxxxx" style={{ width: '100%', padding: '12px 14px', background: '#141418', border: '1px solid #2A2A38', borderRadius: 6, color: '#fff', outline: 'none', fontFamily: 'monospace' }} />
            </div>

            <button onClick={finishOnboarding} disabled={loading || !pat} style={{ background: '#47BFFF', color: '#07070A', border: 'none', padding: '14px', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: (loading||!pat) ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Encrypting & Booting...' : 'Complete Initialization'}
            </button>
            <button onClick={() => navigate('/app')} style={{ background: 'none', color: '#8080A0', border: 'none', padding: '8px', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
              Skip for now
            </button>
          </div>
        )}

      </div>
    </div>
  );
}