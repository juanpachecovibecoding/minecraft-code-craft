/**
 * PlayCode Hub UI: Auth Modal, Blockly Launcher & Projects Manager
 */
(function () {
  'use strict';

  function createStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #playcode-hub-btn {
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 999999;
        background: rgba(24, 24, 27, 0.85);
        backdrop-filter: blur(8px);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 8px;
        padding: 8px 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        transition: all 0.2s ease;
      }
      #playcode-hub-btn:hover {
        background: rgba(39, 39, 42, 0.95);
        transform: translateY(-1px);
        border-color: #10b981;
      }
      .playcode-modal-overlay {
        position: fixed;
        inset: 0;
        z-index: 1000000;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .playcode-card {
        background: #18181b;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        width: 100%;
        max-width: 440px;
        color: #f4f4f5;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
        overflow: hidden;
      }
      .playcode-header {
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .playcode-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: #10b981;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .playcode-close {
        background: none;
        border: none;
        color: #a1a1aa;
        font-size: 20px;
        cursor: pointer;
        line-height: 1;
      }
      .playcode-body {
        padding: 20px;
      }
      .playcode-form-group {
        margin-bottom: 14px;
      }
      .playcode-form-group label {
        display: block;
        font-size: 12px;
        font-weight: 500;
        color: #a1a1aa;
        margin-bottom: 6px;
      }
      .playcode-input {
        width: 100%;
        box-sizing: border-box;
        background: #27272a;
        border: 1px solid #3f3f46;
        border-radius: 6px;
        padding: 10px 12px;
        color: #fff;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
      }
      .playcode-input:focus {
        border-color: #10b981;
      }
      .playcode-btn-primary {
        width: 100%;
        background: #10b981;
        color: #000;
        border: none;
        border-radius: 6px;
        padding: 10px;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        transition: background 0.2s;
      }
      .playcode-btn-primary:hover {
        background: #059669;
      }
      .playcode-tabs {
        display: flex;
        border-bottom: 1px solid #27272a;
        margin-bottom: 16px;
      }
      .playcode-tab {
        flex: 1;
        text-align: center;
        padding: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        color: #71717a;
      }
      .playcode-tab.active {
        color: #10b981;
        border-bottom: 2px solid #10b981;
      }
      .playcode-msg {
        font-size: 12px;
        margin-top: 10px;
        text-align: center;
      }
      .playcode-actions {
        display: flex;
        gap: 10px;
        margin-top: 12px;
      }
      .playcode-btn-secondary {
        flex: 1;
        background: #27272a;
        color: #f4f4f5;
        border: 1px solid #3f3f46;
        border-radius: 6px;
        padding: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        text-decoration: none;
      }
      .playcode-btn-secondary:hover {
        background: #3f3f46;
      }
    `;
    document.head.appendChild(style);
  }

  function initUI() {
    createStyles();

    const hubBtn = document.createElement('button');
    hubBtn.id = 'playcode-hub-btn';
    hubBtn.innerHTML = `<span>🎮</span> <span id="playcode-user-status">Iniciar Sesión / Programar</span>`;
    document.body.appendChild(hubBtn);

    hubBtn.addEventListener('click', showMainModal);

    window.addEventListener('supabase:auth-change', (e) => {
      const user = e.detail.user;
      const statusEl = document.getElementById('playcode-user-status');
      if (statusEl) {
        if (user) {
          const name = user.user_metadata?.username || user.email?.split('@')[0] || 'Alumno';
          statusEl.textContent = `👤 ${name} (Menú)`;
        } else {
          statusEl.textContent = 'Iniciar Sesión / Programar';
        }
      }
    });
  }

  function showMainModal() {
    const existing = document.getElementById('playcode-modal');
    if (existing) existing.remove();

    const user = window.SupabaseService?.getUser();

    const overlay = document.createElement('div');
    overlay.id = 'playcode-modal';
    overlay.className = 'playcode-modal-overlay';

    overlay.innerHTML = `
      <div class="playcode-card">
        <div class="playcode-header">
          <h3><span>⚡</span> PlayCode Minecraft</h3>
          <button class="playcode-close" id="playcode-close-btn">&times;</button>
        </div>
        <div class="playcode-body">
          ${user ? renderUserDashboard(user) : renderAuthTabs()}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('playcode-close-btn').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    if (!user) {
      setupAuthHandlers(overlay);
    } else {
      setupDashboardHandlers(overlay);
    }
  }

  function renderAuthTabs() {
    return `
      <div class="playcode-tabs">
        <div class="playcode-tab active" data-tab="login">Iniciar Sesión</div>
        <div class="playcode-tab" data-tab="register">Crear Cuenta</div>
      </div>
      <form id="playcode-auth-form">
        <div class="playcode-form-group">
          <label>Usuario o Correo</label>
          <input type="text" id="pc-auth-user" class="playcode-input" placeholder="ej: juan123" required />
        </div>
        <div class="playcode-form-group">
          <label>Contraseña</label>
          <input type="password" id="pc-auth-pass" class="playcode-input" placeholder="******" required />
        </div>
        <button type="submit" class="playcode-btn-primary" id="pc-submit-btn">Entrar</button>
        <div id="pc-auth-msg" class="playcode-msg"></div>
      </form>
      <div class="playcode-actions" style="margin-top: 16px;">
        <a href="/blockly/" target="_blank" class="playcode-btn-secondary">🧱 Abrir Blockly sin cuenta</a>
      </div>
    `;
  }

  function renderUserDashboard(user) {
    const name = user.user_metadata?.username || user.email?.split('@')[0] || 'Alumno';
    return `
      <div style="text-align: center; margin-bottom: 16px;">
        <div style="font-size: 32px; margin-bottom: 4px;">🧙‍♂️</div>
        <div style="font-size: 16px; font-weight: 700; color: #fff;">${name}</div>
        <div style="font-size: 12px; color: #71717a;">${user.email}</div>
      </div>
      <div class="playcode-actions" style="flex-direction: column; gap: 8px;">
        <a href="/blockly/" target="_blank" class="playcode-btn-primary" style="text-align: center; text-decoration: none;">
          🧱 Abrir Editor Blockly
        </a>
        <button id="pc-logout-btn" class="playcode-btn-secondary" style="color: #f87171;">
          Cerrar Sesión
        </button>
      </div>
    `;
  }

  function setupAuthHandlers(overlay) {
    let currentMode = 'login';
    const tabs = overlay.querySelectorAll('.playcode-tab');
    const submitBtn = overlay.querySelector('#pc-submit-btn');
    const msgEl = overlay.querySelector('#pc-auth-msg');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentMode = tab.dataset.tab;
        submitBtn.textContent = currentMode === 'login' ? 'Entrar' : 'Registrarse';
        msgEl.textContent = '';
      });
    });

    const form = overlay.querySelector('#playcode-auth-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const userVal = overlay.querySelector('#pc-auth-user').value;
      const passVal = overlay.querySelector('#pc-auth-pass').value;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Procesando...';
      msgEl.textContent = '';

      try {
        if (currentMode === 'register') {
          await window.SupabaseService.signUp(userVal, passVal);
          msgEl.style.color = '#10b981';
          msgEl.textContent = '¡Cuenta creada con éxito!';
        } else {
          await window.SupabaseService.signIn(userVal, passVal);
          msgEl.style.color = '#10b981';
          msgEl.textContent = '¡Bienvenido!';
        }
        setTimeout(() => showMainModal(), 800);
      } catch (err) {
        msgEl.style.color = '#f87171';
        msgEl.textContent = err.message || 'Error en la autenticación';
        submitBtn.disabled = false;
        submitBtn.textContent = currentMode === 'login' ? 'Entrar' : 'Registrarse';
      }
    });
  }

  function setupDashboardHandlers(overlay) {
    const logoutBtn = overlay.querySelector('#pc-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await window.SupabaseService.signOut();
        showMainModal();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUI);
  } else {
    initUI();
  }
})();
