/**
 * Manual live evaluation against real OpenRouter models. Not run in CI or by
 * `npm test` — it spends real requests against the free-tier daily quota.
 *
 * Usage: OPENROUTER_API_KEY=sk-... npm run eval [-- --model=some/model:free]
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractEvents } from '../src/llm/openrouter';
import { buildGcalUrl } from '../src/gcal';
import { resolveTimes } from '../src/time';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, '../tests/fixtures');

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('Set OPENROUTER_API_KEY to run the live eval.');
  process.exit(1);
}

const modelArg = process.argv.find((a) => a.startsWith('--model='));
const model = modelArg?.slice('--model='.length) ?? 'nvidia/nemotron-3-super-120b-a12b:free';

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

  const events = await extractEvents({
    apiKey: apiKey!,
    model,
    fallbackModels: [],
    text,
    pageTitle: base,
    pageUrl: `https://example.com/${base}`,
    now: new Date('2026-09-16T00:00:00Z'),
    browserTimeZone: 'America/Chicago',
  });

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
