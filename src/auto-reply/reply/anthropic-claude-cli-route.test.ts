import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAnthropicOauthClaudeCliRoute } from "./anthropic-claude-cli-route.js";

const {
  ensureAuthProfileStoreMock,
  readClaudeCliCredentialsCachedMock,
} = vi.hoisted(() => ({
  ensureAuthProfileStoreMock: vi.fn(),
  readClaudeCliCredentialsCachedMock: vi.fn(),
}));

vi.mock("../../agents/auth-profiles/store.js", () => ({
  ensureAuthProfileStore: ensureAuthProfileStoreMock,
}));

vi.mock("../../agents/cli-credentials.js", () => ({
  readClaudeCliCredentialsCached: readClaudeCliCredentialsCachedMock,
}));

describe("resolveAnthropicOauthClaudeCliRoute", () => {
  beforeEach(() => {
    ensureAuthProfileStoreMock.mockReset();
    readClaudeCliCredentialsCachedMock.mockReset();
  });

  it("routes supported Anthropic OAuth Claude models to the Claude CLI backend", () => {
    ensureAuthProfileStoreMock.mockReturnValue({
      profiles: {
        "anthropic:default": {
          type: "oauth",
          provider: "anthropic",
          access: "oauth-access",
          refresh: "oauth-refresh",
          expires: Date.now() + 60_000,
        },
      },
    });
    readClaudeCliCredentialsCachedMock.mockReturnValue({
      type: "oauth",
      provider: "anthropic",
      access: "cli-access",
      refresh: "cli-refresh",
      expires: Date.now() + 60_000,
    });

    expect(
      resolveAnthropicOauthClaudeCliRoute({
        agentDir: "/tmp/agent",
        provider: "anthropic",
        model: "claude-opus-4-6",
        authProfileId: "anthropic:default",
      }),
    ).toEqual({
      provider: "claude-cli",
      model: "claude-opus-4-6",
      routed: true,
    });
  });

  it("keeps direct Anthropic routing for token credentials", () => {
    ensureAuthProfileStoreMock.mockReturnValue({
      profiles: {
        "anthropic:default": {
          type: "token",
          provider: "anthropic",
          token: "manual-token",
        },
      },
    });
    readClaudeCliCredentialsCachedMock.mockReturnValue({
      type: "oauth",
      provider: "anthropic",
      access: "cli-access",
      refresh: "cli-refresh",
      expires: Date.now() + 60_000,
    });

    expect(
      resolveAnthropicOauthClaudeCliRoute({
        agentDir: "/tmp/agent",
        provider: "anthropic",
        model: "claude-opus-4-6",
        authProfileId: "anthropic:default",
      }),
    ).toEqual({
      provider: "anthropic",
      model: "claude-opus-4-6",
      routed: false,
    });
  });

  it("keeps direct Anthropic routing for api_key credentials", () => {
    ensureAuthProfileStoreMock.mockReturnValue({
      profiles: {
        "anthropic:default": {
          type: "api_key",
          provider: "anthropic",
          key: "sk-ant-api-key",
        },
      },
    });
    readClaudeCliCredentialsCachedMock.mockReturnValue({
      type: "oauth",
      provider: "anthropic",
      access: "cli-access",
      refresh: "cli-refresh",
      expires: Date.now() + 60_000,
    });

    expect(
      resolveAnthropicOauthClaudeCliRoute({
        agentDir: "/tmp/agent",
        provider: "anthropic",
        model: "claude-opus-4-6",
        authProfileId: "anthropic:default",
      }),
    ).toEqual({
      provider: "anthropic",
      model: "claude-opus-4-6",
      routed: false,
    });
  });

  it("keeps direct Anthropic routing when Claude CLI auth is unavailable", () => {
    ensureAuthProfileStoreMock.mockReturnValue({
      profiles: {
        "anthropic:default": {
          type: "oauth",
          provider: "anthropic",
          access: "oauth-access",
          refresh: "oauth-refresh",
          expires: Date.now() + 60_000,
        },
      },
    });
    readClaudeCliCredentialsCachedMock.mockReturnValue(null);

    expect(
      resolveAnthropicOauthClaudeCliRoute({
        agentDir: "/tmp/agent",
        provider: "anthropic",
        model: "claude-opus-4-6",
        authProfileId: "anthropic:default",
      }),
    ).toEqual({
      provider: "anthropic",
      model: "claude-opus-4-6",
      routed: false,
    });
  });
});
