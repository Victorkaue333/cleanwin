import { describe, expect, it } from "vitest";

import { shouldShowOnboarding, trayToggleState } from "./onboarding";

describe("shouldShowOnboarding", () => {
  const base = { settingsLoaded: true, onboardingShown: false, windowVisible: true };

  it("shows only when loaded, unanswered and the window is visible", () => {
    expect(shouldShowOnboarding(base)).toBe(true);
    expect(shouldShowOnboarding({ ...base, settingsLoaded: false })).toBe(false);
    expect(shouldShowOnboarding({ ...base, onboardingShown: true })).toBe(false);
    expect(shouldShowOnboarding({ ...base, windowVisible: false })).toBe(false);
  });
});

describe("trayToggleState", () => {
  it("disables the toggle while the tray entry is not registered (null)", () => {
    expect(trayToggleState(null)).toEqual({ checked: false, disabled: true, pending: true });
    expect(trayToggleState(undefined).disabled).toBe(true);
  });

  it("maps real states to an enabled toggle", () => {
    expect(trayToggleState(true)).toEqual({ checked: true, disabled: false, pending: false });
    expect(trayToggleState(false)).toEqual({ checked: false, disabled: false, pending: false });
  });
});
