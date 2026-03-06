import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    CreditCard,
    Users,
    Tag,
    Settings,
    DollarSign,
    Activity,
    Save,
    Plus,
    Lock,
    Zap,
    TrendingDown,
    Shield,
    Layout,
    MessageSquare
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import api from '../services/api'; // Use centralized API service

const AdminDashboard = () => {
    // BYPASS AUTH: User requested open admin access
    const [activeTab, setActiveTab] = useState('expenses');

    return (
        <div className="min-h-screen bg-slate-900 text-white flex">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-800 border-r border-slate-700 p-6 flex flex-col hidden md:flex">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-10">
                    Admin Panel
                </h1>

                <nav className="space-y-2 flex-1">
                    <SidebarItem
                        icon={<Activity />}
                        label="Costos & IA"
                        isActive={activeTab === 'expenses'}
                        onClick={() => setActiveTab('expenses')}
                    />
                    <SidebarItem
                        icon={<Shield />}
                        label="Cerebro IO"
                        isActive={activeTab === 'brain'}
                        onClick={() => setActiveTab('brain')}
                    />
                    <SidebarItem
                        icon={<DollarSign />}
                        label="Facturación"
                        isActive={activeTab === 'billing'}
                        onClick={() => setActiveTab('billing')}
                    />
                    <SidebarItem
                        icon={<Tag />}
                        label="Promociones"
                        isActive={activeTab === 'promos'}
                        onClick={() => setActiveTab('promos')}
                    />
                    <SidebarItem
                        icon={<Users />}
                        label="Usuarios & Progreso"
                        isActive={activeTab === 'users'}
                        onClick={() => setActiveTab('users')}
                    />
                    <SidebarItem
                        icon={<Settings />}
                        label="Configuración"
                        isActive={activeTab === 'settings'}
                        onClick={() => setActiveTab('settings')}
                    />
                </nav>

                <div className="text-xs text-slate-500 mt-auto">
                    v1.2.0 - Optimization Update
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-4 md:p-10 overflow-y-auto">
                <div className="md:hidden mb-6 flex gap-2 overflow-x-auto pb-2">
                    {/* Mobile Nav Tabs */}
                    <button onClick={() => setActiveTab('expenses')} className={`px-4 py-2 rounded-lg ${activeTab === 'expenses' ? 'bg-blue-600' : 'bg-slate-800'}`}>IA</button>
                    <button onClick={() => setActiveTab('billing')} className={`px-4 py-2 rounded-lg ${activeTab === 'billing' ? 'bg-blue-600' : 'bg-slate-800'}`}>Pagos</button>
                </div>

                {activeTab === 'expenses' && <ExpensesSection />}
                {activeTab === 'brain' && <BrainSection />}
                {activeTab === 'billing' && <BillingSection />}
                {activeTab === 'promos' && <PromotionsSection />}
                {activeTab === 'users' && <UsersSection />}
                {activeTab === 'settings' && <SettingsSection />}
            </main>
        </div>
    );
};

// Components
const SidebarItem = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${isActive ? 'bg-purple-500/20 text-purple-300' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'}`}
    >
        {React.cloneElement(icon, { size: 20 })}
        <span className="font-medium">{label}</span>
    </button>
);

