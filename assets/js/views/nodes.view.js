const NodesView = (() => {
    let _nodes = [];
    let _editingNodeId = null;
    let _pingTimers = {};

    /* ─── helpers ─── */
    function statusPill(node) {
        const on = node.status === 'ONLINE' || node.isActive;
        return on
            ? `<span class="status-pill status-online"><span class="status-dot"></span>${I18n.t('nodes.status.online')}</span>`
            : `<span class="status-pill status-offline"><span class="status-dot"></span>${I18n.t('nodes.status.offline')}</span>`;
    }

    function ipMasked(ip) {
        return `<span class="ip-masked" data-ip="${ip}">
            <span class="ip-dots">••••</span>
            <button class="ip-reveal-btn" title="${I18n.t('nodes.table.clickReveal')}">👁</button>
        </span>`;
    }

    function roleBadge(role) {
        const r = (role || 'USER').toUpperCase();
        return `<span class="node-role-badge node-role-badge--${r.toLowerCase()}">${r}</span>`;
    }

    function canDo(node, action) {
        if (node.allowedActions) return node.allowedActions.includes(action);
        const role = (node.myRole || 'USER').toUpperCase();
        const map = {
            OWNER:   ['view','edit','delete','ping','manage_members','create_mc_server','metrics'],
            MANAGER: ['view','edit','ping','manage_members','create_mc_server','metrics'],
            ADMIN:   ['view','ping','metrics'],
            USER:    ['view'],
        };
        return (map[role] || map.USER).includes(action);
    }

    /* ─── render ─── */
    function renderSkeleton() {
        const tbody = document.getElementById('nodes-tbody');
        if (!tbody || _nodes.length) return;
        tbody.innerHTML = [1,2,3].map(() =>
            `<tr>${[1,2,3,4,5,6,7].map(() =>
                `<td><div class="skeleton skeleton-text" style="width:${50+Math.random()*60}px;height:13px"></div></td>`
            ).join('')}</tr>`
        ).join('');
    }

    async function render() {
        renderSkeleton();
        try {
            _nodes = await NodesService.getAll();
            _drawTable(_nodes);
            _populateNodeSelect(_nodes);
        } catch (err) {
            _drawError(err.message);
        }
    }

    function _drawTable(nodes) {
        const tbody = document.getElementById('nodes-tbody');
        if (!tbody) return;
        if (!nodes.length) {
            tbody.innerHTML = `<tr><td colspan="7"><div class="placeholder-empty">
                <div class="placeholder-icon">🖥</div>
                <div class="placeholder-title">${I18n.t('nodes.empty.title')}</div>
                <div class="placeholder-hint">${I18n.t('nodes.empty.hint')}</div>
            </div></td></tr>`;
            return;
        }
        tbody.innerHTML = nodes.map(n => `
            <tr data-node-id="${n.id}">
                <td>
                    <div class="node-name">${n.name}</div>
                    ${n.description ? `<div class="node-desc">${n.description}</div>` : ''}
                </td>
                <td>${ipMasked(n.ipAddress)}</td>
                <td>${n.sshPort ?? 22}</td>
                <td>${n.sshUser ?? ''}</td>
                <td data-node-status="${n.id}">${statusPill(n)}</td>
                <td class="nodes-actions-cell">
                    ${canDo(n,'ping')   ? `<button class="action-btn action-btn--neutral node-ping-btn"    data-id="${n.id}">${I18n.t('nodes.action.ping')}</button>` : ''}
                    ${canDo(n,'edit')   ? `<button class="action-btn action-btn--neutral node-edit-btn"    data-id="${n.id}">${I18n.t('nodes.action.edit')}</button>` : ''}
                    ${canDo(n,'metrics')? `<button class="action-btn action-btn--neutral node-metrics-btn" data-id="${n.id}">${I18n.t('nodes.action.metrics')}</button>` : ''}
                    ${canDo(n,'manage_members') ? `<button class="action-btn action-btn--neutral node-members-btn" data-id="${n.id}" data-name="${n.name}">${I18n.t('nodes.action.members')}</button>` : ''}
                    ${canDo(n,'delete') ? `<button class="action-btn action-btn--stop node-delete-btn"    data-id="${n.id}" data-name="${n.name}">${I18n.t('nodes.action.delete')}</button>` : ''}
                </td>
                <td>${roleBadge(n.myRole)}</td>
            </tr>`
        ).join('');

        tbody.querySelectorAll('.ip-masked').forEach(el => {
            el.querySelector('.ip-reveal-btn').addEventListener('click', e => {
                e.stopPropagation();
                const shown = el.dataset.revealed === '1';
                el.querySelector('.ip-dots').textContent = shown ? '••••' : el.dataset.ip;
                el.dataset.revealed = shown ? '' : '1';
            });
        });
        tbody.querySelectorAll('.node-ping-btn').forEach(btn =>
            btn.addEventListener('click', () => _handlePing(btn.dataset.id, btn)));
        tbody.querySelectorAll('.node-edit-btn').forEach(btn =>
            btn.addEventListener('click', () => _openEditModal(btn.dataset.id)));
        tbody.querySelectorAll('.node-metrics-btn').forEach(btn =>
            btn.addEventListener('click', () => {
                Router.navigate('metrics');
                setTimeout(() => {
                    const sel = document.getElementById('metrics-node-select');
                    if (sel) { sel.value = btn.dataset.id; sel.dispatchEvent(new Event('change')); }
                }, 100);
            })
        );
        tbody.querySelectorAll('.node-members-btn').forEach(btn =>
            btn.addEventListener('click', () => _openMembersModal(btn.dataset.id, btn.dataset.name)));
        tbody.querySelectorAll('.node-delete-btn').forEach(btn =>
            btn.addEventListener('click', () => _confirmDelete(btn.dataset.id, btn.dataset.name)));
    }

    function _drawError(msg) {
        const tbody = document.getElementById('nodes-tbody');
        if (!tbody) return;
        tbody.innerHTML = `<tr><td colspan="7"><div class="placeholder-empty">
            <div class="placeholder-icon">⚠</div>
            <div class="placeholder-title">Error</div>
            <div class="placeholder-hint">${msg}</div>
        </div></td></tr>`;
    }

    /* ─── ping ─── */
    async function _handlePing(nodeId, btn) {
        if (btn.disabled) return;
        btn.disabled = true;
        const orig = btn.textContent;
        btn.textContent = I18n.t('nodes.status.connecting');
        clearTimeout(_pingTimers[nodeId]);
        try {
            const res = await NodesService.ping(nodeId);
            const ok = res?.reachable ?? res?.status === 'OK' ?? false;
            const ms = res?.pingMs ?? res?.ms ?? null;
            const cell = document.querySelector(`[data-node-status="${nodeId}"]`);
            if (cell) cell.innerHTML = ok
                ? `<span class="status-pill status-online"><span class="status-dot"></span>${I18n.t('nodes.status.online')}</span>`
                : `<span class="status-pill status-offline"><span class="status-dot"></span>${I18n.t('nodes.status.offline')}</span>`;
            btn.textContent = ok ? (ms != null ? `${ms} ms` : I18n.t('nodes.status.online')) : I18n.t('nodes.status.offline');
            btn.className = ok ? 'action-btn action-btn--start node-ping-btn' : 'action-btn action-btn--stop node-ping-btn';
            Toast.show(ok ? I18n.t('nodes.ping.success') : I18n.t('nodes.ping.fail'), ok ? 'success' : 'error');
        } catch (err) {
            btn.textContent = I18n.t('nodes.status.offline');
            btn.className = 'action-btn action-btn--stop node-ping-btn';
            Toast.show(err.message, 'error');
        } finally {
            _pingTimers[nodeId] = setTimeout(() => {
                btn.textContent = orig;
                btn.className = 'action-btn action-btn--neutral node-ping-btn';
                btn.disabled = false;
            }, 4000);
        }
    }

    /* ─── delete ─── */
    function _confirmDelete(nodeId, name) {
        const overlay = document.getElementById('node-confirm-overlay');
        const msg = document.getElementById('node-confirm-msg');
        if (msg) msg.textContent = `${I18n.t('nodes.action.delete')} "${name}"?`;
        overlay.dataset.pendingId = nodeId;
        overlay.classList.add('active');
    }

    async function _doDelete(nodeId) {
        try {
            await NodesService.remove(nodeId);
            document.querySelector(`tr[data-node-id="${nodeId}"]`)?.remove();
            _nodes = _nodes.filter(n => String(n.id) !== String(nodeId));
            _populateNodeSelect(_nodes);
            Toast.show(I18n.t('nodes.action.deleted'), 'info');
        } catch (err) { Toast.show(err.message, 'error'); }
    }

    /* ─── node modal ─── */
    function _openAddModal() {
        _editingNodeId = null;
        const overlay = document.getElementById('node-modal-overlay');
        document.getElementById('node-modal-title').textContent = I18n.t('nodes.modal.title');
        document.getElementById('node-modal-submit').textContent = I18n.t('nodes.modal.add');
        document.getElementById('node-modal-form').reset();
        _clearKeyField();
        overlay.classList.add('active');
    }

    function _openEditModal(nodeId) {
        const node = _nodes.find(n => String(n.id) === String(nodeId));
        if (!node) return;
        _editingNodeId = nodeId;
        document.getElementById('node-modal-title').textContent = I18n.t('nodes.modal.editTitle');
        document.getElementById('node-modal-submit').textContent = I18n.t('nodes.modal.save');
        document.getElementById('n-name').value = node.name || '';
        document.getElementById('n-ip').value = node.ipAddress || '';
        document.getElementById('n-ssh-port').value = node.sshPort || 22;
        document.getElementById('n-ssh-user').value = node.sshUser || '';
        document.getElementById('n-description').value = node.description || '';
        const authType = node.authType || 'key';
        document.querySelectorAll('input[name="auth-type"]').forEach(r => { r.checked = r.value === authType; });
        _toggleAuthType(authType);
        _clearKeyField();
        document.getElementById('node-modal-overlay').classList.add('active');
    }

    function _closeModal() {
        document.getElementById('node-modal-overlay').classList.remove('active');
        document.getElementById('node-modal-form').reset();
        _clearKeyField();
        _editingNodeId = null;
    }

    function _clearKeyField() {
        const kf = document.getElementById('n-key-filename');
        if (kf) kf.textContent = '';
    }

    function _toggleAuthType(type) {
        document.getElementById('n-key-group').style.display = type === 'key' ? '' : 'none';
        document.getElementById('n-pwd-group').style.display = type === 'password' ? '' : 'none';
    }

    async function _submitModal() {
        const name = document.getElementById('n-name').value.trim();
        const ip   = document.getElementById('n-ip').value.trim();
        const sshPort = Number(document.getElementById('n-ssh-port').value) || 22;
        const sshUser = document.getElementById('n-ssh-user').value.trim();
        const authType = document.querySelector('input[name="auth-type"]:checked')?.value || 'key';
        const desc = document.getElementById('n-description').value.trim() || null;

        if (!name || !ip || !sshUser) { Toast.show(I18n.t('auth.fillAll'), 'error'); return; }

        const btn = document.getElementById('node-modal-submit');
        btn.disabled = true;
        const origText = btn.textContent;
        btn.textContent = '...';

        try {
            const payload = { name, ipAddress: ip, sshPort, sshUser, authType, description: desc };

            if (authType === 'key') {
                const keyContent = document.getElementById('n-key-textarea').value.trim();
                const keyFile = document.getElementById('n-key-file').files[0];
                if (keyFile) {
                    payload.sshPrivateKey = await keyFile.text();
                } else if (keyContent) {
                    payload.sshPrivateKey = keyContent;
                } else if (!_editingNodeId) {
                    Toast.show(I18n.t('auth.fillAll'), 'error');
                    return;
                }
            } else {
                const pwd = document.getElementById('n-password').value;
                if (pwd) payload.sshPassword = pwd;
                else if (!_editingNodeId) { Toast.show(I18n.t('auth.fillAll'), 'error'); return; }
            }

            if (_editingNodeId) {
                await NodesService.update(_editingNodeId, payload);
                Toast.show(`${name} ${I18n.t('nodes.modal.updated')}`, 'success');
            } else {
                await NodesService.create(payload);
                Toast.show(`${name} ${I18n.t('nodes.modal.added')}`, 'success');
            }
            _closeModal();
            render();
        } catch (err) {
            Toast.show(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = origText;
        }
    }

    /* ─── members modal ─── */
    async function _openMembersModal(nodeId, nodeName) {
        const overlay = document.getElementById('node-members-overlay');
        document.getElementById('node-members-title').textContent = nodeName;
        overlay.dataset.nodeId = nodeId;
        document.getElementById('node-members-list').innerHTML = `<div style="opacity:0.5;font-size:12px;padding:8px">Loading...</div>`;
        overlay.classList.add('active');
        try {
            const members = await NodesService.getMembers(nodeId);
            _renderMembersList(members, nodeId);
        } catch (err) {
            document.getElementById('node-members-list').innerHTML = `<div style="color:#ff8a80;font-size:12px;padding:8px">${err.message}</div>`;
        }
    }

    function _renderMembersList(members, nodeId) {
        const list = document.getElementById('node-members-list');
        if (!members.length) {
            list.innerHTML = `<div style="opacity:0.5;font-size:12px;padding:8px">No members yet.</div>`;
            return;
        }
        list.innerHTML = members.map(m => {
            const uid   = m.userId || m.user?.id;
            const uname = m.name  || m.user?.name || m.user?.username || m.email || uid;
            const isOwner = m.role === 'OWNER';
            return `<div class="member-row" data-member-id="${uid}">
                <span class="member-name">${uname}</span>
                <span class="node-role-badge node-role-badge--${(m.role||'user').toLowerCase()}" style="margin-right:4px">${m.role}</span>
                ${!isOwner ? `
                <select class="csel-native member-role-sel" data-node="${nodeId}" data-user="${uid}">
                    <option value="MANAGER" ${m.role==='MANAGER'?'selected':''}>MANAGER</option>
                    <option value="ADMIN"   ${m.role==='ADMIN'  ?'selected':''}>ADMIN</option>
                    <option value="USER"    ${m.role==='USER'   ?'selected':''}>USER</option>
                </select>
                <button class="action-btn action-btn--stop member-remove-btn" data-node="${nodeId}" data-user="${uid}" style="padding:3px 8px;font-size:11px">✕</button>
                ` : ''}
            </div>`;
        }).join('');

        list.querySelectorAll('.member-role-sel').forEach(sel =>
            sel.addEventListener('change', async () => {
                try {
                    await NodesService.updateMemberRole(sel.dataset.node, sel.dataset.user, sel.value);
                    Toast.show(I18n.t('toast.roleSaved'), 'success');
                } catch (err) { Toast.show(err.message, 'error'); }
            })
        );
        list.querySelectorAll('.member-remove-btn').forEach(btn =>
            btn.addEventListener('click', async () => {
                try {
                    await NodesService.removeMember(btn.dataset.node, btn.dataset.user);
                    btn.closest('.member-row').remove();
                    Toast.show(I18n.t('toast.memberRemoved'), 'info');
                } catch (err) { Toast.show(err.message, 'error'); }
            })
        );
    }

    /* ─── node select for MC server form ─── */
    function _populateNodeSelect(nodes) {
        const sel = document.getElementById('f-node');
        if (!sel) return;
        const cur = sel.value;
        sel.innerHTML = `<option value="">${I18n.t('modal.selectNode')}</option>` +
            nodes.map(n => `<option value="${n.id}" ${n.id === cur ? 'selected' : ''}>${n.name} (${n.ipAddress})</option>`).join('');
    }

    /* ─── init ─── */
    function initModal() {
        document.getElementById('btn-new-node')?.addEventListener('click', _openAddModal);
        document.getElementById('node-modal-cancel')?.addEventListener('click', _closeModal);
        document.getElementById('node-modal-submit')?.addEventListener('click', _submitModal);
        document.getElementById('node-modal-overlay')?.addEventListener('click', e => {
            if (e.target === document.getElementById('node-modal-overlay')) _closeModal();
        });

        document.querySelectorAll('input[name="auth-type"]').forEach(r =>
            r.addEventListener('change', () => { if (r.checked) _toggleAuthType(r.value); })
        );
        document.getElementById('n-key-load-btn')?.addEventListener('click', () =>
            document.getElementById('n-key-file').click()
        );
        document.getElementById('n-key-file')?.addEventListener('change', async e => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            document.getElementById('n-key-textarea').value = text;
            document.getElementById('n-key-filename').textContent = file.name;
        });

        const confirmOverlay = document.getElementById('node-confirm-overlay');
        document.getElementById('node-confirm-cancel')?.addEventListener('click', () =>
            confirmOverlay.classList.remove('active')
        );
        document.getElementById('node-confirm-ok')?.addEventListener('click', async () => {
            const id = confirmOverlay.dataset.pendingId;
            confirmOverlay.classList.remove('active');
            if (id) await _doDelete(id);
        });
        confirmOverlay?.addEventListener('click', e => {
            if (e.target === confirmOverlay) confirmOverlay.classList.remove('active');
        });

        const membersOverlay = document.getElementById('node-members-overlay');
        document.getElementById('node-members-close')?.addEventListener('click', () =>
            membersOverlay.classList.remove('active')
        );
        membersOverlay?.addEventListener('click', e => {
            if (e.target === membersOverlay) membersOverlay.classList.remove('active');
        });
        document.getElementById('node-member-add-btn')?.addEventListener('click', async () => {
            const nodeId   = membersOverlay.dataset.nodeId;
            const username = document.getElementById('node-member-username').value.trim();
            const role     = document.getElementById('node-member-role').value;
            if (!username) { Toast.show(I18n.t('auth.fillAll'), 'error'); return; }
            try {
                const user = await NodesService.findByUsername(username);
                await NodesService.addMember(nodeId, user.id, role);
                document.getElementById('node-member-username').value = '';
                Toast.show(I18n.t('toast.memberAdded'), 'success');
                const members = await NodesService.getMembers(nodeId);
                _renderMembersList(members, nodeId);
            } catch (err) { Toast.show(err.message, 'error'); }
        });
    }

    return { render, initModal };
})();
