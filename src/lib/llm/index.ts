// LLM model boundary. V1 ships this interface, a deterministic stub for
// tests, and a real Anthropic-backed provider used in production.
//
// The shape mirrors the Anthropic Messages API (system + user/assistant turns
// → text). Provider-neutral enough that swapping is one file.

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface LlmRequest {
  systemPrompt: string;
  messages: LlmMessage[];
  // Deterministic seed lets tests pin exact outputs from stub providers.
  seed?: string;
}

export interface LlmProvider {
  complete(request: LlmRequest): Promise<string>;
}

// Echo stub — returns the last user message verbatim, prefixed with the seed
// (if any) for deterministic testing. Real provider lands in slices 002/006.
export function createStubProvider(): LlmProvider {
  return {
    async complete(request: LlmRequest): Promise<string> {
      const lastUser = [...request.messages]
        .reverse()
        .find((m) => m.role === "user");
      const body = lastUser?.content ?? "";
      return request.seed ? `[${request.seed}] ${body}` : body;
    },
  };
}

// Scripted provider — lets a test compute the response from the request.
// The Validation Engine's Question Evaluator is the primary consumer:
// tests pin the JSON output per check question.
export function createScriptedProvider(
  script: (request: LlmRequest) => string | Promise<string>
): LlmProvider {
  return {
    async complete(request: LlmRequest): Promise<string> {
      return script(request);
    },
  };
}

// Anthropic-backed provider. Lazy-loaded so the SDK only initializes when
// we actually need it — tests that inject via `setDefaultProviderForTesting`
// never touch this code path.
//
// Model default is a Sonnet (fast + cheap enough for per-section prompts).
// Override via `model` or the `ANTHROPIC_MODEL` env var when wiring routes.
const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4-5";

export interface AnthropicProviderOptions {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

export function createAnthropicProvider(
  options: AnthropicProviderOptions
): LlmProvider {
  const model = options.model ?? ANTHROPIC_DEFAULT_MODEL;
  const maxTokens = options.maxTokens ?? 2048;
  // Lazy import keeps the SDK out of the test/jsdom hot path.
  let clientPromise: Promise<{
    messages: {
      create: (body: AnthropicCreateBody) => Promise<AnthropicResponse>;
    };
  }> | null = null;
  async function getClient() {
    if (!clientPromise) {
      clientPromise = import("@anthropic-ai/sdk").then((mod) => {
        const Anthropic = mod.default;
        return new Anthropic({ apiKey: options.apiKey }) as unknown as {
          messages: {
            create: (body: AnthropicCreateBody) => Promise<AnthropicResponse>;
          };
        };
      });
    }
    return clientPromise;
  }
  return {
    async complete(request: LlmRequest): Promise<string> {
      const client = await getClient();
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: request.systemPrompt,
        messages: request.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });
      return response.content
        .filter((block): block is { type: "text"; text: string } =>
          block.type === "text"
        )
        .map((block) => block.text)
        .join("\n");
    },
  };
}

// Minimal shape we depend on — kept here so the SDK's deep types don't leak
// into our module. The actual SDK types are richer; we only need text
// content blocks back.
interface AnthropicCreateBody {
  model: string;
  max_tokens: number;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}
interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
}

// Local provider — talks to a ClaudeInBrowserSocket server over WebSocket.
// The server fronts a headless `claude -p` run per job: we send one prompt,
// wait for the terminal `result` (or `error`) frame, and return the result
// text. The provider contract is single-shot text in / text out, so the
// systemPrompt and the (single) user turn are folded into one string the
// way `claude -p` expects (no separate system slot).
//
// Multi-turn `messages` arrays are not used by any current call site, but
// the contract accepts them — we degrade gracefully by tagging each turn
// with its role so nothing is silently dropped.
const LOCAL_DEFAULT_URL = "ws://127.0.0.1:8787";
const LOCAL_DEFAULT_TIMEOUT_MS = 120_000;

export interface LocalProviderOptions {
  url?: string;
  timeoutMs?: number;
}

export function createLocalProvider(
  options: LocalProviderOptions = {}
): LlmProvider {
  const url = options.url ?? LOCAL_DEFAULT_URL;
  const timeoutMs = options.timeoutMs ?? LOCAL_DEFAULT_TIMEOUT_MS;
  return {
    async complete(request: LlmRequest): Promise<string> {
      const prompt = renderPromptForLocal(request);
      return await sendOnce(url, prompt, timeoutMs);
    },
  };
}

