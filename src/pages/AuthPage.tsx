import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

export default function AuthPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Custom Registration fields
  const [tenantName, setTenantName] = useState('');
  const [username, setUsername] = useState('');
  
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/app');
      } else {
        // Sign Up Flow
        // 1. Create the Auth User
        const { data: authData, error: signupError } = await supabase.auth.signUp({ 
          email, 
          password 
        });
        if (signupError) throw signupError;
        
        const userId = authData.user?.id;
        if (!userId) throw new Error("No user ID returned");

        // 2. Create the Tenant and Admin Profile atomically using an RPC function
        // This ensures Row Level Security doesn't block the frontend from provisioning itself
        const slug = tenantName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        
        const { error: rpcError } = await supabase.rpc('register_tenant_admin', {
          p_user_id: userId,
          p_tenant_name: tenantName,
          p_slug: slug,
          p_display_name: username
        });
        
        if (rpcError) throw rpcError;

        navigate('/onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#07070A', color: '#E8E8E2', alignItems: 'center', justifyContent: 'center', fontFamily: '"Syne", sans-serif' }}>
      <div style={{ width: 400, padding: 40, background: '#0E0E12', border: '1px solid #1E1E28', borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.7)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, justifyContent: 'center' }}>
          <div style={{ width: 32, height: 32, background: '#47BFFF', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 800, color: '#000' }}>R</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.05em' }}>REACH</h1>
        </div>

        {error && (
          <div style={{ padding: '12px 16px', background: 'rgba(255,64,64,0.1)', border: '1px solid #FF4040', color: '#FF4040', borderRadius: 6, marginBottom: 20, fontSize: 14 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!isLogin && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#8080A0', marginBottom: 6 }}>Workspace Name</label>
                <input required type="text" value={tenantName} onChange={e => setTenantName(e.target.value)} placeholder="Acme Corp" style={{ width: '100%', padding: '10px 14px', background: '#141418', border: '1px solid #2A2A38', borderRadius: 6, color: '#fff', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: '#8080A0', marginBottom: 6 }}>Your Name</label>
                <input required type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Alex L." style={{ width: '100%', padding: '10px 14px', background: '#141418', border: '1px solid #2A2A38', borderRadius: 6, color: '#fff', outline: 'none' }} />
              </div>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#8080A0', marginBottom: 6 }}>Email</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="alex@acme.com" style={{ width: '100%', padding: '10px 14px', background: '#141418', border: '1px solid #2A2A38', borderRadius: 6, color: '#fff', outline: 'none' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, color: '#8080A0', marginBottom: 6 }}>Password</label>
            <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="��������" style={{ width: '100%', padding: '10px 14px', background: '#141418', border: '1px solid #2A2A38', borderRadius: 6, color: '#fff', outline: 'none' }} />
          </div>

          <button type="submit" disabled={loading} style={{ marginTop: 8, background: '#47BFFF', color: '#07070A', border: 'none', padding: '12px', borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Processing...' : (isLogin ? 'Sign In via Email' : 'Create Account')}
          </button>
        </form>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
          <div style={{ flex: 1, height: 1, background: "#1E1E28" }} />
          <span style={{ fontSize: 12, color: "#8080A0" }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "#1E1E28" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button style={{ background: "#141418", border: "1px solid #2A2A38", color: "#E8E8E2", padding: "12px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 14 }}>
            <span>GitHub</span>
          </button>
          <button style={{ background: "#141418", border: "1px solid #2A2A38", color: "#E8E8E2", padding: "12px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 14 }}>
            <span>Google</span>
          </button>
          <button style={{ background: "#141418", border: "1px solid #2A2A38", color: "#E8E8E2", padding: "12px", borderRadius: 6, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontSize: 14 }}>
            <span>Apple</span>
          </button>
        </div>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: 13, color: '#8080A0' }}>
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span style={{ color: '#47BFFF', cursor: 'pointer', fontWeight: 600 }} onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Sign up' : 'Sign in'}
          </span>
        </div>
      </div>
    </div>
  );
}