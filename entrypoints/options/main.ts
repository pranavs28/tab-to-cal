import { DEFAULT_SETTINGS, getSettings, saveSettings } from '../../src/settings';

const apiKey = document.getElementById('apiKey') as HTMLInputElement;
const model = document.getElementById('model') as HTMLInputElement;
const fallbackModels = document.getElementById('fallbackModels') as HTMLTextAreaElement;
const accountEmail = document.getElementById('accountEmail') as HTMLInputElement;
const ack = document.getElementById('ack') as HTMLInputElement;
const status = document.getElementById('status')!;

async function load() {
  const settings = await getSettings();
  apiKey.value = settings.apiKey;
  model.value = settings.model || DEFAULT_SETTINGS.model;
  fallbackModels.value = settings.fallbackModels.join('\n');
  accountEmail.value = settings.accountEmail;
  ack.checked = settings.privacyNoticeAcknowledged;
}

document.getElementById('save')!.addEventListener('click', async () => {
  await saveSettings({
    apiKey: apiKey.value.trim(),
    model: model.value.trim() || DEFAULT_SETTINGS.model,
    fallbackModels: fallbackModels.value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    accountEmail: accountEmail.value.trim(),
    privacyNoticeAcknowledged: ack.checked,
  });
  status.textContent = 'Saved.';
  setTimeout(() => (status.textContent = ''), 1500);
});

load();
