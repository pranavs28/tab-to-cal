# Tab to Cal

A personal Chromium extension: read the current tab (event page, email, Google
Doc), send it through an LLM via [OpenRouter](https://openrouter.ai), and open
a prefilled Google Calendar "create event" tab for each event found. No
Google sign-in or OAuth — it opens `calendar.google.com`'s own event form,
which uses whatever Google account you're already signed into in that tab.

## Setup

```sh
npm install
npm run dev     # loads a live-reloading build; wxt prints a load-unpacked path
```

Or build once and load manually:

```sh
npm run build
```

Then in Chrome: `chrome://extensions` → enable Developer mode → **Load
unpacked** → select `.output/chrome-mv3`.

Open the extension's **Options** page (right-click the toolbar icon →
Options) and:

1. Add an [OpenRouter API key](https://openrouter.ai/keys).
2. Optionally change the model / fallback models (defaults to a free model
   that supports structured outputs — the free lineup changes, so check
   [openrouter.ai/models](https://openrouter.ai/models?fmt=cards&supported_parameters=structured_outputs)
   if the default stops working).
3. Optionally set which Google account calendar events should open in.
4. Acknowledge the privacy notice (free models may be served by providers
   that log or retain what you send them).

## Using it

- **Toolbar icon**: reads your text selection if you have one, otherwise the
  whole page (or the Google Doc export, on a Doc). A single event opens
  Google Calendar directly; multiple events show a checklist to pick from.
- **Right-click a selection → "Add to Google Calendar"**: same pipeline, no
  popup. Watch the toolbar badge — a number is how many events were found
  (click the icon to see the checklist), `✓` means one event was opened,
  `!` is an error, `0` means nothing was found.

## Limits

OpenRouter's free models allow 20 requests/minute and 50/day (1,000/day once
you've bought $10 of credits — see [OpenRouter's
limits](https://openrouter.ai/docs/api-reference/limits)). Reopening the
popup on a page you already ran reuses the cached result instead of spending
another request; use **Re-run** to force a fresh one.

## Development

```sh
npm test        # unit tests (timezone math, Calendar URL building, schema validation, capture)
npm run typecheck
npm run eval     # OPENROUTER_API_KEY=... npm run eval — live check against tests/fixtures/*, not run in CI
```

`src/time.ts` and `src/gcal.ts` carry the logic worth testing carefully: the
LLM only reads times as written on the page (never converts between
timezones), and the code does the UTC conversion — including the case where
a flight's departure and arrival are in different timezones.
