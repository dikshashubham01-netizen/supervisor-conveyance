const RAW_BACKEND = import.meta.env.VITE_API_URL || '';
export const BACKEND_URL = RAW_BACKEND.replace(/\/+$/, '');
export const API_BASE = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

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
      const q = new URLSearchParams(params).toString();
      return request(`/duty/history${q ? `?${q}` : ''}`);
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
      const q = new URLSearchParams(params).toString();
      return request(`/reports${q ? `?${q}` : ''}`);
    },
    getCsvUrl: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return `${API_BASE}/reports/export/csv${q ? `?${q}` : ''}`;
    },
    getExcelUrl: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return `${API_BASE}/reports/export/excel${q ? `?${q}` : ''}`;
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

  audit: {
    getLogs: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/audit${q ? `?${q}` : ''}`);
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
