// LLM model boundary. V1 ships only this interface plus a deterministic stub.
// Slice 002 (Validation) and Slice 006 (Generation) will swap in a real
// Anthropic-backed implementation behind the same interface — see
// docs/decisions.md §"LLM provider".
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

// Process-singleton provider. Swap the factory here in slice 002/006 to wire
// up the real Anthropic provider; callers stay unchanged.
let _defaultProvider: LlmProvider | null = null;

export function getDefaultProvider(): LlmProvider {
  if (!_defaultProvider) _defaultProvider = createStubProvider();
  return _defaultProvider;
}

// Test seam — mirrors the document store's seam so engines can swap in a
// scripted provider for integration tests without rewiring imports.
export function setDefaultProviderForTesting(provider: LlmProvider | null): void {
  _defaultProvider = provider;
}
