const normalize = (url) => (url || '').replace(/\/$/, '');

const RENDER_BACKEND_HINT = import.meta.env.VITE_RENDER_BACKEND_URL || '';
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 60000); // 60s for Render wake-up
const FORCE_PRIMARY_BACKEND = import.meta.env.VITE_FORCE_PRIMARY_BACKEND === 'true';
const ALLOW_ORIGIN_FALLBACK = import.meta.env.VITE_ALLOW_ORIGIN_FALLBACK !== 'false';
let lastResolvedApiBase = null;

const getApiBases = () => {
  const envBase = normalize(import.meta.env.VITE_API_URL);
  const primaryBase = envBase || RENDER_BACKEND_HINT;

  if (FORCE_PRIMARY_BACKEND) return [primaryBase];

  const bases = [primaryBase];

  if (ALLOW_ORIGIN_FALLBACK && typeof window !== 'undefined') {
    const origin = normalize(window.location.origin);
    if (origin && !bases.includes(origin)) bases.push(origin);
  }

  // Ensure RENDER_BACKEND_HINT is tried if it's not the primary
  if (RENDER_BACKEND_HINT && !bases.includes(RENDER_BACKEND_HINT)) {
    bases.push(RENDER_BACKEND_HINT);
  }

  return bases;
};

export const getPreferredApiBase = () => getApiBases()[0] || null;
export const getLastResolvedApiBase = () => lastResolvedApiBase;

const shouldTryNextBase = (response) => {
  if (!response) return true;
  return [404, 502, 503, 504].includes(response.status);
};

export const fetchWithApiFallback = async (path, options = {}) => {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, headers = {}, ...fetchOptions } = options;
  const bases = getApiBases();
  const errors = [];

  // Inject Authorization header globally
  const authHeaders = getAuthHeaders();
  const mergedHeaders = { ...headers, ...authHeaders };

  for (const base of bases) {
    const url = `${base}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...fetchOptions, headers: mergedHeaders, signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok && shouldTryNextBase(response)) {
        errors.push(`${url} → HTTP ${response.status}`);
        continue;
      }

      lastResolvedApiBase = base;

      // Auto-logout on auth failures (stale/invalid tokens)
      if ((response.status === 401 || response.status === 403) && !path.includes('/api/auth/')) {
        console.warn('🔒 Token rechazado por el backend (HTTP', response.status, '). Limpiando sesión...');
        localStorage.removeItem('alex_io_token');
        localStorage.removeItem('alex_io_role');
        localStorage.removeItem('demo_email');
        localStorage.removeItem('alex_io_tenant');
        sessionStorage.removeItem('alex_io_token');
        // Redirect to login (debounced to avoid loops)
        if (!window.__alexLogoutRedirecting) {
          window.__alexLogoutRedirecting = true;
          setTimeout(() => {
            window.location.hash = '#/login';
            window.location.reload();
          }, 100);
        }
      }

      return response;
    } catch (error) {
      clearTimeout(timeout);
      errors.push(`${url} → ${error.name === 'AbortError' ? `timeout ${timeoutMs}ms` : error.message}`);
    }
  }

  throw new Error(`No se pudo conectar al backend. Intentos: ${errors.join(' | ')}`);
};

export const fetchJsonWithApiFallback = async (path, options = {}) => {
  const response = await fetchWithApiFallback(path, options);
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    const bodyPreview = (await response.text()).slice(0, 80).replace(/\s+/g, ' ').trim();
    throw new Error(`El backend respondió sin JSON (HTTP ${response.status}). Preview: ${bodyPreview || 'vacío'}`);
  }

  const data = await response.json();
  return { response, data };
};

export const getAuthHeaders = () => {
  const token = localStorage.getItem('alex_io_token') || sessionStorage.getItem('alex_io_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};
