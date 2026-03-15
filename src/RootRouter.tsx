import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import LandingPage from './pages/LandingPage';
import ReachApp from './App';
import MeetingPage from './pages/MeetingPage';
import InboxPage from './pages/InboxPage';
import StandupsPage from './pages/StandupsPage';
import AuthPage from './pages/AuthPage';
import OnboardingPage from './pages/OnboardingPage';
import { ChatLayout } from './components/chat/ChatLayout';
import { StoreInitializer } from './components/StoreInitializer';
import { createBrowserClient } from './lib/supabase';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (!checked) return null;
  if (!authed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function RootRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app/*" element={<ReachApp />} />
        <Route path="/chat" element={
          <AuthGuard>
            <StoreInitializer />
            <ChatLayout />
          </AuthGuard>
        } />
        <Route path="/inbox" element={
          <AuthGuard>
            <StoreInitializer />
            <InboxPage />
          </AuthGuard>
        } />
        <Route path="/standups" element={
          <AuthGuard>
            <StoreInitializer />
            <StandupsPage />
          </AuthGuard>
        } />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/meeting/:roomCode" element={<MeetingPage />} />
      </Routes>
    </BrowserRouter>
  );
}