const LogsView = (() => {
    let _stompClient = null;
    let _currentServerId = null;
    let _autoScroll = true;
    let _filterText = '';
    const STATE_KEY = 'mc.logs.state';
    let _allLines = [];


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
        return nextState;
    }

    function render() {
        const container = document.getElementById('logs-container');
        if (!container) return;
        const savedState = _loadState();
        _autoScroll = savedState.autoScroll !== false;
        _filterText = String(savedState.filterText || '').toLowerCase();
        _currentServerId = savedState.serverId || null;
        container.innerHTML = `
        <div class="card table-card logs-card">
            <div class="card-header">
                <div class="card-title" data-i18n="logs.title">${I18n.t('logs.title')}</div>
            </div>
            <div class="logs-toolbar">
                <select id="logs-server-select" class="csel-native toolbar-select" style="min-width:190px">
                    <option value="">${I18n.t('logs.selectServer')}</option>
                </select>
                <button class="action-btn action-btn--start" id="logs-connect-btn" disabled>${I18n.t('logs.connect')}</button>
                <input type="text" id="logs-filter" class="logs-filter-input" placeholder="${I18n.t('logs.filter')}" style="flex:1;min-width:120px">
                <label class="check-option" style="white-space:nowrap">
                    <input type="checkbox" id="logs-autoscroll" ${_autoScroll ? 'checked' : ''}> ${I18n.t('logs.autoScroll')}
                </label>
                <button class="action-btn action-btn--neutral" id="logs-clear-btn">${I18n.t('logs.clear')}</button>
                <button class="action-btn action-btn--neutral" id="logs-copy-btn">${I18n.t('logs.copy')}</button>
            </div>
            <div class="log-viewer" id="log-viewer"></div>
        </div>`;
        const filterInput = document.getElementById('logs-filter');
        if (filterInput) filterInput.value = savedState.filterText || '';
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
            const savedState = _loadState();
            if (savedState.serverId && servers.some(server => String(server.id) === String(savedState.serverId))) {
                sel.value = String(savedState.serverId);
                _currentServerId = sel.value;
                const connectBtn = document.getElementById('logs-connect-btn');
                if (connectBtn) connectBtn.disabled = !_currentServerId;
            }
        } catch { /* ignore */ }
    }

    function _bindEvents() {
        document.getElementById('logs-server-select')?.addEventListener('change', e => {
            _currentServerId = e.target.value || null;
            _saveState({ serverId: _currentServerId || '' });
            document.getElementById('logs-connect-btn').disabled = !_currentServerId;
            _clearViewer();
            if (!_currentServerId) _disconnect();
        });
        document.getElementById('logs-connect-btn')?.addEventListener('click', async () => {
            if (_stompClient && _stompClient.connected) {
                _disconnect();
                return;
            }
            await _connect();
        });
        document.getElementById('logs-autoscroll')?.addEventListener('change', e => {
            _autoScroll = e.target.checked;
            _saveState({ autoScroll: _autoScroll });
            if (_autoScroll) _scrollToBottom();
        });
        document.getElementById('logs-filter')?.addEventListener('input', e => {
            _filterText = e.target.value.toLowerCase();
            _saveState({ filterText: e.target.value || '' });
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

        _disconnectTransportOnly();
        _clearViewer();

        try {
            const recent = await Api.get(`/api/console/${_currentServerId}/log?lines=1000`);
            const lines = _normalizeRecentLogs(recent);
            for (const entry of lines) {
                if (typeof entry === 'string') {
                    _pushLine({ line: entry, level: _detectLevel(entry), timestamp: '' });
                } else {
                    _pushLine(entry);
                }
            }
            _scrollToBottom();
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
        if (typeof SockJS === 'undefined' || typeof StompJs === 'undefined') {
            const btn = document.getElementById('logs-connect-btn');
            if (btn) btn.textContent = I18n.t('logs.connect');
            return;
        }

        const socket = new SockJS(`${Api.getBase()}/ws`);
        _stompClient = new StompJs.Client({
            webSocketFactory: () => socket,
            reconnectDelay: 5000,
            connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
            onConnect: async () => {
                const btn = document.getElementById('logs-connect-btn');
                if (btn) btn.textContent = I18n.t('logs.disconnect');

                _stompClient.subscribe(`/topic/console/${_currentServerId}`, msg => {
                    try {
                        const data = JSON.parse(msg.body);
                        _pushLine(data);
                    } catch {
                        _pushRaw(msg.body);
                    }
                });

                try {
                    await Api.post(`/api/console/${_currentServerId}/start`);
                } catch {
                    /* non-fatal */
                }
            },
            onDisconnect: () => {
                const btn = document.getElementById('logs-connect-btn');
                if (btn) btn.textContent = I18n.t('logs.connect');
            },
            onStompError: frame => {
                const btn = document.getElementById('logs-connect-btn');
                if (btn) btn.textContent = I18n.t('logs.connect');
                Toast.show('WebSocket error: ' + (frame.headers?.message || ''), 'error');
            },
        });
        _stompClient.activate();
    }

    function _disconnectTransportOnly() {
        if (_stompClient) {
            try { _stompClient.deactivate?.() || _stompClient.ws?.close?.(); } catch { /* ok */ }
            _stompClient = null;
        }
    }

    function _disconnect() {
        if (_currentServerId) {
            Api.post(`/api/console/${_currentServerId}/stop`).catch(() => {});
        }
        _disconnectTransportOnly();
        const btn = document.getElementById('logs-connect-btn');
        if (btn) btn.textContent = I18n.t('logs.connect');
    }

    function _clearViewer() {
        _allLines = [];
        const viewer = document.getElementById('log-viewer');
        if (viewer) viewer.innerHTML = '';
    }

    function _pushLine(entry) {
        const line = entry.line || entry.message || '';
        const level = entry.level || _detectLevel(line);
        const ts = entry.timestamp
            ? new Date(entry.timestamp).toLocaleTimeString()
            : (entry.ts ? new Date(entry.ts).toLocaleTimeString() : '');
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
        el.className = `log-line log-line--${String(level || 'INFO').toLowerCase()}`;
        el.innerHTML = `${ts ? `<span class="log-ts">${ts}</span>` : ''}<span class="log-text">${_escHtml(line)}</span>`;
        viewer.appendChild(el);
        if (_autoScroll) _scrollToBottom();
    }

    function _renderLines() {
        const viewer = document.getElementById('log-viewer');
        if (!viewer) return;
        viewer.innerHTML = '';
        _allLines
            .filter(l => !_filterText || l.raw.toLowerCase().includes(_filterText))
            .forEach(l => _appendLineEl(l.raw, l.level, l.ts));
        if (_autoScroll) _scrollToBottom();
    }

    function _scrollToBottom() {
        const viewer = document.getElementById('log-viewer');
        if (!viewer) return;
        requestAnimationFrame(() => { viewer.scrollTop = viewer.scrollHeight; });
    }

    function _detectLevel(line) {
        const u = (line || '').toUpperCase();
        if (u.includes('ERROR') || u.includes('EXCEPTION') || u.includes('FATAL')) return 'ERROR';
        if (u.includes('WARN')) return 'WARN';
        return 'INFO';
    }

    function _escHtml(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
