import { describe, expect, it } from "vitest";
import { isAnthropicBillingError } from "./live-auth-keys.js";
import {
  BILLING_ERROR_USER_MESSAGE,
  classifyFailoverReasonFromHttpStatus,
  formatAssistantErrorText,
  isBillingErrorMessage,
} from "./pi-embedded-helpers.js";
import { makeAssistantMessageFixture } from "./test-helpers/assistant-message-fixtures.js";

const ANTHROPIC_EXTRA_USAGE_CLAIM_MESSAGE =
  "Third-party apps now draw from your extra usage, not your plan limits. We've added a $200 credit to get you started. Claim it at claude.ai/settings/usage and keep going.";

describe("Anthropic extra-usage billing detection", () => {
  it("treats the observed Anthropic claim error as billing instead of format", () => {
    expect(isBillingErrorMessage(ANTHROPIC_EXTRA_USAGE_CLAIM_MESSAGE)).toBe(true);
    expect(classifyFailoverReasonFromHttpStatus(400, ANTHROPIC_EXTRA_USAGE_CLAIM_MESSAGE)).toBe(
      "billing",
    );
    expect(isAnthropicBillingError(ANTHROPIC_EXTRA_USAGE_CLAIM_MESSAGE)).toBe(true);
  });

  it("surfaces a friendly billing message for the observed Anthropic claim error", () => {
    const msg = makeAssistantMessageFixture({
      errorMessage: ANTHROPIC_EXTRA_USAGE_CLAIM_MESSAGE,
    });

    expect(formatAssistantErrorText(msg)).toBe(BILLING_ERROR_USER_MESSAGE);
  });
});
