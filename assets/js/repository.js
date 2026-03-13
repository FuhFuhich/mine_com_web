const ServerRepository = (() => {
  const STORAGE_KEY = "mc_servers";

  function _load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || _defaults();
    } catch {
      return _defaults();
    }
  }

  function _defaults() {
    return [
      { id: 1, name: "Survival‑RU‑1", version: "1.20.4", modLoader: "Paper", node: "ubuntu‑node‑01", ram: 4096, status: "online" },
      { id: 2, name: "Modpack‑FTB",   version: "1.18.2", modLoader: "Forge", node: "debian‑node‑02",  ram: 6144, status: "stopped" }
    ];
  }

  function _save(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function getAll() {
    return _load();
  }

  function create(data) {
    const list = _load();
    const server = { id: Date.now(), status: "stopped", node: "ubuntu‑node‑01", ...data };
    list.push(server);
    _save(list);
    return server;
  }

  function updateStatus(id, status) {
    const list = _load();
    const s = list.find(x => x.id === id);
    if (s) { s.status = status; _save(list); }
    return s;
  }

  return { getAll, create, updateStatus };
})();
