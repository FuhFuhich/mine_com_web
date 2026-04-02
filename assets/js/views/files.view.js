const FilesView = (() => {
    let _currentServerId = null;
    let _currentPath = '/';
    let _editPath = null;
    let _editOriginal = '';

    const SHORTCUTS = [
        { label: 'mods',    path: '/mods' },
        { label: 'plugins', path: '/plugins' },
        { label: 'world',   path: '/world' },
        { label: 'config',  path: '/config' },
        { label: 'logs',    path: '/logs' },
    ];

    function render() {
        const container = document.getElementById('files-container');
        if (!container) return;
        container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div class="card-title">${I18n.t('files.title')}</div>
                <select id="files-server-select" class="csel-native toolbar-select" style="min-width:200px">
                    <option value="">${I18n.t('files.selectServer')}</option>
                </select>
            </div>
            <div id="files-body">
                <div class="placeholder-empty">
                    <div class="placeholder-icon">▣</div>
                    <div class="placeholder-hint">${I18n.t('files.selectHint')}</div>
                </div>
            </div>
        </div>
        <div class="modal-overlay" id="file-editor-overlay">
            <div class="modal" style="width:600px;max-height:85vh;display:flex;flex-direction:column">
                <div class="modal-title" id="file-editor-title">Edit</div>
                <textarea id="file-editor-textarea" class="configs-editor" style="flex:1;min-height:300px" spellcheck="false"></textarea>
                <div class="modal-actions">
                    <button class="btn-cancel" id="file-editor-cancel">${I18n.t('files.cancel')}</button>
                    <button class="btn-create" id="file-editor-save">${I18n.t('files.save')}</button>
                </div>
            </div>
        </div>`;

        _populateServers();
        document.getElementById('files-server-select')?.addEventListener('change', e => {
            _currentServerId = e.target.value || null;
            _currentPath = '/';
            if (_currentServerId) _renderLayout();
            else _showHint();
        });
        _bindEditorModal();
    }

    async function _populateServers() {
        const sel = document.getElementById('files-server-select');
        if (!sel) return;
        try {
            const servers = await ServersService.getAll();
            sel.innerHTML = `<option value="">${I18n.t('files.selectServer')}</option>` +
                servers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
        } catch { /* ignore */ }
    }

    function _showHint() {
        const body = document.getElementById('files-body');
        if (body) body.innerHTML = `<div class="placeholder-empty">
            <div class="placeholder-icon">▣</div>
            <div class="placeholder-hint">${I18n.t('files.selectHint')}</div>
        </div>`;
    }

    function _renderLayout() {
        const body = document.getElementById('files-body');
        if (!body) return;
        body.innerHTML = `
        <div class="files-toolbar">
            <div class="files-breadcrumbs" id="files-breadcrumbs"></div>
            <div style="flex:1"></div>
            <button class="action-btn action-btn--neutral" id="files-upload-btn">+ ${I18n.t('files.upload')}</button>
            <button class="action-btn action-btn--neutral" id="files-mkdir-btn">+ ${I18n.t('files.newFolder')}</button>
            <input type="file" id="files-upload-input" style="display:none" multiple>
        </div>
        <div class="files-shortcuts" id="files-shortcuts">
            ${I18n.t('files.shortcuts')}:
            ${SHORTCUTS.map(s => `<button class="shortcut-btn" data-path="${s.path}">${s.label}</button>`).join('')}
            <button class="action-btn action-btn--neutral" id="files-modpack-btn" style="margin-left:8px">+ ${I18n.t('files.uploadModpack')}</button>
            <input type="file" id="files-modpack-input" style="display:none" accept=".zip">
        </div>
        <div class="files-list-wrap" id="files-list-wrap">
            <div class="files-list-header">
                <span style="flex:1">Name</span>
                <span style="width:90px">Size</span>
                <span style="width:120px">Actions</span>
            </div>
            <div id="files-list"></div>
        </div>`;

        document.querySelectorAll('.shortcut-btn').forEach(btn =>
            btn.addEventListener('click', () => _navigate(btn.dataset.path))
        );
        document.getElementById('files-upload-btn')?.addEventListener('click', () =>
            document.getElementById('files-upload-input').click()
        );
        document.getElementById('files-upload-input')?.addEventListener('change', async e => {
            for (const file of e.target.files) await _uploadFile(file);
            e.target.value = '';
        });
        document.getElementById('files-mkdir-btn')?.addEventListener('click', _createFolder);
        document.getElementById('files-modpack-btn')?.addEventListener('click', () =>
            document.getElementById('files-modpack-input').click()
        );
        document.getElementById('files-modpack-input')?.addEventListener('change', async e => {
            const file = e.target.files[0];
            if (file) await _uploadModpack(file);
            e.target.value = '';
        });

        _navigate('/');
    }

    async function _navigate(path) {
        _currentPath = path;
        _renderBreadcrumbs(path);
        const list = document.getElementById('files-list');
        if (!list) return;
        list.innerHTML = `<div style="padding:20px;opacity:0.5;text-align:center">Loading...</div>`;
        try {
            const tree = await FilesService.getTree(_currentServerId, path);
            const items = tree.items || [];
            if (!items.length) {
                list.innerHTML = `<div class="placeholder-empty" style="padding:30px"><div class="placeholder-hint">${I18n.t('files.noFiles')}</div></div>`;
                return;
            }
            const sorted = [...items.filter(i => i.type === 'directory'), ...items.filter(i => i.type !== 'directory')];
            list.innerHTML = sorted.map(item => _fileRow(item)).join('');
            list.querySelectorAll('.file-row').forEach(row => {
                const path = row.dataset.path;
                const type = row.dataset.type;
                row.querySelector('.file-row-name')?.addEventListener('click', () => {
                    if (type === 'directory') _navigate(path);
                    else _openFileEdit(path, row.dataset.name);
                });
            });
            list.querySelectorAll('[data-file-action]').forEach(btn =>
                btn.addEventListener('click', () => _handleFileAction(btn.dataset.fileAction, btn.dataset.path, btn.dataset.name))
            );
        } catch (err) {
            list.innerHTML = `<div class="placeholder-empty"><div class="placeholder-icon">!</div><div class="placeholder-hint">${err.message}</div></div>`;
        }
    }

    function _fileRow(item) {
        const isDir = item.type === 'directory';
        const icon = isDir ? '▣' : _fileIcon(item.name);
        const size = item.sizeBytes != null ? _fmtBytes(item.sizeBytes) : (isDir ? '—' : '—');
        return `<div class="file-row" data-path="${item.path}" data-type="${item.type}" data-name="${item.name}">
            <div class="file-row-name" style="cursor:pointer;flex:1;display:flex;align-items:center;gap:8px">
                <span>${icon}</span><span>${item.name}</span>
            </div>
            <div class="file-row-size">${size}</div>
            <div class="file-row-actions">
                ${!isDir ? `<button class="action-btn action-btn--neutral" data-file-action="edit" data-path="${item.path}" data-name="${item.name}" style="padding:2px 7px;font-size:11px">✏</button>` : ''}
                <button class="action-btn action-btn--stop" data-file-action="delete" data-path="${item.path}" data-name="${item.name}" style="padding:2px 7px;font-size:11px">✕</button>
            </div>
        </div>`;
    }

    function _fileIcon(name) {
        const ext = name.split('.').pop()?.toLowerCase();
        const map = { jar: '◌', zip: '▤', json: '{}', yml: '≡', yaml: '≡', properties: '≡', txt: '▤', log: '≣', sh: '—', toml: '≡' };
        return map[ext] || '▤';
    }

    function _renderBreadcrumbs(path) {
        const el = document.getElementById('files-breadcrumbs');
        if (!el) return;
        const parts = path.split('/').filter(Boolean);
        const crumbs = [{ label: '/', path: '/' }];
        let acc = '';
        for (const part of parts) { acc += '/' + part; crumbs.push({ label: part, path: acc }); }
        el.innerHTML = crumbs.map((c, i) =>
            `<span class="breadcrumb-item ${i === crumbs.length-1 ? 'active' : ''}" data-path="${c.path}">${c.label}</span>`
            + (i < crumbs.length-1 ? '<span class="breadcrumb-sep"> / </span>' : '')
        ).join('');
        el.querySelectorAll('.breadcrumb-item:not(.active)').forEach(item =>
            item.addEventListener('click', () => _navigate(item.dataset.path))
        );
    }

    async function _handleFileAction(action, path, name) {
        if (action === 'edit') {
            _openFileEdit(path, name);
        } else if (action === 'delete') {
            const ok = confirm(`${I18n.t('files.confirmDelete')}\n${name}`);
            if (!ok) return;
            try {
                await FilesService.remove(_currentServerId, path);
                Toast.show(I18n.t('toast.fileDeleted'), 'info');
                _navigate(_currentPath);
            } catch (err) { Toast.show(err.message, 'error'); }
        }
    }

    async function _openFileEdit(path, name) {
        _editPath = path;
        const overlay = document.getElementById('file-editor-overlay');
        document.getElementById('file-editor-title').textContent = name || path;
        const ta = document.getElementById('file-editor-textarea');
        ta.value = 'Loading...';
        overlay.classList.add('active');
        try {
            const res = await FilesService.getContent(_currentServerId, path);
            ta.value = res.content || '';
            _editOriginal = ta.value;
        } catch (err) { ta.value = ''; Toast.show(err.message, 'error'); }
    }

    function _bindEditorModal() {
        const overlay = document.getElementById('file-editor-overlay');
        document.getElementById('file-editor-cancel')?.addEventListener('click', () =>
            overlay.classList.remove('active')
        );
        overlay?.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('active'); });
        document.getElementById('file-editor-save')?.addEventListener('click', async () => {
            if (!_editPath || !_currentServerId) return;
            const content = document.getElementById('file-editor-textarea').value;
            const btn = document.getElementById('file-editor-save');
            btn.disabled = true;
            try {
                await FilesService.saveContent(_currentServerId, _editPath, content);
                Toast.show(I18n.t('toast.fileSaved'), 'success');
                overlay.classList.remove('active');
            } catch (err) { Toast.show(err.message, 'error'); }
            finally { btn.disabled = false; }
        });
    }

    async function _uploadFile(file) {
        try {
            await FilesService.upload(_currentServerId, _currentPath, file);
            Toast.show(`${file.name} uploaded`, 'success');
            _navigate(_currentPath);
        } catch (err) { Toast.show(err.message, 'error'); }
    }

    async function _uploadModpack(file) {
        const btn = document.getElementById('files-modpack-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Uploading...'; }
        try {
            await FilesService.uploadModpack(_currentServerId, file);
            Toast.show(`${file.name} uploaded`, 'success');
            _navigate(_currentPath);
        } catch (err) { Toast.show(err.message, 'error'); }
        finally { if (btn) { btn.disabled = false; btn.textContent = `▤ ${I18n.t('files.uploadModpack')}`; } }
    }

    async function _createFolder() {
        const name = prompt(I18n.t('files.folderName'));
        if (!name) return;
        const path = _currentPath.replace(/\/$/, '') + '/' + name;
        try {
            await FilesService.mkdir(_currentServerId, path);
            Toast.show(I18n.t('toast.folderCreated'), 'success');
            _navigate(_currentPath);
        } catch (err) { Toast.show(err.message, 'error'); }
    }

    function _fmtBytes(bytes) {
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
        if (bytes >= 1024)    return (bytes / 1024).toFixed(1) + ' KB';
        return bytes + ' B';
    }

    return { render };
})();
