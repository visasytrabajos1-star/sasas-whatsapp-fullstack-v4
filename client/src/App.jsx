import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import Login from './components/Login';

import LandingPage from './components/LandingPage';
import WhatsAppConnect from './components/WhatsAppConnect';

import AdminDashboard from './components/AdminDashboard';
import OnboardingWizard from './components/Onboarding/OnboardingWizard';
import PaymentSetup from './components/PaymentSetup';
import SaasDashboard from './components/SaasDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';


function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const demoMode = localStorage.getItem('demo_mode') === 'true';

    if (demoMode) {
      setSession({
        user: { id: 'demo-admin-id', email: 'admin@demo.com' }
      });
      setLoading(false);
      return;
    }

    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Cargando...</div>;
  }

  const ProtectedRoute = ({ children }) => {
    if (!session) return <Navigate to="/login" />;
    return children;
  };

  return (
    <Router>
      <div className="min-h-screen bg-black">
        <Routes>
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" />} />

          <Route path="/dashboard" element={
            <ProtectedRoute>
              <WhatsAppConnect />
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="/superadmin" element={
            <ProtectedRoute>
              <SuperAdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="/saas" element={<SaasDashboard />} />
          <Route path="/payment-setup" element={<ProtectedRoute><PaymentSetup /></ProtectedRoute>} />
          <Route path="/onboarding" element={
            <ProtectedRoute>
              <OnboardingWizard session={session} onComplete={() => { }} />
            </ProtectedRoute>
          } />

          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
