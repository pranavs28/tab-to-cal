import { PROVIDER_INFO, PROVIDERS, type Provider } from '../../src/llm/providers/types';
import { getSettings, saveSettings, type ProviderSettings, type Settings } from '../../src/settings';

const providerSelect = document.getElementById('provider') as HTMLSelectElement;
const sectionsContainer = document.getElementById('providerSections')!;
const accountEmail = document.getElementById('accountEmail') as HTMLInputElement;
const ack = document.getElementById('ack') as HTMLInputElement;
const status = document.getElementById('status')!;

function fieldIds(provider: Provider) {
  return {
    section: `section-${provider}`,
    apiKey: `apiKey-${provider}`,
    model: `model-${provider}`,
    fallback: `fallback-${provider}`,
  };
}

function buildSection(provider: Provider): HTMLFieldSetElement {
  const info = PROVIDER_INFO[provider];
  const ids = fieldIds(provider);
  const el = document.createElement('fieldset');
  el.id = ids.section;
  el.innerHTML = `
    <legend>${info.name}</legend>
    <label for="${ids.apiKey}">API key
      <span class="hint">${info.keyHint} Get one at <a href="${info.keyUrl}" target="_blank" rel="noopener">${new URL(info.keyUrl).hostname}</a>. Stored only in this browser.</span>
    </label>
    <input type="password" id="${ids.apiKey}" autocomplete="off" />

    <label for="${ids.model}">Model
      <span class="hint">${info.modelHint}</span>
    </label>
    <input type="text" id="${ids.model}" autocomplete="off" placeholder="${info.defaultModel}" />

    <label for="${ids.fallback}">Fallback models
      <span class="hint">One per line. Tried in order if the model above fails or is rate-limited.</span>
    </label>
    <textarea id="${ids.fallback}"></textarea>
  `;
  return el;
}

for (const provider of PROVIDERS) sectionsContainer.appendChild(buildSection(provider));

function showOnly(provider: Provider) {
  for (const p of PROVIDERS) {
    document.getElementById(fieldIds(p).section)!.hidden = p !== provider;
  }
}

function readProviderSection(provider: Provider): ProviderSettings {
  const ids = fieldIds(provider);
  const model = (document.getElementById(ids.model) as HTMLInputElement).value.trim();
  return {
    apiKey: (document.getElementById(ids.apiKey) as HTMLInputElement).value.trim(),
    model: model || PROVIDER_INFO[provider].defaultModel,
    fallbackModels: (document.getElementById(ids.fallback) as HTMLTextAreaElement).value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

function fillProviderSection(provider: Provider, settings: ProviderSettings) {
  const ids = fieldIds(provider);
  (document.getElementById(ids.apiKey) as HTMLInputElement).value = settings.apiKey;
  (document.getElementById(ids.model) as HTMLInputElement).value = settings.model;
  (document.getElementById(ids.fallback) as HTMLTextAreaElement).value = settings.fallbackModels.join('\n');
}

providerSelect.addEventListener('change', () => showOnly(providerSelect.value as Provider));

async function load() {
  const settings = await getSettings();
  providerSelect.value = settings.provider;
  showOnly(settings.provider);
  for (const provider of PROVIDERS) fillProviderSection(provider, settings.providers[provider]);
  accountEmail.value = settings.accountEmail;
  ack.checked = settings.privacyNoticeAcknowledged;
}

document.getElementById('save')!.addEventListener('click', async () => {
  const settings: Settings = {
    provider: providerSelect.value as Provider,
    providers: Object.fromEntries(PROVIDERS.map((p) => [p, readProviderSection(p)])) as Settings['providers'],
    accountEmail: accountEmail.value.trim(),
    privacyNoticeAcknowledged: ack.checked,
  };
  await saveSettings(settings);
  status.textContent = 'Saved.';
  setTimeout(() => (status.textContent = ''), 1500);
});

load();
