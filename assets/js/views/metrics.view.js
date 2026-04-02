const MetricsView = (() => {
    let _nodes = [];
    let _servers = [];

    function _el(root, sel) {
        return root.querySelector(sel);
    }

    function _fmtPercent(v) {
        if (v == null || Number.isNaN(Number(v))) return '—';
        return `${Number(v).toFixed(1)}%`;
    }

    function _fmtMb(v) {
        if (v == null || Number.isNaN(Number(v))) return '—';
        return `${Math.round(Number(v))} MB`;
    }

    function _fmtGbFromMb(v) {
        if (v == null || Number.isNaN(Number(v))) return '—';
        return `${(Number(v) / 1024).toFixed(1)} GB`;
    }

    function _fmtBps(v) {
        if (v == null || Number.isNaN(Number(v))) return '—';
        const n = Number(v);
        if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB/s`;
        if (n >= 1024) return `${(n / 1024).toFixed(2)} KB/s`;
        return `${n.toFixed(0)} B/s`;
    }

    function _fmtSeconds(sec) {
        if (sec == null || Number.isNaN(Number(sec))) return '—';
        const s = Math.max(0, Math.floor(Number(sec)));
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        if (d > 0) return `${d}д ${h}ч ${m}м`;
        if (h > 0) return `${h}ч ${m}м`;
        return `${m}м`;
    }

    function _createMetricCard(label, value, sub = '') {
        return `
            <div class="metric-card">
                <div class="metric-card__label">${label}</div>
                <div class="metric-card__value">${value}</div>
                ${sub ? `<div class="metric-card__sub">${sub}</div>` : ''}
            </div>
        `;
    }

    function _renderNodeCards(container, data) {
        const cpu = data.cpuUsagePct ?? data.cpuPercent ?? data.cpuUsage;
        const ramUsed = data.ramUsedMb ?? data.usedRamMb ?? data.memoryUsedMb;
        const ramTotal = data.ramTotalMb ?? data.totalRamMb ?? data.memoryTotalMb;
        const diskUsed = data.diskUsedMb ?? data.usedDiskMb;
        const diskTotal = data.diskTotalMb ?? data.totalDiskMb;
        const rx = data.networkRxBps ?? data.rxBps;
        const tx = data.networkTxBps ?? data.txBps;
        const uptime = data.uptimeSec ?? data.uptimeSeconds;
        const dockerTotal = data.dockerContainersTotal ?? data.containersTotal;
        const dockerRunning = data.dockerContainersRunning ?? data.containersRunning;
        const load1 = data.loadAverage1m ?? data.load1;
        const load5 = data.loadAverage5m ?? data.load5;
        const load15 = data.loadAverage15m ?? data.load15;

        container.innerHTML = `
            <div class="metrics-grid">
                ${_createMetricCard('CPU', _fmtPercent(cpu))}
                ${_createMetricCard('RAM', `${_fmtMb(ramUsed)} / ${_fmtMb(ramTotal)}`)}
                ${_createMetricCard('Disk', `${_fmtGbFromMb(diskUsed)} / ${_fmtGbFromMb(diskTotal)}`)}
                ${_createMetricCard('RX', _fmtBps(rx))}
                ${_createMetricCard('TX', _fmtBps(tx))}
                ${_createMetricCard('Uptime', _fmtSeconds(uptime))}
                ${_createMetricCard('Load', [load1, load5, load15].filter(v => v != null).join(' / ') || '—')}
                ${_createMetricCard('Docker', dockerRunning != null || dockerTotal != null ? `${dockerRunning ?? '—'} / ${dockerTotal ?? '—'}` : '—', 'running / total')}
            </div>
        `;
    }

    function _renderServerCards(container, latest) {
        const status = latest.status ?? '—';
        const cpu = latest.cpuUsagePct ?? latest.cpuPercent ?? latest.cpuUsage;
        const ramUsed = latest.ramUsedMb ?? latest.usedRamMb ?? latest.memoryUsedMb;
        const ramLimit = latest.ramLimitMb ?? latest.ramTotalMb ?? latest.totalRamMb;
        const disk = latest.diskUsedMb ?? latest.usedDiskMb;
        const players = latest.playerCount;
        const tps = latest.tps;
        const mspt = latest.mspt;
        const collectedAt = latest.collectedAt ? new Date(latest.collectedAt).toLocaleString() : '';

        container.innerHTML = `
            <div class="metrics-grid">
                ${_createMetricCard('Статус', status)}
                ${_createMetricCard('CPU', _fmtPercent(cpu))}
                ${_createMetricCard('RAM', `${_fmtMb(ramUsed)} / ${_fmtMb(ramLimit)}`)}
                ${_createMetricCard('Disk', _fmtGbFromMb(disk))}
                ${_createMetricCard('Игроки', players ?? '—')}
                ${_createMetricCard('TPS', tps ?? '—')}
                ${_createMetricCard('MSPT', mspt ?? '—')}
                ${_createMetricCard('Обновлено', collectedAt || '—')}
            </div>
        `;
    }

    function _renderHistory(container, history) {
        if (!Array.isArray(history) || history.length === 0) {
            container.innerHTML = `<div class="empty-state"><div class="empty-state__text">История метрик пока отсутствует</div></div>`;
            return;
        }

        const rows = history.slice(0, 20).map(item => {
            const ts = item.collectedAt ? new Date(item.collectedAt).toLocaleString() : '—';
            const cpu = item.cpuUsagePct ?? item.cpuPercent ?? item.cpuUsage ?? '—';
            const ram = item.ramUsedMb ?? item.usedRamMb ?? item.memoryUsedMb ?? '—';
            const tps = item.tps ?? '—';
            const mspt = item.mspt ?? '—';

            return `
                <tr>
                    <td>${ts}</td>
                    <td>${cpu === '—' ? '—' : `${Number(cpu).toFixed(1)}%`}</td>
                    <td>${ram === '—' ? '—' : `${Math.round(Number(ram))} MB`}</td>
                    <td>${tps}</td>
                    <td>${mspt}</td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Время</th>
                            <th>CPU</th>
                            <th>RAM</th>
                            <th>TPS</th>
                            <th>MSPT</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    }

    async function _loadNodeMetrics(root, nodeId) {
        const out = _el(root, '[data-role="node-metrics-output"]');
        if (!nodeId) {
            out.innerHTML = `<div class="empty-state"><div class="empty-state__text">Выберите узел</div></div>`;
            return;
        }

        out.innerHTML = `<div class="loading-state">Загрузка метрик узла...</div>`;

        try {
            const data = await MetricsService.getNodeLatest(nodeId);
            _renderNodeCards(out, data || {});
        } catch (e) {
            out.innerHTML = `<div class="empty-state"><div class="empty-state__text">Не удалось загрузить метрики узла: ${e.message || e}</div></div>`;
        }
    }

    async function _loadServerMetrics(root, serverId) {
        const latestOut = _el(root, '[data-role="server-metrics-latest"]');
        const historyOut = _el(root, '[data-role="server-metrics-history"]');

        if (!serverId) {
            latestOut.innerHTML = `<div class="empty-state"><div class="empty-state__text">Выберите Minecraft-сервер</div></div>`;
            historyOut.innerHTML = '';
            return;
        }

        latestOut.innerHTML = `<div class="loading-state">Загрузка метрик сервера...</div>`;
        historyOut.innerHTML = '';

        try {
            const latest = await MetricsService.getServerLatest(serverId);
            _renderServerCards(latestOut, latest || {});

            try {
                const history = await MetricsService.getServerHistory(serverId, 24, 0, 100);
                _renderHistory(historyOut, history);
            } catch (e) {
                historyOut.innerHTML = `<div class="empty-state"><div class="empty-state__text">Не удалось загрузить историю метрик: ${e.message || e}</div></div>`;
            }
        } catch (e) {
            latestOut.innerHTML = `<div class="empty-state"><div class="empty-state__text">Не удалось загрузить метрики сервера: ${e.message || e}</div></div>`;
            historyOut.innerHTML = '';
        }
    }

    function _fillNodeSelect(select) {
        const options = ['<option value="">— Выберите узел —</option>']
            .concat(_nodes.map(n => `<option value="${n.id}">${n.name || n.ipAddress || n.id}</option>`));
        select.innerHTML = options.join('');
    }

    function _fillServerSelect(select) {
        const options = ['<option value="">— Выберите сервер —</option>']
            .concat(_servers.map(s => `<option value="${s.id}">${s.name || s.id}</option>`));
        select.innerHTML = options.join('');
    }

    async function render(root) {
        root.innerHTML = `
            <section class="panel">
                <div class="tabs">
                    <button class="tab-btn is-active" data-tab="node">Метрики узла</button>
                    <button class="tab-btn" data-tab="server">Метрики MC-сервера</button>
                </div>

                <div class="tab-pane is-active" data-pane="node">
                    <div class="toolbar">
                        <select class="app-select app-select--compact" data-role="node-select"></select>
                        <button class="btn btn-secondary" data-role="node-scan">Обновить</button>
                    </div>
                    <div data-role="node-metrics-output" class="metrics-section"></div>
                </div>

                <div class="tab-pane" data-pane="server">
                    <div class="toolbar">
                        <select class="app-select app-select--compact" data-role="server-select"></select>
                    </div>
                    <div data-role="server-metrics-latest" class="metrics-section"></div>
                    <div data-role="server-metrics-history" class="metrics-section"></div>
                </div>
            </section>
        `;

        const nodeSelect = _el(root, '[data-role="node-select"]');
        const serverSelect = _el(root, '[data-role="server-select"]');
        const nodeScanBtn = _el(root, '[data-role="node-scan"]');

        try {
            _nodes = await NodesService.getAll();
        } catch {
            _nodes = [];
        }

        try {
            _servers = await ServersService.getAll();
        } catch {
            _servers = [];
        }

        _fillNodeSelect(nodeSelect);
        _fillServerSelect(serverSelect);

        nodeSelect.addEventListener('change', () => _loadNodeMetrics(root, nodeSelect.value));
        serverSelect.addEventListener('change', () => _loadServerMetrics(root, serverSelect.value));

        nodeScanBtn.addEventListener('click', async () => {
            const nodeId = nodeSelect.value;
            if (!nodeId) return;

            nodeScanBtn.disabled = true;
            try {
                await MetricsService.scanNodeHardware(nodeId);
                await _loadNodeMetrics(root, nodeId);
            } catch (e) {
                const out = _el(root, '[data-role="node-metrics-output"]');
                out.innerHTML = `<div class="empty-state"><div class="empty-state__text">Не удалось обновить метрики узла: ${e.message || e}</div></div>`;
            } finally {
                nodeScanBtn.disabled = false;
            }
        });

        root.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;

                root.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('is-active'));
                root.querySelectorAll('.tab-pane').forEach(x => x.classList.remove('is-active'));

                btn.classList.add('is-active');
                _el(root, `[data-pane="${tab}"]`).classList.add('is-active');
            });
        });

        await _loadNodeMetrics(root, '');
        await _loadServerMetrics(root, '');
    }

    return { render };
})();