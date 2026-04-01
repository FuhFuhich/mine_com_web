const ServersView = (() => {
    let _servers = [];
    let _editingId = null;
    let _dockerOptions = [];
    let _bundles = [];

    /* ─── status ─── */
    const STATUS_CLASS = {
        RUNNING: 'status-online', STOPPED: 'status-offline',
        STARTING: 'status-connecting', STOPPING: 'status-connecting',
        RESTARTING: 'status-connecting', DEPLOYING: 'status-connecting', ERROR: 'status-error',
    };
    function statusPill(status) {
        const cls = STATUS_CLASS[status] || 'status-offline';
        const label = I18n.t(`servers.status.${status}`) || status;
        return `<span class="status-pill ${cls}"><span class="status-dot"></span>${label}</span>`;
    }

    /* ─── permission check ─── */
    function can(server, action) {
        if (server.allowedActions) return server.allowedActions.includes(action);
        return true;
    }

    /* ─── table ─── */
    function _drawTable(list) {
        const tbody = document.getElementById('servers-tbody');
        if (!tbody) return;
        if (!list.length) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="placeholder-empty">
                <div class="placeholder-icon">⚡</div>
                <div class="placeholder-title">${I18n.t('servers.empty.title')}</div>
                <div class="placeholder-hint">${I18n.t('servers.empty.hint')}</div>
            </div></td></tr>`;
            return;
        }
        tbody.innerHTML = list.map(s => `
            <tr data-server-id="${s.id}">
                <td>
                    <div class="node-name">${s.name}</div>
                    <div class="node-desc">${s.deployTarget || ''} ${s.storageType ? `· ${s.storageType}` : ''}</div>
                </td>
                <td>
                    <div>${s.minecraftVersion || (s.bundleId || '—')}</div>
                    <div class="node-desc">${s.modLoader || ''}${s.modLoaderVersion ? ` ${s.modLoaderVersion}` : ''}</div>
                </td>
                <td>${s.nodeName || ''}</td>
                <td>${s.gamePort || '—'}</td>
                <td>
                    <div style="font-size:11px;white-space:nowrap">${s.ramMb ? `${s.ramMb} MB` : '—'} / ${s.cpuCores ? `${s.cpuCores} CPU` : '—'}</div>
                    <div class="node-desc">${s.backupEnabled ? '💾 backup on' : ''}</div>
                </td>
                <td class="server-status-cell" data-server-status="${s.id}">${statusPill(s.status)}</td>
                <td class="server-actions-cell">
                    ${_buildActions(s)}
                </td>
            </tr>`).join('');

        tbody.querySelectorAll('[data-action]').forEach(btn =>
            btn.addEventListener('click', () => _handleAction(btn.dataset.action, btn.dataset.id))
        );
        _bindDropdowns(tbody);
    }

    function _buildActions(s) {
        const id = s.id;
        const busy = ['STARTING','STOPPING','RESTARTING','DEPLOYING'].includes(s.status);
        if (busy) {
            return `<button class="action-btn action-btn--neutral" disabled style="opacity:0.6">${statusPill(s.status)}</button>`;
        }
        const parts = [];
        if (s.status === 'RUNNING') {
            if (can(s,'stop'))    parts.push(`<button class="action-btn action-btn--stop" data-action="stop" data-id="${id}">${I18n.t('servers.action.stop')}</button>`);
            if (can(s,'restart')) parts.push(`<button class="action-btn action-btn--neutral" data-action="restart" data-id="${id}">${I18n.t('servers.action.restart')}</button>`);
        } else if (s.status === 'STOPPED' || s.status === 'ERROR') {
            if (can(s,'start'))   parts.push(`<button class="action-btn action-btn--start" data-action="start" data-id="${id}">${I18n.t('servers.action.start')}</button>`);
        }

        const menuItems = [];
        if (can(s,'redeploy'))     menuItems.push({ action:'redeploy',     label: I18n.t('servers.action.redeploy') });
        if (can(s,'backup'))       menuItems.push({ action:'backup',       label: I18n.t('servers.action.backup') });
        if (can(s,'logs'))         menuItems.push({ action:'logs',         label: I18n.t('servers.action.logs') });
        if (can(s,'metrics'))      menuItems.push({ action:'metrics',      label: I18n.t('servers.action.metrics') });
        if (can(s,'files'))        menuItems.push({ action:'files',        label: I18n.t('servers.action.files') });
        if (can(s,'configs'))      menuItems.push({ action:'configs',      label: I18n.t('servers.action.configs') });
        menuItems.push({ action:'backups', label: I18n.t('servers.action.backups') });
        if (can(s,'edit'))         menuItems.push({ action:'edit',         label: I18n.t('servers.action.edit') });
        if (s.rconEnabled && can(s,'view')) menuItems.push({ action:'rcon', label: I18n.t('servers.action.rcon') });
        if (can(s,'delete_device')) menuItems.push({ action:'delete_device', label: I18n.t('servers.action.deleteDevice'), danger: true });
        if (can(s,'delete_full'))   menuItems.push({ action:'delete_full',  label: I18n.t('servers.action.deleteFull'),   danger: true });

        if (menuItems.length) {
            const menuHtml = menuItems.map(m =>
                `<div class="action-menu-item ${m.danger ? 'action-menu-item--danger' : ''}" data-action="${m.action}" data-id="${id}">${m.label}</div>`
            ).join('');
            parts.push(`<div class="action-menu-wrap">
                <button class="action-btn action-btn--neutral action-menu-toggle" data-id="${id}">···</button>
                <div class="action-menu" id="amenu-${id}">${menuHtml}</div>
            </div>`);
        }
        return parts.join('');
    }

    function _bindDropdowns(tbody) {
        tbody.querySelectorAll('.action-menu-toggle').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const menu = document.getElementById(`amenu-${btn.dataset.id}`);
                const wasOpen = menu.classList.contains('open');
                document.querySelectorAll('.action-menu.open').forEach(m => m.classList.remove('open'));
                if (!wasOpen) menu.classList.add('open');
            });
        });
        tbody.querySelectorAll('.action-menu-item').forEach(item =>
            item.addEventListener('click', () => {
                item.closest('.action-menu')?.classList.remove('open');
                _handleAction(item.dataset.action, item.dataset.id);
            })
        );
    }

    document.addEventListener('click', () =>
        document.querySelectorAll('.action-menu.open').forEach(m => m.classList.remove('open'))
    );

    /* ─── actions ─── */
    async function _handleAction(action, id) {
        const s = _servers.find(x => String(x.id) === String(id));

        if (action === 'edit') { _openEditModal(id); return; }
        if (action === 'logs')    { Router.navigate('logs');    setTimeout(() => _preselectServer('logs-server-select', id), 80); return; }
        if (action === 'metrics') { Router.navigate('metrics'); setTimeout(() => _preselectServer('metrics-mc-select', id), 80); return; }
        if (action === 'files')   { Router.navigate('files');   setTimeout(() => _preselectServer('files-server-select', id), 80); return; }
        if (action === 'configs') { Router.navigate('configs'); setTimeout(() => _preselectServer('configs-server-select', id), 80); return; }
        if (action === 'backups') { Router.navigate('backups'); setTimeout(() => _preselectServer('backups-server-select', id), 80); return; }
        if (action === 'rcon')    { _openRconModal(id, s?.name); return; }
        if (action === 'delete_device') { _confirmDelete(id, s?.name, 'device'); return; }
        if (action === 'delete_full')   { _confirmDelete(id, s?.name, 'full');   return; }

        const btn = document.querySelector(`[data-action="${action}"][data-id="${id}"]`);
        if (btn) { btn.disabled = true; btn.style.opacity = '0.55'; }
        try {
            if (action === 'start') {
                await ServersService.start(id);
                _updateStatus(id, 'STARTING');
                Toast.show(I18n.t('toast.serverStarted'), 'success');
            } else if (action === 'stop') {
                await ServersService.stop(id);
                _updateStatus(id, 'STOPPING');
                Toast.show(I18n.t('toast.serverStopped'), 'info');
            } else if (action === 'restart') {
                await ServersService.restart(id);
                _updateStatus(id, 'RESTARTING');
                Toast.show(I18n.t('toast.serverRestarted'), 'info');
            } else if (action === 'redeploy') {
                await ServersService.redeploy(id);
                _updateStatus(id, 'DEPLOYING');
                Toast.show(I18n.t('toast.serverRedeployed'), 'info');
            } else if (action === 'backup') {
                Toast.show(I18n.t('toast.backupStarted'), 'info');
                await BackupsService.create(id);
                Toast.show(I18n.t('toast.backupDone'), 'success');
            }
        } catch (err) {
            Toast.show(err.message, 'error');
        } finally {
            if (btn) { btn.disabled = false; btn.style.opacity = ''; }
        }
    }

    function _preselectServer(selectId, serverId) {
        const sel = document.getElementById(selectId);
        if (sel) { sel.value = serverId; sel.dispatchEvent(new Event('change')); }
    }

    function _updateStatus(id, newStatus) {
        const s = _servers.find(x => String(x.id) === String(id));
        if (s) s.status = newStatus;
        const cell = document.querySelector(`[data-server-status="${id}"]`);
        if (cell) cell.innerHTML = statusPill(newStatus);
        const actCell = document.querySelector(`tr[data-server-id="${id}"] .server-actions-cell`);
        if (actCell && s) {
            actCell.innerHTML = _buildActions(s);
            actCell.querySelectorAll('[data-action]').forEach(btn =>
                btn.addEventListener('click', () => _handleAction(btn.dataset.action, btn.dataset.id))
            );
            _bindDropdowns(actCell.closest('tbody') || actCell);
        }
    }

    /* ─── delete confirm ─── */
    function _confirmDelete(id, name, mode) {
        const overlay = document.getElementById('server-confirm-overlay');
        const msg = document.getElementById('server-confirm-msg');
        const txt = mode === 'device' ? I18n.t('servers.deleteDevice.confirm') : I18n.t('servers.deleteFull.confirm');
        if (msg) msg.textContent = `"${name}": ${txt}`;
        overlay.dataset.pendingId   = id;
        overlay.dataset.deleteMode  = mode;
        overlay.classList.add('active');
    }

    async function _doDelete(id, mode) {
        try {
            if (mode === 'device') await ServersService.removeDevice(id);
            else await ServersService.remove(id);
            document.querySelector(`tr[data-server-id="${id}"]`)?.remove();
            _servers = _servers.filter(s => String(s.id) !== String(id));
            Toast.show('Deleted', 'info');
        } catch (err) { Toast.show(err.message, 'error'); }
    }

    /* ─── RCON modal ─── */
    function _openRconModal(serverId, serverName) {
        const overlay = document.getElementById('rcon-modal-overlay');
        if (!overlay) return;
        document.getElementById('rcon-modal-title').textContent = `${I18n.t('rcon.title')} — ${serverName || serverId}`;
        document.getElementById('rcon-log').innerHTML = '';
        document.getElementById('rcon-command').value = '';
        overlay.dataset.serverId = serverId;
        overlay.classList.add('active');
    }

    /* ─── MC server creation modal ─── */
    async function _openCreateModal() {
        _editingId = null;
        document.getElementById('mc-modal-title').textContent = I18n.t('modal.createServer');
        document.getElementById('mc-modal-submit').textContent = I18n.t('modal.create');
        document.getElementById('mc-server-form').reset();
        await _loadCatalog();
        _syncDeployTarget();
        document.getElementById('mc-modal-overlay').classList.add('active');
    }

    async function _openEditModal(id) {
        const s = _servers.find(x => String(x.id) === String(id)) || await ServersService.getById(id);
        if (!s) return;
        _editingId = id;
        document.getElementById('mc-modal-title').textContent = I18n.t('modal.editServer');
        document.getElementById('mc-modal-submit').textContent = I18n.t('modal.save');
        await _loadCatalog();

        document.getElementById('f-name').value = s.name || '';
        document.getElementById('f-node').value = s.nodeId || '';
        document.getElementById('f-game-port').value = s.gamePort || 25565;
        document.getElementById('f-storage').value = s.storageType || 'ssd';
        document.getElementById('f-allocate-all').checked = s.allocateAllResources || false;
        document.getElementById('f-ram').value = s.ramMb || 2048;
        document.getElementById('f-cpu').value = s.cpuCores || 2;
        document.getElementById('f-disk').value = s.diskMb || 20480;
        document.getElementById('f-auto-restart').checked = s.autoRestart !== false;
        document.getElementById('f-backup-enabled').checked = s.backupEnabled || false;
        document.getElementById('f-backup-interval').value = s.backupIntervalHours || 6;
        document.getElementById('f-backup-auto-delete').checked = s.backupAutoDelete || false;
        document.getElementById('f-backup-delete-after').value = s.backupDeleteAfterHours || 168;
        document.getElementById('f-backup-path').value = s.backupPath || '';
        document.getElementById('f-backup-max').value = s.backupMaxCount || 10;
        document.getElementById('f-log-max').value = s.logMaxFiles || 10;
        document.getElementById('f-whitelist').checked = s.whitelistEnabled || false;
        document.getElementById('f-rcon-enabled').checked = s.rconEnabled || false;
        document.getElementById('f-rcon-port').value = s.rconPort || 25566;
        document.getElementById('f-rcon-password').value = s.rconPassword || '';

        const target = s.deployTarget || 'docker';
        document.querySelector(`input[name="mc-deploy-target"][value="${target}"]`).checked = true;

        if (target === 'baremetal' && s.bundleId) {
            document.getElementById('f-bundle').value = s.bundleId;
        } else if (target === 'docker') {
            document.getElementById('f-mc-version').value = s.minecraftVersion || '';
            _onVersionChange(s.minecraftVersion, s.modLoader, s.modLoaderVersion);
        }

        _syncDeployTarget();
        document.getElementById('mc-modal-overlay').classList.add('active');
    }

    function _closeModal() {
        document.getElementById('mc-modal-overlay').classList.remove('active');
        _editingId = null;
    }

    async function _loadCatalog() {
        try { _bundles = await CatalogService.getBaremetalBundles(); } catch { _bundles = []; }
        try { _dockerOptions = await CatalogService.getDockerOptions(); } catch { _dockerOptions = []; }

        const bundleSel = document.getElementById('f-bundle');
        bundleSel.innerHTML = `<option value="">${I18n.t('modal.selectBundle')}</option>` +
            _bundles.map(b => `<option value="${b.bundleId}">${b.bundleId}</option>`).join('');

        const versions = CatalogService.getUniqueVersions(_dockerOptions);
        const verSel = document.getElementById('f-mc-version');
        verSel.innerHTML = `<option value="">${I18n.t('modal.selectVersion')}</option>` +
            versions.map(v => `<option value="${v}">${v}</option>`).join('');

        document.getElementById('f-mod-loader').innerHTML = `<option value="">${I18n.t('modal.selectLoader')}</option>`;
        document.getElementById('f-mod-loader-version').innerHTML = `<option value="">${I18n.t('modal.selectLoaderVersion')}</option>`;
    }

    function _syncDeployTarget() {
        const target = document.querySelector('input[name="mc-deploy-target"]:checked')?.value || 'docker';
        document.getElementById('mc-docker-fields').style.display = target === 'docker' ? '' : 'none';
        document.getElementById('mc-baremetal-fields').style.display = target === 'baremetal' ? '' : 'none';
        _syncAllocateAll();
        _syncBackupEnabled();
        _syncRcon();
    }

    function _syncAllocateAll() {
        const all = document.getElementById('f-allocate-all').checked;
        ['f-ram','f-cpu','f-disk'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.disabled = all;
        });
    }

    function _syncBackupEnabled() {
        const en = document.getElementById('f-backup-enabled').checked;
        document.getElementById('f-backup-options').style.display = en ? '' : 'none';
    }

    function _syncRcon() {
        const en = document.getElementById('f-rcon-enabled').checked;
        document.getElementById('f-rcon-options').style.display = en ? '' : 'none';
    }

    function _onVersionChange(version, preselectLoader, preselectLV) {
        const loaders = CatalogService.getLoadersForVersion(_dockerOptions, version);
        const loaderSel = document.getElementById('f-mod-loader');
        loaderSel.innerHTML = `<option value="">${I18n.t('modal.selectLoader')}</option>` +
            loaders.map(l => `<option value="${l}" ${l === preselectLoader ? 'selected' : ''}>${l}</option>`).join('');
        document.getElementById('f-mod-loader-version').innerHTML = `<option value="">${I18n.t('modal.selectLoaderVersion')}</option>`;
        if (preselectLoader) _onLoaderChange(version, preselectLoader, preselectLV);
    }

    function _onLoaderChange(version, loader, preselectLV) {
        const versions = CatalogService.getLoaderVersions(_dockerOptions, version, loader);
        const sel = document.getElementById('f-mod-loader-version');
        sel.innerHTML = `<option value="">${I18n.t('modal.selectLoaderVersion')}</option>` +
            versions.map(v => `<option value="${v}" ${v === preselectLV ? 'selected' : ''}>${v}</option>`).join('');
    }

    async function _submitModal() {
        const name   = document.getElementById('f-name').value.trim();
        const nodeId = document.getElementById('f-node').value;
        const target = document.querySelector('input[name="mc-deploy-target"]:checked')?.value || 'docker';

        if (!name || !nodeId) { Toast.show(I18n.t('auth.fillAll'), 'error'); return; }

        const allocAll = document.getElementById('f-allocate-all').checked;
        const backupEn = document.getElementById('f-backup-enabled').checked;
        const rconEn   = document.getElementById('f-rcon-enabled').checked;

        const payload = {
            nodeId, name, deployTarget: target,
            gamePort:  Number(document.getElementById('f-game-port').value) || 25565,
            storageType: document.getElementById('f-storage').value || 'ssd',
            allocateAllResources: allocAll,
            ramMb:    allocAll ? undefined : (Number(document.getElementById('f-ram').value) || 2048),
            cpuCores: allocAll ? undefined : (Number(document.getElementById('f-cpu').value) || 2),
            diskMb:   allocAll ? undefined : (Number(document.getElementById('f-disk').value) || 20480),
            autoRestart: document.getElementById('f-auto-restart').checked,
            backupEnabled: backupEn,
            ...(backupEn ? {
                backupIntervalHours:    Number(document.getElementById('f-backup-interval').value) || 6,
                backupAutoDelete:       document.getElementById('f-backup-auto-delete').checked,
                backupDeleteAfterHours: Number(document.getElementById('f-backup-delete-after').value) || 168,
                backupPath:             document.getElementById('f-backup-path').value.trim() || null,
                backupMaxCount:         Number(document.getElementById('f-backup-max').value) || 10,
            } : {}),
            logMaxFiles:      Number(document.getElementById('f-log-max').value) || 10,
            whitelistEnabled: document.getElementById('f-whitelist').checked,
            rconEnabled:      rconEn,
            ...(rconEn ? {
                rconPort:     Number(document.getElementById('f-rcon-port').value) || 25566,
                rconPassword: document.getElementById('f-rcon-password').value || '',
            } : {}),
        };

        if (target === 'docker') {
            payload.minecraftVersion  = document.getElementById('f-mc-version').value;
            payload.modLoader         = document.getElementById('f-mod-loader').value;
            payload.modLoaderVersion  = document.getElementById('f-mod-loader-version').value;
            if (!payload.minecraftVersion || !payload.modLoader || !payload.modLoaderVersion) {
                Toast.show(I18n.t('auth.fillAll'), 'error'); return;
            }
        } else {
            payload.bundleId = document.getElementById('f-bundle').value;
            if (!payload.bundleId) { Toast.show(I18n.t('auth.fillAll'), 'error'); return; }
        }

        const btn = document.getElementById('mc-modal-submit');
        btn.disabled = true;
        btn.textContent = '...';
        try {
            if (_editingId) {
                await ServersService.update(_editingId, payload);
                Toast.show(`${name} saved`, 'success');
            } else {
                const created = await ServersService.create(payload);
                Toast.show(`${name} created`, 'success');
            }
            _closeModal();
            render();
        } catch (err) {
            Toast.show(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = _editingId ? I18n.t('modal.save') : I18n.t('modal.create');
        }
    }

    /* ─── render ─── */
    async function render() {
        try {
            _servers = await ServersService.getAll();
            _drawTable(_servers);
        } catch (err) {
            const tbody = document.getElementById('servers-tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="7"><div class="placeholder-empty">
                <div class="placeholder-icon">⚠</div>
                <div class="placeholder-title">Error</div>
                <div class="placeholder-hint">${err.message}</div>
            </div></td></tr>`;
        }
    }

    /* ─── init ─── */
    function init() {
        document.getElementById('btn-new-server')?.addEventListener('click', _openCreateModal);
        document.getElementById('mc-modal-cancel')?.addEventListener('click', _closeModal);
        document.getElementById('mc-modal-submit')?.addEventListener('click', _submitModal);
        document.getElementById('mc-modal-overlay')?.addEventListener('click', e => {
            if (e.target === document.getElementById('mc-modal-overlay')) _closeModal();
        });

        document.querySelectorAll('input[name="mc-deploy-target"]').forEach(r =>
            r.addEventListener('change', _syncDeployTarget)
        );
        document.getElementById('f-allocate-all')?.addEventListener('change', _syncAllocateAll);
        document.getElementById('f-backup-enabled')?.addEventListener('change', _syncBackupEnabled);
        document.getElementById('f-rcon-enabled')?.addEventListener('change', _syncRcon);

        document.getElementById('f-mc-version')?.addEventListener('change', e => {
            _onVersionChange(e.target.value);
        });
        document.getElementById('f-mod-loader')?.addEventListener('change', e => {
            const ver = document.getElementById('f-mc-version').value;
            _onLoaderChange(ver, e.target.value);
        });

        const confirmOverlay = document.getElementById('server-confirm-overlay');
        document.getElementById('server-confirm-cancel')?.addEventListener('click', () =>
            confirmOverlay.classList.remove('active')
        );
        document.getElementById('server-confirm-ok')?.addEventListener('click', async () => {
            const id   = confirmOverlay.dataset.pendingId;
            const mode = confirmOverlay.dataset.deleteMode;
            confirmOverlay.classList.remove('active');
            if (id) await _doDelete(id, mode);
        });
        confirmOverlay?.addEventListener('click', e => {
            if (e.target === confirmOverlay) confirmOverlay.classList.remove('active');
        });

        const rconOverlay = document.getElementById('rcon-modal-overlay');
        document.getElementById('rcon-modal-close')?.addEventListener('click', () =>
            rconOverlay.classList.remove('active')
        );
        rconOverlay?.addEventListener('click', e => {
            if (e.target === rconOverlay) rconOverlay.classList.remove('active');
        });
        document.getElementById('rcon-send-btn')?.addEventListener('click', _sendRcon);
        document.getElementById('rcon-command')?.addEventListener('keydown', e => {
            if (e.key === 'Enter') _sendRcon();
        });

        const modpackInput = document.getElementById('f-modpack-file');
        document.getElementById('f-modpack-zone')?.addEventListener('click', () => modpackInput?.click());
        modpackInput?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (file) document.getElementById('f-modpack-name').textContent = file.name;
        });
    }

    async function _sendRcon() {
        const overlay  = document.getElementById('rcon-modal-overlay');
        const serverId = overlay?.dataset.serverId;
        const input    = document.getElementById('rcon-command');
        const cmd      = input?.value.trim();
        if (!cmd || !serverId) return;
        input.value = '';
        const log = document.getElementById('rcon-log');
        if (log) {
            const entry = document.createElement('div');
            entry.className = 'rcon-entry';
            entry.innerHTML = `<span class="rcon-cmd">▶ ${cmd}</span>`;
            log.appendChild(entry);
            try {
                const res = await ServersService.sendRcon(serverId, cmd);
                const r = document.createElement('div');
                r.className = 'rcon-entry rcon-response';
                r.textContent = res.response || '';
                log.appendChild(r);
            } catch (err) {
                const r = document.createElement('div');
                r.className = 'rcon-entry rcon-error';
                r.textContent = err.message;
                log.appendChild(r);
            }
            log.scrollTop = log.scrollHeight;
        }
    }

    return { render, init };
})();
