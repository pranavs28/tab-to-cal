# Tab to Cal

A personal Chromium extension: read the current tab (event page, email, Google
Doc), send it through an LLM, and open a prefilled Google Calendar "create
event" tab for each event found. No Google sign-in or OAuth — it opens
`calendar.google.com`'s own event form, which uses whatever Google account
you're already signed into in that tab.

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

1. Pick an **LLM provider** — OpenRouter, OpenAI, Claude (Anthropic), or
   Gemini (Google) — and add that provider's own API key. Each has its own
   key/model/fallback fields, so you can set up more than one and switch
   between them. Key pages:
   - OpenRouter: [openrouter.ai/keys](https://openrouter.ai/keys)
   - OpenAI: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Anthropic: [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
   - Gemini: [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (has a free tier)
2. Optionally change the model / fallback models for that provider — the
   options page prefills a reasonable small/fast default, but model lineups
   change often, so check the provider's current model list if it stops
   working.
3. Optionally set which Google account calendar events should open in.
4. Acknowledge the privacy notice (your page text is sent to whichever
   provider you pick, using your own key — some free-tier models may log or
   retain requests; check that provider's policy if you're unsure).

## Using it

- **Toolbar icon**: reads your text selection if you have one, otherwise the
  whole page (or the Google Doc export, on a Doc). A single event opens
  Google Calendar directly; multiple events show a checklist to pick from.
  Each event's description ends with a short "Added with Tab to Cal" note.
- **Right-click a selection → "Add to Google Calendar"**: same pipeline, no
  popup. Watch the toolbar badge — a number is how many events were found
  (click the icon to see the checklist), `✓` means one event was opened,
  `!` is an error, `0` means nothing was found.

## Limits

Each provider has its own rate limits and pricing:
- **OpenRouter** free models allow 20 requests/minute and 50/day (1,000/day
  once you've bought $10 of credits — see [OpenRouter's
  limits](https://openrouter.ai/docs/api-reference/limits)).
- **OpenAI**, **Anthropic**, and **Gemini** are billed per token on your own
  account (Gemini has a free tier); check each provider's own pricing/limits
  pages.

Reopening the popup on a page you already ran reuses the cached result
instead of spending another request; use **Re-run** to force a fresh one.

## Development

```sh
npm test        # unit tests: timezone math, Calendar URL building, schema
                 # validation/normalization, capture, per-provider request
                 # shaping, settings migration
npm run typecheck
npm run eval     # live check against tests/fixtures/*, not run in CI. e.g.:
                 #   OPENROUTER_API_KEY=... npm run eval
                 #   OPENAI_API_KEY=...     npm run eval -- --provider=openai --model=gpt-5.6-luna
                 #   ANTHROPIC_API_KEY=...  npm run eval -- --provider=anthropic
                 #   GEMINI_API_KEY=...     npm run eval -- --provider=gemini
```

`src/time.ts` and `src/gcal.ts` carry the logic worth testing carefully: the
LLM only reads times as written on the page (never converts between
timezones), and the code does the UTC conversion — including the case where
a flight's departure and arrival are in different timezones.

`src/normalize.ts` coerces common alternate date/time formats (12h AM/PM,
month names, slash dates) before schema validation. This matters because
`json_schema` structured-output modes generally enforce JSON *shape* (keys,
types) but not string `pattern`s, so a model can return a well-formed object
with a date/time in whatever format the source page used.

`src/llm/providers/` has one module per provider (`openrouter.ts`,
`openai.ts`, `anthropic.ts` — via the official `@anthropic-ai/sdk` —
`gemini.ts`), each just turning a provider-agnostic message list into a raw
text response. `src/llm/extract.ts` is the shared orchestration: it runs a
model, retries once with the validation error fed back if the response fails
schema validation, and falls back through the configured fallback models on
a retryable error (not on an auth/billing error, which won't be fixed by
trying a different model on the same account).

## Contributing

Issues and PRs are welcome. Please run `npm test` and `npm run typecheck`
before submitting, and keep new logic covered by unit tests — see
`tests/` for the existing style (mocked `fetch`/`Response` for provider
code, fixture-based for capture/extraction).

## License

[MIT](LICENSE)
