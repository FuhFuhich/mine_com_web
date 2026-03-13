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
        if (btn.dataset.viewTarget === "dashboard") DashboardView.render();
      });
    });
  }

  function init() {
    initTheme();
    I18n.init();
    initViews();
    DashboardView.render();
    ServersView.render();
    ModalView.init();
    CustomSelect.initAll();
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", App.init);
