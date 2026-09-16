import { buildGcalUrl } from './gcal';
import { putResult, resultKey, type RunResult } from './history';
import { extractEvents, ExtractError } from './llm/openrouter';
import { getSettings } from './settings';
import type { Capture } from './capture';

export interface RunOutcome {
  result: RunResult;
  gcalUrls: string[];
}

/** Runs extraction for a captured page and records the result in history. */
export async function runExtraction(capture: Capture, browserTimeZone: string): Promise<RunOutcome> {
  const key = await resultKey(capture.url, capture.text);
  const settings = await getSettings();

  await putResult({ status: 'pending', key, url: capture.url, title: capture.title, startedAt: Date.now() });

  try {
    const events = await extractEvents({
      apiKey: settings.apiKey,
      model: settings.model,
      fallbackModels: settings.fallbackModels,
      text: capture.text,
      pageTitle: capture.title,
      pageUrl: capture.url,
      now: new Date(),
      browserTimeZone,
    });

    const gcalUrls = events.map((event) =>
      buildGcalUrl(event, {
        fallbackTimeZone: browserTimeZone,
        sourceUrl: capture.url,
        accountEmail: settings.accountEmail || undefined,
      }),
    );

    const result: RunResult = {
      status: 'done',
      key,
      url: capture.url,
      title: capture.title,
      finishedAt: Date.now(),
      events,
      gcalUrls,
    };
    await putResult(result);
    return { result, gcalUrls };
  } catch (error) {
    const message = error instanceof ExtractError ? error.message : 'Something went wrong. Please try again.';
    const result: RunResult = { status: 'error', key, url: capture.url, title: capture.title, finishedAt: Date.now(), message };
    await putResult(result);
    return { result, gcalUrls: [] };
  }
}
