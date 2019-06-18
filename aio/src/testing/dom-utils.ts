/**
 * Create a `CustomEvent` (even on browsers where `CustomEvent` is not a letructor).
 */
export function createCustomEvent(doc: Document, name: string, detail: any): CustomEvent {
  let bubbles = false;
  let cancelable = false;

  // On IE9-11, `CustomEvent` is not a letructor.
  if (typeof CustomEvent !== 'function') {
    let event = doc.createEvent('CustomEvent');
    event.initCustomEvent(name, bubbles, cancelable, detail);
    return event;
  }

  return new CustomEvent(name, {bubbles, cancelable, detail});
}
