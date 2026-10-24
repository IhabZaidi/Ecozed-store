/** Bounded retry for outbound notifiers (Telegram, CAPI).
 * Retries ONLY thrown network errors (connection reset, timeout, DNS) —
 * those mean "almost certainly not delivered". HTTP error responses are
 * decisive (delivered-or-rejected by the API) and must NOT be retried:
 * resending to Telegram could double-post the message, while CAPI is safe
 * to resend (same event_id dedups) but a 4xx means our payload/auth is
 * wrong and retrying won't fix it. Callers log the final outcome.
 */
export async function withRetries<T>(
  label: string,
  attempts: number,
  fn: () => Promise<T>
): Promise<T> {
  let last: unknown = null;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < attempts)
        await new Promise((r) => setTimeout(r, 500 * i));
    }
  }
  console.error(`${label} failed after ${attempts} attempts`, last);
  throw last;
}
