import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import LandingPage from './pages/LandingPage';
import MainApp from './App';
import { supabase } from './lib/supabase';

export default function RootRouter() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div style={{ height: '100vh', background: '#07070A' }} />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route 
          path="/" 
          element={<LandingPage />} 
        />
        <Route 
          path="/auth" 
          element={!session ? <AuthPage /> : <Navigate to="/app" />} 
        />
        <Route 
          path="/onboarding" 
          element={session ? <OnboardingPage session={session} /> : <Navigate to="/auth" />} 
        />
        <Route 
          path="/app/*" 
          element={session ? <MainApp session={session} /> : <Navigate to="/auth" />} 
        />
        <Route 
          path="/ide" 
          element={session ? <MainApp session={session} /> : <Navigate to="/auth" />} 
        />
      </Routes>
    </BrowserRouter>
  );
}