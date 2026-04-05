const MetricsView = (() => {
    const RANGE_OPTIONS = [
        { key: '1h', hours: 1, points: 120, label: '1ч' },
        { key: '6h', hours: 6, points: 240, label: '6ч' },
        { key: '24h', hours: 24, points: 360, label: '24ч' },
        { key: '7d', hours: 24 * 7, points: 480, label: '7д' }
    ];

    const CHART_KEYS = ['cpu', 'ram', 'disk', 'players', 'tps', 'mspt'];
    let _nodes = [];
    let _servers = [];
    let _activeRange = '24h';
    const STATE_KEY = 'mc.metrics.state';
    let _serverRefreshTimer = null;
    let _tooltipHost = null;

    function _resolveRoot(root) {
        return root || document.getElementById('metrics-container');
    }


    function _loadState() {
        try {
            const parsed = JSON.parse(sessionStorage.getItem(STATE_KEY) || '{}');
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    function _saveState(patch = {}) {
        const nextState = { ..._loadState(), ...patch };
        try {
            sessionStorage.setItem(STATE_KEY, JSON.stringify(nextState));
        } catch {
            /* no-op */
        }
        if (nextState.range) _activeRange = nextState.range;
        return nextState;
    }

    function _t(key, fallback) {
        try {
            const value = I18n.t(key);
            return value === key ? fallback : value;
        } catch {
            return fallback;
        }
    }

    function _el(root, sel) {
        return root?.querySelector(sel);
    }

    function _fmtPercent(v, digits = 1) {
        if (v == null || Number.isNaN(Number(v))) return '—';
        return `${Number(v).toFixed(digits)}%`;
    }

    function _fmtInt(v) {
        if (v == null || Number.isNaN(Number(v))) return '—';
        return `${Math.round(Number(v))}`;
    }

    function _fmtGb(v) {
        if (v == null || Number.isNaN(Number(v))) return '—';
        return `${(Number(v) / 1024).toFixed(1)} GB`;
    }

    function _fmtDuration(sec) {
        if (sec == null || Number.isNaN(Number(sec))) return '—';
        const total = Math.max(0, Math.floor(Number(sec)));
        const days = Math.floor(total / 86400);
        const hours = Math.floor((total % 86400) / 3600);
        const minutes = Math.floor((total % 3600) / 60);
        if (days > 0) return `${days}д ${hours}ч ${minutes}м`;
        if (hours > 0) return `${hours}ч ${minutes}м`;
        return `${minutes}м`;
    }

    function _fmtDate(value) {
        if (!value) return '—';
        try {
            return new Date(value).toLocaleString();
        } catch {
            return '—';
        }
    }

    function _fmtDateShort(value) {
        if (!value) return '—';
        try {
            const date = new Date(value);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '—';
        }
    }

    function _normalizeStatus(status) {
        const raw = String(status || '').trim().toLowerCase();
        if (!raw) return 'offline';
        if (['running', 'online', 'started'].includes(raw)) return 'online';
        if (['stopped', 'offline', 'shutdown', 'undeployed'].includes(raw)) return 'offline';
        return raw;
    }

    function _statusLabel(status) {
        const normalized = _normalizeStatus(status);
        if (normalized === 'online') return _t('servers.status.ONLINE', 'Онлайн');
        if (normalized === 'offline') return _t('servers.status.OFFLINE', 'Оффлайн');
        const key = `servers.status.${String(status || '').toUpperCase()}`;
        const translated = _t(key, normalized);
        return translated || normalized;
    }

    function _metricCard(label, value, sub = '', tone = 'default') {
        return `
            <div class="metric-hero-card metric-hero-card--${tone}">
                <div class="metric-hero-card__label">${label}</div>
                <div class="metric-hero-card__value">${value}</div>
                ${sub ? `<div class="metric-hero-card__sub">${sub}</div>` : ''}
            </div>
        `;
    }

    function _historyValue(item, key) {
        const map = {
            cpu: item.cpuUsagePercent,
            ram: item.ramUsedMb,
            disk: item.diskUsedMb ?? item.diskUsedWorldMb,
            players: item.playersOnline,
            tps: item.tps,
            mspt: item.mspt
        };
        const value = map[key];
        return value == null || Number.isNaN(Number(value)) ? null : Number(value);
    }

    function _chartTitle(key) {
        return {
            cpu: _t('metrics.cpu', 'CPU'),
            ram: _t('metrics.ram', 'RAM'),
            disk: _t('metrics.disk', 'Disk'),
            players: _t('metrics.players', 'Players'),
            tps: _t('metrics.tps', 'TPS'),
            mspt: _t('metrics.mspt', 'MSPT')
        }[key] || key;
    }

    function _chartFormatter(key, value) {
        if (value == null || Number.isNaN(Number(value))) return '—';
        const num = Number(value);
        if (key === 'cpu') return `${num.toFixed(1)}%`;
        if (key === 'ram' || key === 'disk') return `${(num / 1024).toFixed(2)} GB`;
        if (key === 'players') return `${Math.round(num)}`;
        if (key === 'tps' || key === 'mspt') return `${num.toFixed(2)}`;
        return `${num}`;
    }

    function _chartAxisFormatter(key, value) {
        if (value == null || Number.isNaN(Number(value))) return '—';
        const num = Number(value);
        if (key === 'cpu') return `${num.toFixed(0)}%`;
        if (key === 'ram' || key === 'disk') return `${(num / 1024).toFixed(1)} GB`;
        if (key === 'players') return `${Math.round(num)}`;
        return `${num.toFixed(1)}`;
    }

    function _buildChart(metricKey, history) {
        const points = history
            .map(item => ({ at: item.recordedAt, value: _historyValue(item, metricKey) }))
            .filter(item => item.value != null);

        if (!points.length) return null;

        const width = 620;
        const height = 240;
        const left = 52;
        const right = 18;
        const top = 18;
        const bottom = 34;
        const chartW = width - left - right;
        const chartH = height - top - bottom;

        let min = Math.min(...points.map(p => p.value));
        let max = Math.max(...points.map(p => p.value));
        if (min === max) {
            const pad = min === 0 ? 1 : Math.abs(min * 0.15);
            min -= pad;
            max += pad;
        }
        const range = max - min || 1;

        const mapped = points.map((point, index) => {
            const x = left + (chartW * index) / Math.max(points.length - 1, 1);
            const y = top + chartH - ((point.value - min) / range) * chartH;
            return { ...point, x, y };
        });

        const line = mapped.map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
        const area = `${line} L ${mapped[mapped.length - 1].x.toFixed(2)} ${(top + chartH).toFixed(2)} L ${mapped[0].x.toFixed(2)} ${(top + chartH).toFixed(2)} Z`;
        const yTicks = [max, min + range / 2, min];
        const xLabels = [mapped[0], mapped[Math.floor((mapped.length - 1) / 2)], mapped[mapped.length - 1]];

        const hitRects = mapped.map((point, idx) => {
            const prevX = idx === 0 ? left : (mapped[idx - 1].x + point.x) / 2;
            const nextX = idx === mapped.length - 1 ? left + chartW : (point.x + mapped[idx + 1].x) / 2;
            const widthRect = Math.max(12, nextX - prevX);
            const payload = encodeURIComponent(JSON.stringify({
                title: _chartTitle(metricKey),
                time: _fmtDate(point.at),
                value: _chartFormatter(metricKey, point.value)
            }));
            return `<rect class="metrics-chart-hit" x="${prevX.toFixed(2)}" y="${top}" width="${widthRect.toFixed(2)}" height="${chartH}" data-point="${payload}"></rect>`;
        }).join('');

        const yLabels = yTicks.map((tick, idx) => {
            const y = top + (chartH * idx) / 2;
            return `
                <g>
                    <line x1="${left}" y1="${y.toFixed(2)}" x2="${left + chartW}" y2="${y.toFixed(2)}" class="metrics-line-chart__grid ${idx === 2 ? 'metrics-line-chart__grid--strong' : ''}" />
                    <text x="${left - 10}" y="${(y + 4).toFixed(2)}" text-anchor="end" class="metrics-line-chart__axis-label">${_chartAxisFormatter(metricKey, tick)}</text>
                </g>
            `;
        }).join('');

        const xAxisLabels = xLabels.map(point => `
            <text x="${point.x.toFixed(2)}" y="${height - 8}" text-anchor="middle" class="metrics-line-chart__axis-label">${_fmtDateShort(point.at)}</text>
        `).join('');

        const svg = `
            <svg viewBox="0 0 ${width} ${height}" class="metrics-line-chart__svg" preserveAspectRatio="none" aria-hidden="true">
                ${yLabels}
                <line x1="${left}" y1="${top + chartH}" x2="${left + chartW}" y2="${top + chartH}" class="metrics-line-chart__axis" />
                <line x1="${left}" y1="${top}" x2="${left}" y2="${top + chartH}" class="metrics-line-chart__axis" />
                <path d="${area}" class="metrics-line-chart__area"></path>
                <path d="${line}" class="metrics-line-chart__line"></path>
                ${mapped.map(point => `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3.5" class="metrics-line-chart__dot"></circle>`).join('')}
                ${xAxisLabels}
                <g>${hitRects}</g>
            </svg>
        `;

        return { svg, points, min, max, latest: points[points.length - 1].value, prev: points.length > 1 ? points[points.length - 2].value : points[points.length - 1].value, firstAt: points[0].at, lastAt: points[points.length - 1].at };
    }

    function _renderChartCard(metricKey, history) {
        const chart = _buildChart(metricKey, history);
        if (!chart) {
            return `
                <article class="metrics-chart-card metrics-chart-card--${metricKey}">
                    <div class="metrics-chart-card__head">
                        <div>
                            <div class="metrics-chart-card__eyebrow">${_t('metrics.history', 'История')}</div>
                            <div class="metrics-chart-card__title">${_chartTitle(metricKey)}</div>
                        </div>
                    </div>
                    <div class="metrics-chart-card__empty">${_t('metrics.noSeries', 'Данные пока не собирались')}</div>
                </article>
            `;
        }

        const delta = Number(chart.latest) - Number(chart.prev);
        const deltaLabel = delta === 0
            ? _t('metrics.noChanges', 'без изменений')
            : `${delta > 0 ? '+' : ''}${_chartFormatter(metricKey, delta)}`;

        return `
            <article class="metrics-chart-card metrics-chart-card--${metricKey}">
                <div class="metrics-chart-card__head">
                    <div>
                        <div class="metrics-chart-card__eyebrow">${_t('metrics.history', 'История')}</div>
                        <div class="metrics-chart-card__title">${_chartTitle(metricKey)}</div>
                    </div>
                    <div class="metrics-chart-card__stat-block">
                        <div class="metrics-chart-card__latest">${_chartFormatter(metricKey, chart.latest)}</div>
                        <div class="metrics-chart-card__delta">${deltaLabel}</div>
                    </div>
                </div>
                <div class="metrics-line-chart" data-chart-card>
                    ${chart.svg}
                </div>
                <div class="metrics-chart-card__foot">
                    <span>${_t('metrics.min', 'min')} ${_chartFormatter(metricKey, chart.min)}</span>
                    <span>${_t('metrics.max', 'max')} ${_chartFormatter(metricKey, chart.max)}</span>
                    <span>${chart.points.length} ${_t('metrics.points', 'точек')}</span>
                </div>
                <div class="metrics-chart-card__range">${_fmtDate(chart.firstAt)} — ${_fmtDate(chart.lastAt)}</div>
            </article>
        `;
    }

    function _renderNodePanel(container, payload) {
        const usage = payload?.usage || {};
        const hardware = payload?.hardware || {};
        const cpu = usage.cpuUsagePct ?? usage.cpuPercent ?? usage.cpuUsage;
        const ramUsed = usage.ramUsedMb ?? usage.usedRamMb ?? usage.memoryUsedMb;
        const ramTotal = usage.ramTotalMb ?? usage.totalRamMb ?? usage.memoryTotalMb ?? hardware.ramTotalMb;
        const diskUsed = usage.diskUsedMb ?? usage.usedDiskMb;
        const diskTotal = usage.diskTotalMb ?? usage.totalDiskMb;
        const dockerRunning = usage.dockerContainersRunning ?? usage.containersRunning;
        const dockerTotal = usage.dockerContainersTotal ?? usage.containersTotal;
        const scannedAt = usage.recordedAt ?? usage.collectedAt ?? hardware.scannedAt;
        const cpuLabel = hardware.cpuModel || _t('metrics.nodeUsageTitle', 'Метрики узла');
        const osLabel = [hardware.osName, hardware.osVersion].filter(Boolean).join(' ') || '—';

        container.innerHTML = `
            <div class="metrics-section-heading">
                <div class="metrics-section-heading__eyebrow">${_t('metrics.live', 'Live')}</div>
                <h3 class="metrics-section-heading__title">${_t('metrics.nodeUsageTitle', 'Метрики узла')}</h3>
            </div>
            <div class="metrics-hero-grid metrics-hero-grid--node">
                ${_metricCard(_t('metrics.cpu', 'CPU'), _fmtPercent(cpu), cpuLabel, 'accent')}
                ${_metricCard(_t('metrics.ram', 'RAM'), `${_fmtGb(ramUsed)} / ${_fmtGb(ramTotal)}`, _fmtPercent(usage.ramUsagePercent), 'accent')}
                ${_metricCard(_t('metrics.disk', 'Disk'), `${_fmtGb(diskUsed)} / ${_fmtGb(diskTotal)}`, _fmtPercent(usage.diskUsagePercent), 'accent')}
                ${_metricCard(_t('metrics.docker', 'Docker'), dockerRunning != null || dockerTotal != null ? `${dockerRunning ?? '—'} / ${dockerTotal ?? '—'}` : '—', _t('metrics.runningTotal', 'running / total'), 'neutral')}
                ${_metricCard(_t('metrics.os', 'OS'), osLabel, hardware.kernel || '', 'neutral')}
                ${_metricCard(_t('metrics.lastUpdate', 'Последнее обновление'), _fmtDate(scannedAt), '', 'neutral')}
            </div>
        `;
    }

    function _renderServerSummary(container, runtime, rangeLabel) {
        const status = _statusLabel(runtime?.status);
        const ramUsed = runtime?.ramUsedMb;
        const ramTotal = runtime?.ramTotalMb;
        const diskUsed = runtime?.diskUsedMb ?? runtime?.diskUsedWorldMb;
        const diskTotal = runtime?.diskTotalMb;

        container.innerHTML = `
            <div class="metrics-section-heading metrics-section-heading--spaced">
                <div class="metrics-section-heading__eyebrow">${_t('metrics.live', 'Live')}</div>
                <h3 class="metrics-section-heading__title">${_t('metrics.serverMetricsTitle', 'Метрики MC-сервера')}</h3>
            </div>
            <div class="metrics-hero-panel">
                <div class="metrics-hero-panel__top">
                    <div>
                        <div class="metrics-hero-panel__eyebrow">${_t('metrics.liveSnapshot', 'Live snapshot')}</div>
                        <div class="metrics-hero-panel__title">${_t('metrics.serverMetricsTitle', 'Метрики MC-сервера')}</div>
                        <div class="metrics-hero-panel__subtitle">${_t('metrics.rangeInfo', 'История за выбранный диапазон и текущий снимок без перезагрузки страницы')}: ${rangeLabel}</div>
                    </div>
                    <div class="metrics-hero-panel__stamp">${_fmtDate(runtime?.recordedAt)}</div>
                </div>
                <div class="metrics-hero-grid metrics-hero-grid--compact">
                    ${_metricCard(_t('servers.table.status', 'Статус'), status, runtime?.storageType || '—', _normalizeStatus(runtime?.status) === 'online' ? 'success' : 'neutral')}
                    ${_metricCard(_t('metrics.cpu', 'CPU'), _fmtPercent(runtime?.cpuUsagePercent), _t('metrics.currentLoad', 'текущая загрузка'), 'accent')}
                    ${_metricCard(_t('metrics.ram', 'RAM'), `${_fmtGb(ramUsed)} / ${_fmtGb(ramTotal)}`, _fmtPercent(runtime?.ramUsagePercent), 'accent')}
                    ${_metricCard(_t('metrics.disk', 'Disk'), `${_fmtGb(diskUsed)} / ${_fmtGb(diskTotal)}`, _fmtPercent(runtime?.diskUsagePercent), 'accent')}
                    ${_metricCard(_t('metrics.players', 'Игроки'), _fmtInt(runtime?.playersOnline), _fmtDuration(runtime?.uptimeSeconds), 'neutral')}
                    ${_metricCard(_t('backups.title', 'Бэкапы'), _fmtInt(runtime?.totalBackups), runtime?.backupsSizeMbTotal != null ? _fmtGb(runtime.backupsSizeMbTotal) : '', 'neutral')}
                </div>
            </div>
        `;
    }

    function _renderHistoryTable(container, history) {
        const rows = history.slice().reverse();
        if (!rows.length) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <div class="metrics-history-table-wrap">
                <div class="metrics-section-heading metrics-section-heading--table">
                    <div class="metrics-section-heading__eyebrow">${_t('metrics.history', 'История')}</div>
                    <h3 class="metrics-section-heading__title">${_t('metrics.historyPoints', 'Точки истории')}</h3>
                </div>
                <div class="metrics-history-scroll">
                    ${rows.map(item => `
                        <div class="metrics-history-row">
                            <div class="metrics-history-row__time">${_fmtDate(item.recordedAt)}</div>
                            <div class="metrics-history-row__values">
                                <span>CPU: ${_fmtPercent(item.cpuUsagePercent)}</span>
                                <span>RAM: ${_fmtGb(item.ramUsedMb)} / ${_fmtGb(item.ramTotalMb)}</span>
                                <span>Disk: ${_fmtGb(item.diskUsedMb ?? item.diskUsedWorldMb)} / ${_fmtGb(item.diskTotalMb)}</span>
                                <span>${_t('metrics.players', 'Игроки')}: ${_fmtInt(item.playersOnline)}</span>
                                <span>TPS: ${item.tps != null ? Number(item.tps).toFixed(2) : '—'}</span>
                                <span>MSPT: ${item.mspt != null ? Number(item.mspt).toFixed(2) : '—'}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function _ensureTooltipHost() {
        if (!_tooltipHost) {
            _tooltipHost = document.createElement('div');
            _tooltipHost.className = 'metrics-chart-tooltip metrics-chart-tooltip--global';
            _tooltipHost.hidden = true;
            document.body.appendChild(_tooltipHost);
        }
        return _tooltipHost;
    }

    function _showTooltip(event, payload) {
        const host = _ensureTooltipHost();
        host.innerHTML = `
            <div class="metrics-chart-tooltip__title">${payload.title}</div>
            <div class="metrics-chart-tooltip__row">${payload.time}</div>
            <div class="metrics-chart-tooltip__row metrics-chart-tooltip__row--strong">${payload.value}</div>
        `;
        host.hidden = false;
        host.style.left = `${event.clientX + 16}px`;
        host.style.top = `${event.clientY + 16}px`;
    }

    function _hideTooltip() {
        if (_tooltipHost) _tooltipHost.hidden = true;
    }

    function _attachChartTooltips(container) {
        container.querySelectorAll('.metrics-chart-hit').forEach(hit => {
            hit.addEventListener('mouseenter', event => {
                try {
                    _showTooltip(event, JSON.parse(decodeURIComponent(hit.dataset.point || '')));
                } catch {
                    _hideTooltip();
                }
            });
            hit.addEventListener('mousemove', event => {
                try {
                    _showTooltip(event, JSON.parse(decodeURIComponent(hit.dataset.point || '')));
                } catch {
                    _hideTooltip();
                }
            });
            hit.addEventListener('mouseleave', _hideTooltip);
        });
    }

    function _renderServerCharts(container, history) {
        container.innerHTML = `
            <div class="metrics-chart-grid">
                ${CHART_KEYS.map(key => _renderChartCard(key, history)).join('')}
            </div>
        `;
        _attachChartTooltips(container);
    }

    async function _loadNodeMetrics(root, nodeId) {
        const output = _el(root, '[data-role="node-output"]');
        if (!nodeId) {
            output.innerHTML = `<div class="empty-state"><div class="empty-state__text">${_t('metrics.selectNodeHint', 'Выберите физический узел')}</div></div>`;
            return;
        }

        output.innerHTML = `<div class="loading-state">${_t('metrics.loadingNode', 'Загрузка метрик узла...')}</div>`;
        try {
            const [usageResult, hardwareResult] = await Promise.allSettled([
                MetricsService.getNodeUsage(nodeId),
                MetricsService.getNodeHardware(nodeId)
            ]);
            const usage = usageResult.status === 'fulfilled' ? usageResult.value : null;
            const hardware = hardwareResult.status === 'fulfilled' ? hardwareResult.value : null;
            if (!usage && !hardware) throw new Error(_t('metrics.nodeLoadFailed', 'Не удалось загрузить метрики узла'));
            _renderNodePanel(output, { usage, hardware });
        } catch (e) {
            output.innerHTML = `<div class="empty-state"><div class="empty-state__text">${_t('metrics.nodeLoadFailed', 'Не удалось загрузить метрики узла')}: ${e.message || e}</div></div>`;
        }
    }

    async function _loadServerMetrics(root, serverId, { refreshOnly = false } = {}) {
        const summary = _el(root, '[data-role="server-summary"]');
        const charts = _el(root, '[data-role="server-charts"]');
        const table = _el(root, '[data-role="server-history-table"]');

        if (!serverId) {
            summary.innerHTML = `<div class="empty-state"><div class="empty-state__text">${_t('metrics.selectServerHint', 'Выберите Minecraft-сервер')}</div></div>`;
            charts.innerHTML = '';
            table.innerHTML = '';
            return;
        }

        if (!refreshOnly) {
            summary.innerHTML = `<div class="loading-state">${_t('metrics.loadingServer', 'Загрузка текущего снимка...')}</div>`;
            charts.innerHTML = `<div class="loading-state">${_t('metrics.loadingHistory', 'Загрузка истории метрик...')}</div>`;
            table.innerHTML = '';
        }

        const selectedRange = RANGE_OPTIONS.find(item => item.key === _activeRange) || RANGE_OPTIONS[2];

        try {
            const runtime = await MetricsService.getServerRuntime(serverId);
            _renderServerSummary(summary, runtime || {}, selectedRange.label);
        } catch (e) {
            summary.innerHTML = `<div class="empty-state"><div class="empty-state__text">${_t('metrics.serverLoadFailed', 'Не удалось загрузить текущий снимок')}: ${e.message || e}</div></div>`;
        }

        if (refreshOnly) return;

        try {
            const [seriesPayload, historyPayload] = await Promise.all([
                MetricsService.getServerSeries(serverId, selectedRange.hours, selectedRange.points),
                MetricsService.getServerHistory(serverId, selectedRange.hours, 0, 120)
            ]);
            const series = MetricsService.normalizePage(seriesPayload);
            const history = MetricsService.normalizePage(historyPayload);
            _renderServerCharts(charts, Array.isArray(seriesPayload) ? seriesPayload : series);
            _renderHistoryTable(table, history);
        } catch (e) {
            charts.innerHTML = `<div class="empty-state"><div class="empty-state__text">${_t('metrics.historyLoadFailed', 'Не удалось загрузить историю метрик')}: ${e.message || e}</div></div>`;
            table.innerHTML = '';
        }
    }

    function _fillNodeSelect(select) {
        select.innerHTML = ['<option value="">— ' + _t('metrics.selectNodeValue', 'Выберите узел') + ' —</option>']
            .concat(_nodes.map(node => `<option value="${node.id}">${node.name || node.ipAddress || node.id}</option>`))
            .join('');
    }

    function _fillServerSelect(select) {
        select.innerHTML = ['<option value="">— ' + _t('metrics.selectServerValue', 'Выберите сервер') + ' —</option>']
            .concat(_servers.map(server => `<option value="${server.id}">${server.name || server.id}</option>`))
            .join('');
    }

    function _startServerPolling(root) {
        _stopServerPolling();
        _serverRefreshTimer = window.setInterval(() => {
            if (!root || !root.closest('.view.active')) return;
            const serverId = _el(root, '[data-role="server-select"]')?.value;
            if (!serverId) return;
            _loadServerMetrics(root, serverId, { refreshOnly: true }).catch(() => {});
        }, 30000);
    }

    function _stopServerPolling() {
        if (_serverRefreshTimer) {
            window.clearInterval(_serverRefreshTimer);
            _serverRefreshTimer = null;
        }
    }

    async function render(root) {
        root = _resolveRoot(root);
        if (!root) return;
        _stopServerPolling();
        _hideTooltip();

        const savedState = _loadState();
        if (savedState.range && RANGE_OPTIONS.some(item => item.key === savedState.range)) {
            _activeRange = savedState.range;
        }

        root.innerHTML = `
            <section class="panel metrics-shell metrics-shell--tight">
                <section class="metrics-block metrics-block--node">
                    <div class="metrics-toolbar metrics-toolbar--compact">
                        <select id="metrics-node-select" class="toolbar-select csel-native metrics-control" data-role="node-select"></select>
                        <button class="metrics-button metrics-button--ghost" data-role="node-scan">${_t('metrics.refresh', 'Обновить')}</button>
                    </div>
                    <div data-role="node-output"></div>
                </section>

                <section class="metrics-block metrics-block--server">
                    <div class="metrics-toolbar metrics-toolbar--compact metrics-toolbar--server">
                        <select id="metrics-mc-select" class="toolbar-select csel-native metrics-control metrics-control--server" data-role="server-select"></select>
                        <div class="metrics-range-switcher" data-role="range-switcher">
                            ${RANGE_OPTIONS.map(item => `<button class="metrics-range-switcher__btn ${item.key === _activeRange ? 'is-active' : ''}" data-range="${item.key}">${item.label}</button>`).join('')}
                        </div>
                        <button class="metrics-button metrics-button--ghost" data-role="server-refresh">${_t('metrics.refresh', 'Обновить')}</button>
                        <button class="metrics-button metrics-button--accent" data-role="server-collect">${_t('metrics.collectNow', 'Снять сейчас')}</button>
                    </div>
                    <div data-role="server-summary"></div>
                    <div data-role="server-charts"></div>
                    <div data-role="server-history-table"></div>
                </section>
            </section>
        `;

        const nodeSelect = _el(root, '[data-role="node-select"]');
        const serverSelect = _el(root, '[data-role="server-select"]');
        const nodeScanBtn = _el(root, '[data-role="node-scan"]');
        const serverRefreshBtn = _el(root, '[data-role="server-refresh"]');
        const serverCollectBtn = _el(root, '[data-role="server-collect"]');

        try { _nodes = await NodesService.getAll(); } catch { _nodes = []; }
        try { _servers = await ServersService.getAll(); } catch { _servers = []; }

        _fillNodeSelect(nodeSelect);
        _fillServerSelect(serverSelect);

        const restoredNodeId = savedState.nodeId && _nodes.some(node => String(node.id) === String(savedState.nodeId))
            ? String(savedState.nodeId)
            : '';
        const restoredServerId = savedState.serverId && _servers.some(server => String(server.id) === String(savedState.serverId))
            ? String(savedState.serverId)
            : '';

        nodeSelect.value = restoredNodeId;
        serverSelect.value = restoredServerId;

        nodeSelect.addEventListener('change', () => {
            _saveState({ nodeId: nodeSelect.value || '' });
            _loadNodeMetrics(root, nodeSelect.value);
        });
        serverSelect.addEventListener('change', () => {
            _saveState({ serverId: serverSelect.value || '' });
            _loadServerMetrics(root, serverSelect.value);
        });

        nodeScanBtn.addEventListener('click', async () => {
            const nodeId = nodeSelect.value;
            if (!nodeId) return;
            nodeScanBtn.disabled = true;
            try {
                await MetricsService.scanNodeHardware(nodeId);
                await _loadNodeMetrics(root, nodeId);
            } finally {
                nodeScanBtn.disabled = false;
            }
        });

        serverRefreshBtn.addEventListener('click', async () => {
            const serverId = serverSelect.value;
            if (!serverId) return;
            serverRefreshBtn.disabled = true;
            try { await _loadServerMetrics(root, serverId); } finally { serverRefreshBtn.disabled = false; }
        });

        serverCollectBtn.addEventListener('click', async () => {
            const serverId = serverSelect.value;
            if (!serverId) return;
            serverCollectBtn.disabled = true;
            try {
                await MetricsService.collectServerMetrics(serverId);
                await _loadServerMetrics(root, serverId);
            } catch (e) {
                const summary = _el(root, '[data-role="server-summary"]');
                summary.innerHTML = `<div class="empty-state"><div class="empty-state__text">${_t('metrics.collectFailed', 'Не удалось снять метрики вручную')}: ${e.message || e}</div></div>`;
            } finally {
                serverCollectBtn.disabled = false;
            }
        });

        root.querySelectorAll('[data-range]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const next = btn.dataset.range;
                if (!next || next === _activeRange) return;
                _activeRange = next;
                _saveState({ range: _activeRange });
                root.querySelectorAll('[data-range]').forEach(item => item.classList.toggle('is-active', item.dataset.range === _activeRange));
                const serverId = serverSelect.value;
                if (serverId) await _loadServerMetrics(root, serverId);
            });
        });

        _saveState({
            range: _activeRange,
            nodeId: nodeSelect.value || '',
            serverId: serverSelect.value || ''
        });

        await _loadNodeMetrics(root, nodeSelect.value || '');
        await _loadServerMetrics(root, serverSelect.value || '');
        _startServerPolling(root);
    }

    return { render };
})();
