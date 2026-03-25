const NodesService = (() => {
  const KEY = 'mc_nodes';

  function _load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || _defaults(); }
    catch { return _defaults(); }
  }

  function _defaults() {
    return [
      { id: 1, name: 'ubuntu-node-01', ip: '192.168.1.10', sshPort: 22, sshUser: 'root', description: '', status: 'online' },
      { id: 2, name: 'debian-node-02',  ip: '192.168.1.11', sshPort: 22, sshUser: 'root', description: '', status: 'offline' }
    ];
  }

  function _save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  function getAll() {
    return Promise.resolve(_load());
  }

  function create(data) {
    return new Promise(resolve => {
      const list = _load();
      const node = { id: Date.now(), status: 'connecting', ...data };
      list.push(node);
      _save(list);
      setTimeout(() => {
        const l = _load();
        const n = l.find(x => x.id === node.id);
        if (n) { n.status = 'online'; _save(l); NodesView.render(); }
      }, 2000);
      resolve(node);
    });
  }

  function remove(id) {
    _save(_load().filter(x => x.id !== id));
    return Promise.resolve();
  }

  return { getAll, create, remove };
})();