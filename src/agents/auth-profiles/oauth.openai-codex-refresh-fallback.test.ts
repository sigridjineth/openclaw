import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { captureEnv } from "../../test-utils/env.js";
import { forceRefreshOAuthProfile, resolveApiKeyForProfile } from "./oauth.js";
import {
  clearRuntimeAuthProfileStoreSnapshots,
  ensureAuthProfileStore,
  saveAuthProfileStore,
} from "./store.js";
import type { AuthProfileStore } from "./types.js";

const { getOAuthApiKeyMock, writeClaudeCliCredentialsMock } = vi.hoisted(() => ({
  getOAuthApiKeyMock: vi.fn(async (): Promise<unknown> => {
    throw new Error("Failed to extract accountId from token");
  }),
  writeClaudeCliCredentialsMock: vi.fn(() => true),
}));

vi.mock("@mariozechner/pi-ai/oauth", () => ({
  getOAuthApiKey: getOAuthApiKeyMock,
  getOAuthProviders: () => [
    { id: "openai-codex", envApiKey: "OPENAI_API_KEY", oauthTokenEnv: "OPENAI_OAUTH_TOKEN" }, // pragma: allowlist secret
    { id: "anthropic", envApiKey: "ANTHROPIC_API_KEY", oauthTokenEnv: "ANTHROPIC_OAUTH_TOKEN" }, // pragma: allowlist secret
  ],
}));

vi.mock("../cli-credentials.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../cli-credentials.js")>();
  return {
    ...actual,
    writeClaudeCliCredentials: writeClaudeCliCredentialsMock,
  };
});

function createExpiredOauthStore(params: {
  profileId: string;
  provider: string;
  access?: string;
  expiresOffsetMs?: number;
}): AuthProfileStore {
  return {
    version: 1,
    profiles: {
      [params.profileId]: {
        type: "oauth",
        provider: params.provider,
        access: params.access ?? "cached-access-token",
        refresh: "refresh-token",
        expires: Date.now() + (params.expiresOffsetMs ?? -60_000),
      },
    },
  };
}

describe("resolveApiKeyForProfile openai-codex refresh fallback", () => {
  const envSnapshot = captureEnv([
    "OPENCLAW_STATE_DIR",
    "OPENCLAW_AGENT_DIR",
    "PI_CODING_AGENT_DIR",
  ]);
  let tempRoot = "";
  let agentDir = "";

  beforeEach(async () => {
    getOAuthApiKeyMock.mockClear();
    writeClaudeCliCredentialsMock.mockClear();
    clearRuntimeAuthProfileStoreSnapshots();
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-codex-refresh-fallback-"));
    agentDir = path.join(tempRoot, "agents", "main", "agent");
    await fs.mkdir(agentDir, { recursive: true });
    process.env.OPENCLAW_STATE_DIR = tempRoot;
    process.env.OPENCLAW_AGENT_DIR = agentDir;
    process.env.PI_CODING_AGENT_DIR = agentDir;
  });

  afterEach(async () => {
    clearRuntimeAuthProfileStoreSnapshots();
    envSnapshot.restore();
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  it("force refreshes unexpired anthropic oauth credentials after stale-auth failures", async () => {
    const profileId = "anthropic:default";
    saveAuthProfileStore(
      {
        version: 1,
        profiles: {
          [profileId]: {
            type: "oauth",
            provider: "anthropic",
            access: "cached-access-token",
            refresh: "refresh-token",
            expires: Date.now() + 60_000,
          },
        },
      },
      agentDir,
    );
    getOAuthApiKeyMock.mockImplementationOnce(async () => ({
      apiKey: "fresh-access-token",
      newCredentials: {
        access: "fresh-access-token",
        refresh: "refresh-token-2",
        expires: Date.now() + 120_000,
      },
    }));

    const store = ensureAuthProfileStore(agentDir);
    const result = await forceRefreshOAuthProfile({
      store,
      profileId,
      agentDir,
    });

    expect(result).toEqual({
      apiKey: "fresh-access-token", // pragma: allowlist secret
      provider: "anthropic",
      email: undefined,
    });
    expect(store.profiles[profileId]).toMatchObject({
      type: "oauth",
      access: "fresh-access-token",
      refresh: "refresh-token-2",
    });
    expect(writeClaudeCliCredentialsMock).toHaveBeenCalledTimes(1);
    expect(writeClaudeCliCredentialsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        access: "fresh-access-token",
        refresh: "refresh-token-2",
      }),
    );
  });
  it("falls back to cached access token when openai-codex refresh fails on accountId extraction", async () => {
    const profileId = "openai-codex:default";
    saveAuthProfileStore(
      createExpiredOauthStore({
        profileId,
        provider: "openai-codex",
      }),
      agentDir,
    );

    const result = await resolveApiKeyForProfile({
      store: ensureAuthProfileStore(agentDir),
      profileId,
      agentDir,
    });

    expect(result).toEqual({
      apiKey: "cached-access-token", // pragma: allowlist secret
      provider: "openai-codex",
      email: undefined,
    });
    expect(getOAuthApiKeyMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to cached access token for anthropic inside the early-expiry grace window", async () => {
    const profileId = "anthropic:default";
    saveAuthProfileStore(
      createExpiredOauthStore({
        profileId,
        provider: "anthropic",
      }),
      agentDir,
    );

    await expect(
      resolveApiKeyForProfile({
        store: ensureAuthProfileStore(agentDir),
        profileId,
        agentDir,
      }),
    ).resolves.toEqual({
      apiKey: "cached-access-token", // pragma: allowlist secret
      provider: "anthropic",
      email: undefined,
    });
  });

  it("keeps throwing for anthropic outside the early-expiry grace window", async () => {
    const profileId = "anthropic:default";
    saveAuthProfileStore(
      createExpiredOauthStore({
        profileId,
        provider: "anthropic",
        expiresOffsetMs: -(6 * 60_000),
      }),
      agentDir,
    );

    await expect(
      resolveApiKeyForProfile({
        store: ensureAuthProfileStore(agentDir),
        profileId,
        agentDir,
      }),
    ).rejects.toThrow(/OAuth token refresh failed for anthropic/);
  });

  it("does not use fallback for unrelated openai-codex refresh errors", async () => {
    const profileId = "openai-codex:default";
    saveAuthProfileStore(
      createExpiredOauthStore({
        profileId,
        provider: "openai-codex",
      }),
      agentDir,
    );
    getOAuthApiKeyMock.mockImplementationOnce(async () => {
      throw new Error("invalid_grant");
    });

    await expect(
      resolveApiKeyForProfile({
        store: ensureAuthProfileStore(agentDir),
        profileId,
        agentDir,
      }),
    ).rejects.toThrow(/OAuth token refresh failed for openai-codex/);
  });
});
