import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { fetchJsonWithApiFallback } from '../api';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, ArrowLeft, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Login() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [accessCode, setAccessCode] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [accountType, setAccountType] = useState('student');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    const handleGoogleLogin = async () => {
        if (!supabase) {
            setMessage('Google Auth requiere configuración de Supabase. Usa email y contraseña.');
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
            setMessage(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        const BACKEND = 'https://whatsapp-fullstack-gkm6.onrender.com';
        const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';

        try {
            const res = await fetch(`${BACKEND}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || `Error del servidor (${res.status})`);
            }

            if (!data.token) throw new Error('El servidor no devolvió un token');

            localStorage.setItem('alex_io_token', data.token);
            localStorage.setItem('demo_email', email);
            localStorage.setItem('alex_io_role', data.role || 'OWNER');
            localStorage.setItem('alex_io_tenant', data.tenantId || '');

            if (isSignUp) {
                setMessage('¡Cuenta creada exitosamente! Redirigiendo...');
                setTimeout(() => {
                    window.location.href = '/#/dashboard';
                }, 1000);
            } else {
                const targetPath = data.role === 'SUPERADMIN' ? '/#/admin' : '/#/dashboard';
                window.location.href = targetPath;
            }
        } catch (error) {
            console.error('Auth Error:', error);
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                setMessage('No se puede conectar al servidor. Reintenta en 30 segundos.');
            } else {
                setMessage(error.message || 'Error al conectar con el servidor');
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
                <div className="flex justify-center mb-8">
                    <div className="w-16 h-16 bg-cyan-600/20 rounded-2xl flex items-center justify-center border border-cyan-500/20">
                        <Globe className="text-cyan-400 w-8 h-8" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-white mb-2 text-center tracking-tight">
                    {isSignUp ? 'Crear Cuenta' : 'Bienvenido'}
                </h1>

                {/* LOGIN / SIGNUP TOGGLE */}
                <div className="flex justify-center gap-4 mb-8 bg-slate-950 p-1 rounded-xl border border-slate-800 mt-6">
                    <button
                        onClick={() => setIsSignUp(false)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${!isSignUp ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        Iniciar Sesión
                    </button>
                    <button
                        onClick={() => setIsSignUp(true)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${isSignUp ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                    >
                        Registrarse
                    </button>
                </div>

                {/* DEMO BYPASS BUTTON */}
                <button
                    onClick={() => {
                        localStorage.setItem('demo_mode', 'true');
                        window.location.reload();
                    }}
                    className="w-full mb-3 py-2 border border-yellow-600/50 text-yellow-500 rounded-xl text-xs font-bold hover:bg-yellow-900/20 transition-all flex items-center justify-center gap-2"
                >
                    🚀 ACCESO DEMO (ADMIN/INVITADO)
                </button>

                <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full mb-4 py-3 bg-white text-slate-900 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continuar con Google
                </button>

                <form onSubmit={handleAuth} className="space-y-5">
                    {isSignUp && (
                        <div className="flex flex-col gap-2 mb-4">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo de cuenta</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setAccountType('student')}
                                    className={`flex-1 py-3 px-2 rounded-xl text-sm font-semibold border transition-all ${accountType === 'student' ? 'bg-cyan-600/10 border-cyan-500/50 text-cyan-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                                >
                                    Soy Alumno
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAccountType('freemium')}
                                    className={`flex-1 py-3 px-2 rounded-xl text-sm font-semibold border transition-all ${accountType === 'freemium' ? 'bg-indigo-600/10 border-indigo-500/50 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                                >
                                    Cuenta Freemium
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all font-medium"
                                placeholder="tu@email.com"
                                required
                            />
                        </div>

                        {/* Access Code removed for Open MVP */}

                        <div>
                            <label className="block text-slate-400 text-xs font-bold mb-2 uppercase tracking-wider">Contraseña</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all font-medium"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-xl text-sm flex items-start gap-2 ${message.includes('exitoso') || message.includes('creado') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            <span>{message}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-cyan-900/20 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading && <Loader2 className="animate-spin" size={20} />}
                        {isSignUp ? 'Crear Cuenta' : 'Entrar'}
                    </button>
                </form>

                <div className="mt-8 text-center text-sm text-slate-500">
                    {isSignUp ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="ml-2 text-cyan-400 font-bold hover:text-cyan-300 transition-colors"
                    >
                        {isSignUp ? 'Ingresa aquí' : 'Regístrate gratis'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