const ExpensesSection = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/admin/stats?limit=50')
            .then(res => {
                setStats(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Error fetching stats:", err);
                setLoading(false);
            });
    }, []);

    const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 }).format(val);

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Zap className="text-yellow-400" fill="currentColor" /> Visor de Consumo IA
            </h2>

            {loading ? (
                <div className="text-slate-400">Cargando datos del servidor...</div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-slate-400 text-sm">Gasto Total (Sesión)</p>
                                    <h3 className="text-3xl font-bold text-white mt-1">{formatCurrency(stats?.summary?.total_cost_window || 0)}</h3>
                                </div>
                                <div className="p-3 bg-red-500/20 text-red-400 rounded-lg">
                                    <DollarSign size={24} />
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">En las últimas 50 peticiones</p>
                        </div>

                        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-slate-400 text-sm">Uso DeepSeek V3</p>
                                    <h3 className="text-3xl font-bold text-blue-400 mt-1">{stats?.summary?.deepseek_usage_pct}%</h3>
                                </div>
                                <div className="p-3 bg-blue-500/20 text-blue-400 rounded-lg">
                                    <TrendingDown size={24} />
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">Tráfico desviado al "Challenger"</p>
                        </div>

                        <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-slate-400 text-sm">Aciertos Caché ($0)</p>
                                    <h3 className="text-3xl font-bold text-green-400 mt-1">{stats?.summary?.cache_hits}</h3>
                                </div>
                                <div className="p-3 bg-green-500/20 text-green-400 rounded-lg">
                                    <Save size={24} />
                                </div>
                            </div>
                            <p className="text-xs text-slate-500">Respuestas instantáneas gratuitas</p>
                        </div>
                    </div>

                    {/* Logs Table */}
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
                        <div className="p-6 border-b border-slate-700">
                            <h3 className="font-semibold text-lg">Historial de Transacciones en Vivo</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold">
                                    <tr>
                                        <th className="p-4">Hora</th>
                                        <th className="p-4">Input</th>
                                        <th className="p-4">Tráducción</th>
                                        <th className="p-4">Cost ($)</th>
                                        <th className="p-4">Motores (STT / LLM / TTS)</th>
                                        <th className="p-4">Optimización</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700 text-sm">
                                    {stats?.logs?.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-700/30 transition-colors">
                                            <td className="p-4 text-slate-400 whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleTimeString()}
                                            </td>
                                            <td className="p-4 max-w-[200px] truncate" title={log.input_text}>
                                                {log.input_text || '...'}
                                            </td>
                                            <td className="p-4 max-w-[200px] truncate text-slate-300" title={log.translated_text}>
                                                {log.translated_text}
                                            </td>
                                            <td className="p-4 font-mono font-bold text-emerald-400">
                                                ${Number(log.cost_estimated).toFixed(5)}
                                            </td>
                                            <td className="p-4 text-xs text-slate-500">
                                                {log.provider_stt?.split('-')[0]} / {log.provider_llm?.split('-')[0]} / {log.provider_tts?.split('-')[0]}
                                            </td>
                                            <td className="p-4">
                                                <div className="flex gap-2">
                                                    {log.is_cache_hit && <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-bold">CACHE</span>}
                                                    {log.is_challenger && <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-full font-bold">DEEPSEEK</span>}
                                                    {!log.is_cache_hit && !log.is_challenger && <span className="px-2 py-1 bg-gray-700 text-gray-400 text-xs rounded-full">PREMIUM</span>}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </motion.div>
    );
};

const BillingSection = () => {
    const [keys, setKeys] = useState({
        stripePublic: '',
        stripeSecret: '',
        paypalClient: ''
    });

    useEffect(() => {
        const saved = localStorage.getItem('billingKeys');
        if (saved) setKeys(JSON.parse(saved));
    }, []);

    const handleSave = () => {
        localStorage.setItem('billingKeys', JSON.stringify(keys));
        alert('Claves guardadas en local (Modo Seguro MVP)');
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-3xl font-bold mb-6">Configuración de Pasarelas</h2>

            <div className="grid grid-cols-1 gap-6 mb-8 max-w-4xl">
                <div className="p-6 bg-slate-800 rounded-2xl border border-slate-700">
                    <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <CreditCard className="text-blue-400" /> Credenciales de API
                    </h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Stripe Public Key</label>
                            <input
                                type="text"
                                value={keys.stripePublic}
                                onChange={e => setKeys({ ...keys, stripePublic: e.target.value })}
                                placeholder="pk_test_..."
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white font-mono text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-slate-400 mb-1">Stripe Secret Key</label>
                            <input
                                type="password"
                                value={keys.stripeSecret}
                                onChange={e => setKeys({ ...keys, stripeSecret: e.target.value })}
                                placeholder="sk_test_..."
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white font-mono text-sm"
                            />
                        </div>
                        <div className="pt-4 border-t border-slate-700">
                            <label className="block text-sm text-slate-400 mb-1">PayPal Client ID</label>
                            <input
                                type="text"
                                value={keys.paypalClient}
                                onChange={e => setKeys({ ...keys, paypalClient: e.target.value })}
                                placeholder="AbC123..."
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white font-mono text-sm"
                            />
                        </div>

                        {/* Mercado Pago */}
                        <div className="pt-4 border-t border-slate-700">
                            <h4 className="text-blue-400 font-semibold mb-2 flex items-center gap-2">Mercado Pago (LATAM)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Public Key</label>
                                    <input
                                        type="text"
                                        value={keys.mpPublic || ''}
                                        onChange={e => setKeys({ ...keys, mpPublic: e.target.value })}
                                        placeholder="TEST-..."
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white font-mono text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Access Token</label>
                                    <input
                                        type="password"
                                        value={keys.mpAccessToken || ''}
                                        onChange={e => setKeys({ ...keys, mpAccessToken: e.target.value })}
                                        placeholder="TEST-..."
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white font-mono text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Lemon Squeezy */}
                        <div className="pt-4 border-t border-slate-700">
                            <h4 className="text-purple-400 font-semibold mb-2 flex items-center gap-2">Lemon Squeezy (SaaS)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">API Key</label>
                                    <input
                                        type="password"
                                        value={keys.lsApiKey || ''}
                                        onChange={e => setKeys({ ...keys, lsApiKey: e.target.value })}
                                        placeholder="eyJ..."
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white font-mono text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">Store ID</label>
                                    <input
                                        type="text"
                                        value={keys.lsStoreId || ''}
                                        onChange={e => setKeys({ ...keys, lsStoreId: e.target.value })}
                                        placeholder="12345"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white font-mono text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* dLocal */}
                        <div className="pt-4 border-t border-slate-700">
                            <h4 className="text-orange-400 font-semibold mb-2 flex items-center gap-2">dLocal (Emerging Markets)</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">X-Login</label>
                                    <input
                                        type="text"
                                        value={keys.dlocalLogin || ''}
                                        onChange={e => setKeys({ ...keys, dlocalLogin: e.target.value })}
                                        placeholder="Login ID"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white font-mono text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 mb-1">X-Trans-Key</label>
                                    <input
                                        type="password"
                                        value={keys.dlocalTransKey || ''}
                                        onChange={e => setKeys({ ...keys, dlocalTransKey: e.target.value })}
                                        placeholder="Trans Key"
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white font-mono text-sm"
                                    />
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleSave}
                            className="w-full mt-4 bg-green-600 hover:bg-green-500 text-white p-3 rounded-lg transition-colors flex items-center justify-center gap-2 font-bold"
                        >
                            <Save size={18} /> Guardar Credeciales
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const PromotionsSection = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Same as before... */}
        <h2 className="text-3xl font-bold mb-6">Gestión de Promociones</h2>
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 text-center">
            <p className="text-slate-400">Sistema de cupones listo para configurar en Base de Datos.</p>
        </div>
    </motion.div>
);

