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
    try { response = await fetch(url, config); }
    catch {
      const error = new Error('Não foi possível conectar ao portal administrativo.');
      error.code = 'NETWORK_ERROR';
      throw error;
    }

    let payload = {};
    try { payload = await response.json(); } catch {}
    if (!response.ok || payload.ok === false) {
      const error = new Error(payload?.error?.message || 'Não foi possível concluir a operação.');
      error.code = payload?.error?.code || `HTTP_${response.status}`;
      error.details = payload?.error?.details;
      error.status = response.status;
      if (response.headers.get('Retry-After')) error.retryAfter = Number(response.headers.get('Retry-After'));
      throw error;
    }
    return payload;
  }

  global.CCAdminApi = {
    request,
    login: body => request('/api/portal?action=admin-login', { method: 'POST', body }),
    me: () => request('/api/portal?action=admin-me'),
    logout: () => request('/api/portal?action=admin-logout', { method: 'POST' }),
    changePassword: body => request('/api/portal?action=admin-password', { method: 'POST', body }),
    dashboard: () => request('/api/portal?action=admin-dashboard'),
    tickets: params => request(`/api/portal?action=admin-tickets&${new URLSearchParams(params || {}).toString()}`),
    ticket: id => request(`/api/portal?action=admin-ticket&id=${encodeURIComponent(id)}`),
    updateTicket: (id, body) => request(`/api/portal?action=admin-ticket&id=${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    sendMessage: (id, body) => request(`/api/portal?action=admin-message&id=${encodeURIComponent(id)}`, { method: 'POST', body }),
    transferHistory: id => request(`/api/admin-enterprise?action=transfer&id=${encodeURIComponent(id)}`),
    transferTicket: (id, body) => request(`/api/admin-enterprise?action=transfer&id=${encodeURIComponent(id)}`, { method: 'POST', body }),
    clients: params => request(`/api/portal?action=admin-clients&${new URLSearchParams(params || {}).toString()}`),
    createClient: body => request('/api/portal?action=admin-clients', { method: 'POST', body }),
    updateClient: (id, body) => request(`/api/portal?action=admin-clients&id=${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    users: organizationId => request(`/api/portal?action=admin-users&organizationId=${encodeURIComponent(organizationId)}`),
    createUser: body => request('/api/portal?action=admin-users', { method: 'POST', body }),
    updateUser: (id, body) => request(`/api/portal?action=admin-users&id=${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    team: () => request('/api/admin-enterprise?action=team'),
    createTeamMember: body => request('/api/admin-enterprise?action=team', { method: 'POST', body }),
    updateTeamMember: (id, body) => request(`/api/admin-enterprise?action=team&id=${encodeURIComponent(id)}`, { method: 'PATCH', body })
  };
})(window);
