import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncAnthropicDefaultProfileFromClaudeCliCredential } from "./onboard-auth.credentials.js";
import {
  setByteplusApiKey,
  setCloudflareAiGatewayConfig,
  setMoonshotApiKey,
  setOpencodeZenApiKey,
  setOpenaiApiKey,
  setVolcengineApiKey,
} from "./onboard-auth.js";
import {
  createAuthTestLifecycle,
  readAuthProfilesForAgent,
  setupAuthTestEnv,
} from "./test-wizard-helpers.js";

describe("onboard auth credentials secret refs", () => {
  const lifecycle = createAuthTestLifecycle([
    "OPENCLAW_STATE_DIR",
    "OPENCLAW_AGENT_DIR",
    "PI_CODING_AGENT_DIR",
    "MOONSHOT_API_KEY",
    "OPENAI_API_KEY",
    "CLOUDFLARE_AI_GATEWAY_API_KEY",
    "VOLCANO_ENGINE_API_KEY",
    "BYTEPLUS_API_KEY",
    "OPENCODE_API_KEY",
  ]);

  afterEach(async () => {
    await lifecycle.cleanup();
  });

  type AuthProfileEntry = { key?: string; keyRef?: unknown; metadata?: unknown };

  async function withAuthEnv(
    prefix: string,
    run: (env: Awaited<ReturnType<typeof setupAuthTestEnv>>) => Promise<void>,
  ) {
    const env = await setupAuthTestEnv(prefix);
    lifecycle.setStateDir(env.stateDir);
    await run(env);
  }

  async function readProfile(
    agentDir: string,
    profileId: string,
  ): Promise<AuthProfileEntry | undefined> {
    const parsed = await readAuthProfilesForAgent<{
      profiles?: Record<string, AuthProfileEntry>;
    }>(agentDir);
    return parsed.profiles?.[profileId];
  }

  async function expectStoredAuthKey(params: {
    prefix: string;
    envVar?: string;
    envValue?: string;
    profileId: string;
    apply: (agentDir: string) => Promise<void>;
    expected: AuthProfileEntry;
    absent?: Array<keyof AuthProfileEntry>;
  }) {
    await withAuthEnv(params.prefix, async (env) => {
      if (params.envVar && params.envValue !== undefined) {
        process.env[params.envVar] = params.envValue;
      }
      await params.apply(env.agentDir);
      const profile = await readProfile(env.agentDir, params.profileId);
      expect(profile).toMatchObject(params.expected);
      for (const key of params.absent ?? []) {
        expect(profile?.[key]).toBeUndefined();
      }
    });
  }

  it("keeps env-backed moonshot key as plaintext by default", async () => {
    await expectStoredAuthKey({
      prefix: "openclaw-onboard-auth-credentials-",
      envVar: "MOONSHOT_API_KEY",
      envValue: "sk-moonshot-env",
      profileId: "moonshot:default",
      apply: async () => {
        await setMoonshotApiKey("sk-moonshot-env");
      },
      expected: {
        key: "sk-moonshot-env",
      },
      absent: ["keyRef"],
    });
  });

  it("stores env-backed moonshot key as keyRef when secret-input-mode=ref", async () => {
    await expectStoredAuthKey({
      prefix: "openclaw-onboard-auth-credentials-ref-",
      envVar: "MOONSHOT_API_KEY",
      envValue: "sk-moonshot-env",
      profileId: "moonshot:default",
      apply: async (agentDir) => {
        await setMoonshotApiKey("sk-moonshot-env", agentDir, { secretInputMode: "ref" }); // pragma: allowlist secret
      },
      expected: {
        keyRef: { source: "env", provider: "default", id: "MOONSHOT_API_KEY" },
      },
      absent: ["key"],
    });
  });

  it("stores ${ENV} moonshot input as keyRef even when env value is unset", async () => {
    await expectStoredAuthKey({
      prefix: "openclaw-onboard-auth-credentials-inline-ref-",
      profileId: "moonshot:default",
      apply: async () => {
        await setMoonshotApiKey("${MOONSHOT_API_KEY}");
      },
      expected: {
        keyRef: { source: "env", provider: "default", id: "MOONSHOT_API_KEY" },
      },
      absent: ["key"],
    });
  });

  it("keeps plaintext moonshot key when no env ref applies", async () => {
    await expectStoredAuthKey({
      prefix: "openclaw-onboard-auth-credentials-plaintext-",
      envVar: "MOONSHOT_API_KEY",
      envValue: "sk-moonshot-other",
      profileId: "moonshot:default",
      apply: async () => {
        await setMoonshotApiKey("sk-moonshot-plaintext");
      },
      expected: {
        key: "sk-moonshot-plaintext",
      },
      absent: ["keyRef"],
    });
  });

  it("preserves cloudflare metadata when storing keyRef", async () => {
    const env = await setupAuthTestEnv("openclaw-onboard-auth-credentials-cloudflare-");
    lifecycle.setStateDir(env.stateDir);
    process.env.CLOUDFLARE_AI_GATEWAY_API_KEY = "cf-secret"; // pragma: allowlist secret

    await setCloudflareAiGatewayConfig("account-1", "gateway-1", "cf-secret", env.agentDir, {
      secretInputMode: "ref", // pragma: allowlist secret
    });

    const parsed = await readAuthProfilesForAgent<{
      profiles?: Record<string, { key?: string; keyRef?: unknown; metadata?: unknown }>;
    }>(env.agentDir);
    expect(parsed.profiles?.["cloudflare-ai-gateway:default"]).toMatchObject({
      keyRef: { source: "env", provider: "default", id: "CLOUDFLARE_AI_GATEWAY_API_KEY" },
      metadata: { accountId: "account-1", gatewayId: "gateway-1" },
    });
    expect(parsed.profiles?.["cloudflare-ai-gateway:default"]?.key).toBeUndefined();
  });

  it("keeps env-backed openai key as plaintext by default", async () => {
    await expectStoredAuthKey({
      prefix: "openclaw-onboard-auth-credentials-openai-",
      envVar: "OPENAI_API_KEY",
      envValue: "sk-openai-env",
      profileId: "openai:default",
      apply: async () => {
        await setOpenaiApiKey("sk-openai-env");
      },
      expected: {
        key: "sk-openai-env",
      },
      absent: ["keyRef"],
    });
  });

  it("stores env-backed openai key as keyRef in ref mode", async () => {
    await expectStoredAuthKey({
      prefix: "openclaw-onboard-auth-credentials-openai-ref-",
      envVar: "OPENAI_API_KEY",
      envValue: "sk-openai-env",
      profileId: "openai:default",
      apply: async (agentDir) => {
        await setOpenaiApiKey("sk-openai-env", agentDir, { secretInputMode: "ref" }); // pragma: allowlist secret
      },
      expected: {
        keyRef: { source: "env", provider: "default", id: "OPENAI_API_KEY" },
      },
      absent: ["key"],
    });
  });

  it("stores env-backed volcengine and byteplus keys as keyRef in ref mode", async () => {
    const env = await setupAuthTestEnv("openclaw-onboard-auth-credentials-volc-byte-");
    lifecycle.setStateDir(env.stateDir);
    process.env.VOLCANO_ENGINE_API_KEY = "volcengine-secret"; // pragma: allowlist secret
    process.env.BYTEPLUS_API_KEY = "byteplus-secret"; // pragma: allowlist secret

    await setVolcengineApiKey("volcengine-secret", env.agentDir, { secretInputMode: "ref" }); // pragma: allowlist secret
    await setByteplusApiKey("byteplus-secret", env.agentDir, { secretInputMode: "ref" }); // pragma: allowlist secret

    const parsed = await readAuthProfilesForAgent<{
      profiles?: Record<string, { key?: string; keyRef?: unknown }>;
    }>(env.agentDir);

    expect(parsed.profiles?.["volcengine:default"]).toMatchObject({
      keyRef: { source: "env", provider: "default", id: "VOLCANO_ENGINE_API_KEY" },
    });
    expect(parsed.profiles?.["volcengine:default"]?.key).toBeUndefined();

    expect(parsed.profiles?.["byteplus:default"]).toMatchObject({
      keyRef: { source: "env", provider: "default", id: "BYTEPLUS_API_KEY" },
    });
    expect(parsed.profiles?.["byteplus:default"]?.key).toBeUndefined();
  });

  it("stores shared OpenCode credentials for both runtime providers", async () => {
    const env = await setupAuthTestEnv("openclaw-onboard-auth-credentials-opencode-");
    lifecycle.setStateDir(env.stateDir);
    process.env.OPENCODE_API_KEY = "sk-opencode-env"; // pragma: allowlist secret

    await setOpencodeZenApiKey("sk-opencode-env", env.agentDir, {
      secretInputMode: "ref", // pragma: allowlist secret
    });

    const parsed = await readAuthProfilesForAgent<{
      profiles?: Record<string, { key?: string; keyRef?: unknown }>;
    }>(env.agentDir);

    expect(parsed.profiles?.["opencode:default"]).toMatchObject({
      keyRef: { source: "env", provider: "default", id: "OPENCODE_API_KEY" },
    });
    expect(parsed.profiles?.["opencode-go:default"]).toMatchObject({
      keyRef: { source: "env", provider: "default", id: "OPENCODE_API_KEY" },
    });
  });
});

