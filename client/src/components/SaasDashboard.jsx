import React, { useEffect, useMemo, useState, Component } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Activity, Settings, Smartphone, Plus, Loader, AlertTriangle, CheckCircle2, X, Wand2, LogOut } from 'lucide-react';
import PromptWizard from './PromptWizard';
import { fetchJsonWithApiFallback, getLastResolvedApiBase, getPreferredApiBase, getAuthHeaders } from '../api';

const VERSION = 'v2.0.4.16';

const PROVIDERS = [
  { value: 'baileys', label: 'Baileys (QR)' },
  { value: 'meta', label: 'Meta Cloud API' },
  { value: '360dialog', label: '360Dialog' }
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
            <p className="text-red-300 text-sm mb-4">{this.state.error?.message}</p>
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
  const userEmail = localStorage.getItem('demo_email') || 'user@app.com';
  const userRole = localStorage.getItem('alex_io_role') || 'OWNER';
  const userTenant = localStorage.getItem('alex_io_tenant') || '';

  const isDemo = localStorage.getItem('demo_mode') === 'true';

  const [instances, setInstances] = useState([]);
  const [selected, setSelected] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [apiDebugUrl, setApiDebugUrl] = useState(getPreferredApiBase() || 'No resuelta');
  const [notice, setNotice] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [showNewBotModal, setShowNewBotModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [newBotName, setNewBotName] = useState('');
  const [newBotProvider, setNewBotProvider] = useState('baileys');
  const [configDraft, setConfigDraft] = useState({
    name: '',
    provider: 'baileys',
    customPrompt: 'Eres un asistente virtual amigable y profesional.',
    metaApiUrl: '',
    metaPhoneNumberId: '',
    metaAccessToken: '',
    dialogApiKey: ''
  });

  useEffect(() => {
    const resolved = getLastResolvedApiBase();
    if (resolved) setApiDebugUrl(resolved);
    fetchInstances();
  }, []);

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
  };

  useEffect(() => {
    if (!selected) return;
    setConfigDraft({
      name: selected.name || '',
      provider: selected.provider || 'baileys',
      customPrompt: selected.customPrompt || 'Eres un asistente virtual amigable y profesional.',
      metaApiUrl: selected.metaApiUrl || '',
      metaPhoneNumberId: selected.metaPhoneNumberId || '',
      metaAccessToken: selected.metaAccessToken || '',
      dialogApiKey: selected.dialogApiKey || ''
    });
  }, [selected]);

  const pushNotice = (type, message) => setNotice({ type, message });

  const providerLabel = useMemo(() => {
    const found = PROVIDERS.find((p) => p.value === (selected?.provider || 'baileys'));
    return found?.label || 'Baileys (QR)';
  }, [selected]);

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
        metaApiUrl: '',
        metaPhoneNumberId: '',
        metaAccessToken: '',
        dialogApiKey: ''
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
          body: JSON.stringify(configDraft)
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
      {/* Upgrade Modal — Demo Mode */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-blue-500/40 rounded-2xl p-8 w-full max-w-md text-center shadow-2xl">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield size={32} className="text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">¡Estás en modo Demo!</h3>
            <p className="text-slate-400 text-sm mb-6">
              Para crear y gestionar tus bots de WhatsApp necesitás una cuenta registrada.
              <br />Es gratis para empezar 🚀
            </p>
            <div className="space-y-3">
              <a
                href="/#/login"
                onClick={() => {
                  localStorage.removeItem('demo_mode');
                  setShowUpgradeModal(false);
                }}
                className="block w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-3 rounded-xl transition-all"
              >
                🎉 Crear mi cuenta gratis
              </a>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="block w-full text-slate-500 hover:text-slate-300 text-sm py-2 transition-colors"
              >
                Seguir explorando demo
              </button>
            </div>
          </div>
        </div>
      )}

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
                <label className="block text-sm text-slate-400 mb-1">Canal WhatsApp</label>
                <select
                  className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  value={newBotProvider}
                  onChange={(e) => setNewBotProvider(e.target.value)}
                >
                  {PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
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
          <Link to="/pricing" className="bg-blue-600 px-4 py-2 rounded font-bold hover:bg-blue-500 text-sm">Planes</Link>
          <button
            onClick={() => {
              localStorage.removeItem('alex_io_token');
              localStorage.removeItem('demo_email');
              localStorage.removeItem('alex_io_role');
              localStorage.removeItem('alex_io_tenant');
              localStorage.removeItem('demo_mode');
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
        <aside className="w-64 bg-slate-950 border-r border-slate-800 p-4">
          <h2 className="text-xs font-bold uppercase text-slate-500 tracking-widest mb-4">Mis Bots</h2>
          <div className="space-y-2">
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
          <button
            onClick={() => isDemo ? setShowUpgradeModal(true) : setShowNewBotModal(true)}
            disabled={connecting}
            className="w-full mt-4 py-2 border border-dashed border-slate-700 text-slate-500 rounded-lg hover:border-blue-500 hover:text-blue-500 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {connecting ? <Loader className="animate-spin" size={16} /> : <Plus size={16} />} <span>Nuevo Bot</span>
          </button>
        </aside>

        <div className="flex-1 p-6 overflow-auto">
          {selected ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
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
                    <label className="block text-sm text-slate-400 mb-1">Prompt Personalizado (Cerebro AI)</label>
                    <div className="flex gap-2 mb-1">
                      <button onClick={() => setShowWizard(true)} className="flex items-center gap-1 text-xs bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 px-3 py-1 rounded-full font-bold transition-all">
                        <Wand2 size={12} /> Asistente IA
                      </button>
                    </div>
                    <textarea className="w-full bg-slate-900 border border-slate-700 rounded p-2 h-32" value={configDraft.customPrompt} onChange={(e) => setConfigDraft((prev) => ({ ...prev, customPrompt: e.target.value }))} />
                  </div>

                  {configDraft.provider === 'meta' && (
                    <div className="space-y-3 p-3 bg-slate-900 rounded border border-blue-500/30">
                      <h4 className="text-sm font-bold text-blue-400">Configuración Meta Cloud API</h4>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Meta API URL</label>
                        <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm" placeholder="https://graph.facebook.com/v20.0" value={configDraft.metaApiUrl} onChange={(e) => setConfigDraft((prev) => ({ ...prev, metaApiUrl: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Phone Number ID</label>
                        <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm" value={configDraft.metaPhoneNumberId} onChange={(e) => setConfigDraft((prev) => ({ ...prev, metaPhoneNumberId: e.target.value }))} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Access Token</label>
                        <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm" type="password" value={configDraft.metaAccessToken} onChange={(e) => setConfigDraft((prev) => ({ ...prev, metaAccessToken: e.target.value }))} />
                      </div>
                    </div>
                  )}

                  {configDraft.provider === '360dialog' && (
                    <div className="space-y-3 p-3 bg-slate-900 rounded border border-green-500/30">
                      <h4 className="text-sm font-bold text-green-400">Configuración 360Dialog</h4>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">360Dialog API Key</label>
                        <input className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm" type="password" value={configDraft.dialogApiKey} onChange={(e) => setConfigDraft((prev) => ({ ...prev, dialogApiKey: e.target.value }))} />
                      </div>
                    </div>
                  )}

                  <button onClick={handleSaveConfig} disabled={savingConfig} className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded font-bold disabled:opacity-50 transition-colors">
                    <span>{savingConfig ? 'Guardando...' : 'Guardar Configuración'}</span>
                  </button>
                </div>
              </div>

              <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 h-full flex flex-col">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Activity size={20} className="text-green-500" /> Actividad Reciente</h3>
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
                    <div className="mt-6 pt-4 border-t border-slate-800">
                      <p className="text-slate-500 text-[10px] flex items-center justify-between">
                        <span>Canal: {providerLabel}</span>
                        <span className="text-blue-400 uppercase tracking-tighter">Estado: {selected.status || 'desconocido'}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Smartphone size={64} className="mb-4 opacity-20" />
              <p>Selecciona un bot del panel lateral para administrar su configuración.</p>
            </div>
          )}
        </div>
      </main>

      <footer className="fixed bottom-2 right-3 text-[11px] text-slate-400 bg-slate-950/90 border border-slate-800 px-2 py-1 rounded flex items-center gap-2">
        <span className="text-blue-400 font-bold">{VERSION}</span>
        <span>Hardened | V8 Multi-Tenancy | API: {apiDebugUrl}</span>
      </footer>

      {showWizard && (
        <PromptWizard
          onClose={() => setShowWizard(false)}
          onPromptGenerated={(prompt) => setConfigDraft(prev => ({ ...prev, customPrompt: prompt }))}
          instanceName={selected?.name || configDraft.name}
        />
      )}
    </div>
  );
}

export default function SaasDashboardWithBoundary() {
  return (
    <ErrorBoundary>
      <SaasDashboard />
    </ErrorBoundary>
  );
}