function renderPromptForLocal(request: LlmRequest): string {
  // The common case: one user turn. systemPrompt + blank line + user content.
  if (request.messages.length === 1 && request.messages[0]!.role === "user") {
    return `${request.systemPrompt}\n\n${request.messages[0]!.content}`;
  }
  // Defensive: tag each turn so nothing is silently dropped if a future call
  // site uses multi-turn. claude -p has no real role channel, but a labelled
  // transcript is still legible to the model.
  const turns = request.messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
  return `${request.systemPrompt}\n\n${turns}`;
}

// One round-trip over the WS protocol used by ClaudeInBrowserSocket:
//   client -> {prompt, sessionId, resume:false}
//   server -> {type:"accepted"} | {type:"queued", position}   (informational)
//   server -> {type:"result", is_error, result} | {type:"error", reason}
function sendOnce(
  url: string,
  prompt: string,
  timeoutMs: number
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    // Node 24 exposes WebSocket as a global. In the browser/Edge runtime
    // this provider isn't reachable (routes that use it run server-side).
    const ws = new WebSocket(url);
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const settle = (err: Error | null, value?: string) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try {
        ws.close();
      } catch {
        /* already closing */
      }
      if (err) reject(err);
      else resolve(value!);
    };

    timer = setTimeout(() => {
      settle(new Error(`Local LLM request timed out after ${timeoutMs} ms`));
    }, timeoutMs);

    ws.addEventListener("open", () => {
      const sessionId = randomSessionId();
      ws.send(JSON.stringify({ prompt, sessionId, resume: false }));
    });

    ws.addEventListener("message", (event: MessageEvent) => {
      let frame: { type?: string; is_error?: boolean; result?: string; reason?: string };
      try {
        frame = JSON.parse(String(event.data));
      } catch {
        return; // non-JSON frame — ignore
      }
      if (frame.type === "result") {
        if (frame.is_error) {
          settle(
            new Error(`Local LLM returned an error result: ${frame.result ?? ""}`)
          );
        } else {
          settle(null, String(frame.result ?? ""));
        }
      } else if (frame.type === "error") {
        settle(new Error(`Local LLM job failed: ${frame.reason ?? "unknown"}`));
      }
      // 'accepted' / 'queued' frames are informational — keep waiting.
    });

    ws.addEventListener("error", () => {
      settle(new Error(`Local LLM connection error talking to ${url}`));
    });
    ws.addEventListener("close", () => {
      settle(
        new Error(
          `Local LLM connection closed before a terminal frame (${url})`
        )
      );
    });
  });
}

function randomSessionId(): string {
  // crypto.randomUUID is in globalThis on Node 16+ and modern browsers.
  return globalThis.crypto.randomUUID();
}

// Process-singleton provider. When ANTHROPIC_API_KEY is set in the
// environment, routes get the real provider; otherwise they fall back to
// the deterministic stub so dev still runs without an API key (the stub
// returns echo output, so generated drafts will be visibly stubby — that's
// the dev signal that you forgot to set the key, not a bug).
let _defaultProvider: LlmProvider | null = null;

// What provider the process is configured to use, in a form route/page code
// can use to decide what banner to show. Server-only.
//
//  - "ok"          — Anthropic provider with a usable API key.
//  - "missing"     — no key, no local mode; falls back to the echo stub.
//  - "oauth-token" — an `sk-ant-oat…` Claude-subscription / OAuth token. The
//                    provider authenticates with the `x-api-key` header,
//                    which only accepts API keys, so this 401s at request
//                    time — present, but not usable.
//  - "local"       — LLM_PROVIDER=local; routes talk to a ClaudeInBrowserSocket
//                    server at `localUrl`. The key is irrelevant in this mode.
export type LlmKeyStatus =
  | { kind: "ok" }
  | { kind: "missing" }
  | { kind: "oauth-token" }
  | { kind: "local"; localUrl: string };

export function getLlmKeyStatus(): LlmKeyStatus {
  if (isLocalProviderSelected()) {
    return { kind: "local", localUrl: getLocalProviderUrl() };
  }
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { kind: "missing" };
  if (key.startsWith("sk-ant-oat")) return { kind: "oauth-token" };
  return { kind: "ok" };
}

