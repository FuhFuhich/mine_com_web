document.addEventListener('DOMContentLoaded', () => {

  const saved = localStorage.getItem('theme') || 'dark';
  document.body.dataset.theme = saved;
  document.getElementById('themeSwitch')?.addEventListener('click', () => {
    const next = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = next;
    localStorage.setItem('theme', next);
  });

  I18n.init();

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      _showForm('tab-' + tab.dataset.tab);
    });
  });

  document.querySelectorAll('.method-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const isPhone = btn.dataset.method === 'phone';
      document.getElementById('reg-email-group').style.display = isPhone ? 'none' : '';
      document.getElementById('reg-phone-group').style.display = isPhone ? '' : 'none';
    });
  });

  document.querySelectorAll('.eye-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      if (!input) return;

      const isHidden = input.type === 'password';
      input.type = isHidden ? 'text' : 'password';

      btn.classList.toggle('is-visible', isHidden);
      btn.setAttribute('aria-label', isHidden ? 'Скрыть пароль' : 'Показать пароль');
      btn.setAttribute('title', isHidden ? 'Скрыть пароль' : 'Показать пароль');
    });
  });

  document.getElementById('r-password')?.addEventListener('input', e => {
    _updateStrength(e.target.value);
  });

  const cells = document.querySelectorAll('.code-cell');
  cells.forEach((cell, i) => {
    cell.addEventListener('input', () => {
      cell.value = cell.value.replace(/\D/, '');
      if (cell.value) {
        cell.classList.add('filled');
        if (i < cells.length - 1) cells[i + 1].focus();
      } else {
        cell.classList.remove('filled');
      }
    });

    cell.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !cell.value && i > 0) {
        cells[i - 1].focus();
      }
    });

    cell.addEventListener('paste', e => {
      e.preventDefault();
      const digits = (e.clipboardData.getData('text') || '')
        .replace(/\D/g, '')
        .slice(0, 6);

      digits.split('').forEach((d, j) => {
        if (cells[j]) {
          cells[j].value = d;
          cells[j].classList.add('filled');
        }
      });

      if (cells[Math.min(digits.length, 5)]) {
        cells[Math.min(digits.length, 5)].focus();
      }
    });
  });

  document.getElementById('btn-login')?.addEventListener('click', async () => {
    const identity = document.getElementById('l-identity').value.trim();
    const password = document.getElementById('l-password').value;

    if (!identity || !password) {
      Toast.show(I18n.t('auth.fillAll'), 'error');
      return;
    }

    const btn = document.getElementById('btn-login');
    btn.disabled = true;
    btn.textContent = '...';

    try {
      const data = await Api.post('/api/auth/login', { identity, password });
      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);

      if (document.getElementById('l-remember')?.checked) {
        localStorage.setItem('remember', '1');
      }

      Toast.show(I18n.t('auth.welcome'), 'success');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 900);
    } catch (err) {
      Toast.show(err.message || I18n.t('auth.loginError'), 'error');
      btn.disabled = false;
      btn.textContent = I18n.t('auth.signIn');
    }
  });

  document.getElementById('btn-send-code')?.addEventListener('click', async () => {
    const method = document.querySelector('.method-btn.active')?.dataset.method || 'email';
    const email = document.getElementById('r-email').value.trim();
    const phone = document.getElementById('r-phone-code').value + document.getElementById('r-phone').value.trim();
    const identity = method === 'email' ? email : phone;
    const username = document.getElementById('r-username').value.trim();
    const password = document.getElementById('r-password').value;
    const password2 = document.getElementById('r-password2').value;

    if (!identity || !username) {
      Toast.show(I18n.t('auth.fillAll'), 'error');
      return;
    }

    if (password !== password2) {
      Toast.show(I18n.t('auth.pwdMismatch'), 'error');
      return;
    }

    if (password.length < 6) {
      Toast.show(I18n.t('auth.pwdShort'), 'error');
      return;
    }

    _pendingReg = {
      username,
      password,
      email: method === 'email' ? email : null,
      phoneNumber: method === 'phone' ? phone : null
    };

    const btn = document.getElementById('btn-send-code');
    btn.disabled = true;
    btn.textContent = '...';

    try {
      const data = await Api.post('/api/auth/register', {
        username: _pendingReg.username,
        password: _pendingReg.password,
        email: _pendingReg.email || null,
        phoneNumber: _pendingReg.phoneNumber || null
      });

      localStorage.setItem('token', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);

      Toast.show(I18n.t('auth.registered'), 'success');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 900);
    } catch (err) {
      Toast.show(err.message || I18n.t('auth.registerError'), 'error');
      btn.disabled = false;
      btn.textContent = I18n.t('auth.sendCode');
    }
  });

  document.getElementById('btn-reset')?.addEventListener('click', async () => {
    const identity = document.getElementById('f-identity').value.trim();

    if (!identity) {
      Toast.show(I18n.t('auth.fillAll'), 'error');
      return;
    }

    const btn = document.getElementById('btn-reset');
    btn.disabled = true;
    btn.textContent = '...';

    try {
      Toast.show(I18n.t('auth.resetSent'), 'success');
      _showForm('tab-login');
      _setActiveTab('login');
    } catch (err) {
      Toast.show(err.message || I18n.t('auth.resetError'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = I18n.t('auth.sendReset');
    }
  });

  document.getElementById('btn-forgot')?.addEventListener('click', () => _showForm('tab-forgot'));
  document.getElementById('btn-back-login')?.addEventListener('click', () => {
    _showForm('tab-login');
    _setActiveTab('login');
  });
  document.getElementById('btn-back-register')?.addEventListener('click', () => {
    _showForm('tab-register');
    _setActiveTab('register');
  });

  document.getElementById('btn-resend')?.addEventListener('click', () => {
    _startResendTimer(60);
    Toast.show(I18n.t('auth.codeSent'), 'success');
  });

  if (localStorage.getItem('token')) {
    window.location.href = 'index.html';
  }
});

let _pendingReg = null;

function _showForm(id) {
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

function _setActiveTab(name) {
  document.querySelectorAll('.auth-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === name);
  });
}

function _startResendTimer(seconds) {
  const timerEl = document.getElementById('resend-timer');
  const resendBtn = document.getElementById('btn-resend');

  if (!timerEl || !resendBtn) return;

  resendBtn.style.display = 'none';
  let left = seconds;
  timerEl.textContent = left + 's';

  const iv = setInterval(() => {
    left--;
    timerEl.textContent = left + 's';

    if (left <= 0) {
      clearInterval(iv);
      timerEl.textContent = '';
      resendBtn.style.display = '';
    }
  }, 1000);
}

function _updateStrength(pwd) {
  const fill = document.getElementById('strength-fill');
  const label = document.getElementById('strength-label');

  if (!fill || !label) return;

  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  const levels = [
    { pct: '15%', color: '#ff5252', text: I18n.t('auth.strengthWeak') },
    { pct: '40%', color: '#ff9800', text: I18n.t('auth.strengthFair') },
    { pct: '70%', color: '#ffeb3b', text: I18n.t('auth.strengthGood') },
    { pct: '100%', color: '#00e676', text: I18n.t('auth.strengthStrong') }
  ];

  const lvl = levels[Math.max(0, score - 1)] || levels[0];
  fill.style.width = pwd.length ? lvl.pct : '0%';
  fill.style.background = lvl.color;
  label.textContent = pwd.length ? lvl.text : '';
}