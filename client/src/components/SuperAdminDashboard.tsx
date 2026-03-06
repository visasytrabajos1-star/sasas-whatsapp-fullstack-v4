import React, { useState, useEffect } from 'react';
import { fetchJsonWithApiFallback, getAuthHeaders } from '../api';
import {
    Users,
    DollarSign,
    Activity,
    ShieldAlert,
    TrendingUp,
    Search,
    MessageCircle,
    Server,
    ArrowUpRight,
    ArrowDownRight,
    MoreVertical,
    ChevronDown,
    ChevronRight,
    RefreshCw,
    Power,
    Trash2,
    AlertTriangle,
    CheckCircle2,
    Info,
    Cpu,
    Zap,
    Heart
} from 'lucide-react';

interface GlobalStats {
    total_users: number;
    active_bots: number;
    total_revenue: number;
    total_messages: number;
    bots_with_errors: number;
    estimated_daily_cost: number;
}

const SuperAdminDashboard = () => {
    const [stats, setStats] = useState<GlobalStats>({
        total_users: 0,
        active_bots: 0,
        total_revenue: 0,
        total_messages: 0,
        bots_with_errors: 0,
        estimated_daily_cost: 0
    });
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedBot, setExpandedBot] = useState<string | null>(null);
    const [botDetails, setBotDetails] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        fetchGlobalData();
        const interval = setInterval(fetchGlobalData, 30000); // Auto-refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const fetchGlobalData = async () => {
        try {
            setLoading(true);
            const { response, data } = await fetchJsonWithApiFallback('/api/saas/superadmin/clients', {
                headers: { ...getAuthHeaders() }
            });

            if (response.ok && data.clients) {
                const totalMsgs = data.clients.reduce((acc: number, curr: any) => acc + (curr.usage?.messages_sent || 0), 0);
                const allBots = data.clients.flatMap((c: any) => c.bots || []);
                const totalBots = allBots.length;
                const botsWithErrors = allBots.filter((b: any) => b.last_error).length;

                const revMap: Record<string, number> = { 'PRO': 29.99, 'ENTERPRISE': 99.99, 'FREE': 0 };
                const revenue = data.clients.reduce((acc: number, curr: any) => acc + (revMap[curr.plan?.toUpperCase()] || 0), 0);

                // Estimate daily cost from AI usage
                let totalCost = 0;
                allBots.forEach((b: any) => {
                    if (b.ai_usage) {
                        totalCost += (b.ai_usage.openai?.tokens || 0) / 1000000 * 0.60;
                        totalCost += (b.ai_usage.deepseek?.tokens || 0) / 1000000 * 0.28;
                    }
                });

                setClients(data.clients);
                setStats({
                    total_users: data.clients.length,
                    active_bots: totalBots,
                    total_revenue: revenue,
                    total_messages: totalMsgs,
                    bots_with_errors: botsWithErrors,
                    estimated_daily_cost: totalCost
                });
            }
        } catch (err: any) {
            console.error("SuperAdmin Error:", err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchBotDetails = async (instanceId: string) => {
        if (expandedBot === instanceId) {
            setExpandedBot(null);
            setBotDetails(null);
            return;
        }
        setExpandedBot(instanceId);
        setLoadingDetails(true);
        try {
            const { response, data } = await fetchJsonWithApiFallback(`/api/saas/superadmin/bot-details/${instanceId}`, {
                headers: { ...getAuthHeaders() }
            });
            if (response.ok && data.success) {
                setBotDetails(data);
            }
        } catch (err: any) {
            console.error("Bot details error:", err.message);
        } finally {
            setLoadingDetails(false);
        }
    };

    const executeBotAction = async (instanceId: string, action: string) => {
        if (action === 'delete' && !confirm(`¿Estás seguro de ELIMINAR permanentemente el bot ${instanceId}?`)) return;
        setActionLoading(`${instanceId}_${action}`);
        try {
            const { response, data } = await fetchJsonWithApiFallback('/api/saas/superadmin/bot-action', {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ instanceId, action })
            });
            if (response.ok) {
                alert(data.message || 'Acción ejecutada.');
                fetchGlobalData();
            } else {
                alert(data.error || 'Error ejecutando acción');
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setActionLoading(null);
        }
    };

    const filteredClients = clients.filter(c =>
        c.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getHealthColor = (score: number) => {
        if (score >= 80) return 'text-emerald-400';
        if (score >= 50) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getHealthBg = (score: number) => {
        if (score >= 80) return 'bg-emerald-500';
        if (score >= 50) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const getLevelIcon = (level: string) => {
        if (level === 'error') return <AlertTriangle size={12} className="text-red-400" />;
        if (level === 'warn') return <AlertTriangle size={12} className="text-yellow-400" />;
        return <Info size={12} className="text-blue-400" />;
    };

    const getLevelBg = (level: string) => {
        if (level === 'error') return 'border-red-900/50 bg-red-950/30';
        if (level === 'warn') return 'border-yellow-900/50 bg-yellow-950/20';
        return 'border-slate-800 bg-slate-900/30';
    };

    if (loading && clients.length === 0) return <div className="p-8 text-center text-slate-400">Accediendo a la Consola de Control de ALEX IO...</div>;

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
            <header className="mb-10 flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-2 mb-2 text-blue-500">
                        <ShieldAlert size={20} />
                        <span className="text-xs font-bold uppercase tracking-widest">SaaS SuperAdmin</span>
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight">Consola Global <span className="text-blue-500">ALEX IO</span></h1>
                </div>
                <div className="flex gap-3">
                    <button onClick={fetchGlobalData} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-colors">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
                    </button>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input type="text" placeholder="Buscar por email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64" />
                    </div>
                </div>
            </header>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
                <MetricCard title="Clientes" value={stats.total_users} icon={<Users className="text-blue-400" size={18} />} />
                <MetricCard title="Bots Activos" value={stats.active_bots} icon={<Server className="text-emerald-400" size={18} />} />
                <MetricCard title="MRR" value={`$${Math.round(stats.total_revenue)}`} icon={<DollarSign className="text-yellow-400" size={18} />} />
                <MetricCard title="Mensajes" value={stats.total_messages.toLocaleString()} icon={<MessageCircle className="text-purple-400" size={18} />} />
                <MetricCard title="Bots con Errores" value={stats.bots_with_errors} icon={<AlertTriangle className="text-red-400" size={18} />} accent={stats.bots_with_errors > 0 ? 'red' : undefined} />
                <MetricCard title="Costo IA / Día" value={`$${stats.estimated_daily_cost.toFixed(4)}`} icon={<Cpu className="text-cyan-400" size={18} />} />
            </div>

            {/* Clients Table */}
            <section className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                    <h3 className="font-bold flex items-center gap-2"><Users size={18} className="text-slate-500" /> Directorio de Entidades (Tenants)</h3>
                    <span className="text-xs text-slate-500">{filteredClients.length} clientes</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-900/50 text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b border-slate-900">
                            <tr>
                                <th className="px-6 py-4">Tenant (Email)</th>
                                <th className="px-6 py-4">Plan</th>
                                <th className="px-6 py-4">Uso</th>
                                <th className="px-6 py-4">Tokens IA</th>
                                <th className="px-6 py-4">Bots</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900">
                            {filteredClients.map(client => (
                                <React.Fragment key={client.id}>
                                    <tr className="hover:bg-slate-900/40 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-500 font-bold text-xs border border-blue-500/20">{client.email?.[0]?.toUpperCase()}</div>
                                                <div>
                                                    <p className="text-sm font-semibold">{client.email}</p>
                                                    <p className="text-xs text-slate-500">ID: {client.tenant_id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${client.plan === 'PRO' ? 'bg-yellow-500/10 text-yellow-500' : client.plan === 'ENTERPRISE' ? 'bg-purple-500/10 text-purple-500' : 'bg-slate-800 text-slate-400'}`}>
                                                {client.plan || 'FREE'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 w-24">
                                                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(((client.usage?.messages_sent || 0) / Math.max(client.usage?.plan_limit || 1, 1)) * 100, 100)}%` }}></div>
                                                </div>
                                                <span className="text-[10px] text-slate-400">{client.usage?.messages_sent || 0} / {client.usage?.plan_limit || 0}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-xs font-mono text-purple-300">{client.usage?.tokens_consumed ? `${(client.usage.tokens_consumed / 1000).toFixed(1)}k` : '0'}</p>
                                        </td>
                                        <td className="px-6 py-4">
                                            {client.bots?.length > 0 ? (
                                                <div className="flex flex-col gap-1.5">
                                                    {client.bots.map((b: any) => (
                                                        <button
                                                            key={b.instance_id}
                                                            onClick={() => fetchBotDetails(b.instance_id)}
                                                            className={`text-[11px] flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all cursor-pointer hover:ring-1 hover:ring-blue-500/50 ${expandedBot === b.instance_id ? 'bg-blue-950/50 ring-1 ring-blue-500/30' : 'bg-slate-800/80'}`}
                                                        >
                                                            <div className={`w-2 h-2 rounded-full ${b.status === 'online' ? 'bg-emerald-500 shadow-emerald-500/50 shadow-sm' : 'bg-red-500'}`} />
                                                            <span className="truncate max-w-[100px]" title={b.company_name}>{b.company_name}</span>

                                                            {/* Health Score Badge */}
                                                            <span className={`ml-auto text-[9px] font-bold ${getHealthColor(b.health_score ?? 100)}`}>
                                                                {b.health_score ?? 100}
                                                            </span>

                                                            {b.last_error && <AlertTriangle size={10} className="text-red-400 ml-1" />}

                                                            {expandedBot === b.instance_id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-500 italic">Sin bots</span>
                                            )}
                                        </td>
                                    </tr>

                                    {/* Expanded Bot Details Row */}
                                    {client.bots?.map((b: any) => (
                                        expandedBot === b.instance_id && (
                                            <tr key={`details-${b.instance_id}`}>
                                                <td colSpan={5} className="p-0">
                                                    <div className="bg-slate-950 border-t border-b border-blue-900/30 p-6">
                                                        {loadingDetails ? (
                                                            <div className="text-center text-slate-400 py-4">Cargando detalles...</div>
                                                        ) : botDetails ? (
                                                            <div className="space-y-6">
                                                                {/* Bot Header */}
                                                                <div className="flex items-center justify-between">
                                                                    <div className="flex items-center gap-4">
                                                                        <div>
                                                                            <h4 className="text-lg font-bold">{botDetails.company_name}</h4>
                                                                            <p className="text-xs text-slate-500 font-mono">{botDetails.instance_id}</p>
                                                                        </div>
                                                                        {/* Health Score Circle */}
                                                                        <div className="flex items-center gap-2">
                                                                            <Heart size={14} className={getHealthColor(botDetails.health_score)} />
                                                                            <div className="relative w-12 h-12">
                                                                                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                                                                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#1e293b" strokeWidth="3" />
                                                                                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" className={`${getHealthBg(botDetails.health_score).replace('bg-', 'stroke-')}`} strokeWidth="3" strokeDasharray={`${botDetails.health_score}, 100`} />
                                                                                </svg>
                                                                                <span className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${getHealthColor(botDetails.health_score)}`}>{botDetails.health_score}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    {/* Actions */}
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => executeBotAction(b.instance_id, 'reconnect')}
                                                                            disabled={actionLoading === `${b.instance_id}_reconnect`}
                                                                            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                                                        >
                                                                            <RefreshCw size={12} className={actionLoading === `${b.instance_id}_reconnect` ? 'animate-spin' : ''} /> Reconectar
                                                                        </button>
                                                                        <button
                                                                            onClick={() => executeBotAction(b.instance_id, 'disconnect')}
                                                                            disabled={actionLoading === `${b.instance_id}_disconnect`}
                                                                            className="bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                                                        >
                                                                            <Power size={12} /> Desconectar
                                                                        </button>
                                                                        <button
                                                                            onClick={() => executeBotAction(b.instance_id, 'delete')}
                                                                            disabled={actionLoading === `${b.instance_id}_delete`}
                                                                            className="bg-red-600/20 hover:bg-red-600/30 text-red-400 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                                                        >
                                                                            <Trash2 size={12} /> Eliminar
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* Status Badges */}
                                                                <div className="flex gap-3 flex-wrap">
                                                                    <StatusBadge label="Estado" value={botDetails.status} color={botDetails.status === 'online' ? 'emerald' : 'red'} />
                                                                    <StatusBadge label="Reconexiones" value={botDetails.reconnect_attempts} color={botDetails.reconnect_attempts > 0 ? 'yellow' : 'slate'} />
                                                                    <StatusBadge label="Errores" value={botDetails.error_count} color={botDetails.error_count > 0 ? 'red' : 'slate'} />
                                                                    <StatusBadge label="Warnings" value={botDetails.warn_count} color={botDetails.warn_count > 0 ? 'yellow' : 'slate'} />
                                                                </div>

                                                                {/* AI Usage by Model */}
                                                                <div>
                                                                    <h5 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2"><Cpu size={14} /> Consumo por Modelo de IA</h5>
                                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                        <AiModelCard
                                                                            name="Gemini"
                                                                            color="blue"
                                                                            count={botDetails.ai_usage?.gemini?.count || 0}
                                                                            tokens={botDetails.ai_usage?.gemini?.tokens || 0}
                                                                            cost={botDetails.estimated_costs?.gemini || 0}
                                                                        />
                                                                        <AiModelCard
                                                                            name="OpenAI"
                                                                            color="emerald"
                                                                            count={botDetails.ai_usage?.openai?.count || 0}
                                                                            tokens={botDetails.ai_usage?.openai?.tokens || 0}
                                                                            cost={botDetails.estimated_costs?.openai || 0}
                                                                        />
                                                                        <AiModelCard
                                                                            name="DeepSeek"
                                                                            color="purple"
                                                                            count={botDetails.ai_usage?.deepseek?.count || 0}
                                                                            tokens={botDetails.ai_usage?.deepseek?.tokens || 0}
                                                                            cost={botDetails.estimated_costs?.deepseek || 0}
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* Event Logs */}
                                                                <div>
                                                                    <h5 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 flex items-center gap-2"><Activity size={14} /> Últimos Eventos</h5>
                                                                    <div className="max-h-64 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                                                                        {botDetails.logs?.length > 0 ? (
                                                                            [...botDetails.logs].reverse().map((log: any, idx: number) => (
                                                                                <div key={idx} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-[11px] ${getLevelBg(log.level)}`}>
                                                                                    {getLevelIcon(log.level)}
                                                                                    <span className="text-slate-500 font-mono whitespace-nowrap">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                                                                    <span className="text-slate-300 flex-1">{log.message}</span>
                                                                                    {log.meta && Object.keys(log.meta).length > 0 && (
                                                                                        <span className="text-slate-600 font-mono text-[9px]">{JSON.stringify(log.meta)}</span>
                                                                                    )}
                                                                                </div>
                                                                            ))
                                                                        ) : (
                                                                            <p className="text-slate-500 text-xs italic py-4 text-center">Sin eventos registrados aún. Los logs se generan en tiempo real.</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-center text-slate-500 py-4">No se pudieron cargar los detalles.</div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                    {filteredClients.length === 0 && <p className="text-center p-8 text-slate-500 italic">No se encontraron clientes.</p>}
                </div>
            </section>
        </div>
    );
};

// --- Sub-components ---

const MetricCard = ({ title, value, icon, accent }: any) => (
    <div className={`bg-slate-950 border ${accent === 'red' ? 'border-red-900/50' : 'border-slate-800'} p-5 rounded-2xl shadow-xl hover:border-slate-700 transition-all`}>
        <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-slate-900 rounded-xl">{icon}</div>
        </div>
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-0.5">{title}</p>
        <h4 className={`text-xl font-bold ${accent === 'red' && Number(value) > 0 ? 'text-red-400' : 'text-white'}`}>{value}</h4>
    </div>
);

const StatusBadge = ({ label, value, color }: any) => (
    <div className={`bg-${color}-500/10 border border-${color}-500/20 px-3 py-1.5 rounded-lg`}>
        <span className="text-[9px] text-slate-500 uppercase tracking-wider block">{label}</span>
        <span className={`text-sm font-bold text-${color}-400`}>{value}</span>
    </div>
);

const AiModelCard = ({ name, color, count, tokens, cost }: any) => (
    <div className={`bg-slate-900/50 border border-slate-800 rounded-xl p-4`}>
        <div className="flex items-center gap-2 mb-2">
            <Zap size={14} className={`text-${color}-400`} />
            <span className="text-xs font-bold text-slate-300">{name}</span>
        </div>
        <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Llamadas</span>
                <span className="text-slate-300 font-mono">{count}</span>
            </div>
            <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Tokens</span>
                <span className="text-slate-300 font-mono">{tokens > 1000 ? `${(tokens / 1000).toFixed(1)}k` : tokens}</span>
            </div>
            <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Costo est.</span>
                <span className={`font-mono ${cost > 0 ? 'text-yellow-400' : 'text-slate-500'}`}>${cost.toFixed(4)}</span>
            </div>
        </div>
    </div>
);

export default SuperAdminDashboard;
