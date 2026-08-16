(function(global){
  'use strict';

  async function request(url, options = {}) {
    const config = {
      method: options.method || 'GET',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json', ...(options.headers || {}) }
    };
    if (options.body !== undefined) {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(options.body);
    }

    let response;
    try {
      response = await fetch(url, config);
    } catch (error) {
      const network = new Error('Não foi possível conectar ao portal. Verifique sua internet e tente novamente.');
      network.code = 'NETWORK_ERROR';
      throw network;
    }

    let payload = {};
    try { payload = await response.json(); } catch {}

    if (!response.ok || payload.ok === false) {
      const error = new Error(payload?.error?.message || 'Não foi possível concluir a operação.');
      error.code = payload?.error?.code || `HTTP_${response.status}`;
      error.details = payload?.error?.details;
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  global.CCApi = {
    request,
    login: body => request('/api/portal?action=login', { method:'POST', body }),
    me: () => request('/api/portal?action=me'),
    logout: () => request('/api/portal?action=logout', { method:'POST' }),
    dashboard: () => request('/api/portal?action=dashboard'),
    tickets: params => request(`/api/portal?action=tickets&${new URLSearchParams(params || {}).toString()}`),
    createTicket: body => request('/api/portal?action=tickets', { method:'POST', body }),
    ticket: id => request(`/api/portal?action=ticket&id=${encodeURIComponent(id)}`),
    ticketAction: (id, action) => request(`/api/portal?action=ticket&id=${encodeURIComponent(id)}`, { method:'PATCH', body:{ action } }),
    sendMessage: (id, body) => request(`/api/portal?action=message&id=${encodeURIComponent(id)}`, { method:'POST', body: typeof body === 'string' ? { message: body } : body }),
    profile: () => request('/api/portal?action=profile'),
    updateProfile: body => request('/api/portal?action=profile', { method:'PATCH', body }),
    changePassword: body => request('/api/portal?action=password', { method:'POST', body })
  };
})(window);
