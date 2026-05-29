// Runs on index.html
document.addEventListener('DOMContentLoaded', () => {
  // Redirect if already logged in
  if (localStorage.getItem('fc_token')) {
    window.location.href = 'chat.html';
    return;
  }

  const loginTab    = document.getElementById('tab-login');
  const registerTab = document.getElementById('tab-register');
  const loginForm   = document.getElementById('form-login');
  const regForm     = document.getElementById('form-register');
  const loginErr    = document.getElementById('login-error');
  const regErr      = document.getElementById('register-error');

  // ── Tab switching ─────────────────────────────────────────
  loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    loginErr.textContent = '';
  });

  registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    regForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    regErr.textContent = '';
  });

  // ── Login ─────────────────────────────────────────────────
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginErr.textContent = '';
    const btn = loginForm.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    try {
      const { token, user } = await api.post('/auth/login', {
        email:    document.getElementById('login-email').value.trim(),
        password: document.getElementById('login-password').value,
      });
      localStorage.setItem('fc_token', token);
      localStorage.setItem('fc_user',  JSON.stringify(user));
      window.location.href = 'chat.html';
    } catch (err) {
      loginErr.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });

  // ── Register ──────────────────────────────────────────────
  regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    regErr.textContent = '';
    const btn = regForm.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Creating account…';

    try {
      const { token, user } = await api.post('/auth/register', {
        username: document.getElementById('reg-username').value.trim(),
        email:    document.getElementById('reg-email').value.trim(),
        password: document.getElementById('reg-password').value,
      });
      localStorage.setItem('fc_token', token);
      localStorage.setItem('fc_user',  JSON.stringify(user));
      window.location.href = 'chat.html';
    } catch (err) {
      regErr.textContent = err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create account';
    }
  });
});
