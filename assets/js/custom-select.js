const CustomSelect = (() => {
  function init(selectEl) {
    if (selectEl.dataset.customized) return;
    selectEl.dataset.customized = "1";
    selectEl.style.display = "none";

    const wrapper = document.createElement("div");
    wrapper.className = "csel-wrapper";

    const trigger = document.createElement("div");
    trigger.className = "csel-trigger";
    trigger.textContent = selectEl.options[selectEl.selectedIndex]?.text || "";

    const dropdown = document.createElement("div");
    dropdown.className = "csel-dropdown";

    Array.from(selectEl.options).forEach((opt, i) => {
      const item = document.createElement("div");
      item.className = "csel-option" + (i === selectEl.selectedIndex ? " selected" : "");
      item.textContent = opt.text;
      item.dataset.value = opt.value;
      item.addEventListener("click", () => {
        selectEl.value = opt.value;
        trigger.textContent = opt.text;
        dropdown.querySelectorAll(".csel-option").forEach(o => o.classList.remove("selected"));
        item.classList.add("selected");
        dropdown.classList.remove("open");
        selectEl.dispatchEvent(new Event("change"));
      });
      dropdown.appendChild(item);
    });

    trigger.addEventListener("click", e => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains("open");
      document.querySelectorAll(".csel-dropdown.open").forEach(d => d.classList.remove("open"));
      if (!isOpen) dropdown.classList.add("open");
    });

    wrapper.appendChild(trigger);
    wrapper.appendChild(dropdown);
    selectEl.parentNode.insertBefore(wrapper, selectEl.nextSibling);
  }

  function initAll(root) {
    (root || document).querySelectorAll(".form-group select").forEach(init);
  }

  document.addEventListener("click", () => {
    document.querySelectorAll(".csel-dropdown.open").forEach(d => d.classList.remove("open"));
  });

  return { init, initAll };
})();
