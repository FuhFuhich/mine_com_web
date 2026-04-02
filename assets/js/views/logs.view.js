const LogsView = (() => {
    let _stompClient = null;
    let _currentServerId = null;
    let _autoScroll = true;
    let _filterText = '';
    let _allLines = [];

    /* ─── render shell ─── */
    function render() {
        const container = document.getElementById('logs-container');
        if (!container) return;
        container.innerHTML = `
        <div class="card table-card">
            <div class="card-header">
                <div class="card-title" data-i18n="logs.title">${I18n.t('logs.title')}</div>
            </div>
            <div class="logs-toolbar">
                <select id="logs-server-select" class="csel-native toolbar-select" style="min-width:190px">
                    <option value="">${I18n.t('logs.selectServer')}</option>
                </select>
                <button class="action-btn action-btn--start" id="logs-connect-btn" disabled>${I18n.t('logs.connect')}</button>
                <span class="logs-status-badge" id="logs-status"></span>
                <input type="text" id="logs-filter" class="logs-filter-input" placeholder="${I18n.t('logs.filter')}" style="flex:1;min-width:120px">
                <label class="check-option" style="white-space:nowrap">
                    <input type="checkbox" id="logs-autoscroll" checked> ${I18n.t('logs.autoScroll')}
                </label>
                <button class="action-btn action-btn--neutral" id="logs-clear-btn">${I18n.t('logs.clear')}</button>
                <button class="action-btn action-btn--neutral" id="logs-copy-btn">${I18n.t('logs.copy')}</button>
            </div>
            <div class="log-viewer" id="log-viewer"></div>
        </div>`;
        _populateServers();
        _bindEvents();
    }

    async function _populateServers() {
        const sel = document.getElementById('logs-server-select');
        if (!sel) return;
        try {
            const servers = await ServersService.getAll();
            sel.innerHTML = `<option value="">${I18n.t('logs.selectServer')}</option>` +
                servers.map(s => `<option value="${s.id}">${s.name} (${s.nodeName || s.nodeId || ''})</option>`).join('');
        } catch { /* ignore */ }
    }

    function _bindEvents() {
        document.getElementById('logs-server-select')?.addEventListener('change', e => {
            _currentServerId = e.target.value || null;
            document.getElementById('logs-connect-btn').disabled = !_currentServerId;
            if (!_currentServerId) _disconnect();
        });
        document.getElementById('logs-connect-btn')?.addEventListener('click', () => {
            if (_stompClient && _stompClient.connected) _disconnect();
            else _connect();
        });
        document.getElementById('logs-autoscroll')?.addEventListener('change', e => {
            _autoScroll = e.target.checked;
        });
        document.getElementById('logs-filter')?.addEventListener('input', e => {
            _filterText = e.target.value.toLowerCase();
            _renderLines();
        });
        document.getElementById('logs-clear-btn')?.addEventListener('click', () => {
            _allLines = [];
            const viewer = document.getElementById('log-viewer');
            if (viewer) viewer.innerHTML = '';
        });
        document.getElementById('logs-copy-btn')?.addEventListener('click', () => {
            const text = _allLines.map(l => l.raw).join('\n');
            navigator.clipboard.writeText(text).then(() => Toast.show('Copied', 'success')).catch(() => {});
        });
    }

    async function _connect() {
        if (!_currentServerId) return;
        const btn = document.getElementById('logs-connect-btn');
        if (btn) btn.textContent = I18n.t('logs.connecting');
        _setStatus('connecting');

        try {
            const recent = await ServersService.getRecentLogs(_currentServerId, 200);
            const lines = _normalizeRecentLogs(recent);
            for (const entry of lines) {
                if (typeof entry === 'string') {
                    _pushLine({ line: entry, level: _detectLevel(entry), timestamp: '' });
                } else {
                    _pushLine(entry);
                }
            }
        } catch (err) {
            const viewer = document.getElementById('log-viewer');
            if (viewer) {
                viewer.innerHTML = `<div class="log-line log-line--error">${_escHtml(err.message || 'Не удалось загрузить последние логи')}</div>`;
            }
            Toast.show(err.message || 'Не удалось загрузить последние логи', 'error');
        }

        _connectWs();
    }

    function _connectWs() {
        const token = localStorage.getItem('token');
        const wsBase = Api.getBase().replace(/^http/, 'ws');

        if (typeof StompJs === 'undefined') {
            _connectRawWs(wsBase, token);
            return;
        }

        _stompClient = new StompJs.Client({
            brokerURL: `${wsBase}/ws${token ? '?token=' + token : ''}`,
            reconnectDelay: 5000,
            onConnect: () => {
                _setStatus('connected');
                const btn = document.getElementById('logs-connect-btn');
                if (btn) btn.textContent = I18n.t('logs.disconnect');

                _stompClient.subscribe(`/topic/mc-servers/${_currentServerId}/logs`, msg => {
                    try {
                        const data = JSON.parse(msg.body);
                        _pushLine(data);
                    } catch { _pushRaw(msg.body); }
                });

                _stompClient.publish({ destination: `/app/mc-servers/${_currentServerId}/logs/start` });
            },
            onDisconnect: () => {
                _setStatus('disconnected');
                const btn = document.getElementById('logs-connect-btn');
                if (btn) btn.textContent = I18n.t('logs.connect');
            },
            onStompError: frame => {
                _setStatus('disconnected');
                Toast.show('WebSocket error: ' + (frame.headers?.message || ''), 'error');
            },
        });
        _stompClient.activate();
    }

    function _connectRawWs(wsBase, token) {
        const ws = new WebSocket(`${wsBase}/ws${token ? '?token=' + token : ''}`);
        ws.onopen = () => {
            _setStatus('connected');
            const btn = document.getElementById('logs-connect-btn');
            if (btn) btn.textContent = I18n.t('logs.disconnect');
            _stompClient = { connected: true, ws, deactivate() { ws.close(); } };
        };
        ws.onmessage = e => {
            try {
                const data = JSON.parse(e.data);
                if (data.line || data.message) _pushLine(data);
            } catch { _pushRaw(e.data); }
        };
        ws.onclose = () => {
            _setStatus('disconnected');
            const btn = document.getElementById('logs-connect-btn');
            if (btn) btn.textContent = I18n.t('logs.connect');
            _stompClient = null;
        };
        ws.onerror = () => { _setStatus('disconnected'); Toast.show('WebSocket error', 'error'); };
    }

    function _disconnect() {
        if (_stompClient) {
            if (_stompClient.connected && _stompClient.publish) {
                try { _stompClient.publish({ destination: `/app/mc-servers/${_currentServerId}/logs/stop` }); } catch { /* ok */ }
            }
            try { _stompClient.deactivate?.() || _stompClient.ws?.close?.(); } catch { /* ok */ }
            _stompClient = null;
        }
        _setStatus('disconnected');
        const btn = document.getElementById('logs-connect-btn');
        if (btn) btn.textContent = I18n.t('logs.connect');
    }

    function _pushLine(entry) {
        const line = entry.line || entry.message || '';
        const level = entry.level || _detectLevel(line);
        const ts = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '';
        _allLines.push({ raw: line, level, ts });
        if (_filterText && !line.toLowerCase().includes(_filterText)) return;
        _appendLineEl(line, level, ts);
    }

    function _pushRaw(text) {
        _allLines.push({ raw: text, level: 'INFO', ts: '' });
        if (_filterText && !text.toLowerCase().includes(_filterText)) return;
        _appendLineEl(text, 'INFO', '');
    }

    function _appendLineEl(line, level, ts) {
        const viewer = document.getElementById('log-viewer');
        if (!viewer) return;
        const el = document.createElement('div');
        el.className = `log-line log-line--${level.toLowerCase()}`;
        el.innerHTML = `${ts ? `<span class="log-ts">${ts}</span>` : ''}<span class="log-text">${_escHtml(line)}</span>`;
        viewer.appendChild(el);
        if (_autoScroll) viewer.scrollTop = viewer.scrollHeight;
    }

    function _renderLines() {
        const viewer = document.getElementById('log-viewer');
        if (!viewer) return;
        viewer.innerHTML = '';
        _allLines
            .filter(l => !_filterText || l.raw.toLowerCase().includes(_filterText))
            .forEach(l => _appendLineEl(l.raw, l.level, l.ts));
        if (_autoScroll) viewer.scrollTop = viewer.scrollHeight;
    }

    function _detectLevel(line) {
        const u = (line || '').toUpperCase();
        if (u.includes('ERROR') || u.includes('EXCEPTION') || u.includes('FATAL')) return 'ERROR';
        if (u.includes('WARN'))  return 'WARN';
        return 'INFO';
    }

    function _setStatus(state) {
        const el = document.getElementById('logs-status');
        if (!el) return;
        const map = {
            connecting:  { text: I18n.t('logs.connecting'),  cls: 'status-connecting' },
            connected:   { text: I18n.t('logs.connected'),    cls: 'status-online' },
            disconnected:{ text: I18n.t('logs.disconnected'), cls: 'status-offline' },
        };
        const info = map[state] || map.disconnected;
        el.innerHTML = `<span class="status-pill ${info.cls}"><span class="status-dot"></span>${info.text}</span>`;
    }

    function _escHtml(str) {
        return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function _normalizeRecentLogs(recent) {
        if (Array.isArray(recent)) {
            return recent;
        }
        if (recent?.lines && Array.isArray(recent.lines)) {
            return recent.lines;
        }
        if (typeof recent?.content === 'string') {
            return recent.content
                .split('\n')
                .filter(Boolean)
                .map(line => ({ line, level: _detectLevel(line), timestamp: '' }));
        }
        if (typeof recent === 'string') {
            return recent
                .split('\n')
                .filter(Boolean)
                .map(line => ({ line, level: _detectLevel(line), timestamp: '' }));
        }
        return [];
    }

    return { render };
})();
