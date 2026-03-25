const CustomSelect = (() => {
  function initAll() {
    document.querySelectorAll('[data-custom-select]').forEach(init);
  }

  function init(wrapper) {
    const select = wrapper.querySelector('select');
    if (!select) return;

    const trigger = wrapper.querySelector('.cs-trigger');
    const dropdown = wrapper.querySelector('.cs-dropdown');
    if (!trigger || !dropdown) return;

    trigger.addEventListener('click', e => {
      e.stopPropagation();
      wrapper.classList.toggle('open');
    });

    dropdown.querySelectorAll('.cs-option').forEach(opt => {
      opt.addEventListener('click', () => {
        select.value = opt.dataset.value;
        trigger.textContent = opt.textContent;
        wrapper.classList.remove('open');
        select.dispatchEvent(new Event('change'));
      });
    });

    document.addEventListener('click', () => wrapper.classList.remove('open'));
  }

  return { initAll, init };
})();