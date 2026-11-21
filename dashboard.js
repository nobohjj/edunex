const sections = {
  home: document.getElementById("home-section"),
  ai: document.getElementById("ai-section"),
  workspace: document.getElementById("workspace-section"),
  settings: document.getElementById("settings-section"),
};

document.querySelectorAll(".dashboard-nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".dashboard-nav-item")
      .forEach((item) => item.classList.remove("active"));

    button.classList.add("active");

    Object.values(sections).forEach((section) => {
      if (section) {
        section.hidden = true;
      }
    });

    const selectedSection = sections[button.dataset.section];

    if (selectedSection) {
      selectedSection.hidden = false;
    }
  });
});
const difyForm = document.getElementById("dify-form");
const difyInput = document.getElementById("dify-input");
const difyMessages = document.getElementById("dify-messages");

if (difyForm) {
  difyForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = difyInput.value.trim();

    if (!message) {
      return;
    }

    addMessage(message, "user-message");

    difyInput.value = "";

    try {
      const response = await fetch(
        "https://edunex-api.drilskib.workers.dev/api/dify/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Грешка при връзката с EduNex AI.");
      }

      addMessage(result.answer || "Няма получен отговор.", "assistant-message");
    } catch (error) {
      addMessage(error.message, "assistant-message error-message");
    }
  });
}

function addMessage(text, className) {
  const message = document.createElement("div");

  message.className = `agent-message ${className}`;

  message.textContent = text;

  difyMessages.appendChild(message);

  difyMessages.scrollTop = difyMessages.scrollHeight;
}
