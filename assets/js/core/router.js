const Router = (() => {
  const _handlers = {};

  function on(viewName, callback) {
    _handlers[viewName] = callback;
  }

  function navigate(viewName) {
    document.querySelectorAll('[data-view-target]').forEach(b =>
      b.classList.toggle('active', b.dataset.viewTarget === viewName)
    );
    document.querySelectorAll('.view').forEach(v =>
      v.classList.toggle('active', v.dataset.view === viewName)
    );
    if (_handlers[viewName]) _handlers[viewName]();
  }

  function init() {
    document.querySelectorAll('[data-view-target]').forEach(btn => {
      btn.addEventListener('click', () => navigate(btn.dataset.viewTarget));
    });
  }

  return { init, navigate, on };
})();