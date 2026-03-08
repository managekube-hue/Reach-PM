import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
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
          element={session ? <Navigate to="/app" /> : <Navigate to="/auth" />} 
        />
        <Route 
          path="/auth" 
          element={!session ? <AuthPage /> : <Navigate to="/app" />} 
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