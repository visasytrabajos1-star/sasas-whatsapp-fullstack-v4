import React, { useState } from 'react';
import { Send, Users, AlertTriangle, Loader, CheckCircle2 } from 'lucide-react';
import { fetchJsonWithApiFallback, getAuthHeaders } from '../api';

export default function BroadcastCampaign({ instanceId, instanceName }) {
    const [phonesText, setPhonesText] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [confirmModal, setConfirmModal] = useState(null);

    const handleSend = () => {
        if (!phonesText.trim() || !message.trim()) return;

        // Parse phones (split by comma, newline, or space, remove empty strings, keep only digits)
        const rawPhones = phonesText.split(/[\n, ]+/).filter(p => p.trim());
        const cleanedPhones = rawPhones.map(p => p.replace(/\D/g, '')).filter(p => p.length > 8);

        if (cleanedPhones.length === 0) {
            setResult({ success: false, error: "No se encontraron números de teléfono válidos." });
            return;
        }

        setConfirmModal({ count: cleanedPhones.length, phones: cleanedPhones });
    };

    const executeBroadcast = async () => {
        if (!confirmModal) return;
        const cleanedPhones = confirmModal.phones;
        setConfirmModal(null);

        setLoading(true);
        setResult(null);
        try {
            const res = await fetchJsonWithApiFallback('/api/saas/broadcast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({
                    instanceId,
                    phones: cleanedPhones,
                    message
                })
            });

            if (res.data && res.data.success) {
                setResult({ success: true, count: cleanedPhones.length, msg: res.data.message });
                setPhonesText('');
                setMessage('');
            } else {
                throw new Error(res.data?.error || 'Falló el inicio de la campaña');
            }
        } catch (err) {
            console.error('Error starting broadcast:', err);
            setResult({ success: false, error: err.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 relative">
            {confirmModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-orange-400">
                            <AlertTriangle size={24} /> Confirmar Envío
                        </h3>
                        <p className="text-slate-300 mb-6 text-sm">
                            Estás a punto de enviar una campaña masiva a <strong>{confirmModal.count}</strong> contactos desde la cuenta "{instanceName}".
                            <br /><br />
                            <span className="text-xs text-orange-300">⚠️ Recomendamos enviar en lotes menores a 50 si tu número no está validado, ya que Meta penaliza activamente el SPAM.</span>
                        </p>
                        <div className="flex gap-4">
                            <button onClick={() => setConfirmModal(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 rounded-lg transition-colors">Cancelar</button>
                            <button onClick={executeBroadcast} className="flex-1 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white font-bold py-2 rounded-lg transition-colors">Confirmar y Enviar</button>
                        </div>
                    </div>
                </div>
            )}

            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Send size={20} className="text-fuchsia-500" /> Campaña Broadcast (Masiva)
            </h3>
            <p className="text-xs text-slate-400 mb-4">Envía mensajes proactivos a listas de contactos. Útil para seguimientos, promociones o rescate de leads (Growth).</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                            <Users size={14} /> Destinatarios (Teléfonos)
                        </label>
                        <textarea
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm h-32 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 transition-all font-mono"
                            placeholder="Ej: 5491100001111, 5491122223333..."
                            value={phonesText}
                            onChange={e => setPhonesText(e.target.value)}
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Separados por coma, espacio o salto de línea. Incluir código de país sin el '+'.</p>
                    </div>

                    <div className="bg-orange-950/30 border border-orange-500/30 rounded-lg p-3">
                        <div className="flex gap-2">
                            <AlertTriangle size={16} className="text-orange-400 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="text-xs font-bold text-orange-400">Riesgo de Ban / Rate Limits</h4>
                                <p className="text-[10px] text-orange-200 mt-1">
                                    El sistema inserta un delay activo de 2-5 segundos entre cada mensaje. Aún así, un uso abusivo puede bloquear tu número si usas WhatsApp Web/Baileys. Si usas Cloud API, asegúrate de tener una plantilla (Template) aprobada si pasaron 24hs desde la última interacción.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1">Mensaje de la Campaña</label>
                        <textarea
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm h-32 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500 transition-all"
                            placeholder="¡Hola! Retomamos el contacto porque vimos que estabas interesado en..."
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={handleSend}
                        disabled={loading || !phonesText.trim() || !message.trim()}
                        className="w-full bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 disabled:opacity-50 py-3 rounded-lg font-bold text-white shadow-lg flex items-center justify-center gap-2 transition-all mt-4"
                    >
                        {loading ? <Loader className="animate-spin" size={18} /> : <Send size={18} />}
                        {loading ? "Iniciando Campaña..." : "Lanzar Campaña"}
                    </button>

                    {result && (
                        <div className={`mt-3 p-3 rounded-lg text-sm flex items-start gap-2 ${result.success ? 'bg-green-950/50 border border-green-500/30 text-green-400' : 'bg-red-950/50 border border-red-500/30 text-red-400'}`}>
                            {result.success ? <CheckCircle2 size={18} className="shrink-0 mt-0.5" /> : <AlertTriangle size={18} className="shrink-0 mt-0.5" />}
                            <div>
                                <span className="font-bold">{result.success ? '¡Campaña en curso!' : 'Error'}</span>
                                <p className="text-xs mt-1 opacity-90">{result.success ? result.msg : result.error}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
