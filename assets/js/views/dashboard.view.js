const DashboardView = (() => {

  let _user = null;

  async function render() {
    _renderSkeleton();

    // KPI заглушки (шаг 5)
    _setKpi('kpi-total',  '—');
    _setKpi('kpi-online', '—');
    _setKpi('kpi-cpu',    '—');
    _setKpi('kpi-disk',   '—');

    try {
      _user = await Api.get('/api/user/me');
      _renderProfile(_user);
    } catch (err) {
      console.error('Profile load error:', err);
    }
  }

  function _setKpi(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function _renderSkeleton() {
    const el = document.getElementById('profile-block');
    if (!el) return;
    el.innerHTML = `
      <div class="profile-hero skeleton-wrap">
        <div class="skeleton skeleton-avatar"></div>
        <div class="profile-meta">
          <div class="skeleton skeleton-text" style="width:120px;height:18px"></div>
          <div class="skeleton skeleton-text" style="width:60px;height:12px;margin-top:6px"></div>
          <div class="skeleton skeleton-text" style="width:160px;height:11px;margin-top:4px"></div>
        </div>
      </div>`;
  }

  function _renderProfile(user) {
    const el = document.getElementById('profile-block');
    if (!el) return;

    const joined = user.createdAt
      ? new Date(user.createdAt).toLocaleDateString()
      : '—';

    const BASE = Api.getBase();
    const avatarContent = user.avatarUrl
        ? `<img src="${BASE + user.avatarUrl}" alt="avatar" class="profile-avatar-img">`
        : `<span class="profile-avatar-letter">${(user.username?.[0] || '?').toUpperCase()}</span>`;

    el.innerHTML = `
      <div class="profile-hero">
        <div class="profile-avatar-wrap" id="profile-avatar-wrap" title="${I18n.t('profile.changeAvatar')}">
          ${avatarContent}
          <div class="profile-avatar-overlay">
          </div>
          <input type="file" id="avatar-file-input" accept="image/*" style="display:none">
        </div>
        <div class="profile-meta">
          <div class="profile-name" id="profile-username">${user.username}</div>
          <div class="profile-role">${user.role ?? 'user'}</div>
          <div class="profile-joined">${I18n.t('profile.joined')}: ${joined}</div>
        </div>
        <div class="profile-actions">
          <button class="profile-action-btn" id="btn-open-edit-profile">
            ${I18n.t('profile.editTitle')}
          </button>
          <button class="profile-action-btn profile-action-btn--danger" id="btn-open-change-pwd">
            ${I18n.t('profile.changePassword')}
          </button>
        </div>
      </div>`;

    // Клик по аватару
    document.getElementById('profile-avatar-wrap').addEventListener('click', () => {
      document.getElementById('avatar-file-input').click();
    });

    document.getElementById('avatar-file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await _uploadAvatar(file);
    });

    // Кнопка редактировать профиль
    document.getElementById('btn-open-edit-profile').addEventListener('click', () => {
      _openEditModal(user);
    });

    // Кнопка сменить пароль
    document.getElementById('btn-open-change-pwd').addEventListener('click', () => {
      _openPasswordModal();
    });
  }

  // ── Загрузка аватара ──────────────────────────────────────────────────
  async function _uploadAvatar(file) {
    const wrap = document.getElementById('profile-avatar-wrap');
    wrap.classList.add('loading');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const updated = await Api.upload('/api/user/me/avatar', formData);
      _user.avatarUrl = updated.avatarUrl;

      // Обновить превью без перерендера
      const existing = wrap.querySelector('img, .profile-avatar-letter');
      if (existing) existing.remove();
      const img = document.createElement('img');
      img.src = Api.getBase() + updated.avatarUrl + '?t=' + Date.now();
      img.className = 'profile-avatar-img';
      wrap.insertBefore(img, wrap.querySelector('.profile-avatar-overlay'));

      Toast.show(I18n.t('profile.avatarUpdated'), 'success');
    } catch (err) {
      Toast.show(err.message || I18n.t('profile.saveError'), 'error');
    } finally {
      wrap.classList.remove('loading');
    }
  }

  // ── Модальное окно: редактировать профиль ────────────────────────────
  function _openEditModal(user) {
    const overlay = document.getElementById('profile-edit-overlay');
    document.getElementById('pe-username').value  = user.username    ?? '';
    document.getElementById('pe-email').value     = user.email       ?? '';
    document.getElementById('pe-phone').value     = user.phoneNumber ?? '';
    overlay.classList.add('active');
  }

  function _closeEditModal() {
    document.getElementById('profile-edit-overlay').classList.remove('active');
  }

  // ── Модальное окно: сменить пароль ───────────────────────────────────
  function _openPasswordModal() {
    ['pp-cur', 'pp-new', 'pp-new2'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('profile-pwd-overlay').classList.add('active');
  }

  function _closePwdModal() {
    document.getElementById('profile-pwd-overlay').classList.remove('active');
  }

  // ── Инициализация модалок ─────────────────────────────────────────────
  function initModals() {
    // Закрытие по оверлею
    document.getElementById('profile-edit-overlay')
      .addEventListener('click', e => { if (e.target === e.currentTarget) _closeEditModal(); });
    document.getElementById('profile-pwd-overlay')
      .addEventListener('click', e => { if (e.target === e.currentTarget) _closePwdModal(); });

    // Кнопки отмены
    document.getElementById('pe-cancel').addEventListener('click', _closeEditModal);
    document.getElementById('pp-cancel').addEventListener('click', _closePwdModal);

    // Eye btn в модалке пароля
    document.querySelectorAll('#profile-pwd-overlay .eye-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        input.type = input.type === 'password' ? 'text' : 'password';
        btn.style.opacity = input.type === 'password' ? '0.45' : '1';
      });
    });

    // Сохранить профиль
    document.getElementById('pe-save').addEventListener('click', async () => {
      const btn = document.getElementById('pe-save');
      btn.disabled = true;
      try {
        const updated = await Api.put('/api/user/me', {
          username:    document.getElementById('pe-username').value.trim() || null,
          email:       document.getElementById('pe-email').value.trim()    || null,
          phoneNumber: document.getElementById('pe-phone').value.trim()    || null
        });
        _user = { ..._user, ...updated };
        document.getElementById('profile-username').textContent = updated.username;
        Toast.show(I18n.t('profile.saved'), 'success');
        _closeEditModal();
      } catch (err) {
        Toast.show(err.message || I18n.t('profile.saveError'), 'error');
      } finally {
        btn.disabled = false;
      }
    });

    // Сменить пароль
    document.getElementById('pp-save').addEventListener('click', async () => {
      const newPwd  = document.getElementById('pp-new').value;
      const newPwd2 = document.getElementById('pp-new2').value;
      if (newPwd !== newPwd2) { Toast.show(I18n.t('auth.pwdMismatch'), 'error'); return; }
      if (newPwd.length < 6)  { Toast.show(I18n.t('auth.pwdShort'),    'error'); return; }

      const btn = document.getElementById('pp-save');
      btn.disabled = true;
      try {
        await Api.put('/api/user/me/password', {
          currentPassword: document.getElementById('pp-cur').value,
          newPassword:     newPwd
        });
        Toast.show(I18n.t('profile.passwordChanged'), 'success');
        _closePwdModal();
      } catch (err) {
        Toast.show(err.message || I18n.t('profile.saveError'), 'error');
      } finally {
        btn.disabled = false;
      }
    });
  }

  return { render, initModals };
})();