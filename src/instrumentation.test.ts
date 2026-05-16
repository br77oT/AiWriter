import { describe, it, expect, vi, afterEach } from "vitest";
import { register } from "./instrumentation";
import { isLlmConfigured } from "@/lib/llm";

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
    const exit = stubExit();
    expect(() => register()).not.toThrow();
    exit.mockRestore();
  });

  it("does not exit in development when the key is missing", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const exit = stubExit();
    expect(() => register()).not.toThrow();
    exit.mockRestore();
  });
});

describe("isLlmConfigured()", () => {
  it("reflects whether ANTHROPIC_API_KEY is set", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(isLlmConfigured()).toBe(true);
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(isLlmConfigured()).toBe(false);
  });
});
