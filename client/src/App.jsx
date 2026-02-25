import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Login from './components/Login';

import LandingPage from './components/LandingPage';
import WhatsAppConnect from './components/WhatsAppConnect';

import AdminDashboard from './components/AdminDashboard';
import OnboardingWizard from './components/Onboarding/OnboardingWizard';
import PaymentSetup from './components/PaymentSetup';
import SaasDashboard from './components/SaasDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';

console.log("📦 [ALEX IO] App Registry Loaded");

function App() {
  console.log("🛸 [ALEX IO] App Component Rendering Started");
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("🔄 [ALEX IO] Initializing Session Check...");
    const demoMode = localStorage.getItem('demo_mode') === 'true';

    if (demoMode) {
      console.warn("🛡️ [ALEX IO] DEMO MODE ACTIVE");
      setSession({
        user: { id: 'demo-admin-id', email: 'admin@demo.com' }
      });
      setLoading(false);
      return;
    }

    if (!supabase) {
      console.warn("⚠️ [ALEX IO] Supabase client is NULL or missing config");
      // Check for backend JWT token in localStorage
      const backendToken = localStorage.getItem('alex_io_token');
      if (backendToken) {
        const demoEmail = localStorage.getItem('demo_email') || 'user@app.com';
        const userRole = localStorage.getItem('alex_io_role') || 'OWNER';
        const tenantId = localStorage.getItem('alex_io_tenant') || '';
        console.log("🔑 [ALEX IO] Backend JWT found, creating session for:", demoEmail, "role:", userRole);
        setSession({
          user: { id: 'backend-jwt-user', email: demoEmail, role: userRole, tenantId },
          access_token: backendToken
        });
      }
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("🔑 [ALEX IO] Auth Session resolved:", !!session);
      setSession(session);
      setLoading(false);
    }).catch(err => {
      console.error("❌ [ALEX IO] Auth Check Failure:", err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex flex-col items-center justify-center text-white p-6 font-sans">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-400 animate-pulse font-bold tracking-widest uppercase text-xs">Cargando ALEX IO...</p>
      </div>
    );
  }

  const ProtectedRoute = ({ children }) => {
    if (!session) return <Navigate to="/login" />;
    return children;
  };

  const AdminRoute = ({ children }) => {
    if (!session) return <Navigate to="/login" />;
    const role = session.user?.role || localStorage.getItem('alex_io_role') || 'OWNER';
    if (role !== 'SUPERADMIN') return <Navigate to="/dashboard" />;
    return children;
  };

  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-black selection:bg-blue-500/30">
          <Routes>
            <Route path="/login" element={!session ? <Login /> : <Navigate to={session.user?.role === 'SUPERADMIN' ? '/admin' : '/dashboard'} />} />

            <Route path="/dashboard" element={
              <ProtectedRoute>
                <SaasDashboard />
              </ProtectedRoute>
            } />

            <Route path="/admin" element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
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
    </AuthProvider>
  );
}

export default App;
