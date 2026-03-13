const DashboardView = (() => {
  function render() {
    const stats = ViewModel.getDashboardStats();
    const el = id => document.getElementById(id);
    if (el("kpi-total"))   el("kpi-total").textContent   = stats.total;
    if (el("kpi-online"))  el("kpi-online").textContent  = stats.online;
    if (el("kpi-cpu"))     el("kpi-cpu").textContent     = stats.cpu + "%";
    if (el("kpi-disk"))    el("kpi-disk").textContent    = stats.disk;
  }
  return { render };
})();
