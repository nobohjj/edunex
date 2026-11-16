const tabs = document.querySelectorAll('.tab-button');
const forms = document.querySelectorAll('.auth-form');
const switchLink = document.querySelector('.switch-link');

function activateTab(name) {
  tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === name);
  });

  forms.forEach((form) => {
    form.classList.toggle('active', form.id === `${name}-form`);
  });
}

tabs.forEach((button) => {
  button.addEventListener('click', () => activateTab(button.dataset.tab));
});

switchLink.addEventListener('click', (event) => {
  event.preventDefault();
  activateTab('register');
});

document.querySelectorAll('[data-provider]').forEach((button) => {
  button.addEventListener('click', () => {
    const mode = document.querySelector('.tab-button.active')?.dataset.tab || 'login';
    window.location.assign(`/auth/${button.dataset.provider}?mode=${mode}`);
  });
});

document.querySelector('#register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await submitAuth('/api/auth/register', {
    name: form.get('register-name'),
    role: form.get('register-role'),
    email: form.get('register-email'),
    password: form.get('register-password'),
    passwordConfirmation: form.get('register-password-confirm')
  });
});

async function submitAuth(endpoint, body) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Удостоверяването не бе успешно.');
    }
    window.location.assign('/success.html?type=register');
  } catch (error) {
    window.alert(error.message);
  }
}

const hash = window.location.hash.replace('#', '');
if (hash === 'register') {
  activateTab('register');
}

const oauthError = new URLSearchParams(window.location.search).get('error');
if (oauthError) {
  window.alert(`OAuth удостоверяването не бе успешно: ${oauthError}`);
}
