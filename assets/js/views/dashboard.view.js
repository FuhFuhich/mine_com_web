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
    function pct(val) {
        if (val == null || Number.isNaN(Number(val))) return '—';
        return `${Math.round(Number(val))}%`;
    }
    function normalizeServerStatus(status) {
        return String(status || 'OFFLINE').trim().toUpperCase();
    }
    function isServerOnline(status) {
        const s = normalizeServerStatus(status);
        return ['ONLINE', 'RUNNING', 'STARTED'].includes(s);
    }

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

        let dashboard = null;
        let nodes = [];
        let servers = [];

        try { dashboard = await Api.get('/api/dashboard'); } catch { dashboard = null; }
        try { nodes = await Api.get('/api/nodes') || []; } catch { nodes = []; }
        try { servers = await Api.get('/api/mc-servers') || []; } catch { servers = []; }

        const totalNodes = dashboard?.totalNodes ?? nodes.length;
        const onlineNodes = dashboard?.onlineNodes ?? nodes.filter(n => n.status === 'ONLINE' || n.isActive).length;

        const totalServers = dashboard?.totalMcServers ?? servers.length;
        const onlineServers = dashboard?.onlineMcServers ?? servers.filter(s => isServerOnline(s.status)).length;

        const totalBackups = dashboard?.totalBackups ?? 0;
        const avgCpu = dashboard && typeof dashboard.avgCpuPercent === 'number' ? dashboard.avgCpuPercent : null;
        const avgRamPct = dashboard && typeof dashboard.avgRamPercent === 'number' ? dashboard.avgRamPercent : null;
        const avgDiskPct = dashboard && typeof dashboard.avgDiskPercent === 'number' ? dashboard.avgDiskPercent : null;

        container.innerHTML = `
        <div class="summary-grid">
            ${summaryCard(I18n.t('dash.nodes'), totalNodes, `${onlineNodes} ${I18n.t('dash.nodesOnline')}`, '▦', onlineNodes > 0 ? 'green' : 'neutral')}
            ${summaryCard(I18n.t('dash.mcServers'), totalServers, `${onlineServers} ${I18n.t('dash.mcRunning')}`, '≋', onlineServers > 0 ? 'green' : 'neutral')}
            ${summaryCard(I18n.t('dash.backups'), totalBackups, '', '◫', totalBackups > 0 ? 'green' : 'neutral')}
            ${summaryCard(I18n.t('dash.cpu'), avgCpu != null ? pct(avgCpu) : '—', '', '◌', cpuColor(avgCpu))}
            ${summaryCard(I18n.t('dash.ram'), avgRamPct != null ? pct(avgRamPct) : '—', '', '◧', cpuColor(avgRamPct))}
            ${summaryCard(I18n.t('dash.disk'), avgDiskPct != null ? pct(avgDiskPct) : '—', '', '◫', cpuColor(avgDiskPct))}
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
        const problems = servers.filter(s => normalizeServerStatus(s.status) === 'ERROR').map(s =>
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
            img.className = 'profile-avatar-img';
            img.alt = 'avatar';
            img.src = `${Api.getBase()}${updated.avatarUrl}?t=${Date.now()}`;
            wrap.prepend(img);
            Toast.show(I18n.t('profile.avatarUpdated'), 'success');
        } catch (e) {
            Toast.show(e.message || 'Avatar update failed', 'error');
        } finally {
            if (wrap) wrap.classList.remove('loading');
        }
    }

    function _openEditModal(user) {
        const overlay = document.getElementById('profile-edit-modal');
        if (!overlay) return;
        document.getElementById('profile-edit-username').value = user.username || '';
        document.getElementById('profile-edit-email').value = user.email || '';
        overlay.classList.add('active');
    }

    function _closeEditModal() {
        document.getElementById('profile-edit-modal')?.classList.remove('active');
    }

    function _openPasswordModal() {
        document.getElementById('password-modal')?.classList.add('active');
    }

    function _closePasswordModal() {
        document.getElementById('password-modal')?.classList.remove('active');
    }

    function initModals() {
        document.getElementById('profile-edit-close')?.addEventListener('click', _closeEditModal);
        document.getElementById('password-close')?.addEventListener('click', _closePasswordModal);

        document.getElementById('profile-edit-save')?.addEventListener('click', async () => {
            try {
                const payload = {
                    username: document.getElementById('profile-edit-username').value.trim(),
                    email: document.getElementById('profile-edit-email').value.trim()
                };
                _user = await Api.put('/api/user/me', payload);
                renderProfile(_user);
                _closeEditModal();
                Toast.show(I18n.t('profile.saved'), 'success');
            } catch (e) {
                Toast.show(e.message || 'Save failed', 'error');
            }
        });

        document.getElementById('password-save')?.addEventListener('click', async () => {
            const currentPassword = document.getElementById('password-current').value;
            const newPassword = document.getElementById('password-new').value;
            const confirmPassword = document.getElementById('password-confirm').value;
            if (!newPassword || newPassword !== confirmPassword) {
                Toast.show(I18n.t('profile.passwordMismatch'), 'error');
                return;
            }
            try {
                await Api.post('/api/user/me/change-password', { currentPassword, newPassword });
                _closePasswordModal();
                document.getElementById('password-current').value = '';
                document.getElementById('password-new').value = '';
                document.getElementById('password-confirm').value = '';
                Toast.show(I18n.t('profile.passwordChanged'), 'success');
            } catch (e) {
                Toast.show(e.message || 'Password change failed', 'error');
            }
        });
    }

    return { render, initModals };
})();
