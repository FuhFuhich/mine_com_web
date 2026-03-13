const Toast = (() => {
  let container;

  function _ensureContainer() {
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }
  }

  function show(message, type = "info", duration = 3200) {
    _ensureContainer();
    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.innerHTML = `<span class="toast-icon">${type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span><span>${message}</span>`;
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add("toast--visible"));
    setTimeout(() => {
      el.classList.remove("toast--visible");
      el.addEventListener("transitionend", () => el.remove());
    }, duration);
  }

  return { show };
})();
