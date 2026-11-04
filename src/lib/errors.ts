import type { AppErrorCode, AppErrorPayload } from "@/types/ipc";

export const ERROR_CODES: readonly AppErrorCode[] = [
  "io",
  "permission_denied",
  "not_found",
  "invalid_operation",
  "protected",
  "unsupported",
  "busy",
  "cancelled",
  "internal",
] as const;

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

function isPayload(value: unknown): value is AppErrorPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as AppErrorPayload).code === "string" &&
    typeof (value as AppErrorPayload).message === "string"
  );
}

/**
 * Normalise anything thrown by `invoke` into an `AppError`.
 * Rust errors arrive as `{ code, message }`; permission errors from the Tauri
 * runtime arrive as plain strings.
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (isPayload(error)) {
    const code = ERROR_CODES.includes(error.code) ? error.code : "internal";
    return new AppError(code, error.message);
  }
  if (typeof error === "string") {
    try {
      const parsed: unknown = JSON.parse(error);
      if (isPayload(parsed)) return toAppError(parsed);
    } catch {
      /* not JSON */
    }
    return new AppError("internal", error);
  }
  if (error instanceof Error) return new AppError("internal", error.message);
  return new AppError("internal", "Unknown error");
}
