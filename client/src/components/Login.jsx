import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, Globe, Mail } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [rememberSession, setRememberSession] = useState(true);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('error'); // 'error' | 'success'

    const showMsg = (text, type = 'error') => {
        setMessage(text);
        setMessageType(type);
    };

    // ── Google OAuth ──────────────────────────────────────────────────────────
    const handleGoogleLogin = async () => {
        if (!supabase) {
            showMsg('Supabase no está configurado correctamente.');
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: window.location.origin + '/#/dashboard' }
            });
            if (error) throw error;
        } catch (error) {
            console.error("Google Auth Error:", error);
            showMsg(error.message);
            setLoading(false);
        }
    };

    // ── Email / Password ──────────────────────────────────────────────────────
    const handleAuth = async (e) => {
        e.preventDefault();
        if (!supabase) {
            showMsg('Supabase no está configurado. Contactá al administrador.');
            return;
        }
        setLoading(true);
        setMessage('');

        try {
            if (isSignUp) {
                // REGISTRO — Supabase envía email de confirmación automáticamente
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: window.location.origin + '/#/login'
                    }
                });
                if (error) throw error;
                showMsg(
                    '✅ ¡Cuenta creada! Revisá tu casilla de email para confirmar tu cuenta y luego podrás iniciar sesión.',
                    'success'
                );
            } else {
                // LOGIN — Email + contraseña via Supabase (valida credenciales nativamente)
                const normalizedEmail = email.trim().toLowerCase();
                const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
                if (error) throw error;

                if (!data.session) {
                    throw new Error('No se pudo establecer sesión con Supabase.');
                }

                // Obtener JWT del backend mediante intercambio de token de Supabase
                let backendToken = null;
                let backendRole = data.user?.user_metadata?.role || 'OWNER';
                let backendTenant = data.user?.id;

                try {
                    const { getPreferredApiBase } = await import('../api.js');
                    const apiBase = getPreferredApiBase();
                    const resp = await fetch(`${apiBase}/api/auth/session`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ access_token: data.session.access_token })
                    });

                    if (resp.ok) {
                        const backendData = await resp.json();
                        backendToken = backendData.token;
                        backendRole = backendData.role || backendRole;
                        backendTenant = backendData.tenantId || backendTenant;
                    } else {
                        const errData = await resp.json();
                        throw new Error(errData.error || 'Fallo en la validación del backend');
                    }
                } catch (backendErr) {
                    console.error('❌ Backend Session Error:', backendErr.message);
                    throw backendErr; // Obligatorio para Enterprise: el backend debe validar la sesión
                }

                // Guardar solo el token firmado por nuestro backend (JWT_SECRET)
                localStorage.setItem('alex_io_token', backendToken);
                localStorage.setItem('demo_email', data.user.email);
                localStorage.setItem('alex_io_role', backendRole);
                localStorage.setItem('alex_io_tenant', backendTenant);

                if (!rememberSession) {
                    sessionStorage.setItem('alex_io_token', backendToken);
                    localStorage.removeItem('alex_io_token');
                }

                navigate((backendRole === 'SUPERADMIN') ? '/superadmin' : '/dashboard');
            }
        } catch (error) {
            console.error('Auth Error:', error);
            // Mensajes amigables en español
            const msg = error.message;
            if (msg.includes('Invalid login credentials')) {
                showMsg('Email o contraseña incorrectos.');
            } else if (msg.includes('Email not confirmed')) {
                showMsg('Necesitás confirmar tu email. Buscá el link en tu casilla de correo.');
            } else if (msg.includes('User already registered')) {
                showMsg('Ya existe una cuenta con ese email. Usá "Iniciar Sesión".');
            } else if (msg.includes('Password should be')) {
                showMsg('La contraseña debe tener al menos 6 caracteres.');
            } else {
                showMsg(msg || 'Error al conectar con el servidor.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-600/10 rounded-full blur-[100px]"></div>
            </div>

            <div className="absolute top-6 left-6 z-10">
                <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={20} /> Volver al inicio
                </Link>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="bg-slate-900/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-800 relative z-10"
            >
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-cyan-600/20 rounded-2xl flex items-center justify-center border border-cyan-500/20">
                        <Globe className="text-cyan-400 w-8 h-8" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-white mb-2 text-center tracking-tight">
                    {isSignUp ? 'Crear Cuenta' : 'Bienvenido'}
                </h1>
                <p className="text-slate-500 text-sm text-center mb-6">
                    {isSignUp ? 'Registrate para empezar' : 'Ingresá a tu cuenta'}
                </p>

                {/* LOGIN / SIGNUP TOGGLE */}
                <div className="flex justify-center gap-1 mb-6 bg-slate-950 p-1 rounded-xl border border-slate-800">
                    <button
                        onClick={() => { setIsSignUp(false); setMessage(''); }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${!isSignUp ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        Iniciar Sesión
                    </button>
                    <button
                        onClick={() => { setIsSignUp(true); setMessage(''); }}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${isSignUp ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        Registrarse
                    </button>
                </div>


                {/* GOOGLE BUTTON */}
                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full mb-4 py-3 bg-white text-slate-900 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continuar con Google
                </button>

                <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-slate-800" />
                    <span className="text-slate-600 text-xs">o con email</span>
                    <div className="flex-1 h-px bg-slate-800" />
                </div>

                {/* EMAIL FORM */}
                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                            placeholder="tu@email.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Contraseña</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all"
                            placeholder="••••••••"
                            required
                            minLength={6}
                        />
                    </div>

                    {message && (
                        <div className={`p-4 rounded-xl text-sm flex items-start gap-2 ${messageType === 'success'
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                            {messageType === 'success' ? <Mail size={16} className="mt-0.5 shrink-0" /> : null}
                            <span>{message}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 className="animate-spin" size={20} />}
                        <span>{isSignUp ? 'Crear Cuenta' : 'Entrar'}</span>
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-slate-500">
                    {isSignUp ? '¿Ya tenés cuenta?' : '¿No tenés cuenta?'}
                    <button
                        onClick={() => { setIsSignUp(!isSignUp); setMessage(''); }}
                        className="ml-2 text-cyan-400 font-bold hover:text-cyan-300 transition-colors"
                    >
                        {isSignUp ? 'Ingresá aquí' : 'Registrate gratis'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
