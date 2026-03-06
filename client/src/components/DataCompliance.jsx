import React, { useState, useEffect } from 'react';
import { Shield, Lock, Search, RefreshCw, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient'; // Ensure supabase instance is imported directly for client-side fetches

export default function DataCompliance({ instanceId, tenantId }) {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchAuditLogs = async () => {
        setLoading(true);
        try {
            // Fetch latest 50 messages for this instance, including hash and audit status
            const { data, error } = await supabase
                .from('messages')
                .select(`
                    id,
                    remote_jid,
                    direction,
                    content,
                    message_hash,
                    previous_hash,
                    audit_flag,
                    audit_reason,
                    created_at,
                    shadow_audit_logs (
                        is_compliant,
                        claude_analysis
                    )
                `)
                .eq('instance_id', instanceId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setMessages(data || []);
        } catch (err) {
            console.error('Error fetching compliance logs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (instanceId) {
            fetchAuditLogs();
        }
    }, [instanceId]);

    const filteredMessages = messages.filter(m =>
        m.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.remote_jid?.includes(searchTerm)
    );

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Shield size={20} className="text-cyan-500" /> Data Compliance & Auditoría
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Registros inmutables Hash SHA-256 en cadena y evaluación Shadow Mode por Anthropic Claude 3.5 Sonnet.</p>
                </div>
                <button
                    onClick={fetchAuditLogs}
                    className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded transition-colors"
                >
                    <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refrescar
                </button>
            </div>

            <div className="mb-4 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                    type="text"
                    placeholder="Buscar por contenido de chat o número..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded p-2 pl-9 text-sm text-slate-300 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
            </div>

            <div className="flex-1 overflow-auto border border-slate-700/50 rounded-lg">
                <table className="w-full text-left text-xs mb-10">
                    <thead className="bg-slate-950 sticky top-0 z-10 text-slate-400">
                        <tr>
                            <th className="p-3 font-medium">Fecha</th>
                            <th className="p-3 font-medium">Teléfono / Dir</th>
                            <th className="p-3 font-medium">Mensaje</th>
                            <th className="p-3 font-medium">Hash Criptográfico (SHA-256)</th>
                            <th className="p-3 font-medium">Estado Auditoría (Claude 3.5)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {loading && messages.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-500"><RefreshCw className="animate-spin inline-block mr-2" /> Cargando cadena criptográfica...</td></tr>
                        ) : filteredMessages.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-slate-500">No hay mensajes auditados encontrados o base vacía.</td></tr>
                        ) : filteredMessages.map(msg => {
                            const isFailed = msg.audit_flag === 'FAILED';
                            const claudeLog = msg.shadow_audit_logs?.[0]; // If array
                            const riskScore = claudeLog?.claude_analysis?.risk_score;

                            return (
                                <tr key={msg.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="p-3 text-slate-400 align-top max-w-[100px] whitespace-nowrap">
                                        {new Date(msg.created_at).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                                    </td>
                                    <td className="p-3 align-top font-mono text-slate-400">
                                        {msg.direction === 'OUTBOUND' ? <span className="text-blue-400 mr-1">↑</span> : <span className="text-green-400 mr-1">↓</span>}
                                        {msg.remote_jid.split('@')[0]}
                                    </td>
                                    <td className="p-3 align-top text-slate-300 max-w-xs truncate" title={msg.content}>
                                        {msg.content}
                                    </td>
                                    <td className="p-3 align-top font-mono text-[10px]">
                                        {msg.message_hash ? (
                                            <div className="flex items-center gap-1.5 text-cyan-500 bg-cyan-950/20 px-2 py-1 rounded inline-block">
                                                <Lock size={10} /> {msg.message_hash.substring(0, 16)}...
                                            </div>
                                        ) : <span className="text-slate-600">Pte. Hashing</span>}
                                        {msg.previous_hash && <div className="text-slate-600 mt-0.5 truncate max-w-[150px]" title={msg.previous_hash}>Prev: {msg.previous_hash.substring(0, 10)}...</div>}
                                    </td>
                                    <td className="p-3 align-top">
                                        {isFailed ? (
                                            <div className="flex flex-col gap-1">
                                                <span className="flex items-center gap-1 text-red-400 bg-red-950/50 px-2 py-0.5 rounded border border-red-500/30 inline-block font-bold">
                                                    <AlertTriangle size={12} /> VIOLACIÓN (Risk: {riskScore})
                                                </span>
                                                <span className="text-[9px] text-red-300 leading-tight">
                                                    {msg.audit_reason}
                                                </span>
                                            </div>
                                        ) : claudeLog ? (
                                            <span className="flex items-center gap-1 text-green-400 bg-green-950/20 px-2 py-0.5 rounded border border-green-500/20 inline-block w-max">
                                                <CheckCircle2 size={12} /> Seguro (Risk: {riskScore})
                                            </span>
                                        ) : msg.direction === 'INBOUND' ? (
                                            <span className="text-slate-500 text-[10px]">Solo salientes</span>
                                        ) : (
                                            <span className="text-slate-500 text-[10px] animate-pulse">Auditando...</span>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex justify-between items-center text-[10px] text-slate-500">
                <p>⚡ Audited by Claude 3.5 Sonnet (Shadow Mode)</p>
                <button className="flex items-center gap-1 hover:text-cyan-400 transition-colors">
                    <FileText size={12} /> Exportar Logs Inmutables (CSV)
                </button>
            </div>
        </div>
    );
}
