/**
 * Waiter sales that have not reached the server yet (beach, weak signal).
 * Each entry keeps its idempotencyKey, so re-sending can never create a second ticket.
 */
const KEY = "pos_outbox_v1";
/** sale = paid on the spot; park = sent to the counter, paid on delivery. */
export type OutboxEntry = { idem: string; kind?: "sale" | "park"; args: any; at: number };

export function readOutbox(): OutboxEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(list: OutboxEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event("pos-outbox"));
}
export const addToOutbox = (e: OutboxEntry) => write([...readOutbox().filter((x) => x.idem !== e.idem), e]);
export const removeFromOutbox = (idem: string) => write(readOutbox().filter((x) => x.idem !== idem));
