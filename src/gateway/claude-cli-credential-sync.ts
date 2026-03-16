import { readClaudeCliCredentialsCached } from "../agents/cli-credentials.js";
import { syncAnthropicDefaultProfileFromClaudeCliCredential } from "../commands/onboard-auth.credentials.js";

const CLAUDE_CLI_SYNC_TTL_MS = 15 * 60 * 1000;

export async function refreshAnthropicDefaultProfilesFromClaudeCli(params?: {
  log?: { info: (message: string) => void };
}): Promise<void> {
  const credential = readClaudeCliCredentialsCached({
    allowKeychainPrompt: false,
    ttlMs: CLAUDE_CLI_SYNC_TTL_MS,
  });
  if (!credential) {
    return;
  }

  const updatedAgentDirs = await syncAnthropicDefaultProfileFromClaudeCliCredential(
    credential,
    undefined,
    { syncSiblingAgents: true },
  );
  if (updatedAgentDirs.length === 0) {
    return;
  }

  const mode = credential.type === "oauth" ? "oauth" : "token";
  params?.log?.info(
    `synced Claude CLI Anthropic ${mode} credentials into ${updatedAgentDirs.length} agent auth profile(s)`,
  );
}
