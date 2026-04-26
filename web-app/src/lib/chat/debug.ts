/**
 * Shared chat-debug logger. Used by both the chat route and the LLM
 * fetch shim so that server-side traces use a single, greppable prefix
 * (`[chat-debug] ...`) regardless of which layer emitted them.
 *
 * Output goes to `console.error` so it lands in `dev-server.log` even
 * when `console.log` is buffered.
 */
export function logChatDebug(label: string, payload?: unknown): void {
  const prefix = `[chat-debug] ${label}`;
  if (payload === undefined) {
    console.error(prefix);
    return;
  }
  try {
    console.error(prefix, JSON.stringify(payload));
  } catch {
    console.error(prefix, payload);
  }
}
