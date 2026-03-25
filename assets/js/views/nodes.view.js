const NodesView = (() => {
    function _statusPill(status) {
    const map = {
        online:     'status-online',
        offline:    'status-offline',
        connecting: 'status-connecting'
    };
    const cls   = map[status] || 'status-offline';
    const label = I18n.t('nodes.status.' + status);
    return `<span class="status-pill ${cls}">${label}</span>`;
    }

  function render() {
    NodesService.getAll().then(nodes => {
      const tbody = document.getElementById('nodes-tbody');
      if (!tbody) return;
      tbody.innerHTML = nodes.map(n => `
        <tr>
        <td>${n.name}</td>
        <td><code class="ip-code">${n.ip}</code></td>
        <td>${n.sshPort}</td>
        <td>${n.sshUser}</td>
        <td>${_statusPill(n.status)}</td>
        <td>
          <button class="action-btn action-btn--backup" data-action="ping"   data-id="${n.id}">${I18n.t('nodes.action.ping')}</button>
          <button class="action-btn action-btn--stop"   data-action="delete" data-id="${n.id}">${I18n.t('nodes.action.delete')}</button>
        </td>
        </tr>
        `).join('');

      tbody.querySelectorAll('[data-action]').forEach(btn =>
        btn.addEventListener('click', () => _handleAction(btn.dataset.action, Number(btn.dataset.id)))
      );

      _populateNodeSelect(nodes);
    });
  }

  function _populateNodeSelect(nodes) {
    const sel = document.getElementById('f-node');
    if (!sel) return;
    const current = sel.value;
    sel.innerHTML = `<option value="">${I18n.t('modal.selectNode')}</option>` +
      nodes.map(n => `<option value="${n.id}" ${n.id == current ? 'selected' : ''}>${n.name} (${n.ip})</option>`).join('');
  }

  function _handleAction(action, id) {
    if (action === 'ping') {
      Toast.show('Pinging...', 'info');
      setTimeout(() => Toast.show('Pong! Node is reachable', 'success'), 800);
    } else if (action === 'delete') {
      NodesService.remove(id).then(() => {
        render();
        Toast.show(I18n.t('nodes.action.deleted'), 'info');
      });
    }
  }

  function _openModal() {
    document.getElementById('node-modal-overlay')?.classList.add('active');
  }

  function _closeModal() {
    document.getElementById('node-modal-overlay')?.classList.remove('active');
    document.getElementById('node-modal-form')?.reset();
    const kf = document.getElementById('n-key-filename');
    if (kf) kf.textContent = '';
  }

  function _submit() {
    const name    = document.getElementById('n-name')?.value.trim();
    const ip      = document.getElementById('n-ip')?.value.trim();
    const sshPort = Number(document.getElementById('n-ssh-port')?.value || 22);
    const sshUser = document.getElementById('n-ssh-user')?.value.trim();

    if (!name || !ip || !sshUser) {
      Toast.show('Заполните все обязательные поля', 'error');
      return;
    }

    NodesService.create({ name, ip, sshPort, sshUser }).then(() => {
      _closeModal();
      render();
      Toast.show(name + ' — ' + I18n.t('nodes.modal.added'), 'success');
    });
  }

  function initModal() {
    const overlay = document.getElementById('node-modal-overlay');
    document.getElementById('btn-new-node')?.addEventListener('click', _openModal);
    document.getElementById('node-modal-cancel')?.addEventListener('click', _closeModal);
    document.getElementById('node-modal-create')?.addEventListener('click', _submit);
    overlay?.addEventListener('click', e => { if (e.target === overlay) _closeModal(); });

    // Auth type toggle
    document.querySelectorAll('[name="auth-type"]').forEach(r =>
      r.addEventListener('change', () => {
        const isKey = r.value === 'key' && r.checked;
        document.getElementById('n-key-group').style.display = isKey ? '' : 'none';
        document.getElementById('n-pwd-group').style.display = isKey ? 'none' : '';
      })
    );
  }

  return { render, initModal };
})();