import type { Capture } from '../src/capture';
import { latestResultForUrl } from '../src/history';
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
      if (result.events.length === 1) {
        await chrome.tabs.create({ url: result.gcalUrls[0] });
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
    if (message?.type === 'capture-and-extract' && sender.tab?.id) {
      captureTab(sender.tab.id, sender.tab.url ?? '')
        .then((capture) => runExtraction(capture, message.browserTimeZone))
        .then((outcome) => sendResponse({ ok: true, ...outcome }))
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
