const currentUser =
  JSON.parse(
    localStorage.getItem("edunexUser")
  );

if (!currentUser) {

  window.location.href =
    "auth.html#login";

}

const profileName =
  document.getElementById(
    "profile-name"
  );

const profileRole =
  document.getElementById(
    "profile-role"
  );

if (profileName) {
  profileName.textContent =
    currentUser.name;
}

if (profileRole) {
  profileRole.textContent =
    currentUser.role;
}

const sections = {
  home: document.getElementById("home-section"),
  ai: document.getElementById("ai-section"),
  documents: document.getElementById("documents-section"),
  tasks: document.getElementById("tasks-section"),
  calendar: document.getElementById("calendar-section"),
  communication: document.getElementById("communication-section"),
  files: document.getElementById("files-section"),
  settings: document.getElementById("settings-section")
};

document.querySelectorAll(".dashboard-nav-item").forEach((button) => {

  button.addEventListener("click", () => {

    const sectionName = button.dataset.section;

    if (!sectionName) {
      return;
    }

    document
      .querySelectorAll(".dashboard-nav-item")
      .forEach((item) => item.classList.remove("active"));

    button.classList.add("active");

    Object.values(sections).forEach((section) => {
      if (section) {
        section.hidden = true;
      }
    });

    const selectedSection = sections[sectionName];

    if (selectedSection) {
      selectedSection.hidden = false;
    }

  });

});

const workspaceToggle =
  document.getElementById("workspace-toggle");

const workspaceSubmenu =
  document.getElementById("workspace-submenu");

const workspaceArrow =
  document.getElementById("workspace-arrow");

workspaceToggle?.addEventListener("click", () => {

  workspaceSubmenu.hidden =
    !workspaceSubmenu.hidden;

  workspaceArrow.textContent =
    workspaceSubmenu.hidden ? "▶" : "▼";

});

const difyForm =
  document.getElementById("dify-form");

const difyInput =
  document.getElementById("dify-input");

const difyMessages =
  document.getElementById("dify-messages");

if (difyForm) {

  difyForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      const message =
        difyInput.value.trim();

      if (!message) {
        return;
      }

      addMessage(
        message,
        "user-message"
      );

      difyInput.value = "";

      try {

        const response =
          await fetch(
            "https://edunex-api.drilskib.workers.dev/api/dify/chat",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                message
              })
            }
          );

        const result =
          await response.json();

        if (!response.ok) {

          throw new Error(
            result.error ||
            "Грешка при връзката с EduNex AI."
          );

        }

        addMessage(
          result.answer ||
          "Няма получен отговор.",
          "assistant-message"
        );

      } catch (error) {

        addMessage(
          error.message,
          "assistant-message error-message"
        );

      }

    }
  );

}

function addMessage(text, className) {

  const message =
    document.createElement("div");

  message.className =
    `agent-message ${className}`;

  message.textContent = text;

  difyMessages.appendChild(message);

  difyMessages.scrollTop =
    difyMessages.scrollHeight;

}

document
  .querySelectorAll("[data-create-task]")
  .forEach((createTaskBtn) => {
    createTaskBtn.addEventListener("click", async () => {
      const title = prompt(
        "Въведете име на задачата:"
      );

      if (!title) {
        return;
      }

      try {

        const response =
          await fetch(
            "https://edunex-api.drilskib.workers.dev/api/tasks/create",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                title
              })
            }
          );

        const result =
          await response.json();

        if (result.success) {

          alert(
            "Задачата е създадена."
          );

        } else {

          alert(
            result.error ||
            "Грешка."
          );

        }

      } catch (error) {

        alert(
          "Неуспешна връзка със сървъра."
        );

      }
    });
  });

const logoutBtn =
  document.getElementById(
    "logout-btn"
  );

logoutBtn?.addEventListener(
  "click",
  (event) => {

    event.preventDefault();

    localStorage.removeItem(
      "edunexUser"
    );

    window.location.href =
      "auth.html#login";

  }
);