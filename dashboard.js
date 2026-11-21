const applications = {
  teams: { name: 'Microsoft Teams', url: 'https://teams.microsoft.com/' },
  todo: { name: 'Microsoft To Do', url: 'https://to-do.office.com/tasks/' },
  sharepoint: { name: 'SharePoint', url: 'https://www.office.com/launch/sharepoint' },
  onedrive: { name: 'Microsoft OneDrive', url: 'https://onedrive.live.com/' },
  excel: { name: 'Excel 365', url: 'https://www.office.com/launch/excel' },
  outlook: { name: 'Outlook', url: 'https://outlook.office.com/mail/' },
  docs: { name: 'Google Docs', url: 'https://docs.google.com/document/' },
  sheets: { name: 'Google Sheets', url: 'https://docs.google.com/spreadsheets/' },
  calendar: { name: 'Google Calendar', url: 'https://calendar.google.com/calendar/' },
  drive: { name: 'Google Drive', url: 'https://drive.google.com/drive/' }
};

const difyForm = document.querySelector('#dify-form');
const difyInput = document.querySelector('#dify-input');
const difyMessages = document.querySelector('#dify-messages');
const workspaceFrame = document.querySelector('#workspace-frame');
const workspaceNotice = document.querySelector('#workspace-notice');
const workspaceAppName = document.querySelector('#workspace-app-name');

difyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = difyInput.value.trim();
  if (!message) return;

  addDifyMessage(message, 'user-message');
  difyInput.value = '';
  difyInput.disabled = true;
  difyForm.querySelector('button').disabled = true;

  try {
    const response = await fetch('/api/dify/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Неуспешна обработка на съобщението.');
    addDifyMessage(result.answer || 'Няма получен отговор.', 'assistant-message');
  } catch (error) {
    addDifyMessage(error.message, 'assistant-message error-message');
  } finally {
    difyInput.disabled = false;
    difyForm.querySelector('button').disabled = false;
    difyInput.focus();
  }
});

function addDifyMessage(text, className) {
  const message = document.createElement('div');
  message.className = `agent-message ${className}`;
  message.textContent = text;
  difyMessages.appendChild(message);
  difyMessages.scrollTop = difyMessages.scrollHeight;
}

document.querySelectorAll('.app-item').forEach((button) => {
  button.addEventListener('click', () => {
    const application = applications[button.dataset.app];
    if (!application) return;

    document.querySelectorAll('.app-item').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    workspaceAppName.textContent = application.name;
    workspaceFrame.src = application.url;
    workspaceNotice.hidden = false;
  });
});

workspaceFrame.addEventListener('load', () => {
  workspaceNotice.hidden = true;
});