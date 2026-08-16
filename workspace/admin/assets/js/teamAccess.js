(function(global){
  'use strict';
  const $ = (s,r=document) => r.querySelector(s);
  const $$ = (s,r=document) => [...r.querySelectorAll(s)];
  let started = false;

  function esc(value='') { return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  function initials(name='') { return name.split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]).join('').toUpperCase() || 'CC'; }
  function date(value) { return value ? new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(value)) : 'Nunca'; }
  function alertMessage(message,type='success') {
    const el = $('#teamAlert'); if (!el) return;
    el.textContent = message; el.dataset.type = type; el.hidden = false;
    clearTimeout(el._timer); el._timer = setTimeout(()=>el.hidden=true,5200);
  }
  function showCredential(email,password) {
    const box = $('#credentialResult'); if (!box) return;
    box.hidden = false;
    $('#credentialEmail').textContent = email;
    $('#credentialPassword').textContent = password;
    $('#credentialCopy')?.addEventListener('click', async () => {
      await navigator.clipboard.writeText(`E-mail: ${email}\nSenha temporária: ${password}`);
      alertMessage('Credencial temporária copiada. Ela deve ser entregue por um canal seguro.');
    }, { once:true });
  }
  async function load() {
    const data = await global.CCAdminApi.team();
    const tbody = $('#teamBody'); if (!tbody) return;
    const canManage = global.CCAdmin?.role === 'admin';
    $('#newTeamAccess')?.classList.toggle('hidden', !canManage);
    tbody.innerHTML = data.team.length ? data.team.map(user => `<tr>
      <td><span class="team-avatar">${esc(initials(user.name))}</span></td>
      <td><strong class="table-org">${esc(user.name)}</strong><span class="table-sub">${esc(user.email)}</span></td>
      <td><span class="role-chip">${user.role === 'admin' ? 'Administrador' : 'Suporte'}</span></td>
      <td>${date(user.lastLoginAt)}</td>
      <td>${user.forcePasswordChange ? '<span class="admin-state warning">Troca obrigatória</span>' : '<span class="admin-state active">Protegido</span>'}</td>
      <td><span class="admin-state ${user.active ? 'active':'inactive'}">${user.active ? 'Ativo':'Inativo'}</span></td>
      <td>${canManage ? `<div class="row-actions">
        <button class="icon-action js-team-reset" data-id="${esc(user.id)}" data-email="${esc(user.email)}" type="button" title="Gerar nova senha temporária"><i class="bi bi-key"></i></button>
        <button class="icon-action js-team-role" data-id="${esc(user.id)}" data-role="${esc(user.role)}" type="button" title="Alterar perfil"><i class="bi bi-shield-check"></i></button>
        <button class="icon-action js-team-active" data-id="${esc(user.id)}" data-active="${user.active}" type="button" title="${user.active ? 'Desativar':'Ativar'}"><i class="bi ${user.active ? 'bi-person-dash':'bi-person-check'}"></i></button>
      </div>` : '<span class="table-sub">Somente leitura</span>'}</td>
    </tr>`).join('') : '<tr><td colspan="7"><div class="empty-state"><p>Nenhum acesso interno cadastrado.</p></div></td></tr>';

    $$('.js-team-reset').forEach(btn => btn.onclick = async () => {
      if (!confirm('Gerar uma nova senha temporária e invalidar as sessões atuais deste acesso?')) return;
      try {
        const result = await global.CCAdminApi.updateTeamMember(btn.dataset.id,{ operation:'reset_password' });
        showCredential(result.user.email,result.temporaryPassword);
        alertMessage('Senha temporária criada. O usuário será obrigado a redefini-la no próximo login.');
        await load();
      } catch(error) { alertMessage(error.message,'error'); }
    });
    $$('.js-team-active').forEach(btn => btn.onclick = async () => {
      const active = btn.dataset.active !== 'true';
      if (!confirm(`${active ? 'Ativar':'Desativar'} este acesso administrativo?`)) return;
      try { await global.CCAdminApi.updateTeamMember(btn.dataset.id,{ operation:'set_active', active }); alertMessage('Acesso atualizado.'); await load(); }
      catch(error) { alertMessage(error.message,'error'); }
    });
    $$('.js-team-role').forEach(btn => btn.onclick = async () => {
      const nextRole = btn.dataset.role === 'admin' ? 'support' : 'admin';
      if (!confirm(`Alterar este usuário para ${nextRole === 'admin' ? 'Administrador' : 'Suporte'}?`)) return;
      try { await global.CCAdminApi.updateTeamMember(btn.dataset.id,{ operation:'change_role', role:nextRole }); alertMessage('Perfil atualizado.'); await load(); }
      catch(error) { alertMessage(error.message,'error'); }
    });
  }
  function bindCreate() {
    $('#newTeamAccess')?.addEventListener('click',()=>{ $('#teamCreatePanel').hidden=false; $('#teamName')?.focus(); });
    $('#cancelTeamCreate')?.addEventListener('click',()=>{ $('#teamCreatePanel').hidden=true; });
    $('#teamCreateForm')?.addEventListener('submit',async event => {
      event.preventDefault();
      const button = $('#createTeamButton'); button.disabled=true; button.textContent='Criando acesso...';
      try {
        const result = await global.CCAdminApi.createTeamMember({
          name:$('#teamName').value,
          email:$('#teamEmail').value,
          role:$('#teamRole').value,
          temporaryPassword:$('#teamPassword').value
        });
        event.target.reset(); $('#teamCreatePanel').hidden=true;
        showCredential(result.user.email,result.temporaryPassword);
        alertMessage('Acesso criado com senha armazenada somente em hash. A troca será obrigatória no primeiro login.');
        await load();
      } catch(error) { alertMessage(error.message,'error'); }
      finally { button.disabled=false; button.textContent='Criar acesso'; }
    });
  }
  function boot() {
    if (started || document.body.dataset.page !== 'admin-team' || !global.CCAdminApi) return;
    if (!global.CCAdmin) return setTimeout(boot,80);
    started=true; bindCreate(); load().catch(error=>alertMessage(error.message,'error'));
  }
  document.addEventListener('DOMContentLoaded',boot);
})(window);
