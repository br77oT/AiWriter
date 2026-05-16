import { describe, it, expect, vi, afterEach } from "vitest";
import { register } from "./instrumentation";
import { isLlmConfigured } from "@/lib/llm";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("instrumentation — register()", () => {
  it("throws in production when ANTHROPIC_API_KEY is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(() => register()).toThrow(
      /ANTHROPIC_API_KEY is required in production/
    );
  });

  it("does not throw in production when the key is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-ant-test");
    expect(() => register()).not.toThrow();
  });

  it("does not throw in development when the key is missing", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect(() => register()).not.toThrow();
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
