/** Pure decision helpers for the first-run dialog and the tray-icon toggle. */

export interface OnboardingGate {
  settingsLoaded: boolean;
  onboardingShown: boolean;
  /** `frontend_ready` result: false when the app started hidden in the tray. */
  windowVisible: boolean;
}

/** The dialog appears only once settings are known, unanswered, and the window is visible. */
export function shouldShowOnboarding({
  settingsLoaded,
  onboardingShown,
  windowVisible,
}: OnboardingGate): boolean {
  return settingsLoaded && !onboardingShown && windowVisible;
}

export interface TrayToggleState {
  checked: boolean;
  disabled: boolean;
  /** True while the backend has no tray entry yet (`null`). */
  pending: boolean;
}

/** Maps `get_tray_icon_promoted` (`null` = entry not registered yet) to toggle props. */
export function trayToggleState(promoted: boolean | null | undefined): TrayToggleState {
  if (promoted === null || promoted === undefined) {
    return { checked: false, disabled: true, pending: true };
  }
  return { checked: promoted, disabled: false, pending: false };
}

export const TRAY_RETRY_DELAY_MS = 1000;
export const TRAY_RETRY_ATTEMPTS = 3;
export const TRAY_REQUERY_DELAY_MS = 2000;
export const TRAY_REQUERY_MAX = 5;
