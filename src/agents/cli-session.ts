import type { SessionEntry } from "../config/sessions.js";
import { FailoverError } from "./failover-error.js";
import { normalizeProviderId } from "./model-selection.js";

const STALE_CLI_SESSION_MESSAGE_PATTERN =
  /no conversation found|conversation not found|conversation does not exist|conversation expired|conversation invalid|no such session|session(?: id)? not found|session not found|session does not exist|session expired|session invalid|invalid session/i;

export function getCliSessionId(
  entry: SessionEntry | undefined,
  provider: string,
): string | undefined {
  if (!entry) {
    return undefined;
  }
  const normalized = normalizeProviderId(provider);
  const fromMap = entry.cliSessionIds?.[normalized];
  if (fromMap?.trim()) {
    return fromMap.trim();
  }
  if (normalized === "claude-cli") {
    const legacy = entry.claudeCliSessionId?.trim();
    if (legacy) {
      return legacy;
    }
  }
  return undefined;
}

export function setCliSessionId(entry: SessionEntry, provider: string, sessionId: string): void {
  const normalized = normalizeProviderId(provider);
  const trimmed = sessionId.trim();
  if (!trimmed) {
    return;
  }
  const existing = entry.cliSessionIds ?? {};
  entry.cliSessionIds = { ...existing };
  entry.cliSessionIds[normalized] = trimmed;
  if (normalized === "claude-cli") {
    entry.claudeCliSessionId = trimmed;
  }
}

export function clearCliSessionId(entry: SessionEntry, provider: string): void {
  const normalized = normalizeProviderId(provider);
  const existing = entry.cliSessionIds;
  if (existing && Object.hasOwn(existing, normalized)) {
    const next = { ...existing };
    delete next[normalized];
    entry.cliSessionIds = Object.keys(next).length > 0 ? next : undefined;
  }
  if (normalized === "claude-cli") {
    delete entry.claudeCliSessionId;
  }
}

export function shouldRetryFreshCliSession(params: {
  error: unknown;
  provider: string;
  cliSessionId?: string;
}): boolean {
  if (!params.cliSessionId?.trim()) {
    return false;
  }
  const message = params.error instanceof Error ? params.error.message : String(params.error);
  if (STALE_CLI_SESSION_MESSAGE_PATTERN.test(message)) {
    return true;
  }
  if (!(params.error instanceof FailoverError)) {
    return false;
  }
  if (params.error.reason === "session_expired") {
    return true;
  }
  if (normalizeProviderId(params.provider) !== "claude-cli") {
    return false;
  }
  return params.error.reason === "timeout" && /CLI produced no output/i.test(message);
}
