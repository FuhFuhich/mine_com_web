const ServersView = (() => {
  function _statusPill(status) {
    const cls = status === "online" ? "status-online" : "status-offline";
    const key = status === "online" ? "status.online" : "status.stopped";
    return `<span class="status-pill ${cls}">${I18n.t(key)}</span>`;
  }

  function _actionBtns(server) {
    if (server.status === "online") {
      return `<button class="action-btn action-btn--stop"  data-action="stop"   data-id="${server.id}">${I18n.t("servers.stop")}</button>
              <button class="action-btn action-btn--backup" data-action="backup" data-id="${server.id}">${I18n.t("servers.backup")}</button>`;
    }
    return `<button class="action-btn action-btn--start" data-action="start" data-id="${server.id}">${I18n.t("servers.start")}</button>
            <button class="action-btn action-btn--backup" data-action="backup" data-id="${server.id}">${I18n.t("servers.backup")}</button>`;
  }

  function render() {
    const tbody = document.getElementById("servers-tbody");
    if (!tbody) return;
    const servers = ViewModel.getServers();
    tbody.innerHTML = servers.map(s => `
      <tr data-server-id="${s.id}">
        <td>${s.name}</td>
        <td>${s.version} (${s.modLoader})</td>
        <td>${s.node}</td>
        <td>${_statusPill(s.status)}</td>
        <td>${_actionBtns(s)}</td>
      </tr>
    `).join("");

    tbody.querySelectorAll("[data-action]").forEach(btn => {
      btn.addEventListener("click", () => _handleAction(btn.dataset.action, Number(btn.dataset.id)));
    });
  }

  function _handleAction(action, id) {
    const server = ViewModel.getServers().find(s => s.id === id);
    if (action === "start") {
      ServerController.startServer(id).then(() => {
        Toast.show(I18n.t("toast.serverStarted"), "success");
        render();
        DashboardView.render();
      });
    } else if (action === "stop") {
      ServerController.stopServer(id).then(() => {
        Toast.show(I18n.t("toast.serverStopped"), "info");
        render();
        DashboardView.render();
      });
    } else if (action === "backup") {
      Toast.show(I18n.t("toast.backupStarted") + (server ? server.name : ""), "info");
      ServerController.createBackup(id).then(() => {
        Toast.show(I18n.t("toast.backupDone"), "success");
      });
    }
  }

  return { render };
})();
