/**
 * Manual live evaluation against a real provider. Not run in CI or by
 * `npm test` — it spends real requests / quota.
 *
 * Usage:
 *   OPENROUTER_API_KEY=sk-... npm run eval [-- --provider=openrouter --model=some/model:free]
 *   OPENAI_API_KEY=sk-...     npm run eval -- --provider=openai --model=gpt-5.6-luna
 *   ANTHROPIC_API_KEY=sk-...  npm run eval -- --provider=anthropic --model=claude-haiku-4-5-20251001
 *   GEMINI_API_KEY=...        npm run eval -- --provider=gemini --model=gemini-3.5-flash-lite
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEvents } from '../src/llm/extract';
import { COMPLETE_FNS, PROVIDER_INFO, PROVIDERS, type Provider } from '../src/llm/providers';
import { buildGcalUrl } from '../src/gcal';
import { resolveTimes } from '../src/time';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../tests/fixtures');

function argValue(flag: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${flag}=`))?.slice(flag.length + 3);
}

const providerArg = (argValue('provider') as Provider | undefined) ?? 'openrouter';
if (!PROVIDERS.includes(providerArg)) {
  console.error(`Unknown provider "${providerArg}". Choose one of: ${PROVIDERS.join(', ')}`);
  process.exit(1);
}
const provider: Provider = providerArg;

const ENV_KEY: Record<Provider, string> = {
  openrouter: 'OPENROUTER_API_KEY',
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
};
const apiKey = process.env[ENV_KEY[provider]];
if (!apiKey) {
  console.error(`Set ${ENV_KEY[provider]} to run the live eval against ${PROVIDER_INFO[provider].name}.`);
  process.exit(1);
}

const model = argValue('model') ?? PROVIDER_INFO[provider].defaultModel;

interface ExpectedEvent {
  title: string;
  start: { date: string; time: string | null; timeZone?: string };
  end?: { date: string; time: string | null; timeZone?: string };
  location?: string;
  recurrence?: string;
}

function fuzzyDateMatch(expected: string, actual: string): boolean {
  return expected.includes('X') ? expected.slice(0, 5) === actual.slice(0, 5) : expected === actual;
}

async function evalFixture(fileName: string) {
  const base = fileName.replace(/\.txt$/, '');
  const text = await readFile(path.join(fixturesDir, fileName), 'utf-8');
  const expected: { events: ExpectedEvent[] } = JSON.parse(
    await readFile(path.join(fixturesDir, `${base}.expected.json`), 'utf-8'),
  );

  console.log(`\n=== ${base} (expecting ${expected.events.length} event(s)) ===`);

  const events = await extractEvents(
    {
      provider,
      apiKey: apiKey!,
      model,
      fallbackModels: [],
      text,
      pageTitle: base,
      pageUrl: `https://example.com/${base}`,
      now: new Date('2026-09-16T00:00:00Z'),
      browserTimeZone: 'America/Chicago',
    },
    COMPLETE_FNS,
  );

  console.log(`Got ${events.length} event(s):`);
  let matched = 0;
  for (const actual of events) {
    const times = resolveTimes(actual as any, 'America/Chicago');
    const url = buildGcalUrl(actual as any, { fallbackTimeZone: 'America/Chicago' });
    console.log(`  - "${actual.title}" [${times.kind}]`);
    console.log(`    ${url}`);

    const match = expected.events.find(
      (e) => e.title.toLowerCase().slice(0, 12) === actual.title.toLowerCase().slice(0, 12),
    );
    if (match && fuzzyDateMatch(match.start.date, actual.start.date) && match.start.time === actual.start.time) {
      matched++;
    } else if (match) {
      console.log(`    ⚠ expected start ${match.start.date} ${match.start.time}, got ${actual.start.date} ${actual.start.time}`);
    } else {
      console.log(`    ⚠ no matching expected event by title`);
    }
  }
  console.log(`Matched ${matched}/${expected.events.length} expected events.`);
  return { fixture: base, expectedCount: expected.events.length, gotCount: events.length, matched };
}

async function main() {
  console.log(`Provider: ${PROVIDER_INFO[provider].name}, model: ${model}`);
  const files = (await readdir(fixturesDir)).filter((f) => f.endsWith('.txt'));
  const results = [];
  for (const file of files) {
    try {
      results.push(await evalFixture(file));
    } catch (error) {
      console.error(`  ✗ ${file} failed:`, error);
      results.push({ fixture: file, expectedCount: -1, gotCount: 0, matched: 0 });
    }
  }

  console.log('\n=== Summary ===');
  for (const r of results) console.log(`${r.fixture}: ${r.matched}/${r.expectedCount} matched, ${r.gotCount} returned`);
}

main();
