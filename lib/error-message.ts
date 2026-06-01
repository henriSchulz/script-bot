/**
 * Extracts a human-readable string from any thrown value.
 *
 * Tries to surface the *useful* part — Gemini API status, Prisma code, fs path,
 * HTTP response body — instead of just "[object Object]" or a generic Error.
 *
 * Use at every catch boundary that ends up shown to a user.
 */
export function errorMessage(error: unknown): string {
  if (error == null) return "Unbekannter Fehler";
  if (typeof error === "string") return error;

  if (typeof error === "object") {
    const e = error as Record<string, any>;

    // Google Generative AI: GoogleGenerativeAIFetchError / Response error
    // Shape: { status: "RESOURCE_EXHAUSTED" | "INVALID_ARGUMENT" | ..., statusText, errorDetails, message }
    if (typeof e.status === "string" && typeof e.message === "string") {
      // Status codes like "RESOURCE_EXHAUSTED" → rate limit; "PERMISSION_DENIED" → bad key
      const friendly = mapGeminiStatus(e.status);
      return friendly ? `${friendly} (${e.status}): ${e.message}` : `${e.status}: ${e.message}`;
    }

    // Prisma errors: { code: "P2002", meta: { ... }, message }
    if (typeof e.code === "string" && e.code.startsWith("P") && typeof e.message === "string") {
      return `Datenbankfehler (${e.code}): ${shortenPrisma(e.message)}`;
    }

    // Node fs errors: { code: "ENOENT" | "EACCES" | "ENOSPC", path }
    if (typeof e.code === "string") {
      if (e.code === "ENOENT") return `Datei nicht gefunden${e.path ? `: ${e.path}` : ""}`;
      if (e.code === "EACCES") return `Zugriff verweigert${e.path ? `: ${e.path}` : ""}`;
      if (e.code === "ENOSPC") return "Speicherplatz erschöpft";
      if (e.code === "EISDIR") return `Pfad ist ein Verzeichnis${e.path ? `: ${e.path}` : ""}`;
    }

    if (typeof e.message === "string" && e.message.length > 0) return e.message;
    if (typeof e.error === "string") return e.error;

    try {
      const json = JSON.stringify(error);
      if (json && json !== "{}") return json;
    } catch {
      /* ignore */
    }
  }

  return String(error);
}

/**
 * Wraps a label and an error into "{label}: {detail}".
 * Returns just the label if the helper can't extract anything useful.
 */
export function formatError(label: string, error: unknown): string {
  const detail = errorMessage(error);
  if (!detail || detail === label || detail === "Unbekannter Fehler") return label;
  return `${label}: ${detail}`;
}

function mapGeminiStatus(status: string): string | null {
  switch (status) {
    case "RESOURCE_EXHAUSTED":
      return "Rate-Limit erreicht";
    case "PERMISSION_DENIED":
      return "API-Key ungültig oder ohne Berechtigung";
    case "UNAUTHENTICATED":
      return "API-Key fehlt oder ungültig";
    case "INVALID_ARGUMENT":
      return "Ungültige Anfrage an das Modell";
    case "NOT_FOUND":
      return "Modell nicht gefunden";
    case "FAILED_PRECONDITION":
      return "Anfrage abgelehnt";
    case "UNAVAILABLE":
      return "Modell vorübergehend nicht verfügbar";
    case "DEADLINE_EXCEEDED":
      return "Anfrage hat das Timeout überschritten";
    case "INTERNAL":
      return "Interner Fehler beim Modell";
    default:
      return null;
  }
}

function shortenPrisma(message: string): string {
  // Prisma errors often contain a multi-line "Invocation in /path/file.ts" preamble.
  // Keep just the actual error line(s).
  const lines = message
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("Invocation in"));
  // The actual user-facing message is usually the last non-empty line.
  return lines[lines.length - 1] || message;
}
