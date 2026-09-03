const RAW_BACKEND = import.meta.env.VITE_API_URL || 'https://supervisor-api-vvba.onrender.com';
export const BACKEND_URL = RAW_BACKEND.replace(/\/+$/, '');
export const API_BASE = `${BACKEND_URL}/api`;

export function getUploadUrl(filename) {
  if (!filename) return '';
  if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
  return `${BACKEND_URL}/uploads/${filename}`;
}

export function getToken() {
  return localStorage.getItem('token');
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
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

async function request(endpoint, options = {}) {
  const headers = options.headers || {};
  const token = getToken();

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // If body is not FormData, add application/json
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

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

  supervisors: {
    list: () => request('/supervisors'),
    create: (data) =>
      request('/supervisors', {
        method: 'POST',
        body: JSON.stringify(data)
      }),
    update: (id, data) =>
      request(`/supervisors/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data)
      }),
    delete: (id) =>
      request(`/supervisors/${id}`, {
        method: 'DELETE'
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
    getDetails: (id) => request(`/duty/${id}`),
    verify: (id, data) =>
      request(`/duty/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify(data)
      })
  },

  tracking: {
    sync: (points) =>
      request('/tracking/sync', {
        method: 'POST',
        body: JSON.stringify({ points })
      }),
    getLive: () => request('/tracking/live'),
    getRoute: (sessionId) => request(`/tracking/routes/${sessionId}`),
    getStreamUrl: () => `${API_BASE}/tracking/stream`
  },

  reports: {
    get: (params = {}) => {
      return request(`/reports${toQueryString(params)}`);
    },
    getCsvUrl: (params = {}) => {
      return `${API_BASE}/reports/export/csv${toQueryString(params)}`;
    },
    getExcelUrl: (params = {}) => {
      return `${API_BASE}/reports/export/excel${toQueryString(params)}`;
    }
  },

  settings: {
    getRate: () => request('/settings/rate'),
    updateRate: (ratePerKm, effectiveFrom) =>
      request('/settings/rate', {
        method: 'POST',
        body: JSON.stringify({ ratePerKm, effectiveFrom })
      })
  },

  appVersion: {
    get: () => request('/app/version'),
    update: (data) =>
      request('/app/version', {
        method: 'POST',
        body: JSON.stringify(data)
      })
  },

  audit: {
    getLogs: (params = {}) => {
      return request(`/audit${toQueryString(params)}`);
    }
  },

  ocr: {
    scan: (formData) =>
      request('/ocr/scan', {
        method: 'POST',
        body: formData
      })
  }
};
