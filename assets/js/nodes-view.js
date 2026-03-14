const NodesRepository = (() => {
  const KEY = "mc_nodes";
  function _load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || _defaults(); }
    catch { return _defaults(); }
  }
  function _defaults() {
    return [
      { id: 1, name: "ubuntu-node-01", ip: "192.168.1.10", sshPort: 22, sshUser: "root", status: "online" },
      { id: 2, name: "debian-node-02",  ip: "192.168.1.11", sshPort: 22, sshUser: "root", status: "offline" }
    ];
  }
  function _save(list) { localStorage.setItem(KEY, JSON.stringify(list)); }
  function getAll() { return _load(); }
  function create(data) {
    const list = _load();
    const node = { id: Date.now(), status: "connecting", ...data };
    list.push(node);
    _save(list);
    setTimeout(() => {
      const l = _load();
      const n = l.find(x => x.id === node.id);
      if (n) { n.status = "online"; _save(l); NodesView.render(); }
    }, 2000);
    return node;
  }
  function remove(id) { _save(_load().filter(x => x.id !== id)); }
  return { getAll, create, remove };
})();

const NodesView = (() => {
  function _statusPill(status) {
    const map = {
      online:     { cls: "status-online",     key: "nodes.status.online" },
      offline:    { cls: "status-offline",    key: "nodes.status.offline" },
      connecting: { cls: "status-connecting", key: "nodes.status.connecting" }
    };
    const s = map[status] || map.offline;
    return `<span class="status-pill ${s.cls}">${I18n.t(s.key)}</span>`;
  }

  function render() {
    const tbody = document.getElementById("nodes-tbody");
    if (!tbody) return;
    tbody.innerHTML = NodesRepository.getAll().map(n => `
      <tr>
        <td><strong>${n.name}</strong></td>
        <td>
        <span class="ip-masked" title="${I18n.t('nodes.table.clickReveal')}">
            <span class="ip-dots">••••••••</span>
            <span class="ip-value" style="display:none">${n.ip}</span>
        </span>
        </td>
        <td>${n.sshPort}</td>
        <td>
        <span class="ip-masked" title="${I18n.t('nodes.table.clickReveal')}">
            <span class="ip-dots">••••••</span>
            <span class="ip-value" style="display:none">${n.sshUser}</span>
        </span>
        </td>
        <td>${_statusPill(n.status)}</td>
        <td>
          <button class="action-btn action-btn--start" data-node-action="ping" data-id="${n.id}">${I18n.t("nodes.action.ping")}</button>
          <button class="action-btn action-btn--stop"  data-node-action="delete" data-id="${n.id}">${I18n.t("nodes.action.delete")}</button>
        </td>
      </tr>
    `).join("");

    // IP reveal toggle
    tbody.querySelectorAll(".ip-masked").forEach(cell => {
        const dots  = cell.querySelector(".ip-dots");
        const value = cell.querySelector(".ip-value");
        let shown = false;
        cell.addEventListener("click", () => {
            shown = !shown;
            dots.style.display  = shown ? "none" : "";
            value.style.display = shown ? "" : "none";
        });
    });

    tbody.querySelectorAll("[data-node-action]").forEach(btn => {
      btn.addEventListener("click", () => _handleAction(btn.dataset.nodeAction, Number(btn.dataset.id)));
    });

    _populateNodeSelect();
  }

  // Заполняем дропдаун выбора сервера в MC-модалке
  function _populateNodeSelect() {
    const sel = document.getElementById("f-node");
    if (!sel) return;
    const nodes = NodesRepository.getAll();
    sel.innerHTML = `<option value="">${I18n.t("modal.selectNode")}</option>` +
      nodes.map(n => `<option value="${n.id}">${n.name} (${n.ip})</option>`).join("");
    // Обновляем кастомный селект если уже инициализирован
    const wrapper = sel.nextSibling;
    if (wrapper && wrapper.classList && wrapper.classList.contains("csel-wrapper")) {
      wrapper.remove();
      sel.style.display = "";
      sel.dataset.customized = "";
    }
    CustomSelect.init(sel);
  }

  function _handleAction(action, id) {
    if (action === "ping") {
      Toast.show(I18n.t("nodes.action.pinging"), "info", 1500);
      setTimeout(() => Toast.show("Node responded: 12ms", "success"), 1600);
    } else if (action === "delete") {
      NodesRepository.remove(id);
      render();
      Toast.show(I18n.t("nodes.action.deleted"), "info");
    }
  }

  function initModal() {
    document.getElementById("btn-new-node").addEventListener("click", _openModal);
    document.getElementById("node-modal-cancel").addEventListener("click", _closeModal);
    document.getElementById("node-modal-overlay").addEventListener("click", e => {
      if (e.target === e.currentTarget) _closeModal();
    });
    document.getElementById("node-modal-create").addEventListener("click", _submit);

    document.querySelectorAll("input[name='auth-type']").forEach(r => {
      r.addEventListener("change", () => {
        const isKey = document.querySelector("input[name='auth-type']:checked").value === "key";
        document.getElementById("n-key-group").style.display = isKey ? "" : "none";
        document.getElementById("n-pwd-group").style.display = isKey ? "none" : "";
      });
    });

    const zone  = document.getElementById("n-key-dropzone");
    const input = document.getElementById("n-key-file");
    const label = document.getElementById("n-key-filename");
    zone.addEventListener("click", () => input.click());
    input.addEventListener("change", () => { if (input.files[0]) label.textContent = input.files[0].name; });
    zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("dropzone--active"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("dropzone--active"));
    zone.addEventListener("drop", e => {
      e.preventDefault(); zone.classList.remove("dropzone--active");
      const f = e.dataTransfer.files[0];
      if (f) label.textContent = f.name;
    });
  }

  function _openModal() {
    document.getElementById("node-modal-overlay").classList.add("active");
    document.getElementById("node-modal-form").reset();
    document.getElementById("n-key-filename").textContent = "";
    document.getElementById("n-key-group").style.display = "";
    document.getElementById("n-pwd-group").style.display = "none";
  }

  function _closeModal() {
    document.getElementById("node-modal-overlay").classList.remove("active");
  }

  function _submit() {
    const name = document.getElementById("n-name").value.trim();
    const ip   = document.getElementById("n-ip").value.trim();
    if (!name || !ip) { Toast.show(I18n.t("auth.fillAll"), "error"); return; }

    document.getElementById("node-modal-create").disabled = true;
    setTimeout(() => {
      NodesRepository.create({
        name,
        ip,
        sshPort: parseInt(document.getElementById("n-ssh-port").value) || 22,
        sshUser: document.getElementById("n-ssh-user").value.trim() || "root"
      });
      _closeModal();
      render();
      Toast.show(name + " — " + I18n.t("nodes.modal.added"), "success");
      document.getElementById("node-modal-create").disabled = false;
    }, 600);
  }

  return { render, initModal, populateNodeSelect: _populateNodeSelect };
})();
