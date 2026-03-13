const ViewModel = (() => {
  function getDashboardStats() {
    const servers = ServerRepository.getAll();
    const online = servers.filter(s => s.status === "online").length;
    return {
      total: servers.length,
      online,
      cpu: Math.floor(30 + Math.random() * 20),
      disk: "1.2 TB"
    };
  }

  function getServers() {
    return ServerRepository.getAll();
  }

  return { getDashboardStats, getServers };
})();