// Explicit override: LLM_PROVIDER=local|anthropic|stub. When unset, falls
// back to the historical key-driven behavior (key → anthropic, else stub).
function selectedProviderName(): "local" | "anthropic" | "stub" | null {
  const raw = process.env.LLM_PROVIDER?.trim().toLowerCase();
  if (raw === "local" || raw === "anthropic" || raw === "stub") return raw;
  return null;
}

export function isLocalProviderSelected(): boolean {
  return selectedProviderName() === "local";
}

function getLocalProviderUrl(): string {
  return process.env.AIWRITER_LOCAL_LLM_URL?.trim() || "ws://127.0.0.1:8787";
}

function getLocalProviderTimeoutMs(): number {
  const raw = process.env.AIWRITER_LOCAL_LLM_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 120_000;
}

export function getDefaultProvider(): LlmProvider {
  if (_defaultProvider) return _defaultProvider;
  const override = selectedProviderName();
  if (override === "local") {
    _defaultProvider = createLocalProvider({
      url: getLocalProviderUrl(),
      timeoutMs: getLocalProviderTimeoutMs(),
    });
    return _defaultProvider;
  }
  if (override === "stub") {
    _defaultProvider = createStubProvider();
    return _defaultProvider;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (override === "anthropic" || apiKey) {
    if (!apiKey) {
      // Explicit LLM_PROVIDER=anthropic with no key — warn rather than
      // silently fall through to the stub so the misconfiguration is loud.
      console.warn(
        "[AiWriter] LLM_PROVIDER=anthropic but ANTHROPIC_API_KEY is unset; " +
          "falling back to the echo stub."
      );
      _defaultProvider = createStubProvider();
      return _defaultProvider;
    }
    _defaultProvider = createAnthropicProvider({
      apiKey,
      model: process.env.ANTHROPIC_MODEL,
    });
    return _defaultProvider;
  }
  // No key → echo stub. Generation produces stubby text and check
  // evaluation cannot run (the stub's output isn't valid JSON, so every
  // check comes back as `error`). Warn loudly once so this shows up in the
  // server log rather than only as confusing in-app results.
  console.warn(
    "[AiWriter] ANTHROPIC_API_KEY is not set — using the echo stub LLM " +
      "provider. Draft generation will be stubby and document-check " +
      'evaluation will report every check as "Not evaluated". Set ' +
      "ANTHROPIC_API_KEY to enable real generation and validation, or set " +
      "LLM_PROVIDER=local to use a ClaudeInBrowserSocket server."
  );
  _defaultProvider = createStubProvider();
  return _defaultProvider;
}

// Test seam — mirrors the document store's seam so engines can swap in a
// scripted provider for integration tests without rewiring imports.
export function setDefaultProviderForTesting(provider: LlmProvider | null): void {
  _defaultProvider = provider;
}

// --- Prompt recording ---------------------------------------------------
//
// The engines (generation, validation) build their prompt strings privately
// and hand them to a provider. To surface the exact prompt that hit the LLM
// in the UI — without threading a return value through every engine function
// — we wrap the provider: a RecordingProvider delegates `complete` unchanged
// but keeps a transcript of every request/response pair it saw.

// One captured LLM round-trip: the exact request a route sent plus the raw
// text that came back.
export interface PromptExchange {
  systemPrompt: string;
  messages: LlmMessage[];
  response: string;
}

// The bundle of exchanges produced by a single user action (one Generate,
// one Validate, …). `kind` labels the action; `timestamp` is when the route
// finished assembling it.
export interface PromptLog {
  kind: string;
  timestamp: string;
  exchanges: PromptExchange[];
}

export interface RecordingProvider extends LlmProvider {
  // Live transcript — appended to on every `complete` call. Read it after the
  // engine work finishes to build a PromptLog.
  readonly exchanges: PromptExchange[];
}

// Wraps any provider so callers can inspect what was sent. The inner
// provider's behavior is untouched — this only observes.
export function createRecordingProvider(
  inner: LlmProvider
): RecordingProvider {
  const exchanges: PromptExchange[] = [];
  return {
    exchanges,
    async complete(request: LlmRequest): Promise<string> {
      const response = await inner.complete(request);
      exchanges.push({
        systemPrompt: request.systemPrompt,
        messages: request.messages,
        response,
      });
      return response;
    },
  };
}
