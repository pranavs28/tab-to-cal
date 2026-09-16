export interface Settings {
  apiKey: string;
  model: string;
  fallbackModels: string[];
  accountEmail: string;
  privacyNoticeAcknowledged: boolean;
}

// Free models that supported structured_outputs on OpenRouter as of 2026-09.
// The free lineup changes often; these are editable in the options page.
// Default is a small/fast model: a 120B dense model (nemotron-3-super) on
// OpenRouter's free tier measured 50s+ per call in testing, which is too
// slow for an interactive extension. Smaller models trade some extraction
// quality for that, hence the fallback chain if the small model struggles.
export const DEFAULT_SETTINGS: Settings = {
  apiKey: '',
  model: 'nex-agi/nex-n2.5-mini:free',
  fallbackModels: ['nex-agi/nex-n2.5-pro:free', 'liquid/lfm-2.5-2.6b:free'],
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
