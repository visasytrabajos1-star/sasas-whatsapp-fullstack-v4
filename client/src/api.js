const normalize = (url) => (url || '').replace(/\/$/, '');

const RENDER_BACKEND_HINT = import.meta.env.VITE_RENDER_BACKEND_URL || 'https://whatsapp-fullstack-gkm6.onrender.com';
const DEFAULT_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 45000);
const FORCE_PRIMARY_BACKEND = import.meta.env.VITE_FORCE_PRIMARY_BACKEND !== 'false';
const ALLOW_ORIGIN_FALLBACK = import.meta.env.VITE_ALLOW_ORIGIN_FALLBACK === 'true';
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

  return bases;
};

export const getPreferredApiBase = () => getApiBases()[0] || null;
export const getLastResolvedApiBase = () => lastResolvedApiBase;

const shouldTryNextBase = (response) => {
  if (!response) return true;
  return [404, 502, 503, 504].includes(response.status);
};

export const fetchWithApiFallback = async (path, options = {}) => {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options;
  const bases = getApiBases();
  const errors = [];

  for (const base of bases) {
    const url = `${base}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok && shouldTryNextBase(response)) {
        errors.push(`${url} → HTTP ${response.status}`);
        continue;
      }

      lastResolvedApiBase = base;
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
  const token = localStorage.getItem('alex_io_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};
