const Router = (() => {
  const STORAGE_KEYS = {
    lastView: 'mc.router.lastView',
    scrollPrefix: 'mc.router.scroll.'
  };

  const _handlers = {};
  const _renderedViews = new Set();
  let _currentView = null;

  function on(viewName, handler) {
    _handlers[viewName] = handler;
  }

  function _getHandlerEntry(viewName) {
    const handler = _handlers[viewName];
    if (!handler) return {};
    return typeof handler === 'function' ? { render: handler } : handler;
  }

  function _getAvailableViews() {
    return Array.from(document.querySelectorAll('.view[data-view]')).map(view => view.dataset.view);
  }

  function _resolveView(viewName) {
    const available = _getAvailableViews();
    if (available.includes(viewName)) return viewName;
    return available[0] || 'dashboard';
  }

  function _getViewRoot(viewName) {
    return document.querySelector(`.view[data-view="${viewName}"]`);
  }

  function _updateActiveState(viewName) {
    document.querySelectorAll('[data-view-target]').forEach(button => {
      button.classList.toggle('active', button.dataset.viewTarget === viewName);
    });

    document.querySelectorAll('.view[data-view]').forEach(view => {
      view.classList.toggle('active', view.dataset.view === viewName);
    });
  }

  function _saveScrollPosition(viewName) {
    if (!viewName) return;
    try {
      sessionStorage.setItem(`${STORAGE_KEYS.scrollPrefix}${viewName}`, String(window.scrollY || 0));
    } catch {
      /* no-op */
    }
  }

  function _restoreScrollPosition(viewName) {
    let nextScroll = 0;
    try {
      const saved = sessionStorage.getItem(`${STORAGE_KEYS.scrollPrefix}${viewName}`);
      nextScroll = saved == null ? 0 : Number(saved) || 0;
    } catch {
      nextScroll = 0;
    }

    requestAnimationFrame(() => {
      window.scrollTo({ top: nextScroll, left: 0, behavior: 'auto' });
    });
  }

  function _writeLocation(viewName, { replace = false } = {}) {
    const nextHash = `#${viewName}`;
    if (window.location.hash === nextHash) return;

    if (replace) {
      history.replaceState(null, '', nextHash);
      return;
    }

    history.pushState(null, '', nextHash);
  }

  async function navigate(viewName, options = {}) {
    const resolvedView = _resolveView(viewName);
    const previousView = _currentView;

    if (previousView === resolvedView && !options.force) {
      if (options.updateHash !== false) _writeLocation(resolvedView, { replace: options.replaceHash === true });
      return;
    }

    if (previousView) {
      _saveScrollPosition(previousView);
      const previousHandler = _getHandlerEntry(previousView);
      const previousRoot = _getViewRoot(previousView);
      if (typeof previousHandler.onLeave === 'function') {
        try {
          previousHandler.onLeave(previousRoot);
        } catch {
          /* no-op */
        }
      }
    }

    _currentView = resolvedView;

    _updateActiveState(resolvedView);

    try {
      sessionStorage.setItem(STORAGE_KEYS.lastView, resolvedView);
    } catch {
      /* no-op */
    }

    if (options.updateHash !== false) {
      _writeLocation(resolvedView, { replace: options.replaceHash === true });
    }

    const handler = _getHandlerEntry(resolvedView);
    const root = _getViewRoot(resolvedView);

    if (!handler.keepAlive || !_renderedViews.has(resolvedView)) {
      if (typeof handler.render === 'function') {
        await Promise.resolve(handler.render(root));
      }
      _renderedViews.add(resolvedView);
    }

    if (typeof handler.onEnter === 'function') {
      await Promise.resolve(handler.onEnter(root));
    }

    _restoreScrollPosition(resolvedView);
  }

  function init() {
    document.querySelectorAll('[data-view-target]').forEach(button => {
      button.addEventListener('click', () => navigate(button.dataset.viewTarget));
    });

    document.addEventListener('click', event => {
      const target = event.target.closest('[data-view-nav]');
      if (!target) return;
      event.preventDefault();
      navigate(target.dataset.viewNav);
    });

    window.addEventListener('hashchange', () => {
      const hashView = window.location.hash.replace(/^#/, '').trim();
      const nextView = _resolveView(hashView || _currentView || 'dashboard');
      navigate(nextView, { updateHash: false, force: nextView !== _currentView });
    });

    const currentHash = window.location.hash.replace(/^#/, '').trim();
    let initialView = currentHash;

    if (!initialView) {
      try {
        initialView = sessionStorage.getItem(STORAGE_KEYS.lastView) || '';
      } catch {
        initialView = '';
      }
    }

    if (!initialView) {
      initialView = document.querySelector('.view.active')?.dataset.view || 'dashboard';
    }

    navigate(initialView, { replaceHash: true });
  }

  function getCurrentView() {
    return _currentView;
  }

  return { init, navigate, on, getCurrentView };
})();
