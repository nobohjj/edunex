const tabs = document.querySelectorAll(".tab-button");
const forms = document.querySelectorAll(".auth-form");
const switchLink = document.querySelector(".switch-link");
let verifiedRegistrationEmail = null;

function activateTab(name) {
  tabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });

  forms.forEach((form) => {
    form.classList.toggle("active", form.id === `${name}-form`);
  });
}

tabs.forEach((button) => {
  button.addEventListener("click", () => activateTab(button.dataset.tab));
});

switchLink.addEventListener("click", (event) => {
  event.preventDefault();
  activateTab("register");
});

document.querySelectorAll("[data-provider]").forEach((button) => {
  button.addEventListener("click", () => {
    const mode =
      document.querySelector(".tab-button.active")?.dataset.tab || "register";
    window.location.assign(`/auth/${button.dataset.provider}?mode=${mode}`);
  });
});

document
  .querySelector("#register-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const emails = [
      form.get("register-google-email"),
      form.get("register-microsoft-email"),
    ].filter(Boolean);
    await submitAuth(
      "/api/auth/register",
      {
        name: form.get("register-name"),
        role: form.get("register-role"),
        email:
          emails.find(
            (email) =>
              email.trim().toLowerCase() === verifiedRegistrationEmail,
          ) || emails[0],
        password: form.get("register-password"),
        passwordConfirmation: form.get("register-password-confirm"),
      },
    );
  });

async function submitAuth(endpoint, body) {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.headers.get("content-type")?.includes("application/json")) {
      throw new Error("Удостоверяването изисква стартиран EduNex сървър.");
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Грешка при удостоверяването.");
    }

    window.location.assign("dashboard.html");
  } catch (error) {
    alert(error.message);
  }
}

const hash = window.location.hash.replace("#", "");
if (hash === "register") {
  activateTab("register");
}

const oauthError = new URLSearchParams(window.location.search).get("error");
if (oauthError) {
  window.alert(`OAuth удостоверяването не бе успешно: ${oauthError}`);
}

document
  .querySelector("#login-form")
  .addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const googleEmail =
        document.getElementById("login-google-email").value.trim();
      const microsoftEmail =
        document.getElementById("login-microsoft-email").value.trim();
      if (googleEmail && microsoftEmail && googleEmail !== microsoftEmail) {
        throw new Error("Въведете само един имейл за вход.");
      }

      await submitAuth("/api/auth/login", {
        email: googleEmail || microsoftEmail,
        password: document.getElementById("login-password").value,
      });
    } catch (error) {
      alert(error.message);
    }
  });

fetch("/api/auth/session")
  .then(async (response) => {
    if (!response.ok) {
      throw new Error("Неуспешна проверка на сесията.");
    }
    return response.json();
  })
  .then((session) => {
    if (session.authenticated) {
      window.location.replace("dashboard.html");
      return;
    }
    if (session.registrationEmail) {
      activateTab("register");
      verifiedRegistrationEmail = session.registrationEmail.toLowerCase();
      const emailInput = document.getElementById(
        session.registrationProvider === "microsoft"
          ? "register-microsoft-email"
          : "register-google-email",
      );
      emailInput.value = session.registrationEmail;
    }
  })
  .catch((error) => alert(error.message));
