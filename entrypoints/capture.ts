import { Readability } from '@mozilla/readability';
import { captureFromDocument } from '../src/capture';

// Injected on demand by the background worker. Exposes a function that a
// follow-up executeScript call awaits, since file injections can't return
// async results directly.
export default defineUnlistedScript(() => {
  (globalThis as any).__tabToCalCapture = () =>
    captureFromDocument(document, location.href, window.getSelection()?.toString() ?? '', Readability);
});
