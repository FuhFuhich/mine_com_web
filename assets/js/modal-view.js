const ModalView = (() => {
  function init() {
    document.getElementById("btn-new-server").addEventListener("click", open);
    document.getElementById("modal-cancel").addEventListener("click", close);
    document.getElementById("modal-create").addEventListener("click", _submit);
    document.getElementById("server-modal-overlay").addEventListener("click", e => {
      if (e.target === e.currentTarget) close();
    });

    document.querySelectorAll("input[name='deploy-target']").forEach(radio => {
      radio.addEventListener("change", _onTargetChange);
    });

    _initDropzone("f-dropzone", "f-modpack-file", "dropzone-filename", ".zip");
    _initDropzone("f-dropzone-jar", "f-modloader-file", "dropzone-jar-filename", ".jar");
    _initConvenienceToggles();
  }

  function _initDropzone(zoneId, inputId, labelId, accept) {
    const zone  = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);

    zone.addEventListener("click", () => input.click());

    input.addEventListener("change", () => {
      if (input.files[0]) label.textContent = input.files[0].name;
    });

    zone.addEventListener("dragover", e => {
      e.preventDefault();
      zone.classList.add("dropzone--active");
    });

    zone.addEventListener("dragleave", () => zone.classList.remove("dropzone--active"));

    zone.addEventListener("drop", e => {
      e.preventDefault();
      zone.classList.remove("dropzone--active");
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(accept)) {
        label.textContent = file.name;
      }
    });
  }

  function _initConvenienceToggles() {
    _bindToggleSubrow("f-auto-backup",         "f-backup-interval-wrap");
    _bindToggleSubrow("f-backup-cleanup",       "f-backup-ttl-wrap");
    _bindToggleSubrow("f-docker-auto-backup",   "f-docker-backup-interval-wrap");
    _bindToggleSubrow("f-docker-backup-cleanup","f-docker-backup-ttl-wrap");
    _bindMaxResources("f-max-resources",        "f-ram", "f-cpu", 8192, 8);
    _bindMaxResources("f-docker-max-resources", "f-docker-ram", "f-docker-cpu", 8192, 8);
  }

  function _bindToggleSubrow(checkboxId, rowId) {
    const cb  = document.getElementById(checkboxId);
    const row = document.getElementById(rowId);
    if (!cb || !row) return;
    row.style.display = cb.checked ? "" : "none";
    cb.addEventListener("change", () => { row.style.display = cb.checked ? "" : "none"; });
  }

  function _bindMaxResources(checkboxId, ramId, cpuId, maxRam, maxCpu) {
    const cb = document.getElementById(checkboxId);
    if (!cb) return;
    cb.addEventListener("change", () => {
      if (cb.checked) {
        document.getElementById(ramId).value = maxRam;
        document.getElementById(cpuId).value = maxCpu;
        Toast.show("Max resources applied", "info", 1800);
      }
    });
  }

  function _onTargetChange() {
    const val = document.querySelector("input[name='deploy-target']:checked").value;
    document.getElementById("fields-server").style.display = val === "server" ? "" : "none";
    document.getElementById("fields-docker").style.display = val === "docker" ? "" : "none";
  }

  function open() {
    document.getElementById("server-modal-overlay").classList.add("active");
    document.getElementById("modal-form").reset();
    document.getElementById("dropzone-filename").textContent     = "";
    document.getElementById("dropzone-jar-filename").textContent = "";
    document.getElementById("fields-server").style.display = "";
    document.getElementById("fields-docker").style.display = "none";
    document.getElementById("f-backup-interval-wrap").style.display  = "";
    document.getElementById("f-backup-ttl-wrap").style.display       = "";
    document.getElementById("f-docker-backup-interval-wrap").style.display = "";
    document.getElementById("f-docker-backup-ttl-wrap").style.display      = "";
    CustomSelect.initAll(document.getElementById("server-modal-overlay"));
  }

  function close() {
    document.getElementById("server-modal-overlay").classList.remove("active");
  }

  function _collect() {
    const target = document.querySelector("input[name='deploy-target']:checked").value;
    const base = {
      name:              document.getElementById("f-name").value.trim(),
      version:           document.getElementById("f-version").value,
      modLoader:         document.getElementById("f-modloader").value,
      modLoaderVersion:  document.getElementById("f-modloader-version").value.trim(),
      target
    };

    if (target === "server") {
      return {
        ...base,
        ram:           parseInt(document.getElementById("f-ram").value) || 2048,
        cpu:           parseInt(document.getElementById("f-cpu").value) || 2,
        disk:          parseInt(document.getElementById("f-disk").value) || 20,
        port:          parseInt(document.getElementById("f-port").value) || 25565,
        jvmFlags:      document.getElementById("f-jvm").value.trim(),
        autoRestart:   document.getElementById("f-auto-restart").checked,
        autoBackup:    document.getElementById("f-auto-backup").checked,
        backupInterval:parseInt(document.getElementById("f-backup-interval").value) || 6,
        backupTtl:     parseInt(document.getElementById("f-backup-ttl").value) || 7,
        whitelist:     document.getElementById("f-whitelist").checked,
        rcon:          document.getElementById("f-rcon").checked
      };
    }

    return {
      ...base,
      ram:           parseInt(document.getElementById("f-docker-ram").value) || 2048,
      cpu:           parseInt(document.getElementById("f-docker-cpu").value) || 2,
      disk:          parseInt(document.getElementById("f-docker-disk").value) || 20,
      port:          parseInt(document.getElementById("f-docker-port").value) || 25565,
      memSwap:       parseInt(document.getElementById("f-docker-swap").value) || 512,
      image:         document.getElementById("f-docker-image").value,
      restartPolicy: document.getElementById("f-restart-policy").value,
      networkMode:   document.getElementById("f-network-mode").value,
      jvmFlags:      document.getElementById("f-docker-jvm").value.trim(),
      autoBackup:    document.getElementById("f-docker-auto-backup").checked,
      backupInterval:parseInt(document.getElementById("f-docker-backup-interval").value) || 6,
      backupTtl:     parseInt(document.getElementById("f-docker-backup-ttl").value) || 7,
      healthcheck:   document.getElementById("f-docker-healthcheck").checked,
      readonlyFs:    document.getElementById("f-docker-readonly-fs").checked,
      logLimit:      document.getElementById("f-docker-log-limit").checked,
      rcon:          document.getElementById("f-docker-rcon").checked
    };
  }

  function _submit() {
    const data = _collect();
    if (!data.name) return;
    document.getElementById("modal-create").disabled = true;
    ServerController.createServer(data).then(() => {
      close();
      Toast.show(I18n.t("toast.serverCreated"), "success");
      ServersView.render();
      DashboardView.render();
      document.getElementById("modal-create").disabled = false;
    });
  }

  return { init, open, close };
})();
