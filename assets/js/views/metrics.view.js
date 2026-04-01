const MetricsView = (() => {
    let _activeTab = 'node';
    let _refreshTimer = null;

    function render() {
        const container = document.getElementById('metrics-container');
        if (!container) return;
        container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div class="card-title">${I18n.t('metrics.title')}</div>
                <button class="action-btn action-btn--neutral" id="metrics-refresh-btn">${I18n.t('metrics.refresh')}</button>
            </div>
            <div class="tab-bar">
                <button class="tab-btn active" data-tab="node">${I18n.t('metrics.tabNode')}</button>
                <button class="tab-btn" data-tab="mc">${I18n.t('metrics.tabMC')}</button>
            </div>

            <div class="tab-panel active" id="metrics-node-panel">
                <div class="metrics-selector">
                    <select id="metrics-node-select" class="csel-native" style="min-width:220px">
                        <option value="">${I18n.t('metrics.selectNode')}</option>
                    </select>
                </div>
                <div id="metrics-node-content">
                    <div class="placeholder-empty">
                        <div class="placeholder-icon">📊</div>
                        <div class="placeholder-hint">${I18n.t('metrics.selectHint')}</div>
                    </div>
                </div>
            </div>

            <div class="tab-panel" id="metrics-mc-panel">
                <div class="metrics-selector">
                    <select id="metrics-mc-select" class="csel-native" style="min-width:220px">
                        <option value="">${I18n.t('metrics.selectServer')}</option>
                    </select>
                </div>
                <div id="metrics-mc-content">
                    <div class="placeholder-empty">
                        <div class="placeholder-icon">⚡</div>
                        <div class="placeholder-hint">${I18n.t('metrics.selectHint')}</div>
                    </div>
                </div>
            </div>
        </div>`;

        _populateSelects();
        _bindEvents();
    }

    async function _populateSelects() {
        try {
            const nodes = await Api.get('/api/nodes');
            const nodeSel = document.getElementById('metrics-node-select');
            if (nodeSel && nodes?.length) {
                nodeSel.innerHTML = `<option value="">${I18n.t('metrics.selectNode')}</option>` +
                    nodes.map(n => `<option value="${n.id}">${n.name}</option>`).join('');
            }
        } catch { /* ignore */ }
        try {
            const servers = await ServersService.getAll();
            const mcSel = document.getElementById('metrics-mc-select');
            if (mcSel && servers?.length) {
                mcSel.innerHTML = `<option value="">${I18n.t('metrics.selectServer')}</option>` +
                    servers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            }
        } catch { /* ignore */ }
    }

    function _bindEvents() {
        document.querySelectorAll('#metrics-container .tab-btn').forEach(btn =>
            btn.addEventListener('click', () => {
                _activeTab = btn.dataset.tab;
                document.querySelectorAll('#metrics-container .tab-btn').forEach(b => b.classList.toggle('active', b === btn));
                document.getElementById('metrics-node-panel').classList.toggle('active', _activeTab === 'node');
                document.getElementById('metrics-mc-panel').classList.toggle('active', _activeTab === 'mc');
            })
        );
        document.getElementById('metrics-node-select')?.addEventListener('change', e => {
            if (e.target.value) _loadNodeMetrics(e.target.value);
        });
        document.getElementById('metrics-mc-select')?.addEventListener('change', e => {
            if (e.target.value) _loadMcMetrics(e.target.value);
        });
        document.getElementById('metrics-refresh-btn')?.addEventListener('click', () => {
            const nodeSel = document.getElementById('metrics-node-select');
            const mcSel   = document.getElementById('metrics-mc-select');
            if (_activeTab === 'node' && nodeSel?.value) _loadNodeMetrics(nodeSel.value);
            if (_activeTab === 'mc'   && mcSel?.value)   _loadMcMetrics(mcSel.value);
        });
    }

    async function _loadNodeMetrics(nodeId) {
        const content = document.getElementById('metrics-node-content');
        if (!content) return;
        content.innerHTML = _skeletonMetrics();
        try {
            const m = await MetricsService.getNodeLatest(nodeId);
            content.innerHTML = _renderNodeMetrics(m);
        } catch (err) {
            content.innerHTML = `<div class="placeholder-empty"><div class="placeholder-icon">⚠</div><div class="placeholder-hint">${err.message}</div></div>`;
        }
    }

    async function _loadMcMetrics(mcServerId) {
        const content = document.getElementById('metrics-mc-content');
        if (!content) return;
        content.innerHTML = _skeletonMetrics();
        try {
            const m = await MetricsService.getMcServerLatest(mcServerId);
            content.innerHTML = _renderMcMetrics(m);
        } catch (err) {
            content.innerHTML = `<div class="placeholder-empty"><div class="placeholder-icon">⚠</div><div class="placeholder-hint">${err.message}</div></div>`;
        }
    }

    function _skeletonMetrics() {
        return `<div class="metrics-grid">${[1,2,3,4,5,6].map(() =>
            `<div class="metric-card skeleton-wrap">
                <div class="skeleton skeleton-text" style="width:80px;height:13px;margin-bottom:8px"></div>
                <div class="skeleton skeleton-text" style="width:50px;height:24px;margin-bottom:8px"></div>
                <div class="skeleton skeleton-text" style="height:6px"></div>
            </div>`
        ).join('')}</div>`;
    }

    function _renderNodeMetrics(m) {
        if (!m) return `<div class="placeholder-empty"><div class="placeholder-hint">${I18n.t('metrics.noData')}</div></div>`;

        const cpuPct  = m.cpuUsagePct ?? null;
        const ramUsed = m.ramUsedMb ?? null;
        const ramTot  = m.ramTotalMb ?? null;
        const ramPct  = ramUsed != null && ramTot ? (ramUsed / ramTot * 100) : null;
        const diskUsed = m.diskUsedMb ?? null;
        const diskTot  = m.diskTotalMb ?? null;
        const diskPct  = diskUsed != null && diskTot ? (diskUsed / diskTot * 100) : null;
        const rxBps = m.networkRxBps ?? null;
        const txBps = m.networkTxBps ?? null;
        const uptime = m.uptimeSec ?? null;
        const dcTotal = m.dockerContainersTotal ?? null;
        const dcRunning = m.dockerContainersRunning ?? null;
        const ts = m.collectedAt ? new Date(m.collectedAt).toLocaleString() : null;

        return `
        <div class="metrics-grid">
            ${metricCard(I18n.t('metrics.cpu'), cpuPct != null ? cpuPct.toFixed(1)+'%' : '—', cpuPct, '', _cpuColor(cpuPct))}
            ${metricCard(I18n.t('metrics.ram'), ramUsed != null ? _fmtMb(ramUsed) : '—', ramPct, ramTot != null ? `/ ${_fmtMb(ramTot)}` : '', _cpuColor(ramPct))}
            ${metricCard(I18n.t('metrics.disk'), diskUsed != null ? _fmtMb(diskUsed) : '—', diskPct, diskTot != null ? `/ ${_fmtMb(diskTot)}` : '', _cpuColor(diskPct))}
            ${metricCardInfo(I18n.t('metrics.network'), `↓ ${rxBps != null ? _fmtBps(rxBps) : '—'} ↑ ${txBps != null ? _fmtBps(txBps) : '—'}`, '🌐')}
            ${metricCardInfo(I18n.t('metrics.uptime'), uptime != null ? _fmtUptime(uptime) : '—', '⏱')}
            ${metricCardInfo(I18n.t('metrics.docker'), dcRunning != null ? `${dcRunning} / ${dcTotal} ${I18n.t('metrics.containers')}` : '—', '🐳')}
        </div>
        ${ts ? `<div class="metrics-update-time">${I18n.t('metrics.lastUpdate')}: ${ts}</div>` : ''}`;
    }

    function _renderMcMetrics(m) {
        if (!m) return `<div class="placeholder-empty"><div class="placeholder-hint">${I18n.t('metrics.noData')}</div></div>`;

        const status   = m.status ?? null;
        const cpuPct   = m.cpuUsagePct ?? null;
        const ramUsed  = m.ramUsedMb ?? null;
        const ramLimit = m.ramLimitMb ?? null;
        const ramPct   = ramUsed != null && ramLimit ? (ramUsed / ramLimit * 100) : null;
        const diskUsed = m.diskUsedMb ?? null;
        const players  = m.playerCount ?? null;
        const tps      = m.tps ?? null;
        const mspt     = m.mspt ?? null;
        const ts       = m.collectedAt ? new Date(m.collectedAt).toLocaleString() : null;

        const statusPill = status ? `<span class="status-pill ${status==='RUNNING'?'status-online':'status-offline'}"><span class="status-dot"></span>${status}</span>` : '';

        return `
        <div class="metrics-mc-status">${statusPill}</div>
        <div class="metrics-grid">
            ${metricCard(I18n.t('metrics.cpu'), cpuPct != null ? cpuPct.toFixed(1)+'%' : '—', cpuPct, '', _cpuColor(cpuPct))}
            ${metricCard(I18n.t('metrics.ram'), ramUsed != null ? _fmtMb(ramUsed) : '—', ramPct, ramLimit != null ? `/ ${_fmtMb(ramLimit)}` : '', _cpuColor(ramPct))}
            ${metricCardInfo(I18n.t('metrics.disk'), diskUsed != null ? _fmtMb(diskUsed) : '—', '💽')}
            ${metricCardInfo(I18n.t('metrics.players'), players != null ? String(players) : '—', '👥')}
            ${tps    != null ? metricCardInfo(I18n.t('metrics.tps'),  tps.toFixed(1),  '⚡') : ''}
            ${mspt   != null ? metricCardInfo(I18n.t('metrics.mspt'), mspt.toFixed(1)+' ms', '⏱') : ''}
        </div>
        ${ts ? `<div class="metrics-update-time">${I18n.t('metrics.lastUpdate')}: ${ts}</div>` : ''}`;
    }

    function metricCard(title, value, pct, sub, color) {
        const barColor = { green: '#00e676', yellow: '#ffea00', red: '#ff5252', neutral: 'rgba(255,255,255,0.2)' }[color] || 'rgba(255,255,255,0.2)';
        const safePct  = pct != null ? Math.min(100, Math.max(0, pct)) : 0;
        return `<div class="metric-card">
            <div class="metric-title">${title}</div>
            <div class="metric-value">${value}</div>
            ${sub ? `<div class="metric-sub">${sub}</div>` : ''}
            ${pct != null ? `
            <div class="metric-bar-bg">
                <div class="metric-bar-fill" style="width:${safePct}%;background:${barColor}"></div>
            </div>
            <div class="metric-pct">${safePct.toFixed(0)}%</div>` : ''}
        </div>`;
    }

    function metricCardInfo(title, value, icon) {
        return `<div class="metric-card">
            <div class="metric-card-icon">${icon}</div>
            <div class="metric-title">${title}</div>
            <div class="metric-value">${value}</div>
        </div>`;
    }

    function _cpuColor(pct) {
        if (pct == null) return 'neutral';
        if (pct > 85) return 'red';
        if (pct > 60) return 'yellow';
        return 'green';
    }

    function _fmtMb(mb) {
        if (mb == null) return '—';
        return mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : mb + ' MB';
    }

    function _fmtBps(bps) {
        if (bps == null) return '—';
        if (bps >= 1048576) return (bps / 1048576).toFixed(1) + ' MB/s';
        if (bps >= 1024)    return (bps / 1024).toFixed(1) + ' KB/s';
        return bps + ' B/s';
    }

    function _fmtUptime(sec) {
        if (sec == null) return '—';
        const d = Math.floor(sec / 86400);
        const h = Math.floor((sec % 86400) / 3600);
        const m = Math.floor((sec % 3600) / 60);
        if (d > 0) return `${d}d ${h}h`;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }

    return { render };
})();
