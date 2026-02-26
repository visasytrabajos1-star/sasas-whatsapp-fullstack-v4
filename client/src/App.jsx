import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { AuthProvider } from './auth/AuthContext';
import Login from './components/Login';

import LandingPage from './components/LandingPage';
import WhatsAppConnect from './components/WhatsAppConnect';

import AdminDashboard from './components/AdminDashboard';
import OnboardingWizard from './components/Onboarding/OnboardingWizard';
import PaymentSetup from './components/PaymentSetup';
import SaasDashboard from './components/SaasDashboard';
import SuperAdminDashboard from './components/SuperAdminDashboard';

console.log("📦 [ALEX IO] App v2.0.4.28 Loaded");

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let didCancel = false;

    const finishLoading = (sess) => {
      if (!didCancel) {
        setSession(sess);
        setLoading(false);
      }
    };

    // Helper: build session from our backend JWT in localStorage
    const buildJwtSession = () => {
      try {
        const token = localStorage.getItem('alex_io_token');
        if (!token) return null;
        return {
          user: {
            id: 'jwt-user',
            email: localStorage.getItem('demo_email') || 'user@app.com',
            role: localStorage.getItem('alex_io_role') || 'OWNER',
            tenantId: localStorage.getItem('alex_io_tenant') || ''
          },
          access_token: token
        };
      } catch { return null; }
    };

    // 2. If no Supabase client, use JWT only
    if (!supabase) {
      finishLoading(buildJwtSession());
      return;
    }

    // 3. SAFETY: always resolve loading within 3 seconds
    const safetyTimer = setTimeout(() => {
      console.warn('⏰ Safety timeout');
      finishLoading(buildJwtSession());
    }, 3000);

    // 4. Try Supabase session
    try {
      supabase.auth.getSession()
        .then(({ data }) => {
          clearTimeout(safetyTimer);
          const s = data?.session;
          if (s) {
            // Save token for backend API calls
            try {
              localStorage.setItem('alex_io_token', s.access_token);
              localStorage.setItem('demo_email', s.user?.email || '');
            } catch { }
            finishLoading(s);
          } else {
            finishLoading(buildJwtSession());
          }
        })
        .catch(() => {
          clearTimeout(safetyTimer);
          finishLoading(buildJwtSession());
        });
    } catch {
      clearTimeout(safetyTimer);
      finishLoading(buildJwtSession());
    }

    // 5. Listen for auth changes (login/logout)
    let subscription;
    try {
      const result = supabase.auth.onAuthStateChange((_event, newSession) => {
        if (newSession) {
          try {
            localStorage.setItem('alex_io_token', newSession.access_token);
            localStorage.setItem('demo_email', newSession.user?.email || '');
          } catch { }
          setSession(newSession);
        }
      });
      subscription = result?.data?.subscription;
    } catch { }

    return () => {
      didCancel = true;
      try { subscription?.unsubscribe(); } catch { }
    };
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <div style={{ width: 48, height: 48, border: '4px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: 16, color: '#94a3b8', fontSize: 12, letterSpacing: 2 }}>CARGANDO ALEX IO v28...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
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
