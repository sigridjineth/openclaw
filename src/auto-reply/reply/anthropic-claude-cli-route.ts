import { ensureAuthProfileStore } from "../../agents/auth-profiles/store.js";
import { readClaudeCliCredentialsCached } from "../../agents/cli-credentials.js";
import { normalizeProviderId } from "../../agents/model-selection.js";

const CLAUDE_CLI_PROVIDER_ID = "claude-cli";
const CLAUDE_CLI_CREDENTIAL_TTL_MS = 5_000;

function isSupportedAnthropicClaudeModel(model: string): boolean {
  return model.trim().toLowerCase().startsWith("claude-");
}

export function resolveAnthropicOauthClaudeCliRoute(params: {
  agentDir: string;
  provider: string;
  model: string;
  authProfileId?: string;
}): { provider: string; model: string; routed: boolean } {
  const provider = normalizeProviderId(params.provider);
  const model = params.model.trim();
  const authProfileId = params.authProfileId?.trim();
  if (
    provider !== "anthropic" ||
    !model ||
    !authProfileId ||
    !isSupportedAnthropicClaudeModel(model)
  ) {
    return {
      provider: params.provider,
      model: params.model,
      routed: false,
    };
  }

  const store = ensureAuthProfileStore(params.agentDir, { allowKeychainPrompt: false });
  const credential = store.profiles[authProfileId];
  if (
    !credential ||
    credential.type !== "oauth" ||
    normalizeProviderId(credential.provider) !== "anthropic"
  ) {
    return {
      provider: params.provider,
      model: params.model,
      routed: false,
    };
  }

  const hasClaudeCliCredential = Boolean(
    readClaudeCliCredentialsCached({
      allowKeychainPrompt: false,
      ttlMs: CLAUDE_CLI_CREDENTIAL_TTL_MS,
    }),
  );
  if (!hasClaudeCliCredential) {
    return {
      provider: params.provider,
      model: params.model,
      routed: false,
    };
  }

  return {
    provider: CLAUDE_CLI_PROVIDER_ID,
    model,
    routed: true,
  };
}
