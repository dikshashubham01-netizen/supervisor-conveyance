// Live production backend — always use Render unless admin manually overrides via Settings
const DEFAULT_SERVER_URL = 'https://supervisor-api-vvba.onrender.com';

export function getServerUrl() {
  return localStorage.getItem('geoconvey_server_url') || DEFAULT_SERVER_URL;
}

export function setServerUrl(url) {
  const clean = (url || '').trim().replace(/\/+$/, '');
  localStorage.setItem('geoconvey_server_url', clean);
}

export function getToken() {
  return localStorage.getItem('supervisor_token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('supervisor_token', token);
  } else {
    localStorage.removeItem('supervisor_token');
  }
}

async function request(endpoint, options = {}) {
  const server = getServerUrl();
  const headers = options.headers || {};
  const token = getToken();

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${server}/api${endpoint}`;

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (netErr) {
    throw new Error(`Cannot connect to server at ${server}. Please check your network or server URL.`);
  }

  if (response.status === 401) {
    setToken(null);
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data?.error || data || response.statusText;
    throw new Error(errorMsg);
  }

  return data;
}

export const api = {
  getServerUrl,
  setServerUrl,
  checkConnection: async (customUrl) => {
    const target = customUrl ? customUrl.trim().replace(/\/+$/, '') : getServerUrl();
    const res = await fetch(`${target}/api/health`, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  },

  auth: {
    login: (employee_id, password) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ employee_id, password })
      }),
    me: () => request('/auth/me')
  },

  duty: {
    start: (formData) =>
      request('/duty/start', {
        method: 'POST',
        body: formData
      }),
    getCurrent: () => request('/duty/current'),
    end: (formData) =>
      request('/duty/end', {
        method: 'POST',
        body: formData
      }),
    getHistory: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/duty/history${q ? `?${q}` : ''}`);
    },
    getDetails: (id) => request(`/duty/${id}`)
  },

  tracking: {
    sync: (points) =>
      request('/tracking/sync', {
        method: 'POST',
        body: JSON.stringify({ points })
      })
  },

  ocr: {
    scan: (formData) =>
      request('/ocr/scan', {
        method: 'POST',
        body: formData
      })
  },

  version: {
    check: async () => {
      const server = getServerUrl();
      try {
        const res = await fetch(`${server}/api/app/version`, { signal: AbortSignal.timeout(4000) });
        if (res.ok) return await res.json();
      } catch (e) {
        try {
          const res = await fetch('https://supervisor-conveyance.vercel.app/version.json', { signal: AbortSignal.timeout(4000) });
          if (res.ok) return await res.json();
        } catch (fallbackErr) {
          console.warn('Version check error:', fallbackErr);
        }
      }
      return null;
    }
  }
};
