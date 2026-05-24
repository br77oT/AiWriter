import { describe, it, expect, vi, afterEach } from "vitest";
import { register } from "./instrumentation";
import { getLlmKeyStatus } from "@/lib/llm";

afterEach(() => {
  vi.unstubAllEnvs();
});

// Stub process.exit so a "should exit" assertion doesn't tear down the test
// runner. The stub throws instead, which the tests catch.
function stubExit() {
  return vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`process.exit(${code})`);
  }) as never);
}

describe("instrumentation — register()", () => {
  it("exits the process in production when ANTHROPIC_API_KEY is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("LLM_PROVIDER", "");
    const exit = stubExit();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => register()).toThrow("process.exit(1)");
    expect(err).toHaveBeenCalledWith(
      expect.stringContaining("ANTHROPIC_API_KEY is required in production")
    );
    exit.mockRestore();
    err.mockRestore();
  });

  it("does not exit in production when the key is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    vi.stubEnv("LLM_PROVIDER", "");
    const exit = stubExit();
    expect(() => register()).not.toThrow();
    exit.mockRestore();
  });

  it("does not exit in development when the key is missing", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("LLM_PROVIDER", "");
    const exit = stubExit();
    expect(() => register()).not.toThrow();
    exit.mockRestore();
  });

  it("does not exit in production when LLM_PROVIDER=local (no key needed)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("LLM_PROVIDER", "local");
    const exit = stubExit();
    expect(() => register()).not.toThrow();
    exit.mockRestore();
  });
});

describe("getLlmKeyStatus()", () => {
  it("returns 'missing' when ANTHROPIC_API_KEY is not set", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("LLM_PROVIDER", "");
    expect(getLlmKeyStatus()).toEqual({ kind: "missing" });
  });

  it("returns 'oauth-token' for an sk-ant-oat… token", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-oat01-abc123");
    vi.stubEnv("LLM_PROVIDER", "");
    expect(getLlmKeyStatus()).toEqual({ kind: "oauth-token" });
  });

  it("returns 'ok' for an sk-ant-api… key", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-api03-abc123");
    vi.stubEnv("LLM_PROVIDER", "");
    expect(getLlmKeyStatus()).toEqual({ kind: "ok" });
  });

  it("returns 'local' with the default URL when LLM_PROVIDER=local and no override", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("LLM_PROVIDER", "local");
    vi.stubEnv("AIWRITER_LOCAL_LLM_URL", "");
    expect(getLlmKeyStatus()).toEqual({
      kind: "local",
      localUrl: "ws://127.0.0.1:8787",
    });
  });

  it("uses AIWRITER_LOCAL_LLM_URL when set", () => {
    vi.stubEnv("LLM_PROVIDER", "local");
    vi.stubEnv("AIWRITER_LOCAL_LLM_URL", "ws://example.invalid:9999");
    expect(getLlmKeyStatus()).toEqual({
      kind: "local",
      localUrl: "ws://example.invalid:9999",
    });
  });
});
