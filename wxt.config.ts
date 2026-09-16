import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Tab to Cal',
    description: 'Turn the event details on any tab into Google Calendar events.',
    icons: {
      16: 'icon-16.png',
      32: 'icon-32.png',
      48: 'icon-48.png',
      128: 'icon-128.png',
    },
    permissions: ['activeTab', 'scripting', 'contextMenus', 'storage'],
    host_permissions: [
      'https://openrouter.ai/*',
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      'https://generativelanguage.googleapis.com/*',
      // The shared no-signup Gemini proxy (src/llm/providers/types.ts:SHARED_GEMINI_PROXY_URL).
      // Keep this in sync with that URL once the real Vercel domain is known.
      'https://tab-to-cal-proxy.vercel.app/*',
      'https://docs.google.com/*',
      'https://*.googleusercontent.com/*',
    ],
    web_accessible_resources: [
      {
        resources: ['capture.js'],
        matches: ['<all_urls>'],
      },
    ],
  },
});
