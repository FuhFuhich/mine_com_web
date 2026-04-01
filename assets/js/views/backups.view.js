const BackupsView = (() => {
    let _currentServerId = null;

    function render() {
        const container = document.getElementById('backups-container');
        if (!container) return;
        container.innerHTML = `
        <div class="card table-card">
            <div class="card-header">
                <div class="card-title">${I18n.t('backups.title')}</div>
                <div style="display:flex;align-items:center;gap:8px">
                    <select id="backups-server-select" class="csel-native" style="min-width:220px">
                        <option value="">${I18n.t('backups.selectServer')}</option>
                    </select>
                    <button class="action-btn action-btn--start" id="backups-create-btn" disabled>${I18n.t('backups.create')}</button>
                </div>
            </div>
            <div id="backups-body">
                <div class="placeholder-empty">
                    <div class="placeholder-icon">💾</div>
                    <div class="placeholder-hint">${I18n.t('backups.selectHint')}</div>
                </div>
            </div>
        </div>
        <div class="modal-overlay" id="backup-restore-overlay">
            <div class="modal" style="max-width:380px">
                <div class="modal-title">⚠ ${I18n.t('confirm.title')}</div>
                <p id="backup-restore-msg" style="font-size:13px;opacity:0.8;margin:0 0 16px"></p>
                <div class="modal-actions">
                    <button class="btn-cancel" id="backup-restore-cancel">${I18n.t('confirm.no')}</button>
                    <button class="btn-create" id="backup-restore-ok" style="background:rgba(255,165,0,0.85)">${I18n.t('backups.restore')}</button>
                </div>
            </div>
        </div>
        <div class="modal-overlay" id="backup-delete-overlay">
            <div class="modal" style="max-width:380px">
                <div class="modal-title">⚠ ${I18n.t('confirm.title')}</div>
                <p id="backup-delete-msg" style="font-size:13px;opacity:0.8;margin:0 0 16px"></p>
                <div class="modal-actions">
                    <button class="btn-cancel" id="backup-delete-cancel">${I18n.t('confirm.no')}</button>
                    <button class="btn-create" id="backup-delete-ok" style="background:rgba(255,80,80,0.85)">${I18n.t('backups.delete')}</button>
                </div>
            </div>
        </div>`;

        _populateServers();
        _bindEvents();
    }

    async function _populateServers() {
        const sel = document.getElementById('backups-server-select');
        if (!sel) return;
        try {
            const servers = await ServersService.getAll();
            sel.innerHTML = `<option value="">${I18n.t('backups.selectServer')}</option>` +
                servers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        } catch { /* ignore */ }
    }

    function _bindEvents() {
        document.getElementById('backups-server-select')?.addEventListener('change', e => {
            _currentServerId = e.target.value || null;
            document.getElementById('backups-create-btn').disabled = !_currentServerId;
            if (_currentServerId) _loadBackups(_currentServerId);
            else _showHint();
        });
        document.getElementById('backups-create-btn')?.addEventListener('click', _createBackup);

        const restoreOverlay = document.getElementById('backup-restore-overlay');
        document.getElementById('backup-restore-cancel')?.addEventListener('click', () => restoreOverlay.classList.remove('active'));
        document.getElementById('backup-restore-ok')?.addEventListener('click', async () => {
            const id = restoreOverlay.dataset.backupId;
            restoreOverlay.classList.remove('active');
            if (id) await _doRestore(id);
        });
        restoreOverlay?.addEventListener('click', e => { if (e.target === restoreOverlay) restoreOverlay.classList.remove('active'); });

        const deleteOverlay = document.getElementById('backup-delete-overlay');
        document.getElementById('backup-delete-cancel')?.addEventListener('click', () => deleteOverlay.classList.remove('active'));
        document.getElementById('backup-delete-ok')?.addEventListener('click', async () => {
            const id = deleteOverlay.dataset.backupId;
            deleteOverlay.classList.remove('active');
            if (id) await _doDelete(id);
        });
        deleteOverlay?.addEventListener('click', e => { if (e.target === deleteOverlay) deleteOverlay.classList.remove('active'); });
    }

    function _showHint() {
        const body = document.getElementById('backups-body');
        if (body) body.innerHTML = `<div class="placeholder-empty">
            <div class="placeholder-icon">💾</div>
            <div class="placeholder-hint">${I18n.t('backups.selectHint')}</div>
        </div>`;
    }

    async function _loadBackups(serverId) {
        const body = document.getElementById('backups-body');
        if (!body) return;
        body.innerHTML = `<div style="padding:20px;opacity:0.5;text-align:center">Loading...</div>`;
        try {
            const backups = await BackupsService.getAll(serverId);
            _renderBackupsTable(backups || []);
        } catch (err) {
            body.innerHTML = `<div class="placeholder-empty">
                <div class="placeholder-icon">⚠</div>
                <div class="placeholder-hint">${err.message}</div>
            </div>`;
        }
    }

    function _renderBackupsTable(backups) {
        const body = document.getElementById('backups-body');
        if (!body) return;
        if (!backups.length) {
            body.innerHTML = `<div class="placeholder-empty">
                <div class="placeholder-icon">💾</div>
                <div class="placeholder-hint">${I18n.t('backups.empty')}</div>
            </div>`;
            return;
        }
        body.innerHTML = `
        <table class="table backups-table">
            <thead><tr>
                <th>${I18n.t('backups.col.name')}</th>
                <th>${I18n.t('backups.col.size')}</th>
                <th>${I18n.t('backups.col.type')}</th>
                <th>${I18n.t('backups.col.date')}</th>
                <th style="max-width:200px">${I18n.t('backups.col.path')}</th>
                <th>${I18n.t('backups.col.actions')}</th>
            </tr></thead>
            <tbody>
            ${backups.map(b => `<tr data-backup-id="${b.id}">
                <td style="font-size:12px">${b.fileName || b.id}</td>
                <td style="white-space:nowrap">${b.sizeMb != null ? b.sizeMb + ' MB' : '—'}</td>
                <td><span class="backup-type-badge backup-type-badge--${b.backupType || 'manual'}">${I18n.t(`backups.type.${b.backupType || 'manual'}`)}</span></td>
                <td style="font-size:11px;white-space:nowrap">${b.createdAt ? new Date(b.createdAt).toLocaleString() : '—'}</td>
                <td style="font-size:11px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${b.remotePath || ''}">${b.remotePath || '—'}</td>
                <td>
                    <button class="action-btn action-btn--start backup-restore-btn" data-id="${b.id}" data-name="${b.fileName || b.id}" style="padding:3px 8px;font-size:11px">${I18n.t('backups.restore')}</button>
                    <button class="action-btn action-btn--stop  backup-delete-btn"  data-id="${b.id}" data-name="${b.fileName || b.id}" style="padding:3px 8px;font-size:11px">✕</button>
                </td>
            </tr>`).join('')}
            </tbody>
        </table>`;

        body.querySelectorAll('.backup-restore-btn').forEach(btn =>
            btn.addEventListener('click', () => _confirmRestore(btn.dataset.id, btn.dataset.name))
        );
        body.querySelectorAll('.backup-delete-btn').forEach(btn =>
            btn.addEventListener('click', () => _confirmDelete(btn.dataset.id, btn.dataset.name))
        );
    }

    function _confirmRestore(id, name) {
        const overlay = document.getElementById('backup-restore-overlay');
        const msg = document.getElementById('backup-restore-msg');
        if (msg) msg.textContent = `"${name}": ${I18n.t('backups.confirmRestore')}`;
        overlay.dataset.backupId = id;
        overlay.classList.add('active');
    }

    function _confirmDelete(id, name) {
        const overlay = document.getElementById('backup-delete-overlay');
        const msg = document.getElementById('backup-delete-msg');
        if (msg) msg.textContent = `"${name}": ${I18n.t('backups.confirmDelete')}`;
        overlay.dataset.backupId = id;
        overlay.classList.add('active');
    }

    async function _createBackup() {
        if (!_currentServerId) return;
        const btn = document.getElementById('backups-create-btn');
        btn.disabled = true;
        btn.textContent = I18n.t('backups.creating');
        try {
            await BackupsService.create(_currentServerId);
            Toast.show(I18n.t('backups.created'), 'success');
            setTimeout(() => _loadBackups(_currentServerId), 1000);
        } catch (err) { Toast.show(err.message, 'error'); }
        finally { btn.disabled = false; btn.textContent = I18n.t('backups.create'); }
    }

    async function _doRestore(backupId) {
        const btn = document.getElementById('backups-create-btn');
        if (btn) { btn.disabled = true; }
        Toast.show(I18n.t('backups.restoring'), 'info');
        try {
            await BackupsService.restore(backupId);
            Toast.show(I18n.t('backups.restored'), 'success');
        } catch (err) { Toast.show(err.message, 'error'); }
        finally { if (btn) btn.disabled = false; }
    }

    async function _doDelete(backupId) {
        try {
            await BackupsService.remove(backupId);
            Toast.show(I18n.t('backups.deleted'), 'info');
            if (_currentServerId) _loadBackups(_currentServerId);
        } catch (err) { Toast.show(err.message, 'error'); }
    }

    return { render };
})();
