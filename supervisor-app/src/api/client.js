// Live production backend — AWS EC2 Mumbai (24/7 with HTTPS)
const DEFAULT_SERVER_URL = 'https://3-7-65-135.sslip.io';

export function getServerUrl() {
  const stored = localStorage.getItem('geoconvey_server_url');
  if (stored && (stored.includes('onrender.com') || stored.includes('localhost'))) {
    localStorage.removeItem('geoconvey_server_url');
    return DEFAULT_SERVER_URL;
  }
  return stored || DEFAULT_SERVER_URL;
}

export function setServerUrl(url) {
  const clean = (url || '').trim().replace(/\/+$/, '');
  if (clean.includes('onrender.com')) {
    localStorage.removeItem('geoconvey_server_url');
    return;
  }
  localStorage.setItem('geoconvey_server_url', clean);
}

export function getToken() {
  return localStorage.getItem('supervisor_token');
}

export function toQueryString(params = {}) {
  const clean = {};
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '' && val !== 'undefined' && val !== 'null') {
      clean[key] = val;
    }
  }
  const q = new URLSearchParams(clean).toString();
  return q ? `?${q}` : '';
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

  headers['X-App-Version'] = '1.0.8';
  headers['X-App-Version-Code'] = '9';

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
    me: () => request('/auth/me'),
    changePassword: (currentPassword, newPassword) =>
      request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      })
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
      return request(`/duty/history${toQueryString(params)}`);
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

  attendance: {
    getMyAttendance: (params = {}) =>
      request(`/attendance/my-attendance${toQueryString(params)}`)
  },

  version: {
    check: async () => {
      const server = getServerUrl();
      // Try primary server
      try {
        const res = await fetch(`${server}/api/app/version?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' },
          signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.version) return data;
        }
      } catch (e) {
        // Continue to fallback
      }

      // Always fallback to Vercel static version.json if primary server is unreachable or returned error
      try {
        const fallbackRes = await fetch(`https://supervisor-conveyance.vercel.app/version.json?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' },
          signal: AbortSignal.timeout(5000)
        });
        if (fallbackRes.ok) {
          return await fallbackRes.json();
        }
      } catch (fallbackErr) {
        console.warn('Version check fallback error:', fallbackErr);
      }
      return null;
    }
  }
};
