import type { Capture } from '../src/capture';
import { latestResultForUrl, type RunResult } from '../src/history';
import { runExtraction } from '../src/run';

const CONTEXT_MENU_ID = 'tab-to-cal-selection';

async function captureTab(tabId: number, url: string): Promise<Capture> {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['capture.js'] });
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => (globalThis as any).__tabToCalCapture(),
  });
  const result = results[0]?.result;
  if (!result) throw new Error('Could not read this page.');
  return result as Capture;
}

async function setBadge(tabId: number, text: string, color: string) {
  await chrome.action.setBadgeText({ tabId, text });
  await chrome.action.setBadgeBackgroundColor({ tabId, color });
}

/** For a single-event result, opens the Calendar tab right here in the
 * background - not in the popup - so it happens even if the popup that
 * triggered the run has since closed (switching tabs, clicking away, etc.
 * all close it, but the extraction keeps running regardless). */
async function autoOpenIfSingleEvent(result: RunResult): Promise<boolean> {
  if (result.status === 'done' && result.events.length === 1) {
    await chrome.tabs.create({ url: result.gcalUrls[0] });
    return true;
  }
  return false;
}

/** Runs the pipeline for a tab and reflects the outcome as a badge, since the
 * context-menu trigger has no popup of its own to show progress or results in. */
async function runForTab(tabId: number, url: string) {
  await setBadge(tabId, '…', '#666666');
  try {
    const capture = await captureTab(tabId, url);
    const { result } = await runExtraction(capture, Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (result.status === 'error') {
      await setBadge(tabId, '!', '#c0392b');
    } else if (result.status === 'done' && result.events.length > 0) {
      if (await autoOpenIfSingleEvent(result)) {
        await setBadge(tabId, '✓', '#2e7d32');
      } else {
        await setBadge(tabId, String(result.events.length), '#2e7d32');
      }
    } else {
      await setBadge(tabId, '0', '#888888');
    }
  } catch {
    await setBadge(tabId, '!', '#c0392b');
  }
}

export default defineBackground(() => {
  chrome.contextMenus.create({
    id: CONTEXT_MENU_ID,
    title: 'Add to Google Calendar',
    contexts: ['selection'],
  });

  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID && tab?.id) {
      runForTab(tab.id, tab.url ?? '');
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // A message from the popup has no sender.tab (that's only set for
    // messages from a content script running in a tab), so the popup sends
    // its own resolved tabId instead.
    if (message?.type === 'capture-and-extract') {
      const tabId = message.tabId ?? sender.tab?.id;
      if (!tabId) {
        sendResponse({ ok: false, message: 'Could not find the current tab.' });
        return true;
      }
      captureTab(tabId, '')
        .then((capture) => runExtraction(capture, message.browserTimeZone))
        .then(async (outcome) => {
          const autoOpened = await autoOpenIfSingleEvent(outcome.result);
          sendResponse({ ok: true, ...outcome, autoOpened });
        })
        .catch((error) => sendResponse({ ok: false, message: error?.message ?? 'Unknown error' }));
      return true;
    }
    if (message?.type === 'get-latest-for-url') {
      latestResultForUrl(message.url).then((result) => sendResponse({ result }));
      return true;
    }
  });

  chrome.action.onClicked.addListener(async () => {
    // Only fires when there is no popup; kept as a no-op safety net.
  });
});
