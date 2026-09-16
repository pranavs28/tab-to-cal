# Tab to Cal — Privacy Policy

_Last updated September 16, 2026_

**In short:** Tab to Cal has no server of its own and no account system. When you use it, the text of the current tab (or your selection) is sent directly from your browser to the AI provider *you* choose in the extension's options — using your own API key when you set one. Nothing is sent anywhere else, and nothing is sent unless you click the extension icon or use its right-click menu item.

## What Tab to Cal does

Tab to Cal is a browser extension that reads the text of your current tab (or whatever you've selected), sends it to a large language model, and opens a prefilled Google Calendar event page for each event it finds. You review and save each event yourself on Google's own site — the extension never signs in to your Google account or creates events on its own.

## What gets read, and when

Tab to Cal only reads page content when you take an action:

- Clicking the toolbar icon, which reads your current selection, or the whole page if nothing is selected.
- Using "Add to Google Calendar" from the right-click menu on selected text.

It never runs in the background, never reads pages you haven't asked it to, and keeps no history of your browsing beyond the small local log described below.

On `docs.google.com`, Tab to Cal fetches the open document's own exported text using your existing Google sign-in in that tab, rather than reading the page's on-screen canvas — no separate login or permission prompt is involved.

## Where that text goes

The page text (or selection) is sent directly from your browser to whichever AI provider you've selected in the extension's options — OpenRouter, OpenAI, Anthropic, or Google Gemini — using an API key you supply yourself. There is no server in between: Tab to Cal has no backend of its own, so it never sees or stores this traffic.

Each provider's own privacy policy governs how it handles data you send it; check theirs if you want details on retention or training use, particularly for a free-tier model.

## What's stored, and where

Everything Tab to Cal stores lives only in your browser's local extension storage — never on a server the developer controls:

- Your API key(s) and model settings, if you've entered any.
- Your last ~20 extraction results, cached so reopening the popup on a page you already ran doesn't spend another request.

Uninstalling the extension removes all of it.

## What Tab to Cal does not do

- No analytics, tracking, or advertising identifiers.
- No account system, and nothing is sold to or shared with anyone besides the AI provider you've configured.
- No access to your Google account — event creation happens on Google Calendar's own website, using whatever Google account is already signed in there.

## Permissions this extension requests

| Permission | Why |
|---|---|
| `activeTab`, `scripting` | Read the current tab's text only when you invoke the extension. |
| `contextMenus` | Add the "Add to Google Calendar" right-click item. |
| `storage` | Save your settings and result history locally, as described above. |
| Host access to the AI providers, `docs.google.com` | Send/receive extraction requests, and read a Google Doc's exported text. |

## Children's privacy

Tab to Cal is not directed at children and is not knowingly used to collect information from anyone under 13.

## Changes to this policy

If this policy changes, the updated version will be posted at this same file, with a new date above. Past versions remain visible in this repository's [commit history](https://github.com/pranavs28/tab-to-cal/commits/master/PRIVACY.md).

## Contact

Questions about this policy or how Tab to Cal handles data: [pranav.senthilvel@gmail.com](mailto:pranav.senthilvel@gmail.com)
