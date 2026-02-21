import { login } from '../api.js';

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLogin);
} else {
  initLogin();
}

function initLogin() {
  const form = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const submitBtn = document.getElementById('login-submit');
  const errorDiv = document.getElementById('login-error');

  if (!form || !usernameInput || !passwordInput) return;

  if (togglePasswordBtn) {
    togglePasswordBtn.addEventListener('click', () => {
      const nextType = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = nextType;
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const remember = document.getElementById('remember')?.checked || false;

    hideError();

    if (!username || !password) {
      showError('Completa usuario y contrasena');
      return;
    }

    setLoadingState(true);

    try {
      const response = await login({ username, password, remember });
      if (!response?.success || !response?.user) {
        throw new Error(response?.message || 'Error al iniciar sesion');
      }

      const params = new URLSearchParams(window.location.search);
      const explicitRedirect = params.get('redirect');

      const role = response.user.role;
      const roleDefault = role === 'admin' ? '/admin' : '/ventas';
      const redirectTo = explicitRedirect || roleDefault;

      window.location.replace(redirectTo);
    } catch (error) {
      showError(error.message || 'No fue posible iniciar sesion');
      setLoadingState(false);
    }
  });

  [usernameInput, passwordInput].forEach((input) => {
    input.addEventListener('input', () => {
      if (errorDiv.classList.contains('login-form__error--show')) {
        hideError();
      }
    });
  });

  function setLoadingState(loading) {
    if (loading) {
      submitBtn.disabled = true;
      submitBtn.classList.add('login-form__submit--loading');
    } else {
      submitBtn.disabled = false;
      submitBtn.classList.remove('login-form__submit--loading');
    }
  }

  function showError(message) {
    errorDiv.textContent = message;
    errorDiv.classList.add('login-form__error--show');
  }

  function hideError() {
    errorDiv.textContent = '';
    errorDiv.classList.remove('login-form__error--show');
  }
}
