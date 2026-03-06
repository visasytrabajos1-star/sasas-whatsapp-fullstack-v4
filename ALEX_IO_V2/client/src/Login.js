import React, { useState } from 'react';
import { Shield, Loader, Mail } from 'lucide-react';
import { fetchJsonWithApiFallback, getPreferredApiBase } from './api';

function Login() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!email) return;

        setLoading(true);
        setError(null);

        try {
            const { data } = await fetchJsonWithApiFallback('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (data.token) {
                localStorage.setItem('alex_io_token', data.token);
                localStorage.setItem('alex_io_email', email);
                window.location.href = '/';
            } else {
                throw new Error('No se recibió token del servidor');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
            <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 w-full max-w-md shadow-2xl">
                <div className="flex items-center gap-2 justify-center mb-8">
                    <Shield className="text-blue-500" size={32} />
                    <h1 className="text-3xl font-bold">ALEX <span className="text-blue-500">IO</span></h1>
                </div>

                <h2 className="text-xl font-bold mb-2 text-center text-slate-200">Bienvenido de nuevo</h2>
                <p className="text-slate-400 text-center mb-8 text-sm">Ingresa tu email para acceder a tu panel</p>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                        <input
                            type="email"
                            placeholder="tu@email.com"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 pl-10 focus:border-blue-500 outline-none transition-all"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <div className="bg-red-900/20 border border-red-800 text-red-400 p-3 rounded-xl text-xs">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !email}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader className="animate-spin" size={20} /> : 'Entrar ahora'}
                    </button>
                </form>

                <p className="text-[10px] text-slate-500 mt-8 text-center italic">
                    Conectando con: {getPreferredApiBase()}
                </p>
            </div>
        </div>
    );
}

export default Login;
