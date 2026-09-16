import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Tab to Cal',
    description: 'Turn the event details on any tab into Google Calendar events.',
    permissions: ['activeTab', 'scripting', 'contextMenus', 'storage'],
    host_permissions: [
      'https://openrouter.ai/*',
      'https://api.openai.com/*',
      'https://api.anthropic.com/*',
      'https://generativelanguage.googleapis.com/*',
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
