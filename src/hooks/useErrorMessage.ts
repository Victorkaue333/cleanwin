import { useCallback } from "react";

import { useT } from "@/hooks/useT";
import { toAppError } from "@/lib/errors";

/** Map any thrown value to a localized message (+ technical detail). */
export function useErrorMessage() {
  const t = useT();
  return useCallback(
    (error: unknown): { title: string; detail: string } => {
      const err = toAppError(error);
      return { title: t(`errors.${err.code}`), detail: err.message };
    },
    [t],
  );
}
