const ConfigsView = (() => {
    let _currentServerId = null;
    let _currentDir = '/';
    let _currentPath = null;
    let _originalContent = '';
    let _isDirty = false;

    const COMMON_CONFIGS = [
        { path: '/server.properties', label: 'server.properties', warn: true },
        { path: '/eula.txt', label: 'eula.txt', warn: true },
        { path: '/ops.json', label: 'ops.json' },
        { path: '/whitelist.json', label: 'whitelist.json' },
        { path: '/banned-players.json', label: 'banned-players.json' },
        { path: '/banned-ips.json', label: 'banned-ips.json' },
        { path: '/paper-global.yml', label: 'paper-global.yml' },
        { path: '/paper-world-defaults.yml', label: 'paper-world-defaults.yml' },
        { path: '/spigot.yml', label: 'spigot.yml' },
        { path: '/bukkit.yml', label: 'bukkit.yml' },
        { path: '/config', label: 'config/', directory: true },
        { path: '/plugins', label: 'plugins/', directory: true }
    ];

    function render() {
        const container = document.getElementById('configs-container');
        if (!container) return;
        container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div class="card-title">${I18n.t('configs.title')}</div>
                <select id="configs-server-select" class="csel-native toolbar-select" style="min-width:220px">
                    <option value="">${I18n.t('configs.selectServer')}</option>
                </select>
            </div>
            <div id="configs-body">
                <div class="placeholder-empty">
                    <div class="placeholder-icon">✎</div>
                    <div class="placeholder-hint">${I18n.t('configs.selectHint')}</div>
                </div>
            </div>
        </div>`;
        _populateServers();
        document.getElementById('configs-server-select')?.addEventListener('change', e => {
            _currentServerId = e.target.value || null;
            _currentDir = '/';
            _currentPath = null;
            _originalContent = '';
            _isDirty = false;
            if (_currentServerId) _renderLayout();
            else _showHint();
        });
    }

    async function _populateServers() {
        const sel = document.getElementById('configs-server-select');
        if (!sel) return;
        try {
            const servers = await ServersService.getAll();
            sel.innerHTML = `<option value="">${I18n.t('configs.selectServer')}</option>` +
                servers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        } catch {}
    }

    function _showHint() {
        const body = document.getElementById('configs-body');
        if (!body) return;
        body.innerHTML = `<div class="placeholder-empty">
            <div class="placeholder-icon">✎</div>
            <div class="placeholder-hint">${I18n.t('configs.selectHint')}</div>
        </div>`;
    }

    function _renderLayout() {
        const body = document.getElementById('configs-body');
        if (!body) return;
        body.innerHTML = `
        <div class="configs-layout configs-layout--browser">
            <div class="configs-sidebar">
                <div class="configs-section-label">${I18n.t('configs.commonFiles')}</div>
                <ul class="configs-file-list">
                    ${COMMON_CONFIGS.map(item => `
                        <li class="config-file-item" data-common-path="${item.path}" data-common-warn="${item.warn ? '1' : '0'}" data-common-dir="${item.directory ? '1' : '0'}">
                            <span>${item.directory ? '▣' : (item.warn ? '!' : '▤')}</span>
                            <span>${item.label}</span>
                        </li>
                    `).join('')}
                </ul>

                <div class="configs-section-label" style="margin-top:12px">${I18n.t('configs.allFiles')}</div>
                <div class="configs-browser-bar">
                    <button class="action-btn action-btn--neutral" id="configs-up-btn">${I18n.t('configs.up')}</button>
                    <div class="configs-browser-path" id="configs-browser-path">/</div>
                </div>
                <div id="configs-tree-area" class="configs-tree-area">Loading...</div>
            </div>
            <div class="configs-editor-area">
                <div class="configs-editor-toolbar" id="configs-toolbar" style="display:none">
                    <span class="configs-file-path" id="configs-current-path"></span>
                    <span class="configs-dirty-badge" id="configs-dirty" style="display:none">${I18n.t('configs.dirty')}</span>
                    <div style="flex:1"></div>
                    <button class="action-btn action-btn--start" id="configs-save-btn">${I18n.t('configs.save')}</button>
                    <button class="action-btn action-btn--neutral" id="configs-restart-btn">${I18n.t('configs.restart')}</button>
                </div>
                <div id="configs-warning" class="configs-warning" style="display:none">
                    ! ${I18n.t('configs.warningFile')}
                </div>
                <textarea id="configs-editor" class="configs-editor" spellcheck="false" placeholder="${I18n.t('configs.selectFile')}"></textarea>
            </div>
        </div>`;

        document.querySelectorAll('[data-common-path]').forEach(item => {
            item.addEventListener('click', () => {
                const path = item.dataset.commonPath;
                const warn = item.dataset.commonWarn === '1';
                const isDirectory = item.dataset.commonDir === '1';
                if (isDirectory) {
                    _navigate(path);
                } else {
                    _openFile(path, warn);
                }
            });
        });

        document.getElementById('configs-up-btn')?.addEventListener('click', () => {
            if (_currentDir === '/') return;
            const parts = _currentDir.split('/').filter(Boolean);
            parts.pop();
            _navigate('/' + parts.join('/'));
        });
        document.getElementById('configs-save-btn')?.addEventListener('click', _saveFile);
        document.getElementById('configs-restart-btn')?.addEventListener('click', _restartServer);
        document.getElementById('configs-editor')?.addEventListener('input', () => {
            const value = document.getElementById('configs-editor').value;
            _setDirty(value !== _originalContent);
        });

        _navigate('/');
    }

    async function _navigate(path) {
        if (_isDirty) {
            const ok = confirm(I18n.t('configs.unsavedConfirm'));
            if (!ok) return;
        }

        _currentDir = normalizeDir(path);
        _highlightActive(null);
        const pathEl = document.getElementById('configs-browser-path');
        if (pathEl) pathEl.textContent = _currentDir;

        const area = document.getElementById('configs-tree-area');
        if (!area || !_currentServerId) return;
        area.innerHTML = `<div class="configs-tree-empty">Loading...</div>`;

        try {
            const items = await FilesService.getTree(_currentServerId, _currentDir);
            const filtered = (Array.isArray(items) ? items : [])
                .filter(item => item && (item.directory || isConfigLikeFile(item.name)))
                .filter(item => !isHiddenNoise(item.name))
                .sort((a, b) => {
                    if (Boolean(b.directory) !== Boolean(a.directory)) return a.directory ? -1 : 1;
                    return String(a.name || '').localeCompare(String(b.name || ''));
                });

            if (!filtered.length) {
                area.innerHTML = `<div class="configs-tree-empty">${I18n.t('configs.noFiles')}</div>`;
                return;
            }

            area.innerHTML = filtered.map(item => `
                <div class="config-file-item config-file-item--tree" data-tree-path="${item.path}" data-tree-type="${item.directory ? 'directory' : 'file'}">
                    <span>${item.directory ? '▣' : '▤'}</span>
                    <span>${item.name}</span>
                </div>
            `).join('');

            area.querySelectorAll('[data-tree-path]').forEach(item => {
                item.addEventListener('click', () => {
                    const targetPath = item.dataset.treePath;
                    const type = item.dataset.treeType;
                    if (type === 'directory') {
                        _navigate(targetPath);
                    } else {
                        _openFile(targetPath, false);
                    }
                });
            });
        } catch (err) {
            area.innerHTML = `<div class="configs-tree-empty">${escapeHtml(err.message || I18n.t('configs.noFiles'))}</div>`;
        }
    }

    async function _openFile(path, warn) {
        if (_isDirty && path !== _currentPath) {
            const ok = confirm(I18n.t('configs.unsavedConfirm'));
            if (!ok) return;
        }

        _currentPath = path;
        _highlightActive(path);

        const editor = document.getElementById('configs-editor');
        const toolbar = document.getElementById('configs-toolbar');
        const warning = document.getElementById('configs-warning');
        const pathEl = document.getElementById('configs-current-path');
        if (editor) editor.value = 'Loading...';
        if (toolbar) toolbar.style.display = 'flex';
        if (warning) warning.style.display = warn ? '' : 'none';
        if (pathEl) pathEl.textContent = path;

        try {
            const res = await FilesService.getConfigContent(_currentServerId, path);
            const content = res?.content || '';
            if (editor) editor.value = content;
            _originalContent = content;
            _setDirty(false);
        } catch (err) {
            if (editor) editor.value = '';
            _originalContent = '';
            Toast.show(err.message || 'Failed to open file', 'error');
        }
    }

    async function _saveFile() {
        if (!_currentServerId || !_currentPath) return;
        const btn = document.getElementById('configs-save-btn');
        const editor = document.getElementById('configs-editor');
        if (!btn || !editor) return;
        btn.disabled = true;
        btn.textContent = I18n.t('configs.saving');
        try {
            await FilesService.saveConfigContent(_currentServerId, _currentPath, editor.value);
            _originalContent = editor.value;
            _setDirty(false);
            Toast.show(I18n.t('toast.fileSaved'), 'success');
        } catch (err) {
            Toast.show(err.message || 'Save failed', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = I18n.t('configs.save');
        }
    }

    async function _restartServer() {
        if (!_currentServerId) return;
        const ok = confirm(I18n.t('configs.restartConfirm'));
        if (!ok) return;
        try {
            await ServersService.restart(_currentServerId);
            Toast.show(I18n.t('toast.serverRestarted'), 'info');
        } catch (err) {
            Toast.show(err.message || 'Restart failed', 'error');
        }
    }

    function _highlightActive(path) {
        document.querySelectorAll('.config-file-item').forEach(el => {
            const candidate = el.dataset.commonPath || el.dataset.treePath;
            el.classList.toggle('active', !!path && candidate === path);
        });
    }

    function _setDirty(dirty) {
        _isDirty = dirty;
        const badge = document.getElementById('configs-dirty');
        if (badge) badge.style.display = dirty ? '' : 'none';
    }

    function normalizeDir(path) {
        const cleaned = `/${String(path || '/').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')}`;
        return cleaned === '/' ? '/' : cleaned;
    }

    function isConfigLikeFile(name) {
        const lower = String(name || '').toLowerCase();
        if (!lower) return false;
        const exact = new Set([
            'server.properties', 'eula.txt', 'ops.json', 'whitelist.json',
            'banned-players.json', 'banned-ips.json', 'paper.yml', 'spigot.yml',
            'bukkit.yml', 'paper-global.yml', 'paper-world-defaults.yml', 'permissions.yml'
        ]);
        if (exact.has(lower)) return true;
        return ['.yml', '.yaml', '.json', '.properties', '.toml', '.cfg', '.conf', '.ini', '.txt', '.xml'].some(ext => lower.endsWith(ext));
    }

    function isHiddenNoise(name) {
        const lower = String(name || '').toLowerCase();
        return ['runtime', 'logs', 'world', 'libraries', '.fabric', '.cache'].includes(lower);
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    return { render };
})();
