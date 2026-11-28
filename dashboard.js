const localBackend = ["localhost", "127.0.0.1"].includes(
  window.location.hostname,
);
const apiBase = "https://edunex-api.drilskib.workers.dev";
const storedUser = JSON.parse(localStorage.getItem("edunexUser") || "null");
const currentUserPromise = localBackend
  ? fetch("/api/auth/session")
    .then(async (response) => {
      if (!response.ok) return null;
      const session = await response.json();
      return session.authenticated ? session.user : null;
    })
    .catch(() => null)
  : Promise.resolve(storedUser);

currentUserPromise.then((user) => {
  if (!user) {
    window.location.replace("auth.html#register");
    return;
  }

  document.getElementById("profile-name").textContent = user.name || "";
  document.getElementById("profile-role").textContent = user.role || "";
  if (user.name) {
    document.querySelector(".profile-avatar").textContent =
      user.name.trim().charAt(0).toUpperCase();
  }
});

currentUserPromise.then((user) => {
  if (user) {
    loadTasks().catch((error) => alert(error.message));
  }
});

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
            `${apiBase}/api/dify/chat`,
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
      const currentUser = await currentUserPromise;
      if (!currentUser) return;

      const title = prompt(
        "Въведете име на задачата:"
      );

      if (!title) {
        return;
      }

      try {

        const currentUser = await currentUserPromise;
        const response = await fetch(`${apiBase}/api/tasks?userId=${encodeURIComponent(currentUser.id)}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title,
            userId: currentUser.id
          })
        });
        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Грешка при създаване на задачата.");
        }

        await loadTasks();
        alert("Задачата е създадена.");
      } catch (error) {
        alert(error.message);
      }
    });
  });

async function loadTasks() {

  const taskList =
    document.getElementById("my-tasks");

  if (!taskList) return;

  const currentUser =
    await currentUserPromise;

  if (!currentUser) return;

  const listsResponse =
    await fetch(
      `${apiBase}/api/microsoft/todo/lists?userId=${encodeURIComponent(currentUser.id)}`
    );

  const listsResult =
    await listsResponse.json();

  if (!listsResponse.ok) {
    throw new Error(
      listsResult.error ||
      "Неуспешно зареждане на To Do списъците."
    );
  }

  taskList.replaceChildren();

  if (
    !listsResult.lists ||
    listsResult.lists.length === 0
  ) {

    const empty =
      document.createElement("li");

    empty.textContent =
      "Няма списъци в Microsoft To Do.";

    taskList.appendChild(empty);

    return;

  }

  listsResult.lists.forEach((list) => {

    const item =
      document.createElement("li");

    item.textContent =
      list.displayName;

    taskList.appendChild(item);

  });

}

const logoutBtn =
  document.getElementById(
    "logout-btn"
  );

logoutBtn?.addEventListener(
  "click",
  (event) => {

    event.preventDefault();

    const finishLogout = () => {
      localStorage.removeItem("edunexUser");
      window.location.assign("auth.html#login");
    };

    if (!localBackend) {
      finishLogout();
      return;
    }

    fetch("/api/auth/logout", { method: "POST" })
      .then((response) => {
        if (!response.ok) throw new Error("Неуспешен изход от акаунта.");
        finishLogout();
      })
      .catch((error) => alert(error.message));

  }
);

document.getElementById("delete-account-btn")?.addEventListener("click", async () => {
  if (!confirm("Изтриването ще премахне акаунта и всички негови запазени данни. Продължавате ли?")) {
    return;
  }

  try {
    const response = await fetch("/api/auth/account", { method: "DELETE" });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Неуспешно изтриване на акаунта.");
    }
    localStorage.removeItem("edunexUser");
    window.location.assign("auth.html#register");
  } catch (error) {
    alert(error.message);
  }
});

document
  .getElementById("connect-microsoft-btn")
  ?.addEventListener("click", async () => {

    const currentUser =
      await currentUserPromise;

    if (!currentUser) {
      return;
    }

    window.location.href =
      `${apiBase}/auth/microsoft/login?email=${encodeURIComponent(
        currentUser.microsoftEmail
      )}`;

  });

document
  .getElementById("connect-microsoft-btn")
  ?.addEventListener("click", async () => {

    const currentUser =
      await currentUserPromise;

    console.log(currentUser);

    alert(JSON.stringify(currentUser));

  });
const connectMicrosoftBtn =
  document.getElementById(
    "connect-microsoft-btn"
  );

alert(
  connectMicrosoftBtn
    ? "Button found"
    : "Button NOT found"
);