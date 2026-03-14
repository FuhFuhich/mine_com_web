const App = (() => {
  function initTheme() {
    const saved = localStorage.getItem("theme") || "dark";
    document.body.dataset.theme = saved;
    document.getElementById("themeSwitch").addEventListener("click", () => {
      const next = document.body.dataset.theme === "dark" ? "light" : "dark";
      document.body.dataset.theme = next;
      localStorage.setItem("theme", next);
    });
  }

  function initViews() {
    const navBtns = document.querySelectorAll("[data-view-target]");
    navBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        navBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".view").forEach(v =>
          v.classList.toggle("active", v.dataset.view === btn.dataset.viewTarget)
        );
        if (btn.dataset.viewTarget === "servers")   ServersView.render();
        if (btn.dataset.viewTarget === "nodes")     NodesView.render();
        if (btn.dataset.viewTarget === "dashboard") DashboardView.render();
      });
    });
  }

  function initLogout() {
    document.getElementById("btn-logout").addEventListener("click", () => {
      localStorage.removeItem("demo_mode");
      // Потом будет localStorage.removeItem("token") и POST /api/auth/logout
      window.location.href = "auth.html";
    });
  }

  function init() {
    initTheme();
    I18n.init();
    initViews();
    DashboardView.render();
    ServersView.render();
    NodesView.render();
    NodesView.initModal();
    ModalView.init();
    CustomSelect.initAll();
    initLogout();
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", App.init);
