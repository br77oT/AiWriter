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

// Process-singleton provider. When ANTHROPIC_API_KEY is set in the
// environment, routes get the real provider; otherwise they fall back to
// the deterministic stub so dev still runs without an API key (the stub
// returns echo output, so generated drafts will be visibly stubby — that's
// the dev signal that you forgot to set the key, not a bug).
let _defaultProvider: LlmProvider | null = null;

// What kind of ANTHROPIC_API_KEY (if any) is configured. Server-only — used
// by route/page code to decide what to warn the user about.
//  - "missing"     — no key; generation + evaluation fall back to the stub.
//  - "oauth-token" — an `sk-ant-oat…` Claude-subscription / OAuth token. The
//                    provider authenticates with the `x-api-key` header,
//                    which only accepts API keys, so this 401s at request
//                    time — present, but not usable.
//  - "ok"          — looks like a usable API key.
export type LlmKeyStatus = "missing" | "oauth-token" | "ok";

export function getLlmKeyStatus(): LlmKeyStatus {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return "missing";
  if (key.startsWith("sk-ant-oat")) return "oauth-token";
  return "ok";
}

export function getDefaultProvider(): LlmProvider {
  if (_defaultProvider) return _defaultProvider;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    _defaultProvider = createAnthropicProvider({
      apiKey,
      model: process.env.ANTHROPIC_MODEL,
    });
  } else {
    // No key → echo stub. Generation produces stubby text and check
    // evaluation cannot run (the stub's output isn't valid JSON, so every
    // check comes back as `error`). Warn loudly once so this shows up in the
    // server log rather than only as confusing in-app results.
    console.warn(
      "[AiWriter] ANTHROPIC_API_KEY is not set — using the echo stub LLM " +
        "provider. Draft generation will be stubby and document-check " +
        'evaluation will report every check as "Not evaluated". Set ' +
        "ANTHROPIC_API_KEY to enable real generation and validation."
    );
    _defaultProvider = createStubProvider();
  }
  return _defaultProvider;
}

// Test seam — mirrors the document store's seam so engines can swap in a
// scripted provider for integration tests without rewiring imports.
export function setDefaultProviderForTesting(provider: LlmProvider | null): void {
  _defaultProvider = provider;
}
