import React, { useState } from 'react';
import { Sparkles, Loader, X, Send, Wand2, Copy, CheckCircle2 } from 'lucide-react';
import { fetchJsonWithApiFallback, getAuthHeaders, getPreferredApiBase } from '../api';

export default function PromptCopilot({ onClose, currentPrompt, onPromptImproved }) {
    const [instruction, setInstruction] = useState('');
    const [loading, setLoading] = useState(false);
    const [improvedPrompt, setImprovedPrompt] = useState(null);
    const [copied, setCopied] = useState(false);

    const handleImprove = async () => {
        if (!instruction.trim() || !currentPrompt) return;

        setLoading(true);
        try {
            const res = await fetchJsonWithApiFallback('/api/saas/prompt-copilot', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                body: JSON.stringify({ currentPrompt, instruction }),
                timeoutMs: 30000
            });

            if (res.data && res.data.prompt) {
                setImprovedPrompt(res.data.prompt);
            } else {
                throw new Error(res.data?.error || 'No se pudo generar el prompt mejorado');
            }
        } catch (err) {
            console.error('Error enhancing prompt:', err);
            alert('Falló la conexión o el modelo tardó mucho en responder.');
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (!improvedPrompt) return;
        navigator.clipboard.writeText(improvedPrompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleApply = () => {
        if (improvedPrompt) {
            onPromptImproved(improvedPrompt);
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col shadow-2xl h-[85vh]">

                {/* Header */}
                <div className="bg-indigo-900 border-b border-indigo-700 p-4 flex items-center justify-between shadow-lg z-10">
                    <div className="flex items-center gap-3">
                        <Sparkles size={24} className="text-indigo-400" />
                        <div>
                            <h2 className="text-lg font-bold text-white">Co-Piloto AI</h2>
                            <p className="text-indigo-300 text-xs">Mejora tu System Prompt con lenguaje natural</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-indigo-300 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-5 flex flex-col gap-5">
                    {/* Panel Prompt Actual (Solo-lectura) */}
                    <div className="flex flex-col gap-2">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Prompt Actual</h3>
                        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3 max-h-40 overflow-auto">
                            <pre className="text-[11px] text-slate-300 whitespace-pre-wrap font-mono">{currentPrompt || 'No hay prompt actualmente configurado.'}</pre>
                        </div>
                    </div>

                    {/* Chat Interaction */}
                    <div className="flex flex-col gap-2">
                        <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">¿Qué quieres cambiar?</h3>
                        <div className="flex gap-2 relative">
                            <input
                                type="text"
                                className="w-full bg-slate-900 border border-indigo-500/50 rounded-lg pl-4 pr-12 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
                                placeholder="Ej: Hazlo más amigable, agrega regla para no dar descuentos..."
                                value={instruction}
                                onChange={(e) => setInstruction(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleImprove();
                                }}
                                disabled={loading || !currentPrompt}
                            />
                            <button
                                onClick={handleImprove}
                                disabled={loading || !currentPrompt || !instruction.trim()}
                                className="absolute right-1 top-1 bottom-1 aspect-square bg-indigo-600 hover:bg-indigo-500 rounded-md flex items-center justify-center text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                    </div>

                    {/* Resultado / Panel Prompt Mejorado */}
                    {improvedPrompt && (
                        <div className="flex-1 flex flex-col gap-2 min-h-0 bg-slate-900 border border-emerald-500/30 rounded-lg p-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-emerald-900/20 px-3 py-2 border-b border-emerald-500/20 flex justify-between items-center rounded-t-md">
                                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                                    <Wand2 size={14} /> Nueva Versión Sugerida
                                </h3>
                                <div className="flex gap-2">
                                    <button onClick={handleCopy} className="text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors bg-slate-800 px-2 py-1 rounded">
                                        {copied ? <CheckCircle2 size={12} className="text-green-400" /> : <Copy size={12} />}
                                        {copied ? 'Copiado' : 'Copiar'}
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto p-3">
                                <pre className="text-[11px] text-emerald-100/90 whitespace-pre-wrap font-mono">{improvedPrompt}</pre>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Acción */}
                {improvedPrompt && (
                    <div className="p-4 bg-slate-900 border-t border-slate-700 flex justify-end gap-3">
                        <button onClick={() => setImprovedPrompt(null)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
                            Descartar
                        </button>
                        <button onClick={handleApply} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-emerald-900/50 transition-all flex items-center gap-2">
                            <CheckCircle2 size={16} /> Aplicar este Prompt
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
