document.addEventListener("DOMContentLoaded", () => {
  // Theme
  const saved = localStorage.getItem("theme") || "dark";
  document.body.dataset.theme = saved;
  document.getElementById("themeSwitch").addEventListener("click", () => {
    const next = document.body.dataset.theme === "dark" ? "light" : "dark";
    document.body.dataset.theme = next;
    localStorage.setItem("theme", next);
  });

  // i18n
  I18n.init();

  // Tabs
  document.querySelectorAll(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      showForm("tab-" + tab.dataset.tab);
    });
  });

  // Method toggle (email/phone)
  document.querySelectorAll(".method-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".method-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const isPhone = btn.dataset.method === "phone";
      document.getElementById("reg-email-group").style.display = isPhone ? "none" : "";
      document.getElementById("reg-phone-group").style.display = isPhone ? "" : "none";
    });
  });

  // Eye toggle
  document.querySelectorAll(".eye-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = document.getElementById(btn.dataset.target);
      input.type = input.type === "password" ? "text" : "password";
      btn.textContent = "👁";
      btn.style.opacity = input.type === "password" ? "0.45" : "1";
    });
  });

  // Password strength
  document.getElementById("r-password").addEventListener("input", e => {
    updateStrength(e.target.value);
  });

  // Code inputs — auto-advance
  const cells = document.querySelectorAll(".code-cell");
  cells.forEach((cell, i) => {
    cell.addEventListener("input", () => {
      cell.value = cell.value.replace(/\D/, "");
      if (cell.value) {
        cell.classList.add("filled");
        if (i < cells.length - 1) cells[i + 1].focus();
      } else {
        cell.classList.remove("filled");
      }
    });
    cell.addEventListener("keydown", e => {
      if (e.key === "Backspace" && !cell.value && i > 0) cells[i - 1].focus();
    });
    cell.addEventListener("paste", e => {
      e.preventDefault();
      const digits = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
      digits.split("").forEach((d, j) => {
        if (cells[j]) { cells[j].value = d; cells[j].classList.add("filled"); }
      });
      if (cells[Math.min(digits.length, 5)]) cells[Math.min(digits.length, 5)].focus();
    });
  });

  // Send code
  document.getElementById("btn-send-code").addEventListener("click", () => {
    const method = document.querySelector(".method-btn.active").dataset.method;
    const identity = method === "email"
      ? document.getElementById("r-email").value.trim()
      : document.getElementById("r-phone-code").value + document.getElementById("r-phone").value.trim();
    const pwd  = document.getElementById("r-password").value;
    const pwd2 = document.getElementById("r-password2").value;
    const user = document.getElementById("r-username").value.trim();

    if (!identity || !user) { Toast.show(I18n.t("auth.fillAll"), "error"); return; }
    if (pwd !== pwd2)        { Toast.show(I18n.t("auth.pwdMismatch"), "error"); return; }
    if (pwd.length < 6)      { Toast.show(I18n.t("auth.pwdShort"), "error"); return; }

    // Имитация отправки кода
    document.getElementById("confirm-hint-text").textContent =
      I18n.t("auth.codeSentTo") + " " + identity;
    showForm("tab-confirm");
    startResendTimer(60);
    Toast.show(I18n.t("auth.codeSent"), "success");
    // Позже: fetch("/api/auth/send-code", { method: "POST", body: JSON.stringify({ identity }) })
  });

  // Verify code
  document.getElementById("btn-verify").addEventListener("click", () => {
    const code = Array.from(cells).map(c => c.value).join("");
    if (code.length < 6) { Toast.show(I18n.t("auth.enterCode"), "error"); return; }

    // Имитация проверки — правильный код "123456"
    if (code === "123456") {
      Toast.show(I18n.t("auth.registered"), "success");
      setTimeout(() => { window.location.href = "index.html"; }, 1200);
    } else {
      cells.forEach(c => c.classList.add("error"));
      setTimeout(() => cells.forEach(c => c.classList.remove("error")), 600);
      Toast.show(I18n.t("auth.wrongCode"), "error");
    }
    // Позже: fetch("/api/auth/verify", { method: "POST", body: JSON.stringify({ identity, code }) })
  });

  // Login
  document.getElementById("btn-login").addEventListener("click", () => {
    const identity = document.getElementById("l-identity").value.trim();
    const pwd      = document.getElementById("l-password").value;
    if (!identity || !pwd) { Toast.show(I18n.t("auth.fillAll"), "error"); return; }

    // Имитация входа
    Toast.show(I18n.t("auth.welcome"), "success");
    setTimeout(() => { window.location.href = "index.html"; }, 1000);
    // Позже: fetch("/api/auth/login", { method: "POST", ... })
  });

  // Demo
  document.getElementById("btn-demo").addEventListener("click", () => {
    localStorage.setItem("demo_mode", "1");
    window.location.href = "index.html";
  });

  // Forgot
  document.getElementById("btn-forgot").addEventListener("click", () => showForm("tab-forgot"));
  document.getElementById("btn-back-login").addEventListener("click", () => {
    showForm("tab-login");
    setActiveTab("login");
  });
  document.getElementById("btn-back-register").addEventListener("click", () => {
    showForm("tab-register");
    setActiveTab("register");
  });
  document.getElementById("btn-reset").addEventListener("click", () => {
    const v = document.getElementById("f-identity").value.trim();
    if (!v) { Toast.show(I18n.t("auth.fillAll"), "error"); return; }
    Toast.show(I18n.t("auth.resetSent"), "success");
    showForm("tab-login"); setActiveTab("login");
  });

  // Resend
  document.getElementById("btn-resend").addEventListener("click", () => {
    startResendTimer(60);
    Toast.show(I18n.t("auth.codeSent"), "success");
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function showForm(id) {
  document.querySelectorAll(".auth-form").forEach(f => f.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

function setActiveTab(name) {
  document.querySelectorAll(".auth-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.tab === name);
  });
}

let _resendInterval = null;
function startResendTimer(seconds) {
  const timerEl  = document.getElementById("resend-timer");
  const resendBtn = document.getElementById("btn-resend");
  resendBtn.style.display = "none";
  let left = seconds;

  clearInterval(_resendInterval);
  _resendInterval = setInterval(() => {
    timerEl.textContent = I18n.t("auth.resendIn") + " " + left + "s";
    left--;
    if (left < 0) {
      clearInterval(_resendInterval);
      timerEl.textContent = "";
      resendBtn.style.display = "inline";
    }
  }, 1000);
}

function updateStrength(pwd) {
  const fill  = document.getElementById("strength-fill");
  const label = document.getElementById("strength-label");
  let score = 0;
  if (pwd.length >= 6)  score++;
  if (pwd.length >= 10) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  const levels = [
    { w: "0%",   bg: "transparent", label: "" },
    { w: "20%",  bg: "#ff5252",     label: "Weak" },
    { w: "40%",  bg: "#ff9100",     label: "Fair" },
    { w: "60%",  bg: "#ffea00",     label: "Good" },
    { w: "80%",  bg: "#69f0ae",     label: "Strong" },
    { w: "100%", bg: "#00e676",     label: "Excellent" }
  ];
  const lvl = levels[score] || levels[0];
  fill.style.width      = lvl.w;
  fill.style.background = lvl.bg;
  label.textContent     = lvl.label;
}
