import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Lock, Mail, Loader2 } from 'lucide-react';

import { supabase } from '../supabaseClient';

const SuperAdminLogin = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // 1. Iniciar sesión en Supabase
            const { data, error: supaError } = await supabase.auth.signInWithPassword({
                email: email.trim().toLowerCase(),
                password
            });

            if (supaError) throw supaError;
            if (!data.session) throw new Error('No se pudo establecer la sesión.');

            // 2. Intercambiar token por JWT del Backend
            const { getPreferredApiBase } = await import('../api.js');
            const apiBase = getPreferredApiBase();
            const resp = await fetch(`${apiBase}/api/auth/session-exchange`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_token: data.session.access_token })
            });

            if (!resp.ok) {
                const errData = await resp.json().catch(() => ({}));
                throw new Error(errData.error || `Error ${resp.status}`);
            }

            const backendData = await resp.json();

            // 3. Persistir sesión compatible con AuthContext
            localStorage.setItem('alex_io_token', backendData.token);
            localStorage.setItem('demo_email', email.trim().toLowerCase());
            localStorage.setItem('alex_io_role', backendData.role);

            navigate('/superadmin');
            window.location.reload();
        } catch (err: any) {
            setError(err.message || 'Credenciales de SuperAdmin Incorrectas.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
            <div className="w-full max-w-md bg-slate-900/50 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 mb-4 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)]">
                        <ShieldAlert size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">ALEX IO SuperAdmin</h1>
                    <p className="text-slate-500 text-sm mt-1">Consola de Control de Producción</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Admin Email</label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="admin@alex.io"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-slate-500 ml-1">Master Password</label>
                        <div className="relative">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                placeholder="••••••••••••"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs py-3 px-4 rounded-xl text-center font-semibold">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" size={20} /> : 'ACCEDER A PRODUCCIÓN'}
                    </button>
                </form>

                <p className="text-center text-slate-600 text-[10px] mt-8 uppercase tracking-widest font-bold">
                    Acceso Restringido • Auditoría Activa
                </p>
            </div>
        </div>
    );
};

export default SuperAdminLogin;
