const ServersService = (() => {
  const KEY = 'mc_servers';

  function _load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || _defaults(); }
    catch { return _defaults(); }
  }

  function _defaults() {
    return [
      { id: 1, name: 'Survival-RU-1', version: '1.20.4', modLoader: 'Paper', node: 'ubuntu-node-01', ram: 4096, status: 'online' },
      { id: 2, name: 'Modpack-FTB',   version: '1.18.2', modLoader: 'Forge', node: 'debian-node-02', ram: 6144, status: 'stopped' }
    ];
  }

  function _save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function getAll() {
    return Promise.resolve(_load());
  }

  function create(data) {
    return new Promise(resolve => setTimeout(() => {
      const list = _load();
      const s = { id: Date.now(), status: 'stopped', ...data };
      list.push(s);
      _save(list);
      resolve(s);
    }, 800));
  }

  function updateStatus(id, status) {
    return new Promise(resolve => setTimeout(() => {
      const list = _load();
      const s = list.find(x => x.id === id);
      if (s) { s.status = status; _save(list); }
      resolve(s);
    }, 600));
  }

  function createBackup(id) {
    return new Promise(resolve => setTimeout(() => resolve({ id, done: true }), 1500));
  }

  return { getAll, create, updateStatus, createBackup };
})();