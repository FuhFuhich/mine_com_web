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
            window.location.href = 'auth.html';
        });
    }

    function init() {
        initTheme();
        I18n.init();

        Router.on('dashboard', DashboardView.render);
        Router.on('nodes',    NodesView.render);
        Router.on('servers',  ServersView.render);
        Router.on('metrics',  MetricsView.render);
        Router.on('logs',     LogsView.render);
        Router.on('configs',  ConfigsView.render);
        Router.on('files',    FilesView.render);
        Router.on('backups',  BackupsView.render);

        Router.init();

        DashboardView.render();
        DashboardView.initModals();

        NodesView.render();
        NodesView.initModal();

        ServersView.init();

        initLogout();
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
