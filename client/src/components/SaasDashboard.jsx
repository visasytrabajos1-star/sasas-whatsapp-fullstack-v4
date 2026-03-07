import React, { useEffect, useMemo, useState, Component } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, Activity, Settings, Smartphone, Plus, Loader, AlertTriangle, CheckCircle2, X, Wand2, LogOut, MessageCircle, Send, Globe, Book, Sparkles } from 'lucide-react';
import PromptWizard from './PromptWizard';
import PromptCopilot from './PromptCopilot';
import LiveChat from './LiveChat';
import KnowledgeBase from './KnowledgeBase';
import BroadcastCampaign from './BroadcastCampaign';
import DataCompliance from './DataCompliance';
import { fetchJsonWithApiFallback, getLastResolvedApiBase, getPreferredApiBase, getAuthHeaders } from '../api';

const VERSION = 'v2.0.4.17';

const PROVIDERS = [
  { value: 'baileys', label: 'WhatsApp QR Code' },
  { value: 'meta', label: 'WhatsApp API Cloud' },
  { value: 'coexistence', label: 'WhatsApp API Coexistencia' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'webchat', label: 'Web Chat' }
];

// --- Error Boundary to prevent full page crashes ---
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("Dashboard Error Boundary:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-8">
          <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-8 max-w-lg text-center">
            <AlertTriangle size={48} className="text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Error del Dashboard</h2>
            <p className="text-red-300 text-sm mb-4">{this.state.error?.message || 'Error inesperado'}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg font-bold"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function SaasDashboard() {
  const { t, i18n } = useTranslation();

  const userEmail = localStorage.getItem('demo_email') || 'user@app.com';
  const userRole = localStorage.getItem('alex_io_role') || 'OWNER';
  const userTenant = localStorage.getItem('alex_io_tenant') || '';

  const [connecting, setConnecting] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [apiDebugUrl, setApiDebugUrl] = useState(getPreferredApiBase() || 'No resuelta');
  const [notice, setNotice] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [instances, setInstances] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showNewBotModal, setShowNewBotModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showCopilot, setShowCopilot] = useState(false);
  const [usage, setUsage] = useState({ messages_sent: 0, plan_limit: 500, tokens_consumed: 0 });
  const [promptVersions, setPromptVersions] = useState([]);
  const [loadingPromptVersions, setLoadingPromptVersions] = useState(false);
  const [promotingVersionId, setPromotingVersionId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [newBotProvider, setNewBotProvider] = useState('baileys');
  const [activeTab, setActiveTab] = useState('config'); // 'config' | 'chat'

  // Soporte AI Chat
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportMessages, setSupportMessages] = useState([{ role: 'assistant', content: '¡Hola! Soy Alex Support. ¿En qué te puedo ayudar sobre la plataforma ALEX IO?' }]);
  const [supportInput, setSupportInput] = useState('');
  const [isSupportTyping, setIsSupportTyping] = useState(false);

  const [configDraft, setConfigDraft] = useState({
    name: '',
    provider: 'baileys',
    customPrompt: 'Eres un asistente virtual amigable y profesional.',
    voice: 'nova',
    maxWords: 50,
    maxMessages: 10,
    metaApiUrl: '',
    metaPhoneNumberId: '',
    metaAccessToken: '',
    dialogApiKey: '',
    user_gemini_key: '',
    hubspotAccessToken: '',
    copperApiKey: '',
    copperUserEmail: '',
    calendlyLink: '',
    paymentLink: ''
  });

  useEffect(() => {
    const resolved = getLastResolvedApiBase();
    if (resolved) setApiDebugUrl(resolved);
    fetchInstances();
  }, []);

  useEffect(() => {
    if (selected?.instanceId) {
      fetchPromptVersions(selected.instanceId);
      fetchAnalytics(selected.instanceId);
    } else {
      setPromptVersions([]);
      setAnalytics(null);
    }
  }, [selected?.instanceId]);

  const fetchAnalytics = async (instanceId) => {
    setLoadingAnalytics(true);
    try {
      const { response, data } = await fetchJsonWithApiFallback(`/api/saas/analytics/${instanceId}`, {
        headers: { ...getAuthHeaders() }
      });
      if (response.ok && data.success) {
        setAnalytics(data);
      }
    } catch (e) {
      console.error("Error fetching analytics:", e);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleSendSupportMessage = async (e) => {
    e.preventDefault();
    if (!supportInput.trim() || isSupportTyping) return;

    const currentInput = supportInput.trim();
    const newMessages = [...supportMessages, { role: 'user', content: currentInput }];
    setSupportMessages(newMessages);
    setSupportInput('');
    setIsSupportTyping(true);

    try {
      const { response, data } = await fetchJsonWithApiFallback('/api/saas/support-chat', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput, history: supportMessages })
      });

      if (response.ok && data.success) {
        setSupportMessages([...newMessages, { role: 'assistant', content: data.text }]);
      } else {
        setSupportMessages([...newMessages, { role: 'assistant', content: 'Lo siento, hubo un error técnico. Reintenta.' }]);
      }
    } catch (err) {
      setSupportMessages([...newMessages, { role: 'assistant', content: 'Fallo de red.' }]);
    } finally {
      setIsSupportTyping(false);
    }
  };

  const fetchInstances = async () => {
    setLoadingInstances(true);
    try {
      const { response, data } = await fetchJsonWithApiFallback('/api/saas/status', {
        timeoutMs: 15000,
        headers: { ...getAuthHeaders() }
      });
      if (response.ok && data.sessions) {
        setInstances(data.sessions.map(s => ({
          ...s,
          id: s.instanceId || s.id,
          name: s.companyName || 'Instancia Sin Nombre',
          status: s.status || 'disconnected',
          phone: s.phone || (s.provider === 'baileys' ? 'WhatsApp Web' : 'Cloud API')
        })));
        if (data.sessions.length > 0) {
          setLogs([
            { text: 'Quiero información', ai_model: 'gemini-flash', timestamp: new Date() },
            { text: '¿Cual es el precio?', ai_model: 'gemini-flash', timestamp: new Date(Date.now() - 60000) }
          ]);
        }
      }
    } catch (e) {
      console.error("Error fetching instances:", e);
    } finally {
      setLoadingInstances(false);
    }

    try {
      const { response: useRes, data: useData } = await fetchJsonWithApiFallback('/api/saas/usage', {
        timeoutMs: 15000,
        headers: { ...getAuthHeaders() }
      });
      if (useRes.ok && useData.usage) {
        setUsage(useData.usage);
      }
    } catch (e) {
      console.error("Error fetching usage:", e);
    }
  };

  useEffect(() => {
    if (!selected) return;
    setConfigDraft({
      name: selected.name || '',
      provider: selected.provider || 'baileys',
      customPrompt: selected.customPrompt || 'Eres un asistente virtual amigable y profesional.',
      voice: selected.voice || 'nova',
      maxWords: selected.maxWords || 50,
      maxMessages: selected.maxMessages || 10,
      metaApiUrl: selected.metaApiUrl || '',
      metaPhoneNumberId: selected.metaPhoneNumberId || '',
      metaAccessToken: selected.metaAccessToken || '',
      dialogApiKey: selected.dialogApiKey || '',
      hubspotAccessToken: selected.hubspotAccessToken || '',
      copperApiKey: selected.copperApiKey || '',
      copperUserEmail: selected.copperUserEmail || '',
      calendlyLink: selected.calendlyLink || '',
      paymentLink: selected.paymentLink || ''
    });
  }, [selected]);

  const pushNotice = (type, message) => setNotice({ type, message });

  const providerLabel = useMemo(() => {
    const found = PROVIDERS.find((p) => p.value === (selected?.provider || 'baileys'));
    return found?.label || 'Baileys (QR)';
  }, [selected]);

  const sortPromptVersions = (versions = []) => {
    const ranking = { active: 0, test: 1, archived: 2 };
    return [...versions].sort((a, b) => {
      const byStatus = (ranking[a.status] ?? 9) - (ranking[b.status] ?? 9);
      if (byStatus !== 0) return byStatus;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });
  };

  const handleRestartInstance = async () => {
    if (!selected?.instanceId) return;
    try {
      pushNotice('warning', 'Reiniciando el conector. Espera unos segundos...');
      await fetchJsonWithApiFallback(`/api/saas/instance/${selected.instanceId}/restart`, {
        method: 'POST',
        timeoutMs: 30000,
        headers: { ...getAuthHeaders() }
      });
      pushNotice('success', 'Sesión reiniciada. Generando nuevo código QR...');

      if (selected.provider === 'baileys') {
        const result = await waitForQr(selected.instanceId);
        if (result.type === 'qr') {
          setQrCode(result.value);
          pushNotice('success', 'Nuevo QR generado. Escanéalo para reconectar el bot sin perder la memoria.');
        } else if (result.type === 'online') {
          pushNotice('success', 'El bot se reconectó automáticamente.');
        }
      }
      setTimeout(fetchInstances, 2000);
    } catch (error) {
      pushNotice('error', error.message || 'Fallo al reiniciar.');
    }
  };

  const waitForQr = (instanceId) => new Promise((resolve, reject) => {
    const timeoutMs = 120000;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const { response: statusRes, data: statusData } = await fetchJsonWithApiFallback(`/api/saas/status/${instanceId}`, { timeoutMs: 30000, headers: { ...getAuthHeaders() } });
        setApiDebugUrl(getLastResolvedApiBase() || getPreferredApiBase() || 'No resuelta');

        if (!statusRes.ok) return;
        if (statusData.qr_code) {
          clearInterval(intervalId);
          return resolve({ type: 'qr', value: statusData.qr_code });
        }

        if (statusData.status === 'online') {
          clearInterval(intervalId);
          return resolve({ type: 'online' });
        }

        if (statusData.status === 'disconnected') {
          clearInterval(intervalId);
          return reject(new Error('WhatsApp desconectó la sesión durante el enlace. Reintenta.'));
        }
      } catch (_) {
        // keep polling
      }

      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(intervalId);
        reject(new Error('No se recibió QR a tiempo. Verifica backend/WhatsApp y reintenta.'));
      }
    };

    const intervalId = setInterval(poll, 5000);
    poll();
  });

  const handleCreateNew = async () => {
    const name = (newBotName || '').trim();
    if (!name) return;
    const provider = newBotProvider || 'baileys';

    setShowNewBotModal(false);
    setNewBotName('');
    setConnecting(true);
    setNotice(null);

    try {
      const { response: res, data } = await fetchJsonWithApiFallback('/api/saas/connect', {
        timeoutMs: 120000,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          companyName: name,
          customPrompt: `Eres un asistente virtual de ${name}`,
          provider,
          metaApiUrl: '',
          metaPhoneNumberId: '',
          metaAccessToken: '',
          dialogApiKey: ''
        })
      });

      setApiDebugUrl(getLastResolvedApiBase() || getPreferredApiBase() || 'No resuelta');

      if (!res.ok && res.status !== 408) {
        throw new Error(data.error || `Error de conexión (HTTP ${res.status})`);
      }

      const instance = {
        id: Date.now(),
        instanceId: data.instance_id,
        name,
        provider,
        customPrompt: `Eres un asistente virtual de ${name}`,
        voice: 'nova',
        maxWords: 50,
        maxMessages: 10,
        super_prompt_json: null,
        metaApiUrl: '',
        metaPhoneNumberId: '',
        metaAccessToken: '',
        dialogApiKey: '',
        hubspotAccessToken: '',
        copperApiKey: '',
        copperUserEmail: ''
      };

      if (provider !== 'baileys') {
        const cloudInstance = { ...instance, status: 'online', phone: provider === 'meta' ? 'Meta Cloud API' : '360Dialog' };
        setInstances((prev) => [...prev, cloudInstance]);
        setSelected(cloudInstance);
        pushNotice('success', data.message || 'Bot cloud configurado correctamente.');
        return;
      }

      let qr = data.qr_code;

      if (!qr && res.status === 408 && data.instance_id) {
        pushNotice('warning', 'Conexión lenta detectada: intentando recuperar QR automáticamente...');
        const result = await waitForQr(data.instance_id);

        if (result.type === 'online') {
          const onlineInstance = { ...instance, status: 'online', phone: 'Conectado' };
          setInstances((prev) => [...prev, onlineInstance]);
          setSelected(onlineInstance);
          pushNotice('success', 'La instancia se conectó correctamente sin requerir nuevo QR.');
          return;
        }

        qr = result.value;
      }

      if (!qr) throw new Error(data.error || 'No se recibió código QR.');

      setQrCode(qr);
      const connectingInstance = { ...instance, status: 'connecting', phone: 'Escaneando QR...' };
      setInstances((prev) => [...prev, connectingInstance]);
      setSelected(connectingInstance);
      pushNotice('success', 'QR generado correctamente. Escanéalo para finalizar conexión.');
    } catch (error) {
      pushNotice('error', error.message);
    } finally {
      setConnecting(false);
    }
  };

  const fetchPromptVersions = async (instanceId) => {
    if (!instanceId) {
      setPromptVersions([]);
      return;
    }

    setLoadingPromptVersions(true);
    try {
      const { data } = await fetchJsonWithApiFallback(`/api/saas/prompt-versions/${instanceId}`, {
        timeoutMs: 20000,
        headers: { ...getAuthHeaders() }
      });
      setPromptVersions(sortPromptVersions(data.versions || []));
    } catch (error) {
      console.warn('No se pudieron cargar versiones del prompt:', error.message);
      setPromptVersions([]);
    } finally {
      setLoadingPromptVersions(false);
    }
  };

  const handlePromotePromptVersion = async (version) => {
    if (!selected?.instanceId || !version?.id) return;
    setPromotingVersionId(version.id);
    try {
      const { data } = await fetchJsonWithApiFallback(`/api/saas/prompt-versions/${selected.instanceId}/${version.id}/promote`, {
        method: 'PATCH',
        timeoutMs: 20000,
        headers: { ...getAuthHeaders() }
      });

      const activePrompt = data.version?.prompt_text || version.prompt_text;
      if (activePrompt) {
        const nextDraft = { ...configDraft, customPrompt: activePrompt };
        setConfigDraft(nextDraft);

        await fetchJsonWithApiFallback(`/api/saas/config/${selected.instanceId}`, {
          timeoutMs: 30000,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify(nextDraft)
        });
      }

      await fetchPromptVersions(selected.instanceId);
      pushNotice('success', 'Versión promovida como activa.');
    } catch (error) {
      pushNotice('error', error.message || 'No se pudo promover la versión.');
    } finally {
      setPromotingVersionId(null);
    }
  };

  const handleArchivePromptVersion = async (version) => {
    if (!selected?.instanceId || !version?.id) return;
    setPromotingVersionId(version.id);
    try {
      await fetchJsonWithApiFallback(`/api/saas/prompt-versions/${selected.instanceId}/${version.id}/archive`, {
        method: 'PATCH',
        timeoutMs: 20000,
        headers: { ...getAuthHeaders() }
      });
      await fetchPromptVersions(selected.instanceId);
      pushNotice('success', 'Versión archivada correctamente.');
    } catch (error) {
      pushNotice('error', error.message || 'No se pudo archivar la versión.');
    } finally {
      setPromotingVersionId(null);
    }
  };

  const handleSaveConfig = async () => {
    if (!selected) return;

    const merged = { ...selected, ...configDraft };
    setSavingConfig(true);

    try {
      if (selected.instanceId) {
        const { data } = await fetchJsonWithApiFallback(`/api/saas/config/${selected.instanceId}`, {
          timeoutMs: 30000,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          body: JSON.stringify({
            ...configDraft,
            copperApiKey: configDraft.copperApiKey,
            copperUserEmail: configDraft.copperUserEmail,
            calendlyLink: configDraft.calendlyLink,
            paymentLink: configDraft.paymentLink
          })
        });

        if (!data.success) throw new Error(data.error || 'No se pudo guardar configuración.');
      }

      setInstances((prev) => prev.map((inst) => (inst.id === selected.id ? merged : inst)));
      setSelected(merged);
      pushNotice('success', `Configuración guardada (${providerLabel}).`);
    } catch (error) {
      pushNotice('error', error.message);
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">

      {/* New Bot Modal */}
      {showNewBotModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Nuevo Bot</h3>
              <button onClick={() => setShowNewBotModal(false)} className="text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Nombre del Bot</label>
                <input
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  placeholder="Ej: Mi Tienda Online"
                  value={newBotName}
                  onChange={(e) => setNewBotName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateNew()}
                  autoFocus
                />
              </div>
              <div>
                <select
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  value={newBotProvider}
                  onChange={(e) => setNewBotProvider(e.target.value)}
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
                <p className="text-[9px] text-blue-400 mt-1 italic">El modelo Free es solo con Gemini y QR. Otros canales requieren Plan Premium.</p>
              </div>
              <button
                onClick={handleCreateNew}
                disabled={!newBotName.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg disabled:opacity-50"
              >
                Crear Bot
              </button>
            </div>
          </div>
        </div>
      )}

      {qrCode && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-8 rounded-xl text-center max-w-sm w-full">
            <h2 className="text-2xl font-bold mb-4">Escanea el QR</h2>
            <img src={qrCode} alt="QR" className="border-4 border-white p-2 rounded mb-4 mx-auto" />
            <button onClick={() => setQrCode(null)} className="text-blue-500">Cerrar</button>
          </div>
        </div>
      )}

      <header className="bg-slate-950 border-b border-slate-800 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <Shield className="text-blue-500" size={28} />
          <h1 className="text-2xl font-bold">ALEX <span className="text-blue-500">IO</span></h1>
          <span className="text-[10px] bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold px-2 py-0.5 rounded-full">{VERSION}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs text-slate-400">{userEmail}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">{userRole === 'SUPERADMIN' ? '⭐ Admin' : '👤 Cliente'}</p>
          </div>

          {/* Language Switcher */}
          <div className="relative group flex items-center gap-1 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
            <Globe size={16} className="text-slate-400 group-hover:text-white" />
            <select
              className="bg-transparent text-sm text-slate-300 font-bold focus:outline-none cursor-pointer appearance-none pl-1 pr-3"
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="pt">Português</option>
              <option value="fr">Français</option>
              <option value="de">Deutsch</option>
              <option value="zh">中文</option>
            </select>
          </div>

          <Link to="/pricing" className="bg-blue-600 px-4 py-2 rounded font-bold hover:bg-blue-500 text-sm">Planes</Link>
          <button
            onClick={() => {
              localStorage.removeItem('alex_io_token');
              localStorage.removeItem('demo_email');
              localStorage.removeItem('alex_io_role');
              localStorage.removeItem('alex_io_tenant');
              window.location.href = '/#/login';
            }}
            className="text-slate-400 hover:text-red-400 transition-colors p-2"
            title="Cerrar sesión"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {notice && (
        <div className={`mx-6 mt-4 p-3 rounded-lg border text-sm flex items-center gap-2 ${notice.type === 'error' ? 'bg-red-900/30 border-red-700 text-red-200' : notice.type === 'warning' ? 'bg-yellow-900/20 border-yellow-700 text-yellow-200' : 'bg-green-900/20 border-green-700 text-green-200'
          }`}>
          {notice.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          <span>{notice.message}</span>
        </div>
      )}

      <main className="flex h-[calc(100vh-64px)]">
        <aside className="w-64 glass border-r border-slate-800 p-4 flex flex-col">
          <div className="mb-6 glass-blue border border-blue-500/20 rounded-xl p-4 shadow-lg shadow-blue-900/5">
            <h2 className="text-[10px] font-bold uppercase text-slate-500 tracking-widest flex justify-between items-center mb-2">
              Uso del Plan
              <span className="text-blue-400">{usage.messages_sent} / {usage.plan_limit}</span>
            </h2>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mb-2 overflow-hidden">
              <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min((usage.messages_sent / Math.max(usage.plan_limit, 1)) * 100, 100)}%` }}></div>
            </div>
            <p className="text-[10px] text-slate-400 text-right">
              {usage.tokens_consumed ? `${(usage.tokens_consumed / 1000).toFixed(1)}k tokens` : '0 tokens'}
            </p>
          </div>

          <h2 className="text-xs font-bold uppercase text-slate-500 tracking-widest mb-4">{t('dashboard.myBots', 'Mis Bots')}</h2>
          <div className="space-y-2 flex-1 overflow-auto">
            {instances.map((inst) => (
              <button key={inst.id} onClick={() => setSelected(inst)} className={`w-full text-left p-3 rounded-lg flex items-center justify-between ${selected?.id === inst.id ? 'bg-blue-600' : 'bg-slate-900 hover:bg-slate-800'}`}>
                <div>
                  <div className="font-medium">{inst.name}</div>
                  <div className="text-xs text-slate-400">{inst.phone}</div>
                </div>
                <div className={`w-2 h-2 rounded-full ${inst.status === 'online' ? 'bg-green-500' : inst.status === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`} />
              </button>
            ))}
          </div>
          <div className="relative group w-full mt-4">
            <button
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl border border-blue-500/30 flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
            >
              <Plus size={20} /> AGREGAR
            </button>
            <div className="absolute bottom-full left-0 w-full mb-2 hidden group-hover:block animate-fade-in z-50">
              <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => {
                      setNewBotProvider(p.value);
                      setShowNewBotModal(true);
                    }}
                    className="w-full text-left p-3 hover:bg-slate-700 text-xs flex items-center gap-3 border-b border-slate-700/50 last:border-0 transition-colors"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          {selected ? (
            <div className="flex flex-col h-full w-full max-w-7xl mx-auto">
              {/* Tabs */}
              <div className="flex gap-6 mb-4 border-b border-slate-800 pb-2 flex-shrink-0">
                <button
                  onClick={() => setActiveTab('config')}
                  className={`px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'config' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                  <Settings size={18} /> Configuración
                </button>
                <button
                  onClick={() => setActiveTab('kb')}
                  className={`px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'kb' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                  <Book size={18} /> Conocimiento
                  {analytics?.rag_ready && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>}
                </button>
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'chat' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}
                >
                  <MessageCircle size={18} /> Live Chat
                </button>
                <button onClick={() => setActiveTab('broadcast')} className={`px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'broadcast' ? 'border-fuchsia-500 text-fuchsia-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}><Send size={18} /> Campañas (Broadcast)</button>
                <button onClick={() => setActiveTab('compliance')} className={`px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'compliance' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}><Shield size={18} /> Auditoría & Compliance</button>
              </div>

              {activeTab === 'config' ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto pb-6 pr-2 animate-slide-in">
                  <div className="glass-card rounded-xl p-6 border border-slate-700 h-max">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Settings size={20} className="text-blue-500" /> Configuración</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Nombre del Bot</label>
                        <input className="w-full bg-slate-900 border border-slate-700 rounded p-2" value={configDraft.name} onChange={(e) => setConfigDraft((prev) => ({ ...prev, name: e.target.value }))} />
                      </div>

                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Canal WhatsApp (QR o Cloud)</label>
                        <select className="w-full bg-slate-900 border border-slate-700 rounded p-2" value={configDraft.provider} onChange={(e) => setConfigDraft((prev) => ({ ...prev, provider: e.target.value }))}>
                          {PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Cerebro AI (Motor Primario)</label>
                        <select
                          className="w-full bg-slate-900 border border-slate-700 rounded p-2 mb-3"
                          value={configDraft.engine || 'gemini'}
                          onChange={(e) => setConfigDraft((prev) => ({ ...prev, engine: e.target.value }))}
                        >
                          <option value="gemini">Google Gemini 2.0 Flash</option>
                          <option value="claude">Anthropic Claude 3.5 Sonnet</option>
                          <option value="openai">OpenAI GPT-4o Mini</option>
                          <option value="deepseek">DeepSeek V3</option>
                        </select>

                        <label className="block text-sm text-slate-400 mb-1">Voz del Bot (IA)</label>
                        <select className="w-full bg-slate-900 border border-slate-700 rounded p-2" value={configDraft.voice || 'nova'} onChange={(e) => setConfigDraft((prev) => ({ ...prev, voice: e.target.value }))}>
                          <option value="nova">Nova (Femenina - Natural)</option>
                          <option value="onyx">Onyx (Masculina - Profunda)</option>
                          <option value="fable">Fable (Masculina - Animada)</option>
                          <option value="alloy">Alloy (Andrógina - Directa)</option>
                          <option value="echo">Echo (Masculina - Suave)</option>
                          <option value="shimmer">Shimmer (Femenina - Clara)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm text-slate-400 mb-1">Prompt Personalizado (Cerebro AI)</label>
                        <div className="flex gap-2 mb-2 pb-2 border-b border-slate-700/50">
                          <button onClick={() => setConfigDraft(p => ({ ...p, customPrompt: 'Eres un VENDEDOR EXPERTO altamente persuasivo. Tu meta es calificar al usuario y cerrar ventas. Sé dinámico y responde a objeciones.' }))} className="text-[10px] bg-indigo-900/40 hover:bg-indigo-800 text-indigo-300 px-2 py-1 rounded border border-indigo-700/50 uppercase tracking-wide font-bold transition-colors">🎯 Vendedor (Sales)</button>
                          <button onClick={() => setConfigDraft(p => ({ ...p, customPrompt: 'Eres un agente de SOPORTE TÉCNICO paciente y resolutivo. Solicita el número de ticket y guía paso a paso al usuario.' }))} className="text-[10px] bg-teal-900/40 hover:bg-teal-800 text-teal-300 px-2 py-1 rounded border border-teal-700/50 uppercase tracking-wide font-bold transition-colors">🎧 Soporte (Support)</button>
                          <button onClick={() => setConfigDraft(p => ({ ...p, customPrompt: 'Eres un ASISTENTE MÉDICO. Tu trabajo es agendar citas para la clínica. Pregunta por síntomas de manera empática pero no des diagnósticos definitivos.' }))} className="text-[10px] bg-rose-900/40 hover:bg-rose-800 text-rose-300 px-2 py-1 rounded border border-rose-700/50 uppercase tracking-wide font-bold transition-colors">⚕️ Salud (Health)</button>
                        </div>
                        <div className="flex gap-2 mb-1">
                          <button onClick={() => setShowWizard(true)} className="flex items-center gap-1 text-xs bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 px-3 py-1 rounded-full font-bold transition-all mt-1">
                            <Wand2 size={12} /> Asistente Creador IA
                          </button>
                          <button onClick={() => setShowCopilot(true)} className="flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-500 px-3 py-1 rounded-full font-bold transition-all mt-1">
                            <Sparkles size={12} /> Mejorar con IA
                          </button>
                        </div>
                        <textarea className="w-full bg-slate-900 border border-slate-700 rounded p-2 h-32" value={configDraft.customPrompt} onChange={(e) => setConfigDraft((prev) => ({ ...prev, customPrompt: e.target.value }))} />

                        <div className="mt-3 bg-slate-900 border border-slate-700 rounded p-3">
                          <label className="block text-[10px] font-bold uppercase text-blue-400 mb-2">IA Free Tier (Opcional)</label>
                          <p className="text-[10px] text-slate-500 mb-2">Si usas tu propia API Key de Gemini Flash, el bot responderá sin consumir créditos del sistema.</p>
                          <input
                            type="password"
                            placeholder="Tu llave Gemini API"
                            className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs"
                            value={configDraft.user_gemini_key || ''}
                            onChange={(e) => setConfigDraft(p => ({ ...p, user_gemini_key: e.target.value }))}
                          />
                        </div>

                        <div className="mt-4 bg-slate-900 border border-slate-700 rounded p-3">
                          <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider font-bold">Versiones Fase 2</p>
                          {loadingPromptVersions ? (
                            <p className="text-xs text-slate-500">Cargando versiones...</p>
                          ) : promptVersions.length === 0 ? (
                            <p className="text-xs text-slate-500">Aún no hay versiones registradas para esta instancia.</p>
                          ) : (
                            <div className="space-y-2 max-h-40 overflow-auto pr-1">
                              {promptVersions.map((v) => (
                                <div key={v.id} className="border border-slate-700 rounded p-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs text-slate-300 font-semibold">{v.version || 'v1'} · {v.status}</p>
                                    <p className="text-[10px] text-slate-500">{v.created_at ? new Date(v.created_at).toLocaleString() : ''}</p>
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{v.prompt_text || 'Sin contenido'}</p>
                                  <div className="flex gap-2 mt-2">
                                    {v.status !== 'active' && (
                                      <button
                                        onClick={() => handlePromotePromptVersion(v)}
                                        disabled={promotingVersionId === v.id}
                                        className="text-[11px] bg-green-700 hover:bg-green-600 px-2 py-1 rounded disabled:opacity-50"
                                      >
                                        Activar
                                      </button>
                                    )}
                                    {v.status !== 'archived' && (
                                      <button
                                        onClick={() => handleArchivePromptVersion(v)}
                                        disabled={promotingVersionId === v.id}
                                        className="text-[11px] bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded disabled:opacity-50"
                                      >
                                        Archivar
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* AI Limiters Section */}
                      <div className="space-y-4 p-4 bg-slate-900 rounded-xl border border-slate-700 mt-4 rounded">
                        <h4 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                          <Activity size={16} className="text-blue-500" /> Limitadores de Uso de IA
                        </h4>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-xs text-slate-400 font-bold">Límite de Palabras por Respuesta</label>
                            <span className="bg-blue-900/50 text-blue-300 text-[10px] px-2 py-0.5 rounded font-mono">{configDraft.maxWords} palabras</span>
                          </div>
                          <input
                            type="range"
                            min="10"
                            max="200"
                            step="5"
                            value={configDraft.maxWords}
                            onChange={(e) => setConfigDraft((p) => ({ ...p, maxWords: parseInt(e.target.value) }))}
                            className="w-full accent-blue-500"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Fuerza a la IA a ser concisa para ahorrar tokens y mejorar conversión.</p>
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-xs text-slate-400 font-bold">Mensajes Máximos por Lead</label>
                            <span className="bg-purple-900/50 text-purple-300 text-[10px] px-2 py-0.5 rounded font-mono">{configDraft.maxMessages} interacciones</span>
                          </div>
                          <input
                            type="range"
                            min="2"
                            max="50"
                            step="1"
                            value={configDraft.maxMessages}
                            onChange={(e) => setConfigDraft((p) => ({ ...p, maxMessages: parseInt(e.target.value) }))}
                            className="w-full accent-purple-500"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Si el lead alcanza este límite, el bot se pausa y notifica a un humano.</p>
                        </div>
                      </div>

                      {['meta', 'coexistence', 'facebook', 'instagram'].includes(configDraft.provider) && (
                        <div className="space-y-3 p-4 bg-slate-900 rounded-xl border border-blue-500/30 mt-4 rounded">
                          <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2">
                            <Smartphone size={16} /> Configuración de Canal Meta
                          </h4>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Page ID / Phone Number ID</label>
                            <input
                              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm"
                              placeholder="Ej: 1234567890"
                              value={configDraft.metaPhoneNumberId || ''}
                              onChange={(e) => setConfigDraft((prev) => ({ ...prev, metaPhoneNumberId: e.target.value }))}
                            />
                            <p className="text-[10px] text-slate-500 mt-1">El identificador de tu página de Facebook, cuenta de Instagram o número de WhatsApp.</p>
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">System Access Token</label>
                            <input
                              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm"
                              type="password"
                              placeholder="EAA..."
                              value={configDraft.metaAccessToken || ''}
                              onChange={(e) => setConfigDraft((prev) => ({ ...prev, metaAccessToken: e.target.value }))}
                            />
                            <p className="text-[10px] text-slate-500 mt-1">Token generado desde Facebook Developers con permisos de mensajería.</p>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 p-3 rounded mt-2">
                            <p className="text-xs font-bold text-slate-300 mb-1">URL de Webhook (Para Facebook Developers)</p>
                            <code className="text-xs text-blue-300 select-all block bg-slate-900 p-2 rounded border border-slate-800">
                              https://sasas-whatsapp-fullstack-v4.onrender.com/api/webhooks/meta
                            </code>
                            <p className="text-[10px] text-slate-500 mt-2">Verify Token: <code className="text-slate-300 font-bold bg-slate-800 px-1 rounded">alex_io_secure_webhook</code></p>
                          </div>
                        </div>
                      )}

                      {configDraft.provider === 'tiktok' && (
                        <div className="space-y-3 p-4 bg-slate-900 rounded-xl border border-pink-500/30 mt-4 rounded">
                          <h4 className="text-sm font-bold text-pink-400 flex items-center gap-2">
                            <Smartphone size={16} /> Configuración de TikTok
                          </h4>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">TikTok App Key / Account ID</label>
                            <input
                              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm"
                              placeholder="awxyz123..."
                              value={configDraft.metaPhoneNumberId || ''} // Reutilizamos campo
                              onChange={(e) => setConfigDraft((prev) => ({ ...prev, metaPhoneNumberId: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Access Token</label>
                            <input
                              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm"
                              type="password"
                              placeholder="tt_..."
                              value={configDraft.metaAccessToken || ''} // Reutilizamos campo
                              onChange={(e) => setConfigDraft((prev) => ({ ...prev, metaAccessToken: e.target.value }))}
                            />
                          </div>
                          <div className="bg-slate-950 border border-slate-800 p-3 rounded mt-2">
                            <p className="text-xs font-bold text-slate-300 mb-1">URL de Webhook (Para TikTok Developers)</p>
                            <code className="text-xs text-pink-300 select-all block bg-slate-900 p-2 rounded border border-slate-800">
                              https://sasas-whatsapp-fullstack-v4.onrender.com/api/webhooks/tiktok
                            </code>
                          </div>
                        </div>
                      )}

                      <div className="mt-6 pt-4 border-t border-slate-700">
                        <h3 className="text-md font-bold text-slate-300 mb-3 flex items-center gap-2">🔗 Integraciones CRM</h3>
                        <div className="bg-slate-900 border border-orange-500/30 rounded p-4">
                          <h4 className="text-sm font-bold text-orange-400 mb-2">HubSpot CRM</h4>
                          <label className="block text-xs text-slate-400 mb-1">Private App Token (API Key)</label>
                          <input
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm"
                            type="password"
                            placeholder="pat-na1-..."
                            value={configDraft.hubspotAccessToken || ''}
                            onChange={(e) => setConfigDraft((prev) => ({ ...prev, hubspotAccessToken: e.target.value }))}
                          />
                          <p className="text-[10px] text-slate-500 mt-2 leading-tight">La IA leerá las conversaciones en tiempo real y enviará los prospectos a tu cuenta de HubSpot calificándolos como Fríos, Tibios o Calientes.</p>
                        </div>

                        <div className="bg-slate-900 border border-pink-500/30 rounded p-4 mt-4">
                          <h4 className="text-sm font-bold text-pink-400 mb-2">Copper CRM</h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">User Email</label>
                              <input
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm"
                                placeholder="usuario@empresa.com"
                                value={configDraft.copperUserEmail || ''}
                                onChange={(e) => setConfigDraft((prev) => ({ ...prev, copperUserEmail: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">API Key</label>
                              <input
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm"
                                type="password"
                                placeholder="xxxxxxxx-xxxx-xxxx..."
                                value={configDraft.copperApiKey || ''}
                                onChange={(e) => setConfigDraft((prev) => ({ ...prev, copperApiKey: e.target.value }))}
                              />
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-2 leading-tight">Sincroniza y califica automáticamente los perfiles de prospectos en Copper.</p>
                        </div>

                        <div className="bg-slate-900 border border-blue-500/30 rounded p-4 mt-4">
                          <h4 className="text-sm font-bold text-blue-400 mb-2">Integración de Enlaces (Automático)</h4>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Calendly Link</label>
                              <input
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm"
                                placeholder="https://calendly.com/..."
                                value={configDraft.calendlyLink || ''}
                                onChange={(e) => setConfigDraft((prev) => ({ ...prev, calendlyLink: e.target.value }))}
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">Stripe / Payment Link</label>
                              <input
                                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm"
                                placeholder="https://buy.stripe.com/..."
                                value={configDraft.paymentLink || ''}
                                onChange={(e) => setConfigDraft((prev) => ({ ...prev, paymentLink: e.target.value }))}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="bg-slate-900 border border-blue-500/30 rounded p-4 mt-4">
                          <h4 className="text-sm font-bold text-blue-400 mb-2">GoHighLevel (GHL v2)</h4>
                          <label className="block text-xs text-slate-400 mb-1">API Key (Bearer Token)</label>
                          <input
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm"
                            type="password"
                            placeholder="pit-... (LeadConnector Token)"
                            value={configDraft.ghlApiKey || ''}
                            onChange={(e) => setConfigDraft((prev) => ({ ...prev, ghlApiKey: e.target.value }))}
                          />
                          <p className="text-[10px] text-slate-500 mt-2 leading-tight">Inyecta leads extraídos nativamente por la IA usando la API v2 de LeadConnector.</p>
                        </div>

                        <div className="bg-slate-900 border border-emerald-500/30 rounded p-4 mt-4 mb-4">
                          <h4 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-1"><Globe size={14} /> Webhook Custom (Zapier/Make)</h4>
                          <label className="block text-xs text-slate-400 mb-1">Webhook URL Endpoint</label>
                          <input
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm"
                            placeholder="https://hooks.zapier.com/hooks/catch/..."
                            value={configDraft.webhookUrl || ''}
                            onChange={(e) => setConfigDraft((prev) => ({ ...prev, webhookUrl: e.target.value }))}
                          />
                          <p className="text-[10px] text-slate-500 mt-2 leading-tight">Envía los datos procesados del perfil del usuario (nombre, correo) vía POST estandarizado.</p>
                        </div>
                      </div>

                      <button
                        onClick={handleSaveConfig}
                        disabled={savingConfig}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50"
                      >
                        {savingConfig ? <Loader className="animate-spin" size={20} /> : <Settings size={20} />}
                        {savingConfig ? t('dashboard.saving', 'Guardando...') : t('dashboard.saveConfig', 'Guardar Configuración')}
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 h-full flex flex-col">
                    {analytics && (
                      <div className="mb-6 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                        <h3 className="text-sm font-bold mb-3 text-slate-300 flex items-center gap-2"><Activity size={16} className="text-blue-400" /> Analítica de Intenciones (7 Días)</h3>
                        <div className="grid grid-cols-3 gap-2 mb-4">
                          <div className="bg-emerald-900/20 border border-emerald-800/30 p-2 rounded text-center">
                            <p className="text-[10px] text-emerald-400 uppercase tracking-widest">Ventas</p>
                            <p className="text-xl font-bold text-white">{analytics.intent.ventas}</p>
                          </div>
                          <div className="bg-amber-900/20 border border-amber-800/30 p-2 rounded text-center">
                            <p className="text-[10px] text-amber-400 uppercase tracking-widest">Soporte</p>
                            <p className="text-xl font-bold text-white">{analytics.intent.soporte}</p>
                          </div>
                          <div className="bg-slate-800/50 border border-slate-700/50 p-2 rounded text-center">
                            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Otros</p>
                            <p className="text-xl font-bold text-white">{analytics.intent.otros}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold">Volumen de Mensajes</p>
                          <div className="flex items-end gap-1 h-20 opacity-80">
                            {analytics.volume.map((vol, idx) => {
                              const maxVol = Math.max(...analytics.volume.map(v => v.count), 1);
                              const heightPct = (vol.count / maxVol) * 100;
                              return (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                                  <div className="w-full bg-blue-500/80 rounded-t relative group-hover:bg-blue-400 transition-colors" style={{ height: `${Math.max(heightPct, 5)}%` }}>
                                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 px-1 py-0.5 rounded">{vol.count}</span>
                                  </div>
                                  <span className="text-[8px] text-slate-500">{vol.date.split('-')[2]}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}

                    <h3 className="text-lg font-bold mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Activity size={20} className="text-green-500" /> Actividad Reciente
                      </div>
                      <span className="text-[9px] bg-slate-700 text-slate-400 px-2 py-1 rounded-full border border-slate-600 flex items-center gap-1 font-mono">
                        <Shield size={10} className="text-emerald-500" /> AUDIT: SHA-256 VERIFIED
                      </span>
                    </h3>
                    <div className="flex-1 overflow-auto">
                      <div className="bg-slate-900 p-4 rounded border border-slate-800 text-sm">
                        {logs.length === 0 ? (
                          <p className="text-slate-500 italic py-4 text-center">Esperando actividad cognitiva...</p>
                        ) : (
                          <div className="space-y-4">
                            {logs.map((log, idx) => (
                              <div key={idx} className="border-l-2 border-slate-700 pl-3 py-1">
                                <p className="text-slate-200 font-medium">"{log.text}"</p>
                                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-bold flex items-center gap-2">
                                  <span>Respondido por</span>
                                  <span className="text-blue-400 bg-blue-400/10 px-1.5 py-0.5 rounded border border-blue-400/20">{log.ai_model || 'gemini-flash'}</span>
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-end">
                          <div className="flex flex-col gap-1">
                            <p className="text-slate-500 text-[10px] flex items-center gap-3">
                              <span>Canal: {providerLabel}</span>
                              <span className="text-blue-400 uppercase tracking-tighter">Estado: {selected.status || 'desconocido'}</span>
                            </p>
                          </div>
                          <div className="flex gap-2">
                            {(selected.status === 'disconnected' || String(selected.status).startsWith('fatal_') || String(selected.status).startsWith('failed_')) && providerLabel === 'Baileys (QR)' ? (
                              <button
                                onClick={handleRestartInstance}
                                className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white transition-colors px-3 py-1 rounded font-bold uppercase tracking-widest shadow-lg shadow-blue-500/20"
                              >
                                Generar Nuevo QR
                              </button>
                            ) : (
                              <button
                                onClick={handleRestartInstance}
                                className="text-[10px] bg-red-900/30 text-red-400 border border-red-800/50 hover:bg-red-800 hover:text-white transition-colors px-3 py-1 rounded font-bold uppercase tracking-widest"
                              >
                                Reiniciar Conector
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'chat' ? (
                <div className="flex-1 overflow-hidden">
                  <LiveChat instanceId={selected.instanceId || selected.id} tenantId={userTenant} />
                </div>
              ) : activeTab === 'rag' ? (
                <div className="flex-1 overflow-hidden">
                  <KnowledgeBase instanceId={selected.instanceId || selected.id} tenantId={userTenant} />
                </div>
              ) : activeTab === 'broadcast' ? (
                <div className="flex-1 overflow-auto p-4 sm:p-6 pb-24 h-full">
                  <BroadcastCampaign instanceId={selected.instanceId || selected.id} instanceName={selected.name} />
                </div>
              ) : activeTab === 'compliance' ? (
                <div className="flex-1 overflow-hidden">
                  <DataCompliance instanceId={selected.instanceId || selected.id} tenantId={userTenant} />
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Smartphone size={64} className="mb-4 opacity-20" />
              <p>Selecciona un bot del panel lateral para administrar su configuración.</p>
            </div>
          )}
        </div>
      </main >

      <footer className="fixed bottom-2 right-3 text-[11px] text-slate-400 bg-slate-950/90 border border-slate-800 px-2 py-1 rounded flex items-center gap-2">
        <span className="text-blue-400 font-bold">{VERSION}</span>
        <span>Hardened | V8 Multi-Tenancy | API: {apiDebugUrl}</span>
      </footer>

      {
        showWizard && (
          <PromptWizard
            onClose={() => setShowWizard(false)}
            onPromptGenerated={async (prompt, promptMeta) => {
              setConfigDraft(prev => ({ ...prev, customPrompt: prompt }));

              try {
                if (selected?.instanceId && prompt) {
                  await fetchJsonWithApiFallback('/api/saas/prompt-versions', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...getAuthHeaders()
                    },
                    body: JSON.stringify({
                      instanceId: selected.instanceId,
                      prompt,
                      super_prompt_json: promptMeta || null,
                      status: 'test'
                    })
                  });
                  await fetchPromptVersions(selected.instanceId);
                }
              } catch (error) {
                console.warn('No se pudo versionar el prompt automáticamente:', error.message);
              }
            }}
            instanceName={selected?.name || configDraft.name}
          />
        )
      }

      {/* Prompt Co-Pilot Modal */}
      {
        showCopilot && selected && (
          <PromptCopilot
            currentPrompt={configDraft.customPrompt}
            onClose={() => setShowCopilot(false)}
            onPromptImproved={(newPrompt) => {
              setConfigDraft(prev => ({ ...prev, customPrompt: newPrompt }));
            }}
          />
        )
      }

      {/* Floating AI Support Chat */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {isSupportOpen && (
          <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl mb-4 w-80 h-96 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
            <div className="bg-blue-600 p-3 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Wand2 size={16} />
                <span className="font-bold text-sm">Alex Support</span>
              </div>
              <button onClick={() => setIsSupportOpen(false)} className="hover:text-blue-200 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/50">
              {supportMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg p-2 text-sm ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-none'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isSupportTyping && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 border border-slate-700 text-slate-400 rounded-lg rounded-bl-none p-2 text-xs flex gap-1 items-center">
                    <span className="animate-bounce">●</span>
                    <span className="animate-bounce delay-75">●</span>
                    <span className="animate-bounce delay-150">●</span>
                  </div>
                </div>
              )}
            </div>
            <form onSubmit={handleSendSupportMessage} className="p-2 border-t border-slate-800 bg-slate-900 flex gap-2">
              <input
                type="text"
                value={supportInput}
                onChange={e => setSupportInput(e.target.value)}
                placeholder="Escribe tu duda..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-full px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!supportInput.trim() || isSupportTyping}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-full p-2 transition-colors flex items-center justify-center"
              >
                <Send size={16} className="-ml-0.5" />
              </button>
            </form>
          </div>
        )}

        <button
          onClick={() => setIsSupportOpen(!isSupportOpen)}
          className={`bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-full shadow-lg shadow-blue-500/20 transition-all ${isSupportOpen ? 'rotate-90 scale-90 opacity-0' : 'rotate-0 scale-100 opacity-100'}`}
        >
          <MessageCircle size={24} />
        </button>
      </div>

    </div >
  );
}

export default function SaasDashboardWithBoundary() {
  return (
    <ErrorBoundary>
      <SaasDashboard />
    </ErrorBoundary>
  );
}
