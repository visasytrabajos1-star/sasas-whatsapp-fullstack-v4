import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
    Users,
    DollarSign,
    Activity,
    ShieldAlert,
    TrendingUp,
    Search,
    Filter,
    ArrowUpRight,
    ArrowDownRight,
    MoreVertical
} from 'lucide-react';

const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface GlobalStats {
    total_users: number;
    active_subscriptions: number;
    total_revenue: number;
    total_messages: number;
}

const SuperAdminDashboard = () => {
    const [stats, setStats] = useState<GlobalStats>({
        total_users: 0,
        active_subscriptions: 0,
        total_revenue: 0,
        total_messages: 0
    });
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchGlobalData();
    }, []);

    const fetchGlobalData = async () => {
        try {
            setLoading(true);
            // 1. Fetch Users joined with Plans
            const { data: usersData, error: usersError } = await supabase
                .from('profiles')
                .select('*, plans(name, price_monthly)');

            if (usersError) throw usersError;

            // 2. Fetch Global Usage
            const { data: usageData, error: usageError } = await supabase
                .from('usage_metrics')
                .select('messages_sent');

            if (usageError) throw usageError;

            const totalMsgs = usageData?.reduce((acc, curr) => acc + curr.messages_sent, 0) || 0;
            const activeSubs = usersData?.filter(u => u.subscription_status === 'active').length || 0;
            const revenue = usersData?.reduce((acc, curr) => acc + (curr.plans?.price_monthly || 0), 0) || 0;

            setUsers(usersData || []);
            setStats({
                total_users: usersData?.length || 0,
                active_subscriptions: activeSubs,
                total_revenue: revenue,
                total_messages: totalMsgs
            });

        } catch (err: any) {
            console.error("SuperAdmin Error:", err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter(u =>
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="p-8 text-center text-slate-400">Accediendo a la Consola de Control de ALEX IO...</div>;

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
            {/* Header */}
            <header className="mb-10 flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-2 mb-2 text-blue-500">
                        <ShieldAlert size={20} />
                        <span className="text-xs font-bold uppercase tracking-widest">SaaS SuperAdmin</span>
                    </div>
                    <h1 className="text-4xl font-bold tracking-tight">Consola Global <span className="text-blue-500">ALEX IO</span></h1>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar usuarios..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-950 border border-slate-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
                        />
                    </div>
                </div>
            </header>

            {/* global metrics cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
                <MetricCard
                    title="Usuarios Totales"
                    value={stats.total_users}
                    icon={<Users className="text-blue-400" />}
                    trend="+12%"
                    isUp={true}
                />
                <MetricCard
                    title="Suscripciones Activas"
                    value={stats.active_subscriptions}
                    icon={<TrendingUp className="text-emerald-400" />}
                    trend="+5%"
                    isUp={true}
                />
                <MetricCard
                    title="MRR (Ingresos/mes)"
                    value={`$${stats.total_revenue.toLocaleString()}`}
                    icon={<DollarSign className="text-yellow-400" />}
                    trend="+18%"
                    isUp={true}
                />
                <MetricCard
                    title="Mensajes Globales"
                    value={stats.total_messages.toLocaleString()}
                    icon={<Activity className="text-purple-400" />}
                    trend="-2%"
                    isUp={false}
                />
            </div>

            {/* Users Table */}
            <section className="bg-slate-950 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                    <h3 className="font-bold flex items-center gap-2">
                        <Users size={18} className="text-slate-500" />
                        Directorio de Clientes
                    </h3>
                    <button className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                        <Filter size={14} />
                        Filtros Avanzados
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-900/50 text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b border-slate-900">
                            <tr>
                                <th className="px-6 py-4">Usuario</th>
                                <th className="px-6 py-4">Plan</th>
                                <th className="px-6 py-4">Estado</th>
                                <th className="px-6 py-4">Suscripción</th>
                                <th className="px-6 py-4">Registrado</th>
                                <th className="px-6 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900">
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-slate-900/40 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-500 font-bold text-xs border border-blue-500/20">
                                                {user.email?.[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold">{user.full_name || 'Sin nombre'}</p>
                                                <p className="text-xs text-slate-500">{user.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${user.plans?.name === 'Pro' ? 'bg-yellow-500/10 text-yellow-500' :
                                                user.plans?.name === 'Enterprise' ? 'bg-purple-500/10 text-purple-500' :
                                                    'bg-slate-800 text-slate-400'
                                            }`}>
                                            {user.plans?.name || 'Free'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-1.5 h-1.5 rounded-full ${user.subscription_status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                            <span className="text-xs text-slate-400 capitalize">{user.subscription_status}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-xs font-mono text-slate-300">${user.plans?.price_monthly || 0}/mes</p>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button className="p-2 hover:bg-slate-800 rounded-lg text-slate-600 transition-colors">
                                            <MoreVertical size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};

const MetricCard = ({ title, value, icon, trend, isUp }: any) => (
    <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl shadow-xl hover:border-slate-700 transition-all group">
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-slate-900 rounded-2xl group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${isUp ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                {isUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                {trend}
            </div>
        </div>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-1">{title}</p>
        <h4 className="text-2xl font-bold text-white">{value}</h4>
    </div>
);

export default SuperAdminDashboard;
