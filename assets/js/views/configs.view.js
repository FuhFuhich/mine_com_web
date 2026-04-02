const ConfigsView = (() => {
    let _currentServerId = null;
    let _currentPath = null;
    let _originalContent = '';
    let _isDirty = false;

    const COMMON_CONFIGS = [
        { path: '/server.properties', label: 'server.properties', warn: true },
        { path: '/eula.txt',          label: 'eula.txt',          warn: true },
        { path: '/ops.json',          label: 'ops.json' },
        { path: '/whitelist.json',    label: 'whitelist.json' },
        { path: '/banned-players.json', label: 'banned-players.json' },
        { path: '/banned-ips.json',   label: 'banned-ips.json' },
        { path: '/config/fabric.properties', label: 'fabric.properties' },
        { path: '/config/forge.cfg',  label: 'forge.cfg' },
        { path: '/config/paper.yml',  label: 'paper.yml' },
        { path: '/spigot.yml',        label: 'spigot.yml' },
    ];

    function render() {
        const container = document.getElementById('configs-container');
        if (!container) return;
        container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div class="card-title">${I18n.t('configs.title')}</div>
                <select id="configs-server-select" class="csel-native toolbar-select" style="min-width:200px">
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
            _currentPath = null;
            if (_currentServerId) _renderConfigsLayout();
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
        } catch { /* ignore */ }
    }

    function _showHint() {
        const body = document.getElementById('configs-body');
        if (body) body.innerHTML = `<div class="placeholder-empty">
            <div class="placeholder-icon">✎</div>
            <div class="placeholder-hint">${I18n.t('configs.selectHint')}</div>
        </div>`;
    }

    function _renderConfigsLayout() {
        const body = document.getElementById('configs-body');
        if (!body) return;
        body.innerHTML = `
        <div class="configs-layout">
            <div class="configs-sidebar">
                <div class="configs-section-label">${I18n.t('configs.commonFiles')}</div>
                <ul class="configs-file-list" id="configs-common-list">
                    ${COMMON_CONFIGS.map(f =>
                        `<li class="config-file-item" data-path="${f.path}">
                            ${f.warn ? '!' : '▤'} ${f.label}
                        </li>`
                    ).join('')}
                </ul>
                <div class="configs-section-label" style="margin-top:12px">${I18n.t('configs.allFiles')}</div>
                <div id="configs-tree-area" style="font-size:12px;opacity:0.7;padding:4px 8px">Loading...</div>
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

        document.querySelectorAll('.config-file-item').forEach(item =>
            item.addEventListener('click', () => _openFile(item.dataset.path, COMMON_CONFIGS.find(f => f.path === item.dataset.path)?.warn))
        );
        document.getElementById('configs-save-btn')?.addEventListener('click', _saveFile);
        document.getElementById('configs-restart-btn')?.addEventListener('click', _restartServer);
        document.getElementById('configs-editor')?.addEventListener('input', () => {
            const dirty = document.getElementById('configs-editor').value !== _originalContent;
            _setDirty(dirty);
        });
        _loadFileTree();
    }

    async function _loadFileTree() {
        const area = document.getElementById('configs-tree-area');
        if (!area || !_currentServerId) return;
        try {
            const tree = await FilesService.getTree(_currentServerId, '/');
            const files = (tree.items || []).filter(i => i.type === 'file' || i.type === 'directory');
            if (!files.length) { area.textContent = I18n.t('configs.noFiles'); return; }
            area.innerHTML = files.map(f =>
                `<div class="config-file-item config-file-item--tree" data-path="${f.path}" data-warn="false" style="cursor:pointer;padding:3px 8px">
                    ${f.type === 'directory' ? '▣' : '▤'} ${f.name}
                </div>`
            ).join('');
            area.querySelectorAll('.config-file-item--tree').forEach(item =>
                item.addEventListener('click', () => { if (!item.dataset.path.endsWith('/')) _openFile(item.dataset.path, false); })
            );
        } catch { area.textContent = I18n.t('configs.noFiles'); }
    }

    async function _openFile(path, warn) {
        if (_isDirty) {
            const ok = confirm(I18n.t('configs.dirty') + ' — ' + I18n.t('confirm.yes') + '?');
            if (!ok) return;
        }
        _currentPath = path;
        document.querySelectorAll('.config-file-item').forEach(el =>
            el.classList.toggle('active', el.dataset.path === path)
        );
        const editor = document.getElementById('configs-editor');
        const toolbar = document.getElementById('configs-toolbar');
        const warning = document.getElementById('configs-warning');
        const pathEl  = document.getElementById('configs-current-path');
        if (editor) editor.value = 'Loading...';
        if (toolbar) toolbar.style.display = 'flex';
        if (warning) warning.style.display = warn ? '' : 'none';
        if (pathEl)  pathEl.textContent = path;
        try {
            const res = await FilesService.getConfigContent(_currentServerId, path);
            const content = res.content || '';
            if (editor) editor.value = content;
            _originalContent = content;
            _setDirty(false);
        } catch (err) {
            if (editor) editor.value = '';
            _originalContent = '';
            Toast.show(err.message, 'error');
        }
    }

    async function _saveFile() {
        if (!_currentServerId || !_currentPath) return;
        const btn = document.getElementById('configs-save-btn');
        btn.disabled = true;
        btn.textContent = I18n.t('configs.saving');
        const content = document.getElementById('configs-editor').value;
        try {
            await FilesService.saveConfigContent(_currentServerId, _currentPath, content);
            _originalContent = content;
            _setDirty(false);
            Toast.show(I18n.t('toast.fileSaved'), 'success');
        } catch (err) { Toast.show(err.message, 'error'); }
        finally { btn.disabled = false; btn.textContent = I18n.t('configs.save'); }
    }

    async function _restartServer() {
        if (!_currentServerId) return;
        const ok = confirm(I18n.t('configs.restart') + '?');
        if (!ok) return;
        try {
            await ServersService.restart(_currentServerId);
            Toast.show(I18n.t('toast.serverRestarted'), 'info');
        } catch (err) { Toast.show(err.message, 'error'); }
    }

    function _setDirty(dirty) {
        _isDirty = dirty;
        const badge = document.getElementById('configs-dirty');
        if (badge) badge.style.display = dirty ? '' : 'none';
    }

    return { render };
})();
