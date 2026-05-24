// @vitest-environment node
//
// The local provider hits a real WebSocket — jsdom's WebSocket stub never
// connects, so this file pins the test environment to node so the global
// `WebSocket` is Node 24's built-in client.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocketServer, type WebSocket as ServerSocket } from "ws";
import type { AddressInfo } from "node:net";
import { createLocalProvider } from "./index";

interface FakeServer {
  url: string;
  close: () => Promise<void>;
  // Each connection's first message is parsed and handed to the test, which
  // decides what frames to send back (or to hang).
  setHandler: (
    handler: (
      sock: ServerSocket,
      msg: { prompt: string; sessionId: string; resume: boolean }
    ) => void
  ) => void;
}

async function startFakeServer(): Promise<FakeServer> {
  const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await new Promise<void>((resolve) => wss.once("listening", () => resolve()));
  const { port } = wss.address() as AddressInfo;
  let handler:
    | ((
        sock: ServerSocket,
        msg: { prompt: string; sessionId: string; resume: boolean }
      ) => void)
    | null = null;
  wss.on("connection", (sock) => {
    sock.once("message", (data) => {
      const msg = JSON.parse(data.toString());
      handler?.(sock, msg);
    });
  });
  return {
    url: `ws://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        wss.close((err) => (err ? reject(err) : resolve()))
      ),
    setHandler: (h) => {
      handler = h;
    },
  };
}

describe("createLocalProvider", () => {
  let server: FakeServer;
  beforeEach(async () => {
    server = await startFakeServer();
  });
  afterEach(async () => {
    await server.close();
  });

  it("sends prompt = systemPrompt + blank line + user content, returns the result", async () => {
    let receivedPrompt: string | null = null;
    server.setHandler((sock, msg) => {
      receivedPrompt = msg.prompt;
      sock.send(JSON.stringify({ type: "accepted" }));
      sock.send(
        JSON.stringify({ type: "result", is_error: false, result: "hello back" })
      );
    });
    const provider = createLocalProvider({ url: server.url, timeoutMs: 5000 });
    const out = await provider.complete({
      systemPrompt: "You are concise.",
      messages: [{ role: "user", content: "Say hi." }],
    });
    expect(out.text).toBe("hello back");
    // Local mode doesn't surface token counts.
    expect(out.usage).toBeUndefined();
    expect(receivedPrompt).toBe("You are concise.\n\nSay hi.");
  });

  it("tolerates a 'queued' frame before the result", async () => {
    server.setHandler((sock) => {
      sock.send(JSON.stringify({ type: "queued", position: 2 }));
      sock.send(
        JSON.stringify({ type: "result", is_error: false, result: "ok" })
      );
    });
    const provider = createLocalProvider({ url: server.url, timeoutMs: 5000 });
    expect(
      (
        await provider.complete({
          systemPrompt: "s",
          messages: [{ role: "user", content: "u" }],
        })
      ).text
    ).toBe("ok");
  });

  it("throws when the server returns an error result", async () => {
    server.setHandler((sock) => {
      sock.send(
        JSON.stringify({
          type: "result",
          is_error: true,
          result: "claude said no",
        })
      );
    });
    const provider = createLocalProvider({ url: server.url, timeoutMs: 5000 });
    await expect(
      provider.complete({
        systemPrompt: "s",
        messages: [{ role: "user", content: "u" }],
      })
    ).rejects.toThrow(/claude said no/);
  });

  it("throws when the server emits an error frame (crash)", async () => {
    server.setHandler((sock) => {
      sock.send(JSON.stringify({ type: "error", reason: "crash" }));
    });
    const provider = createLocalProvider({ url: server.url, timeoutMs: 5000 });
    await expect(
      provider.complete({
        systemPrompt: "s",
        messages: [{ role: "user", content: "u" }],
      })
    ).rejects.toThrow(/crash/);
  });

  it("rejects with a connection error when the server isn't running", async () => {
    // Close before the call so the connect attempt is guaranteed to fail.
    const url = server.url;
    await server.close();
    const provider = createLocalProvider({ url, timeoutMs: 5000 });
    // Re-open server in afterEach is fine — beforeEach for the next test
    // sets a fresh one. Just have to satisfy our own afterEach: replace
    // `server` with a no-op so close() doesn't crash.
    server = {
      url: "",
      close: async () => {},
      setHandler: () => {},
    };
    await expect(
      provider.complete({
        systemPrompt: "s",
        messages: [{ role: "user", content: "u" }],
      })
    ).rejects.toThrow();
  });

  it("times out when the server accepts but never produces a result", async () => {
    server.setHandler((sock) => {
      sock.send(JSON.stringify({ type: "accepted" }));
      // …then hang forever.
    });
    const provider = createLocalProvider({ url: server.url, timeoutMs: 80 });
    await expect(
      provider.complete({
        systemPrompt: "s",
        messages: [{ role: "user", content: "u" }],
      })
    ).rejects.toThrow(/timed out/i);
  });

  it("joins multi-turn messages with role labels when there is more than one", async () => {
    // Defensive: no current call site uses multi-turn, but the contract
    // accepts it. Verify we don't silently drop turns.
    let receivedPrompt: string | null = null;
    server.setHandler((sock, msg) => {
      receivedPrompt = msg.prompt;
      sock.send(
        JSON.stringify({ type: "result", is_error: false, result: "ack" })
      );
    });
    const provider = createLocalProvider({ url: server.url, timeoutMs: 5000 });
    await provider.complete({
      systemPrompt: "be brief",
      messages: [
        { role: "user", content: "first" },
        { role: "assistant", content: "ok" },
        { role: "user", content: "second" },
      ],
    });
    expect(receivedPrompt).toContain("first");
    expect(receivedPrompt).toContain("second");
    expect(receivedPrompt).toContain("be brief");
  });
});
