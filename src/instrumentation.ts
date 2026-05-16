// Next.js runs `register()` once when the server process boots.
//
// Fail-fast: a production deployment MUST have an LLM key. Without one the app
// would still start, but generation and document-check evaluation silently
// fall back to the echo stub — producing fake results that look real. That is
// acceptable in development (the stub keeps the app and tests runnable offline)
// but dangerous in production, so we refuse to start instead.

export function register(): void {
  const inProduction = process.env.NODE_ENV === "production";
  if (inProduction && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "[AiWriter] ANTHROPIC_API_KEY is required in production but is not set. " +
        "Refusing to start: draft generation and document-check evaluation " +
        "would silently produce fake results. Set ANTHROPIC_API_KEY and restart."
    );
  }
}
