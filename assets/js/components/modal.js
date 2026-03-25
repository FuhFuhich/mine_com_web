const Modal = (() => {
  function init() {
    // Server modal
    const serverOverlay = document.getElementById('server-modal-overlay');
    const btnNewServer  = document.getElementById('btn-new-server');
    const btnCancel     = document.getElementById('modal-cancel');
    const btnCreate     = document.getElementById('modal-create');

    if (btnNewServer) btnNewServer.addEventListener('click', () => _openModal(serverOverlay));
    if (btnCancel)    btnCancel.addEventListener('click',    () => _closeModal(serverOverlay));
    if (serverOverlay) serverOverlay.addEventListener('click', e => {
      if (e.target === serverOverlay) _closeModal(serverOverlay);
    });

    // Deploy target toggle
    const radios = document.querySelectorAll('[name="deploy-target"]');
    radios.forEach(r => r.addEventListener('change', () => {
      const isDocker = r.value === 'docker' && r.checked;
      const fdocker  = document.getElementById('fields-docker');
      const fserver  = document.getElementById('fields-server');
      if (fdocker) fdocker.style.display = isDocker ? '' : 'none';
      if (fserver) fserver.style.display = isDocker ? 'none' : '';
    }));

    // Backup interval toggle
    _toggleOnCheck('f-auto-backup',   'f-backup-interval-wrap');
    _toggleOnCheck('f-backup-cleanup','f-backup-ttl-wrap');
    _toggleOnCheck('f-docker-auto-backup',   'f-docker-backup-interval-wrap');
    _toggleOnCheck('f-docker-backup-cleanup','f-docker-backup-ttl-wrap');

    // Dropzones
    _initDropzone('f-dropzone',     'f-modpack-file',    'dropzone-filename');
    _initDropzone('f-dropzone-jar', 'f-modloader-file',  'dropzone-jar-filename');
    _initDropzone('n-key-dropzone', 'n-key-file',        'n-key-filename');

    // Create button
    if (btnCreate) btnCreate.addEventListener('click', _submit);
  }

  function _openModal(overlay)  { if (overlay) overlay.classList.add('active'); }
  function _closeModal(overlay) { if (overlay) overlay.classList.remove('active'); }

  function _toggleOnCheck(checkId, wrapId) {
    const checkbox = document.getElementById(checkId);
    const wrap     = document.getElementById(wrapId);
    if (!checkbox || !wrap) return;
    wrap.style.display = checkbox.checked ? '' : 'none';
    checkbox.addEventListener('change', () => {
      wrap.style.display = checkbox.checked ? '' : 'none';
    });
  }

  function _initDropzone(zoneId, inputId, filenameId) {
    const zone  = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const label = document.getElementById(filenameId);
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file && label) label.textContent = file.name;
    });
    input.addEventListener('change', () => {
      if (input.files[0] && label) label.textContent = input.files[0].name;
    });
  }

  function _submit() {
    const name    = document.getElementById('f-name')?.value.trim();
    const nodeVal = document.getElementById('f-node')?.value;
    if (!name)    { Toast.show('Введите имя сервера', 'error');  return; }
    if (!nodeVal) { Toast.show('Выберите целевой сервер', 'error'); return; }

    const isDocker = document.getElementById('f-target-docker')?.checked;
    const data = {
      name,
      node:       nodeVal,
      version:    document.getElementById('f-version')?.value    || '1.20.4',
      modLoader:  document.getElementById('f-modloader')?.value  || 'Paper',
      ram:        isDocker
                    ? Number(document.getElementById('f-docker-ram')?.value  || 2048)
                    : Number(document.getElementById('f-ram')?.value          || 2048),
      cpu:        isDocker
                    ? Number(document.getElementById('f-docker-cpu')?.value  || 2)
                    : Number(document.getElementById('f-cpu')?.value          || 2),
      port:       isDocker
                    ? Number(document.getElementById('f-docker-port')?.value || 25565)
                    : Number(document.getElementById('f-port')?.value         || 25565),
      deployType: isDocker ? 'docker' : 'server'
    };

    ServersService.create(data).then(() => {
      _closeModal(document.getElementById('server-modal-overlay'));
      ServersView.render();
      DashboardView.render();
      Toast.show(I18n.t('toast.serverStarted'), 'success');
    });
  }

  return { init };
})();