export interface Settings {
  apiKey: string;
  model: string;
  fallbackModels: string[];
  accountEmail: string;
  privacyNoticeAcknowledged: boolean;
}

// Free models that supported structured_outputs on OpenRouter as of 2026-09.
// The free lineup changes often; these are editable in the options page.
export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'nvidia/nemotron-3-super-120b-a12b:free',
  fallbackModels: ['nex-agi/nex-n2.5-pro:free', 'nex-agi/nex-n2.5-mini:free'],
  accountEmail: '',
  privacyNoticeAcknowledged: false,
};

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(stored.settings as Partial<Settings> | undefined) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set({ settings });
}
