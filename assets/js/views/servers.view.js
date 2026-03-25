const ServersView = (() => {
  function _statusPill(status) {
    const map = {
      online:   'status-online',
      stopped:  'status-offline',
      starting: 'status-connecting'
    };
    const cls   = map[status] || 'status-offline';
    const label = I18n.t('servers.status.' + status);
    return `<span class="status-pill ${cls}">${label}</span>`;
  }

  function _actionButtons(s) {
    if (s.status === 'online') {
      return `
        <button class="action-btn action-btn--stop"   data-action="stop"   data-id="${s.id}">${I18n.t('servers.action.stop')}</button>
        <button class="action-btn action-btn--backup" data-action="backup" data-id="${s.id}">${I18n.t('servers.action.backup')}</button>
      `;
    }
    return `
      <button class="action-btn action-btn--start" data-action="start" data-id="${s.id}">${I18n.t('servers.action.start')}</button>
    `;
  }

  function _handleAction(action, id) {
    if (action === 'start') {
      ServersService.updateStatus(id, 'online').then(() => {
        Toast.show(I18n.t('toast.serverStarted'), 'success');
        render(); DashboardView.render();
      });
    } else if (action === 'stop') {
      ServersService.updateStatus(id, 'stopped').then(() => {
        Toast.show(I18n.t('toast.serverStopped'), 'info');
        render(); DashboardView.render();
      });
    } else if (action === 'backup') {
      Toast.show(I18n.t('toast.backupStarted'), 'info');
      ServersService.createBackup(id).then(() =>
        Toast.show(I18n.t('toast.backupDone'), 'success')
      );
    }
  }

  function render() {
    ServersService.getAll().then(servers => {
      const tbody = document.getElementById('servers-tbody');
      if (!tbody) return;

      tbody.innerHTML = servers.map(s => `
        <tr>
          <td>${s.name}</td>
          <td>${s.version} / ${s.modLoader}</td>
          <td>${s.node || '—'}</td>
          <td>${_statusPill(s.status)}</td>
          <td>${_actionButtons(s)}</td>
        </tr>
      `).join('');

      tbody.querySelectorAll('[data-action]').forEach(btn =>
        btn.addEventListener('click', () => _handleAction(btn.dataset.action, Number(btn.dataset.id)))
      );
    });
  }

  return { render };
})();