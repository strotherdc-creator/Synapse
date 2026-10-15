/**
 * Validation for the Communication Coach "settings from link" query params (Oct 15 2026).
 * The Coach page keeps reading its settings from the link; this only makes the inputs safe.
 */

const PLACEHOLDER_ORIGIN = "https://synapse.invalid";

/**
 * Only a same-origin path like "/today" or "/today?x=1#y" is allowed as a return link.
 * Rejects absolute URLs, protocol-relative "//host", backslash tricks, javascript:/data:
 * schemes, control characters and anything over 500 characters. Returns null when unsafe.
 */
export function safeReturnPath(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (value.length === 0 || value.length > 500) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const url = new URL(value, PLACEHOLDER_ORIGIN);
    if (url.origin !== PLACEHOLDER_ORIGIN) return null;
    const out = `${url.pathname}${url.search}${url.hash}`;
    // Normalising can turn "/..//evil.com" into "//evil.com" (protocol-relative): re-check the result.
    if (!out.startsWith("/") || out.startsWith("//") || out.startsWith("/\\") || /[\\\u0000-\u001f\u007f]/.test(out)) return null;
    return out;
  } catch {
    return null;
  }
}

/** Plain text from a link: control characters removed, trimmed, capped. Empty → null. */
export function safeLinkText(raw: string | null | undefined, maxLength = 500): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, maxLength);
  return cleaned.length > 0 ? cleaned : null;
}