const UsersSection = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Use centralized API instead of hardcoded fetch
        api.get('/admin/users')
            .then(res => {
                setUsers(res.data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error fetching users:', err);
                setLoading(false);
            });
    }, []);

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-3xl font-bold mb-6">Progreso de Usuarios (En Vivo)</h2>
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
                {loading ? (
                    <p className="text-center text-slate-400">Cargando base de clientes...</p>
                ) : (
                    <div className="space-y-2">
                        {users.map((user, i) => (
                            <div key={user.id || i} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center font-bold text-white shadow-lg">
                                        {(user.email || 'U')[0].toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-white max-w-[150px] truncate md:max-w-none">{user.email || `Usuario ${i}`}</p>
                                        <p className="text-xs text-blue-300 font-semibold">{user.role_title || 'Sin Rol Definido'}</p>
                                        <p className="text-xs text-slate-500">ID: {user.id ? user.id.substring(0, 8) : 'anon'}...</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-green-400 font-bold">{user.progress || 'Nivel A1'}</p>
                                    <div className="flex gap-2 justify-end mt-1">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${user.type === 'Premium' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-slate-700 text-slate-400'}`}>
                                            {user.type}
                                        </span>
                                        <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                                            {user.usage || 0} msgs
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Último acceso: {user.last_active}</p>
                                </div>
                            </div>
                        ))}
                        {users.length === 0 && <p className="text-slate-500 text-center">No hay usuarios registrados aún.</p>}
                    </div>
                )}
            </div>
        </motion.div>
    );
};

