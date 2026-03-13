const ServerController = (() => {
  function createServer(data) {
    return new Promise(resolve => {
      setTimeout(() => resolve(ServerRepository.create(data)), 800);
    });
  }

  function startServer(id) {
    return new Promise(resolve => {
      setTimeout(() => resolve(ServerRepository.updateStatus(id, "online")), 600);
    });
  }

  function stopServer(id) {
    return new Promise(resolve => {
      setTimeout(() => resolve(ServerRepository.updateStatus(id, "stopped")), 600);
    });
  }

  function createBackup(id) {
    return new Promise(resolve => {
      setTimeout(() => resolve({ id, done: true }), 1500);
    });
  }

  return { createServer, startServer, stopServer, createBackup };
})();
