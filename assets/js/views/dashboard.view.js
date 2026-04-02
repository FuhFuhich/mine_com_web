const DashboardView = (() => {
    let _user = null;

    function fmtBytes(mb) {
        if (mb == null) return '—';
        if (mb >= 1024) return (mb / 1024).toFixed(1) + ' GB';
        return mb + ' MB';
    }
    function fmtUptime(sec) {
        if (sec == null) return '—';
        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        if (d > 0) return `${d}d ${h}h`;
        const m = Math.floor((sec % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }
    function pct(val) { return val != null ? `${Math.round(val)}%` : '—'; }

    async function render() {
        const el = document.getElementById('profile-block');
        if (el) el.innerHTML = skeletonProfile();

        try {
            _user = await Api.get('/api/user/me');
        } catch {
            try { _user = await Api.get('/api/user/me'); } catch { _user = null; }
        }

        if (_user) renderProfile(_user);
        await renderSummary();
    }

    function skeletonProfile() {
        return `<div class="profile-hero skeleton-wrap">
            <div class="skeleton skeleton-avatar"></div>
            <div class="profile-meta">
                <div class="skeleton skeleton-text" style="width:130px;height:18px"></div>
                <div class="skeleton skeleton-text" style="width:70px;height:12px;margin-top:6px"></div>
            </div>
        </div>`;
    }

    function renderProfile(user) {
        const el = document.getElementById('profile-block');
        if (!el) return;
        const BASE = Api.getBase();
        const avatarContent = user.avatarUrl
            ? `<img src="${BASE}${user.avatarUrl}" alt="avatar" class="profile-avatar-img">`
            : `<span class="profile-avatar-letter">${(user.username || user.name || '?')[0].toUpperCase()}</span>`;
        const joined = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '';
        el.innerHTML = `
        <div class="profile-hero">
            <div class="profile-avatar-wrap" id="profile-avatar-wrap" title="${I18n.t('profile.changeAvatar')}">
                ${avatarContent}
                <div class="profile-avatar-overlay"><span>⊕</span></div>
                <input type="file" id="avatar-file-input" accept="image/*" style="display:none">
            </div>
            <div class="profile-meta">
                <div class="profile-name" id="profile-username">${user.username || user.name || ''}</div>
                <div class="profile-role">${user.email || ''}</div>
                ${joined ? `<div class="profile-joined">${I18n.t('profile.joined')} ${joined}</div>` : ''}
            </div>
            <div class="profile-actions">
                <button class="profile-action-btn" id="btn-open-edit-profile">${I18n.t('profile.editTitle')}</button>
                <button class="profile-action-btn profile-action-btn--danger" id="btn-open-change-pwd">${I18n.t('profile.changePassword')}</button>
            </div>
        </div>`;
        document.getElementById('profile-avatar-wrap').addEventListener('click', () =>
            document.getElementById('avatar-file-input').click()
        );
        document.getElementById('avatar-file-input').addEventListener('change', async e => {
            const file = e.target.files[0];
            if (file) await _uploadAvatar(file);
        });
        document.getElementById('btn-open-edit-profile').addEventListener('click', () => _openEditModal(_user));
        document.getElementById('btn-open-change-pwd').addEventListener('click', _openPasswordModal);
    }

    async function renderSummary() {
        const container = document.getElementById('dashboard-summary');
        if (!container) return;

        let nodes = [], servers = [];
        try { nodes = await Api.get('/api/nodes') || []; } catch { nodes = []; }
        try { servers = await Api.get('/api/mc-servers') || []; } catch { servers = []; }

        const onlineNodes = nodes.filter(n => n.status === 'ONLINE' || n.isActive).length;
        const runningServers = servers.filter(s => s.status === 'RUNNING').length;

        let totalBackups = 0;
        const metricsArr = [];
        await Promise.all(nodes.map(async n => {
            try {
                const m = await MetricsService.getNodeLatest(n.id);
                if (m) metricsArr.push(m);
            } catch { /* no metrics */ }
        }));

        for (const s of servers) {
            try {
                const backups = await BackupsService.getAll(s.id);
                totalBackups += (backups || []).length;
            } catch { /* skip */ }
        }

        const avgCpu = metricsArr.length ? (metricsArr.reduce((a, m) => a + (m.cpuUsagePct || 0), 0) / metricsArr.length).toFixed(1) : null;
        const avgRamPct = metricsArr.length ? (metricsArr.reduce((a, m) => a + (m.ramUsedMb && m.ramTotalMb ? m.ramUsedMb / m.ramTotalMb * 100 : 0), 0) / metricsArr.length).toFixed(1) : null;
        const avgDiskPct = metricsArr.length ? (metricsArr.reduce((a, m) => a + (m.diskUsedMb && m.diskTotalMb ? m.diskUsedMb / m.diskTotalMb * 100 : 0), 0) / metricsArr.length).toFixed(1) : null;
        const totalDockerTotal = metricsArr.reduce((a, m) => a + (m.dockerContainersTotal || 0), 0);
        const totalDockerRunning = metricsArr.reduce((a, m) => a + (m.dockerContainersRunning || 0), 0);

        container.innerHTML = `
        <div class="summary-grid">
            ${summaryCard(I18n.t('dash.nodes'), nodes.length, `${onlineNodes} ${I18n.t('dash.nodesOnline')}`, '▦', onlineNodes > 0 ? 'green' : 'neutral')}
            ${summaryCard(I18n.t('dash.mcServers'), servers.length, `${runningServers} ${I18n.t('dash.mcRunning')}`, '≋', runningServers > 0 ? 'green' : 'neutral')}
            ${summaryCard(I18n.t('dash.backups'), totalBackups, '', '◫', 'neutral')}
            ${metricsArr.length ? summaryCard(I18n.t('dash.cpu'), avgCpu != null ? pct(avgCpu) : '—', '', '◌', cpuColor(avgCpu)) : summaryCard(I18n.t('dash.cpu'), '—', '', '◌', 'neutral')}
            ${metricsArr.length ? summaryCard(I18n.t('dash.ram'), avgRamPct != null ? pct(avgRamPct) : '—', '', '◧', cpuColor(avgRamPct)) : summaryCard(I18n.t('dash.ram'), '—', '', '◧', 'neutral')}
            ${metricsArr.length ? summaryCard(I18n.t('dash.disk'), avgDiskPct != null ? pct(avgDiskPct) : '—', '', '◫', cpuColor(avgDiskPct)) : summaryCard(I18n.t('dash.disk'), '—', '', '◫', 'neutral')}
            ${metricsArr.length ? summaryCard(I18n.t('dash.docker'), totalDockerRunning, `${totalDockerTotal} ${I18n.t('metrics.containers')}`, '◇', 'neutral') : ''}
        </div>
        ${rolesBlock(nodes)}
        ${quickLinks(nodes, servers)}`;
    }

    function cpuColor(val) {
        if (val == null) return 'neutral';
        if (val > 85) return 'red';
        if (val > 60) return 'yellow';
        return 'green';
    }

    function summaryCard(title, value, sub, icon, color) {
        const colorClass = { green: 'summary-card--green', yellow: 'summary-card--yellow', red: 'summary-card--red', neutral: '' }[color] || '';
        return `<div class="summary-card ${colorClass}">
            <div class="summary-card-icon">${icon}</div>
            <div class="summary-card-body">
                <div class="summary-card-title">${title}</div>
                <div class="summary-card-value">${value}</div>
                ${sub ? `<div class="summary-card-sub">${sub}</div>` : ''}
            </div>
        </div>`;
    }

    function rolesBlock(nodes) {
        if (!nodes.length) return '';
        const roles = nodes.map(n => `
            <div class="role-row">
                <span class="role-node-name">${n.name}</span>
                <span class="node-role-badge node-role-badge--${(n.myRole || 'user').toLowerCase()}">${n.myRole || 'USER'}</span>
            </div>`).join('');
        return `<div class="dash-section">
            <div class="dash-section-title">${I18n.t('dash.rolesTitle')}</div>
            <div class="roles-list">${roles}</div>
        </div>`;
    }

    function quickLinks(nodes, servers) {
        const problems = servers.filter(s => s.status === 'ERROR').map(s =>
            `<div class="quick-link quick-link--error" data-view-nav="servers">! ${s.name} — ${I18n.t('servers.status.ERROR')}</div>`
        );
        const offlineNodes = nodes.filter(n => n.status !== 'ONLINE' && !n.isActive).map(n =>
            `<div class="quick-link quick-link--warn" data-view-nav="nodes">○ ${n.name} — ${I18n.t('nodes.status.offline')}</div>`
        );
        const all = [...problems, ...offlineNodes];
        if (!all.length) return '';
        return `<div class="dash-section">
            <div class="dash-section-title">${I18n.t('dash.quickLinks')}</div>
            <div class="quick-links-list">${all.join('')}</div>
        </div>`;
    }

    async function _uploadAvatar(file) {
        const wrap = document.getElementById('profile-avatar-wrap');
        if (wrap) wrap.classList.add('loading');
        try {
            const fd = new FormData();
            fd.append('file', file);
            const updated = await Api.upload('/api/user/me/avatar', fd);
            _user.avatarUrl = updated.avatarUrl;
            const existing = wrap.querySelector('img, .profile-avatar-letter');
            if (existing) existing.remove();
            const img = document.createElement('img');
            img.src = Api.getBase() + updated.avatarUrl + `?t=${Date.now()}`;
            img.className = 'profile-avatar-img';
            wrap.insertBefore(img, wrap.querySelector('.profile-avatar-overlay'));
            Toast.show(I18n.t('profile.avatarUpdated'), 'success');
        } catch (err) {
            Toast.show(err.message || I18n.t('profile.saveError'), 'error');
        } finally {
            if (wrap) wrap.classList.remove('loading');
        }
    }

    function _openEditModal(user) {
        document.getElementById('pe-username').value = user.username || user.name || '';
        document.getElementById('pe-email').value = user.email || '';
        document.getElementById('pe-phone').value = user.phoneNumber || '';
        document.getElementById('profile-edit-overlay').classList.add('active');
    }
    function _closeEditModal() { document.getElementById('profile-edit-overlay').classList.remove('active'); }

    function _openPasswordModal() {
        ['pp-cur', 'pp-new', 'pp-new2'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
        document.getElementById('profile-pwd-overlay').classList.add('active');
    }
    function _closePwdModal() { document.getElementById('profile-pwd-overlay').classList.remove('active'); }

    function initModals() {
        const editOverlay = document.getElementById('profile-edit-overlay');
        const pwdOverlay  = document.getElementById('profile-pwd-overlay');

        editOverlay?.addEventListener('click', e => { if (e.target === editOverlay) _closeEditModal(); });
        pwdOverlay?.addEventListener('click',  e => { if (e.target === pwdOverlay) _closePwdModal(); });
        document.getElementById('pe-cancel')?.addEventListener('click', _closeEditModal);
        document.getElementById('pp-cancel')?.addEventListener('click', _closePwdModal);

        document.querySelectorAll('#profile-pwd-overlay .eye-btn').forEach(btn =>
            btn.addEventListener('click', () => {
                const input = document.getElementById(btn.dataset.target);
                if (input) { input.type = input.type === 'password' ? 'text' : 'password'; }
                btn.style.opacity = input?.type === 'password' ? '0.45' : '1';
            })
        );

        document.getElementById('pe-save')?.addEventListener('click', async () => {
            const btn = document.getElementById('pe-save');
            btn.disabled = true;
            try {
                const updated = await Api.patch('/api/user/me', {
                    username: document.getElementById('pe-username').value.trim() || null,
                    email:    document.getElementById('pe-email').value.trim() || null,
                    phoneNumber: document.getElementById('pe-phone').value.trim() || null,
                });
                _user = { ..._user, ...updated };
                const nameEl = document.getElementById('profile-username');
                if (nameEl) nameEl.textContent = updated.username || updated.name || '';
                Toast.show(I18n.t('profile.saved'), 'success');
                _closeEditModal();
            } catch (err) {
                Toast.show(err.message || I18n.t('profile.saveError'), 'error');
            } finally { btn.disabled = false; }
        });

        document.getElementById('pp-save')?.addEventListener('click', async () => {
            const newPwd  = document.getElementById('pp-new').value;
            const newPwd2 = document.getElementById('pp-new2').value;
            if (newPwd !== newPwd2) { Toast.show(I18n.t('auth.pwdMismatch'), 'error'); return; }
            if (newPwd.length < 6) { Toast.show(I18n.t('auth.pwdShort'), 'error'); return; }
            const btn = document.getElementById('pp-save');
            btn.disabled = true;
            try {
                await Api.put('/api/user/me/password', {
                    currentPassword: document.getElementById('pp-cur').value,
                    newPassword: newPwd,
                });
                Toast.show(I18n.t('profile.passwordChanged'), 'success');
                _closePwdModal();
            } catch (err) {
                Toast.show(err.message || I18n.t('profile.saveError'), 'error');
            } finally { btn.disabled = false; }
        });

        document.addEventListener('click', e => {
            if (e.target.dataset.viewNav) Router.navigate(e.target.dataset.viewNav);
        });
    }

    return { render, initModals };
})();
