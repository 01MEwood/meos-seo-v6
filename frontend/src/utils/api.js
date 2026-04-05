const API_URL = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('meos_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('meos_token', token);
    } else {
      localStorage.removeItem('meos_token');
    }
  }

  async request(path, { method = 'GET', body, params } = {}) {
    let url = `${API_URL}${path}`;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      url += `?${qs}`;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401) {
      this.setToken(null);
      window.location.href = '/login';
      throw new Error('Nicht authentifiziert');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  get(path, params) { return this.request(path, { params }); }
  post(path, body) { return this.request(path, { method: 'POST', body }); }
  put(path, body) { return this.request(path, { method: 'PUT', body }); }
  patch(path, body) { return this.request(path, { method: 'PATCH', body }); }
  del(path) { return this.request(path, { method: 'DELETE' }); }
}

export const api = new ApiClient();
