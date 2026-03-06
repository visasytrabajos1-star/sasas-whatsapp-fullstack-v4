import React, { useEffect, useState, useRef } from 'react';
import { Send, User, Bot, Clock, ShieldAlert, ZapOff, Zap } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { fetchJsonWithApiFallback, getAuthHeaders } from '../api';

export default function LiveChat({ instanceId, tenantId }) {
    const [leads, setLeads] = useState([]);
    const [selectedLead, setSelectedLead] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);

    // Initial Data Load
    useEffect(() => {
        if (!instanceId || !supabase) return;

        const loadRecentLeads = async () => {
            // Because Supabase doesn't have native SELECT DISTINCT out of the box for client,
            // we'll fetch recent messages and group in memory to find active chats
            const { data, error } = await supabase
                .from('messages')
                .select('remote_jid, created_at, content')
                .eq('instance_id', instanceId)
                .order('created_at', { ascending: false })
                .limit(500);

            if (data && !error) {
                const uniqueLeads = new Map();
                data.forEach(msg => {
                    if (!uniqueLeads.has(msg.remote_jid)) {
                        uniqueLeads.set(msg.remote_jid, {
                            jid: msg.remote_jid,
                            lastMessageAt: msg.created_at,
                            preview: msg.content.substring(0, 30)
                        });
                    }
                });
                setLeads(Array.from(uniqueLeads.values()));
            }
        };

        loadRecentLeads();

        // Subscribe to real-time incoming/outgoing messages
        const channel = supabase.channel(`public:messages:${instanceId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `instance_id=eq.${instanceId}`
            }, (payload) => {
                const newMsg = payload.new;

                // If it's the currently selected chat, append message
                setMessages(prev => {
                    // Check if we are viewing this lead's chat
                    if (newMsg.remote_jid === selectedLead) {
                        return [...prev, newMsg];
                    }
                    return prev;
                });

                // Move this lead to the top of the contacts list
                setLeads(prevLeads => {
                    const existing = prevLeads.find(l => l.jid === newMsg.remote_jid);
                    const updatedLead = existing
                        ? { ...existing, lastMessageAt: newMsg.created_at, preview: newMsg.content.substring(0, 30) }
                        : { jid: newMsg.remote_jid, lastMessageAt: newMsg.created_at, preview: newMsg.content.substring(0, 30) };
                    return [updatedLead, ...prevLeads.filter(l => l.jid !== newMsg.remote_jid)];
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [instanceId]);

    // Fetch conversation when a lead is selected
    useEffect(() => {
        if (!selectedLead || !supabase) return;

        const loadConversation = async () => {
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('instance_id', instanceId)
                .eq('remote_jid', selectedLead)
                .order('created_at', { ascending: true })
                .limit(100);

            if (data && !error) setMessages(data);

            // At this point we assume AI is active (not paused). 
            // In a deeper implementation, we'd fetch this from the backend or DB.
            setIsPaused(false);
        };

        loadConversation();
    }, [selectedLead, instanceId]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || !selectedLead) return;

        setSending(true);
        try {
            const res = await fetchJsonWithApiFallback('/api/saas/messages/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    instanceId,
                    remoteJid: selectedLead,
                    text: input.trim()
                })
            });
            if (res.response.ok) {
                setInput('');
            } else {
                alert('Error al enviar mensaje');
            }
        } catch (err) {
            alert('Falló conexión de red al enviar');
        } finally {
            setSending(false);
        }
    };

    const togglePauseBot = async () => {
        const nextState = !isPaused;
        setIsPaused(nextState);
        try {
            await fetchJsonWithApiFallback(`/api/saas/instance/${instanceId}/pause`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                body: JSON.stringify({
                    remoteJid: selectedLead,
                    paused: nextState
                })
            });
        } catch (err) {
            setIsPaused(!nextState); // Rollback on error
            alert('No se pudo pausar el Bot');
        }
    };

    return (
        <div className="flex h-full glass-card rounded-xl border border-slate-700 overflow-hidden animate-slide-in">
            {/* Sidebar Leads */}
            <div className="w-1/3 border-r border-slate-700 flex flex-col bg-slate-900">
                <div className="p-4 border-b border-slate-700 bg-slate-950">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <Clock size={18} className="text-blue-500" /> Conversaciones
                    </h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {leads.length === 0 ? (
                        <p className="text-sm text-slate-500 p-4 text-center mt-10">Sin chats recientes</p>
                    ) : (
                        leads.map(lead => (
                            <button
                                key={lead.jid}
                                onClick={() => setSelectedLead(lead.jid)}
                                className={`w-full text-left p-4 border-b border-slate-800 transition-colors ${selectedLead === lead.jid ? 'bg-blue-900/40 border-l-4 border-l-blue-500' : 'hover:bg-slate-800'}`}
                            >
                                <div className="font-mono text-xs text-slate-300 mb-1">{lead.jid.split('@')[0]}</div>
                                <div className="text-xs text-slate-500 truncate">{lead.preview}</div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Window */}
            <div className="flex-1 flex flex-col bg-slate-950 relative">
                {!selectedLead ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                        <User size={48} className="mb-4 opacity-20" />
                        <p>Selecciona un chat para interactuar</p>
                    </div>
                ) : (
                    <>
                        <div className="p-4 border-b border-slate-700 bg-slate-900 flex justify-between items-center">
                            <span className="font-mono font-bold text-slate-200">{selectedLead.split('@')[0]}</span>

                            <button
                                onClick={togglePauseBot}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold transition-all ${isPaused ? 'bg-red-900/40 text-red-400 border border-red-800' : 'bg-emerald-900/40 text-emerald-400 border border-emerald-800'}`}
                            >
                                {isPaused ? <ZapOff size={14} /> : <Zap size={14} />}
                                {isPaused ? 'Bot Pausado (Control Manual)' : 'Bot IA Respondiendo'}
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map((msg, idx) => {
                                const isUser = msg.direction === 'INBOUND';
                                return (
                                    <div key={msg.id || idx} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`max-w-[70%] rounded-xl p-3 text-sm flex flex-col ${isUser ? 'bg-slate-800 text-slate-200 rounded-tl-none' : 'bg-blue-600 text-white rounded-tr-none'}`}>
                                            <span>{msg.content}</span>
                                            <span className={`text-[9px] mt-1 text-right ${isUser ? 'text-slate-500' : 'text-blue-300'}`}>
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                {!isUser && msg.translation_model === 'none' && ' (Manual)'}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-700 bg-slate-900 flex gap-2">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Escribe un mensaje como Agente Humano..."
                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                                disabled={sending}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || sending}
                                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg px-4 transition-colors flex items-center justify-center gap-2 font-bold"
                            >
                                <Send size={18} /> Enviar
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
