const App = (() => {
    function initTheme() {
        const saved = localStorage.getItem('theme') || 'dark';
        document.body.dataset.theme = saved;
        document.getElementById('themeSwitch')?.addEventListener('click', () => {
            const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
            document.body.dataset.theme = next;
            localStorage.setItem('theme', next);
        });
    }

    function initLogout() {
        document.getElementById('btn-logout')?.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('demo_mode');
            sessionStorage.removeItem('mc.router.lastView');
            window.location.href = 'auth.html';
        });
    }

    function bindRoutes() {
        Router.on('dashboard', { render: DashboardView.render });
        Router.on('nodes', { render: NodesView.render });
        Router.on('servers', { render: ServersView.render });
        Router.on('metrics', { render: MetricsView.render, keepAlive: true });
        Router.on('logs', { render: LogsView.render, keepAlive: true });
        Router.on('configs', { render: ConfigsView.render, keepAlive: true });
        Router.on('backups', { render: BackupsView.render, keepAlive: true });
    }

    function init() {
        initTheme();
        I18n.init();

        DashboardView.initModals();
        NodesView.initModal();
        ServersView.init();

        bindRoutes();
        Router.init();

        initLogout();
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