describe("syncAnthropicDefaultProfileFromClaudeCliCredential", () => {
  const lifecycle = createAuthTestLifecycle([
    "OPENCLAW_STATE_DIR",
    "OPENCLAW_AGENT_DIR",
    "PI_CODING_AGENT_DIR",
  ]);

  afterEach(async () => {
    await lifecycle.cleanup();
  });

  async function setupStandardAgentLayout(prefix: string) {
    const stateDir = await fs.mkdtemp(path.join(process.cwd(), prefix));
    lifecycle.setStateDir(stateDir);
    process.env.OPENCLAW_STATE_DIR = stateDir;

    const mainAgentDir = path.join(stateDir, "agents", "main", "agent");
    process.env.OPENCLAW_AGENT_DIR = mainAgentDir;
    process.env.PI_CODING_AGENT_DIR = mainAgentDir;

    const siblingAgentDirs = [
      mainAgentDir,
      path.join(stateDir, "agents", "dgxspark", "agent"),
      path.join(stateDir, "agents", "magiclabs", "agent"),
    ];
    await Promise.all(siblingAgentDirs.map((dir) => fs.mkdir(dir, { recursive: true })));
    return { stateDir, mainAgentDir, siblingAgentDirs };
  }

  async function writeProfiles(agentDir: string, profiles: Record<string, unknown>) {
    await fs.writeFile(
      path.join(agentDir, "auth-profiles.json"),
      `${JSON.stringify({ version: 1, profiles }, null, 2)}\n`,
    );
  }

  it("updates sibling agents that still store Anthropic oauth profiles", async () => {
    const env = await setupStandardAgentLayout("openclaw-anthropic-sync-");
    for (const agentDir of env.siblingAgentDirs) {
      await writeProfiles(agentDir, {
        "anthropic:default": {
          type: "oauth",
          provider: "anthropic",
          access: `${path.basename(path.dirname(agentDir))}-old-access`,
          refresh: `${path.basename(path.dirname(agentDir))}-old-refresh`,
          expires: 1_000,
        },
      });
    }

    const updated = await syncAnthropicDefaultProfileFromClaudeCliCredential(
      {
        type: "oauth",
        provider: "anthropic",
        access: "new-access",
        refresh: "new-refresh",
        expires: 99_999,
      },
      env.mainAgentDir,
      { syncSiblingAgents: true },
    );

    expect(updated).toHaveLength(3);
    for (const agentDir of env.siblingAgentDirs) {
      const parsed = await readAuthProfilesForAgent<{
        profiles?: Record<string, { access?: string; refresh?: string; expires?: number }>;
      }>(agentDir);
      expect(parsed.profiles?.["anthropic:default"]).toMatchObject({
        access: "new-access",
        refresh: "new-refresh",
        expires: 99_999,
      });
    }
  });

  it("does not overwrite explicit Anthropic token or api_key profiles", async () => {
    const env = await setupStandardAgentLayout("openclaw-anthropic-sync-skip-");
    const [mainAgentDir, dgxAgentDir, magiclabsAgentDir] = env.siblingAgentDirs;
    await writeProfiles(mainAgentDir, {
      "anthropic:default": {
        type: "oauth",
        provider: "anthropic",
        access: "main-old-access",
        refresh: "main-old-refresh",
        expires: 1_000,
      },
    });
    await writeProfiles(dgxAgentDir, {
      "anthropic:default": {
        type: "token",
        provider: "anthropic",
        token: "manual-setup-token",
        expires: 1_234,
      },
    });
    await writeProfiles(magiclabsAgentDir, {
      "anthropic:default": {
        type: "api_key",
        provider: "anthropic",
        key: "sk-ant-api-key",
      },
    });

    const updated = await syncAnthropicDefaultProfileFromClaudeCliCredential(
      {
        type: "oauth",
        provider: "anthropic",
        access: "new-access",
        refresh: "new-refresh",
        expires: 99_999,
      },
      env.mainAgentDir,
      { syncSiblingAgents: true },
    );

    expect(updated).toEqual([mainAgentDir]);

    const dgxParsed = await readAuthProfilesForAgent<{
      profiles?: Record<string, { type?: string; token?: string }>;
    }>(dgxAgentDir);
    expect(dgxParsed.profiles?.["anthropic:default"]).toMatchObject({
      type: "token",
      token: "manual-setup-token",
    });

    const magiclabsParsed = await readAuthProfilesForAgent<{
      profiles?: Record<string, { type?: string; key?: string }>;
    }>(magiclabsAgentDir);
    expect(magiclabsParsed.profiles?.["anthropic:default"]).toMatchObject({
      type: "api_key",
      key: "sk-ant-api-key",
    });
  });

  it("does not overwrite fresher Anthropic oauth profiles with older Claude CLI credentials", async () => {
    const env = await setupStandardAgentLayout("openclaw-anthropic-sync-freshness-");
    const [mainAgentDir] = env.siblingAgentDirs;
    await writeProfiles(mainAgentDir, {
      "anthropic:default": {
        type: "oauth",
        provider: "anthropic",
        access: "fresh-access",
        refresh: "fresh-refresh",
        expires: 200_000,
      },
    });

    const updated = await syncAnthropicDefaultProfileFromClaudeCliCredential(
      {
        type: "oauth",
        provider: "anthropic",
        access: "stale-access",
        refresh: "stale-refresh",
        expires: 100_000,
      },
      mainAgentDir,
      { syncSiblingAgents: false },
    );

    expect(updated).toEqual([]);
    const parsed = await readAuthProfilesForAgent<{
      profiles?: Record<string, { access?: string; refresh?: string; expires?: number }>;
    }>(mainAgentDir);
    expect(parsed.profiles?.["anthropic:default"]).toMatchObject({
      access: "fresh-access",
      refresh: "fresh-refresh",
      expires: 200_000,
    });
  });
});
