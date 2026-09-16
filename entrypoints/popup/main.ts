import { describeWhen, needsReview } from '../../src/format';
import type { RunResult } from '../../src/history';

const app = document.getElementById('app')!;
const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

function send<T = any>(message: any): Promise<T> {
  return chrome.runtime.sendMessage(message);
}

function el(html: string): HTMLElement {
  const div = document.createElement('div');
  div.innerHTML = html.trim();
  return div.firstElementChild as HTMLElement;
}

function renderLoading() {
  app.replaceChildren(el(`<div class="row"><span class="spinner"></span><span>Reading the page…</span></div>`));
}

function renderError(message: string, onRetry: () => void) {
  const view = el(`
    <div>
      <div class="row error">${escapeHtml(message)}</div>
      <div class="footer">
        <button class="link" id="retry">Try again</button>
        <a class="link" href="#" id="options" style="text-decoration:none;display:inline-block">Options</a>
      </div>
    </div>
  `);
  view.querySelector('#retry')!.addEventListener('click', onRetry);
  view.querySelector('#options')!.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });
  app.replaceChildren(view);
}

function renderEmpty(onRetry: () => void) {
  const view = el(`
    <div>
      <div class="row muted">No events found on this page. Try selecting the event text, or use the right-click menu.</div>
      <div class="footer"><button class="link" id="retry">Re-run</button><span></span></div>
    </div>
  `);
  view.querySelector('#retry')!.addEventListener('click', onRetry);
  app.replaceChildren(view);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function renderChecklist(result: Extract<RunResult, { status: 'done' }>, onRetry: () => void) {
  const rows = result.events
    .map((event, i) => {
      const flagged = needsReview(event) ? ' <span class="warn" title="Time or timezone was guessed">⚠</span>' : '';
      return `
        <label class="row">
          <input type="checkbox" data-i="${i}" checked />
          <span class="when">
            <div class="title">${escapeHtml(event.title)}</div>
            <div class="meta">${escapeHtml(describeWhen(event, browserTimeZone))}${flagged}</div>
          </span>
        </label>
      `;
    })
    .join('');

  const view = el(`
    <div>
      <h1>${result.events.length} events found</h1>
      ${rows}
      <div class="footer">
        <button class="link" id="retry">Re-run</button>
        <button class="primary" id="add">Add selected</button>
      </div>
    </div>
  `);

  view.querySelector('#add')!.addEventListener('click', () => {
    const checked = [...view.querySelectorAll<HTMLInputElement>('input[type=checkbox]:checked')];
    for (const box of checked) {
      const i = Number(box.dataset.i);
      chrome.tabs.create({ url: result.gcalUrls[i] });
    }
    window.close();
  });
  view.querySelector('#retry')!.addEventListener('click', onRetry);
  app.replaceChildren(view);
}

function renderDone(result: Extract<RunResult, { status: 'done' }>, onRetry: () => void, freshSingleOpened: boolean) {
  if (result.events.length === 0) return renderEmpty(onRetry);
  if (result.events.length === 1 && freshSingleOpened) {
    app.replaceChildren(el(`<div class="row">Opened in Google Calendar ✓</div>`));
    setTimeout(() => window.close(), 700);
    return;
  }
  renderChecklist(result, onRetry);
}

async function runFresh() {
  renderLoading();
  const response = await send({ type: 'capture-and-extract', browserTimeZone });
  if (!response?.ok) {
    renderError(response?.message ?? 'Something went wrong. Please try again.', runFresh);
    return;
  }
  const { result } = response;
  if (result.status === 'error') return renderError(result.message, runFresh);
  if (result.status === 'done') {
    if (result.events.length === 1) chrome.tabs.create({ url: result.gcalUrls[0] });
    renderDone(result, runFresh, true);
  }
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return renderError('No page to read.', init);

  const { result } = await send<{ result?: RunResult }>({ type: 'get-latest-for-url', url: tab.url });
  if (!result || result.status === 'pending') return runFresh();
  if (result.status === 'error') return renderError(result.message, runFresh);
  renderDone(result, runFresh, false);
}

init();
