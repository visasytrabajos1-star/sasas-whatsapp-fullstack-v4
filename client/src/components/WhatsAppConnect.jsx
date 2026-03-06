import React, { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import io from 'socket.io-client';
import api from '../services/api';
import { motion } from 'framer-motion';
import { QrCode, Cloud, Activity, Loader2 } from 'lucide-react';

const getSocketUrl = () => {
    if (import.meta.env.PROD) {
        if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
        if (typeof window !== 'undefined') {
            return window.location.origin;
        }
    }
    return import.meta.env.VITE_API_URL || 'http://localhost:3000';
};

const WhatsAppConnect = () => {
    console.log("🛸 [ALEX IO] WhatsAppConnect Rendering Started");
    const [mode, setMode] = useState('QR');
    const [qrCode, setQrCode] = useState(null);
    const [status, setStatus] = useState('DISCONNECTED');
    const [cloudStatus, setCloudStatus] = useState({ configured: false });
    const [logs, setLogs] = useState([]);
    const [diagnostics, setDiagnostics] = useState(null);
    const [loading, setLoading] = useState(true);
    const socketRef = useRef(null);

    useEffect(() => {
        console.log("🔌 [ALEX IO] Initializing Socket & Status hooks...");

        try {
            const socketUrl = getSocketUrl();
            console.log("🌐 Socket Target:", socketUrl);
            socketRef.current = io(socketUrl, {
                reconnection: true,
                reconnectionAttempts: 5
            });

            socketRef.current.on('connect', () => console.log("✅ Socket Connected"));
            socketRef.current.on('connect_error', (err) => console.error("❌ Socket Connect Error:", err));

            socketRef.current.on('wa_qr', (data) => {
                setQrCode(data.qr);
                setStatus('QR_READY');
            });

            socketRef.current.on('wa_status', (data) => {
                setStatus(data.status);
                if (data.status === 'READY') setQrCode(null);
            });

            socketRef.current.on('wa_log', (data) => {
                setLogs(prev => [data, ...prev].slice(0, 50));
            });
        } catch (socketInitError) {
            console.error("❌ Fatal Socket Init Error:", socketInitError);
        }

        fetchInitialData();

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, []);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            await Promise.all([fetchStatus(), fetchCloudStatus(), fetchDiagnostics()]);
        } catch (e) {
            console.error("Error fetching initial dashboard data", e);
        } finally {
            setLoading(false);
        }
    };

    const fetchDiagnostics = async () => {
        try {
            const res = await api.get('/api/diagnostics');
            setDiagnostics(res.data);
        } catch (e) {
            console.warn("Could not fetch diagnostics:", e.message);
        }
    };

    const fetchStatus = async () => {
        try {
            const res = await api.get('/whatsapp/status');
            setStatus(res.data.status);
            if (res.data.qr) setQrCode(res.data.qr);
        } catch (e) {
            console.warn("Could not fetch WA status:", e.message);
        }
    };

    const fetchCloudStatus = async () => {
        try {
            const res = await api.get('/api/whatsapp/cloud/status');
            setCloudStatus(res.data);
        } catch (e) {
            console.warn("Could not fetch Cloud API status:", e.message);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6">
                <Loader2 className="animate-spin text-blue-500 mb-4" size={48} />
                <p className="animate-pulse">Calculando Conectividad...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6 font-sans">
            <h1 className="text-3xl font-bold mb-2 text-center bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent">
                Alex IO v5.1 Dashboard
            </h1>
            <p className="text-center text-slate-500 mb-8 text-sm">Control de Inteligencia y Consumo en Tiempo Real</p>

            <div className="flex justify-center mb-8 bg-slate-800/50 p-1 rounded-2xl max-w-sm mx-auto border border-slate-700">
                <button
                    onClick={() => setMode('QR')}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${mode === 'QR' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >
                    <QrCode size={18} /> WhatsApp Web
                </button>
                <button
                    onClick={() => setMode('CLOUD')}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${mode === 'CLOUD' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >
                    <Cloud size={18} /> Cloud API
                </button>
                <button
                    onClick={() => { setMode('DIAG'); fetchDiagnostics(); }}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${mode === 'DIAG' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                >
                    <Activity size={18} /> Diagnóstico
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
                <div className="bg-slate-800 p-8 rounded-3xl border border-slate-700 flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
                    {mode === 'QR' ? (
                        <>
                            <h2 className="text-xl font-bold mb-4 text-slate-300">Conexión vía QR</h2>
                            <div className="mb-6">
                                {status === 'READY' ? (
                                    <div className="w-48 h-48 bg-green-500/20 rounded-full flex items-center justify-center border-4 border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)] animate-pulse">
                                        <span className="text-5xl">✅</span>
                                    </div>
                                ) : qrCode ? (
                                    <div className="bg-white p-5 rounded-3xl shadow-2xl scale-110">
                                        <QRCodeSVG value={qrCode} size={200} />
                                    </div>
                                ) : status === 'CONNECTING' ? (
                                    <div className="w-48 h-48 bg-slate-700/30 rounded-full flex flex-col items-center justify-center border-2 border-slate-600 border-dashed">
                                        <Loader2 className="animate-spin text-blue-500 mb-2" size={32} />
                                        <span className="text-xs text-slate-500">Negociando QR...</span>
                                    </div>
                                ) : (
                                    <button
                                        onClick={async () => {
                                            setStatus('CONNECTING');
                                            try {
                                                const res = await api.post('/saas/connect', { companyName: 'Alex Bot' });
                                                const instanceId = res.data.instance_id;
                                                const poll = setInterval(async () => {
                                                    const s = await api.get('/whatsapp/status');
                                                    if (s.data.status === 'READY') {
                                                        setStatus('READY');
                                                        setQrCode(null);
                                                        clearInterval(poll);
                                                    } else if (s.data.qr) {
                                                        setQrCode(s.data.qr);
                                                        setStatus('QR_READY');
                                                    }
                                                }, 4000);
                                            } catch (e) {
                                                setStatus('DISCONNECTED');
                                                alert("Error al iniciar: " + e.message);
                                            }
                                        }}
                                        className="w-48 h-48 bg-blue-600 hover:bg-blue-500 rounded-full flex flex-col items-center justify-center border-4 border-blue-400/30 shadow-2xl transition-all hover:scale-105"
                                    >
                                        <QrCode size={48} className="mb-2" />
                                        <span className="font-bold">Conectar</span>
                                    </button>
                                )}
                            </div>
                            <div className={`text-sm font-bold mb-6 px-6 py-2 rounded-full transform transition-all ${status === 'READY' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'}`}>
                                {status === 'READY' ? '• CONECTADO' : status === 'QR_READY' ? '• ESCANEA EL QR' : '• DESCONECTADO'}
                            </div>
                        </>
                    ) : mode === 'CLOUD' ? (
                        <>
                            <Cloud className="text-blue-500 mb-4" size={48} />
                            <h2 className="text-xl font-bold mb-2 text-slate-300">Meta Cloud API</h2>
                            <div className="flex flex-col gap-3 w-full max-w-xs mt-4">
                                <StatusBadge label="Configuración" value={cloudStatus.configured ? 'OK' : 'Faltante'} ok={cloudStatus.configured} />
                                <StatusBadge label="Phone ID" value={cloudStatus.phoneNumberId || 'No Encontrado'} ok={!!cloudStatus.phoneNumberId} />
                            </div>
                        </>
                    ) : (
                        <>
                            <Activity className="text-amber-500 mb-4" size={48} />
                            <h2 className="text-xl font-bold mb-2 text-slate-300">Salud del Sistema</h2>
                            <div className="flex flex-col gap-2 w-full max-w-xs mt-4">
                                {diagnostics ? (
                                    <>
                                        <StatusBadge label="Gemini AI" value={diagnostics.providers.gemini ? 'OK' : 'Error'} ok={diagnostics.providers.gemini} />
                                        <StatusBadge label="OpenAI" value={diagnostics.providers.openai ? 'OK' : 'Error'} ok={diagnostics.providers.openai} />
                                        <StatusBadge label="DeepSeek" value={diagnostics.providers.deepseek ? 'OK' : 'Error'} ok={diagnostics.providers.deepseek} />
                                        <StatusBadge label="WhatsApp" value={diagnostics.whatsapp.status} ok={diagnostics.whatsapp.status === 'READY'} />
                                        <div className="mt-4 pt-4 border-t border-slate-700 w-full flex justify-center">
                                            <button
                                                onClick={fetchDiagnostics}
                                                className="text-xs bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg font-bold transition-colors"
                                            >
                                                Actualizar Estado
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-xs text-slate-500 italic">Cargando diagnóstico...</p>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <div className="bg-slate-950 p-8 rounded-3xl border border-slate-800 font-mono text-sm overflow-hidden flex flex-col h-[500px] shadow-2xl">
                    <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                            <span className="text-slate-400 font-bold tracking-tighter uppercase px-2">Logs de Actividad</span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                        {logs.length === 0 && <p className="text-center text-slate-700 opacity-50 py-10 italic">Esperando actividad...</p>}
                        {logs.map((log, i) => (
                            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} key={i} className="border-l-2 border-slate-700 pl-4 py-2 hover:bg-slate-900/50 transition-colors rounded-r-lg">
                                <div className="flex justify-between mb-1">
                                    <span className={`font-bold ${log.from === 'SISTEMA' ? 'text-yellow-500' : 'text-cyan-500'}`}>{log.from}</span>
                                    <span className="text-[10px] text-slate-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-slate-400">{log.body}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatusBadge = ({ label, value, ok }) => (
    <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
        <span className="text-xs text-slate-500 font-bold uppercase">{label}</span>
        <span className={`text-xs font-bold ${ok ? 'text-green-400' : 'text-red-400'}`}>{value}</span>
    </div>
);

export default WhatsAppConnect;
