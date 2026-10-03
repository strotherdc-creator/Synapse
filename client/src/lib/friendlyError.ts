/**
 * Turn a tRPC/network error into a sentence a doctor can act on.
 * Server-side Log Stats errors are already written in plain English (StatSettingsError);
 * anything else (raw validation output, stack-ish text, network failures) is replaced
 * with a plain-English fallback so doctors never see JSON or code words.
 */
type MaybeTrpcError = {
  message?: string;
  data?: { code?: string; zodError?: unknown } | null;
} | null | undefined;

const CODE_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Your session has ended. Please sign in again.",
  FORBIDDEN: "You don't have access to do that.",
  TOO_MANY_REQUESTS: "Too many tries in a row. Please wait a moment and try again.",
  TIMEOUT: "That took too long. Please try again.",
  INTERNAL_SERVER_ERROR: "Something went wrong on our side. Please try again in a moment.",
};

/** True when a message looks like machine output rather than a sentence for people. */
export function looksTechnical(message: string): boolean {
  const m = message.trim();
  if (!m) return true;
  if (m.length > 200) return true;
  if (/^[[{]/.test(m)) return true; // JSON (e.g. zod issue arrays)
  if (/"(code|path|expected|received|minimum|maximum)"\s*:/.test(m)) return true;
  if (/\b(zod|invalid_type|too_big|too_small|TRPCError|undefined|null|NaN|SQL|relation|column|ECONN|fetch failed)\b/i.test(m)) return true;
  return false;
}

export function friendlyErrorMessage(error: MaybeTrpcError, fallback: string): string {
  if (!error) return fallback;
  const code = error.data?.code;
  if (code === "BAD_REQUEST") {
    // Plain-English messages from our own validation pass through; raw schema errors do not.
    if (!error.data?.zodError && error.message && !looksTechnical(error.message)) return error.message;
    return "Some of those entries aren't valid. Please check the numbers and names, then try again.";
  }
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  return fallback;
}
