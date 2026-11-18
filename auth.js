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
    activateTab('login');
  });
});

document.querySelector('#register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await submitAuth(
  'https://edunex-api.drilskib.workers.dev/api/auth/register',
  {
    name: form.get('register-name'),
    role: form.get('register-role'),

    googleEmail: form.get('register-google-email'),
    microsoftEmail: form.get('register-microsoft-email'),

    password: form.get('register-password'),
    passwordConfirmation: form.get('register-password-confirm')
  }
);
});

async function submitAuth(endpoint, body) {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const contentType = response.headers.get('content-type');

    if (!contentType || !contentType.includes('application/json')) {
      throw new Error(
        'Регистрацията не е налична в GitHub Pages. Необходим е сървър.'
      );
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Грешка при регистрация.');
    }

    window.location.assign('success.html?type=register');
  } catch (error) {
    alert(error.message);
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

document
  .querySelector('#login-form')
  .addEventListener('submit', async (event) => {

    event.preventDefault();

    console.log('LOGIN BUTTON CLICKED');

    alert('Login form works');

  });