---
summary: "Use CLI Proxy API as a Claude Code OAuth bridge for OpenClaw"
read_when:
  - You want to use Claude Code subscription access through a local bridge
  - You want an Anthropic-compatible proxy that OpenClaw can onboard directly
  - You are evaluating community proxy tools for personal or development use
title: "CLI Proxy API"
---

# CLI Proxy API

**CLI Proxy API** is a community proxy that exposes Claude Code OAuth-backed
usage through local Anthropic-compatible and OpenAI-compatible endpoints.
OpenClaw can use it directly with the built-in `cli-proxy-api` onboarding
choice.

<Warning>
This is a community integration path, not an official Anthropic or OpenClaw
service. Verify Anthropic's current terms and your own risk tolerance before
relying on subscription-backed proxy access.
</Warning>

## Why use it

- Reuse a local Claude Code OAuth login instead of Anthropic per-token billing
- Keep OpenClaw on an Anthropic-compatible HTTP path instead of CLI automation
- Optionally bridge other tools through the same local proxy

## Recommended CLI Proxy API setup

Use CLI Proxy API as a **local** bridge:

- bind the proxy to loopback or another trusted local-only interface
- keep remote management disabled unless you have a strong reason to expose it
- if you do enable remote management, set a strong secret and restrict access
- create a proxy API key and keep it in `CLI_PROXY_API_KEY`

CLI Proxy API's example config defaults remote management to local-only. Keep
that posture unless you intentionally harden and expose it.

## OpenClaw onboarding

Interactive setup now includes **CLI Proxy API** directly in the provider/auth
picker.

Non-interactive example:

```bash
export CLI_PROXY_API_KEY="your-proxy-key"

openclaw onboard --non-interactive \
  --mode local \
  --auth-choice cli-proxy-api \
  --secret-input-mode ref \
  --gateway-port 18789 \
  --gateway-bind loopback
```

Defaults:

- base URL: `http://127.0.0.1:8317`
- model: `claude-sonnet-4-6`
- provider id: `cli-proxy-api`
- transport: Anthropic-compatible (`/v1/messages`)

Optional overrides reuse the custom-provider flags:

- `--custom-base-url`
- `--custom-model-id`
- `--custom-provider-id`
- `--custom-api-key`

<Note>
Use the proxy **root** base URL without `/v1`. OpenClaw appends `/v1/messages`
for Anthropic-compatible requests.
</Note>

## Resulting OpenClaw config

```json5
{
  models: {
    providers: {
      "cli-proxy-api": {
        baseUrl: "http://127.0.0.1:8317",
        api: "anthropic-messages",
        apiKey: {
          source: "env",
          provider: "default",
          id: "CLI_PROXY_API_KEY",
        },
        models: [{ id: "claude-sonnet-4-6", name: "claude-sonnet-4-6" }],
      },
    },
  },
  agents: {
    defaults: {
      model: { primary: "cli-proxy-api/claude-sonnet-4-6" },
    },
  },
}
```

## When to use something else

- Use [Anthropic](/providers/anthropic) for the official API-key or Claude CLI
  paths.
- Use [Claude Max API Proxy](/providers/claude-max-api-proxy) if you specifically
  want that OpenAI-compatible community bridge instead.

## Links

- GitHub: [router-for-me/CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)