const SettingsSection = () => {
    const [config, setConfig] = useState({ force_provider: 'auto', ab_ratio: 0 });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get('/admin/config').then(res => setConfig(res.data)).catch(console.error);
    }, []);

    const updateProvider = (mode) => {
        setSaving(true);
        api.post('/admin/config', { provider: mode })
            .then(res => {
                setConfig(prev => ({ ...prev, force_provider: mode }));
                alert(`Modo actualizado a: ${mode.toUpperCase()}`);
            })
            .catch(err => alert('Error al guardar configuración'))
            .finally(() => setSaving(false));
    };

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-3xl font-bold mb-6">Configuración del Sistema</h2>

            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 max-w-2xl">
                <h3 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
                    <Activity className="text-purple-400" /> Motor de Inteligencia Artificial
                </h3>
                <p className="text-slate-400 mb-6 text-sm">
                    Selecciona manualmente qué proveedor procesa las solicitudes. Útil para pruebas A/B o contingencia.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button
                        onClick={() => updateProvider('auto')}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${config.force_provider === 'auto' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                    >
                        <div className="font-bold">🤖 AUTO (A/B)</div>
                        <div className="text-xs opacity-70">Balanceo según ID</div>
                    </button>

                    <button
                        onClick={() => updateProvider('premium')}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${config.force_provider === 'premium' ? 'bg-green-600 border-green-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                    >
                        <div className="font-bold">💎 PREMIUM</div>
                        <div className="text-xs opacity-70">OpenAI + ElevenLabs</div>
                    </button>

                    <button
                        onClick={() => updateProvider('challenger')}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${config.force_provider === 'challenger' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                    >
                        <div className="font-bold">🚀 CHALLENGER</div>
                        <div className="text-xs opacity-70">DeepSeek + Google</div>
                    </button>
                </div>

                <div className="mt-6 p-3 bg-slate-900/50 rounded-lg text-xs text-slate-500 font-mono">
                    Variable Actual: {config.force_provider.toUpperCase()}
                </div>
            </div>
        </motion.div>
    );
};

const BrainSection = () => {
    const [configs, setConfigs] = useState([]);
    const [selectedConfig, setSelectedConfig] = useState(null);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchConfigs();
    }, []);

    const fetchConfigs = async () => {
        if (!supabase) {
            setLoading(false);
            return;
        }
        const { data, error } = await supabase
            .from('bot_configs')
            .select('*, whatsapp_accounts(account_name, phone_number)');
        if (!error) setConfigs(data);
        setLoading(false);
    };

    const fetchLogs = async (configId) => {
        if (!supabase) return;
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
        if (!error) setLogs(data);
    };

    const handleSave = async () => {
        if (!selectedConfig || !supabase) return;
        const { error } = await supabase
            .from('bot_configs')
            .update({
                constitution: selectedConfig.constitution,
                conversation_structure: selectedConfig.conversation_structure,
                system_prompt: selectedConfig.system_prompt
            })
            .eq('id', selectedConfig.id);

        if (!error) alert('Configuración guardada en ALEX IO 🚀');
        else alert('Error al guardar: ' + error.message);
    };

    if (loading) return <div className="text-slate-400">Iniciando Cerebro ALEX IO...</div>;

    return (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="h-full flex flex-col">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
                <Shield className="text-blue-400" /> Configuración de Cerebro ALEX IO
            </h2>

            {!supabase ? (
                <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl text-center">
                    <p className="text-red-400 font-bold mb-2">⚠️ Conexión de Base de Datos Desactivada</p>
                    <p className="text-sm text-slate-400">Esta sección requiere una conexión activa con Supabase para editar las constituciones.</p>
                </div>
            ) : (
                <div className="flex-1 flex gap-6 min-h-0">
                    {/* Navigation Mini Sidebar */}
                    <div className="w-1/4 bg-slate-800/50 rounded-2xl border border-slate-700 p-2 overflow-y-auto">
                        <p className="text-[10px] font-bold text-slate-500 uppercase px-3 py-2 tracking-widest">Cuentas Disponibles</p>
                        {configs.map(cfg => (
                            <button
                                key={cfg.id}
                                onClick={() => { setSelectedConfig(cfg); fetchLogs(cfg.id); }}
                                className={`w-full text-left p-3 rounded-xl transition-all mb-1 ${selectedConfig?.id === cfg.id ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-700'}`}
                            >
                                <div className="font-bold text-sm truncate">{cfg.whatsapp_accounts?.account_name || 'Sin Nombre'}</div>
                                <div className="text-[10px] opacity-70">{cfg.whatsapp_accounts?.phone_number || 'Sin Teléfono'}</div>
                            </button>
                        ))}
                        {configs.length === 0 && <p className="text-xs text-slate-600 p-4 italic">No hay configuraciones encontradas.</p>}
                    </div>

                    {/* Editor Area */}
                    {selectedConfig ? (
                        <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-y-auto pr-2">
                            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold">{selectedConfig.whatsapp_accounts?.account_name}</h3>
                                    <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl flex items-center gap-2 font-bold transition-all shadow-lg shadow-blue-900/40">
                                        <Save size={18} /> Guardar Cerebro
                                    </button>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <Shield size={14} /> Constitución (Leyes del Bot)
                                        </label>
                                        <textarea
                                            value={selectedConfig.constitution || ''}
                                            onChange={e => setSelectedConfig({ ...selectedConfig, constitution: e.target.value })}
                                            className="w-full h-48 bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Ingresa la constitución de este bot..."
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-purple-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <Layout size={14} /> Estructura
                                            </label>
                                            <textarea
                                                value={selectedConfig.conversation_structure || ''}
                                                onChange={e => setSelectedConfig({ ...selectedConfig, conversation_structure: e.target.value })}
                                                className="w-full h-32 bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                                placeholder="Flujo de ventas o soporte..."
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                <MessageSquare size={14} /> Prompt Base
                                            </label>
                                            <textarea
                                                value={selectedConfig.system_prompt || ''}
                                                onChange={e => setSelectedConfig({ ...selectedConfig, system_prompt: e.target.value })}
                                                className="w-full h-32 bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                                placeholder="Nombre, tono, personalidad..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cognitive Trace (Mini) */}
                            <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2">
                                    <Activity size={14} /> Trazabilidad Cognitiva Reciente
                                </h4>
                                <div className="space-y-2">
                                    {logs.map(log => (
                                        <div key={log.id} className="p-3 bg-slate-900/50 border border-slate-700/50 rounded-lg text-xs flex justify-between gap-4">
                                            <div className="flex-1">
                                                <span className={`font-bold mr-2 ${log.direction === 'inbound' ? 'text-slate-500' : 'text-blue-400'}`}>
                                                    {log.direction.toUpperCase()}
                                                </span>
                                                <span className="text-slate-300">{log.content?.substring(0, 120)}...</span>
                                            </div>
                                            <div className="text-right text-[10px] text-slate-600 font-mono">
                                                {log.ai_model || 'human'} | {log.processing_time_ms || 0}ms
                                            </div>
                                        </div>
                                    ))}
                                    {logs.length === 0 && <p className="text-center text-slate-600 text-xs py-4">Sin actividad reciente registrada.</p>}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-600 bg-slate-800/20 rounded-2xl border border-slate-700 border-dashed">
                            <Shield size={48} className="mb-4 opacity-10" />
                            <p className="text-sm">Selecciona una cuenta para configurar su cerebro cognitivo</p>
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
};

export default AdminDashboard;
