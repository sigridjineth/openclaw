import { describe, expect, it, vi } from "vitest";
import { createDiscordMonitorStatusTracker } from "./status.js";

describe("createDiscordMonitorStatusTracker", () => {
  it("marks the channel connected on the first inbound event", () => {
    const setStatus = vi.fn();
    const tracker = createDiscordMonitorStatusTracker(setStatus);
    const nowSpy = vi.spyOn(Date, "now").mockReturnValueOnce(1234).mockReturnValueOnce(5678);

    try {
      tracker.trackInboundEvent?.();
      tracker.trackInboundEvent?.();
    } finally {
      nowSpy.mockRestore();
    }

    expect(setStatus).toHaveBeenNthCalledWith(1, {
      connected: true,
      lastConnectedAt: 1234,
      lastDisconnect: null,
      lastEventAt: 1234,
      lastInboundAt: 1234,
    });
    expect(setStatus).toHaveBeenNthCalledWith(2, {
      lastEventAt: 5678,
      lastInboundAt: 5678,
    });
  });

  it("does not re-emit connected when another status patch already marked it connected", () => {
    const setStatus = vi.fn();
    const tracker = createDiscordMonitorStatusTracker(setStatus);
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1234);

    try {
      tracker.setStatus?.({
        connected: true,
        lastConnectedAt: 1000,
        lastEventAt: 1000,
      });
      tracker.trackInboundEvent?.();
    } finally {
      nowSpy.mockRestore();
    }

    expect(setStatus).toHaveBeenNthCalledWith(1, {
      connected: true,
      lastConnectedAt: 1000,
      lastEventAt: 1000,
    });
    expect(setStatus).toHaveBeenNthCalledWith(2, {
      lastEventAt: 1234,
      lastInboundAt: 1234,
    });
  });

  it("resets connected tracking after a disconnect patch", () => {
    const setStatus = vi.fn();
    const tracker = createDiscordMonitorStatusTracker(setStatus);
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(4321);

    try {
      tracker.setStatus?.({ connected: true, lastConnectedAt: 1000, lastEventAt: 1000 });
      tracker.setStatus?.({ connected: false });
      tracker.trackInboundEvent?.();
    } finally {
      nowSpy.mockRestore();
    }

    expect(setStatus).toHaveBeenNthCalledWith(3, {
      connected: true,
      lastConnectedAt: 4321,
      lastDisconnect: null,
      lastEventAt: 4321,
      lastInboundAt: 4321,
    });
  });
});
