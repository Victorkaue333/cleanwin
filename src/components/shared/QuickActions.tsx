import { ExternalLink, Minimize2, Monitor, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useErrorMessage } from "@/hooks/useErrorMessage";
import { useFormat, useT } from "@/hooks/useT";
import { cn } from "@/lib/cn";
import { toast } from "@/stores/toastStore";
import { useUiStore } from "@/stores/uiStore";
import { useUtilitiesStore } from "@/stores/utilitiesStore";
import type { ViewMode } from "@/types/ipc";

/**
 * Compact dashboard actions: keep awake / clean screen toggles, the big
 * "ESCANEAR LIXO" CTA, empty recycle bin and open full window.
 */
export function QuickActions({
  mode,
  onToggleMode,
  className,
}: {
  mode: ViewMode;
  onToggleMode: (next: ViewMode) => void;
  className?: string;
}) {
  const t = useT();
  const f = useFormat();
  const describe = useErrorMessage();
  const setPage = useUiStore((s) => s.setPage);
  const util = useUtilitiesStore();
  const [confirmBin, setConfirmBin] = useState(false);

  useEffect(() => {
    void util.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const keepAwake = util.state?.keepAwake ?? false;
  const iconsVisible = util.state?.desktopIconsVisible;
  const iconsHidden = iconsVisible === false;

  async function toggleKeepAwake() {
    try {
      await util.setKeepAwake(!keepAwake);
    } catch (error) {
      const { title, detail } = describe(error);
      toast.danger(title, detail);
    }
  }

  async function toggleDesktopIcons() {
    try {
      await util.setDesktopIcons(iconsHidden);
    } catch (error) {
      const { title, detail } = describe(error);
      toast.danger(title, detail);
    }
  }

  async function openBinDialog() {
    await util.loadRecycleBin();
    setConfirmBin(true);
  }

  async function emptyBin() {
    try {
      const result = await util.emptyRecycleBin();
      setConfirmBin(false);
      if (result.wasEmpty) toast.info(t("utilities.wasEmpty"));
      else toast.success(t("utilities.emptied", { size: f.bytes(result.freedBytes) }));
    } catch (error) {
      setConfirmBin(false);
      const { title, detail } = describe(error);
      toast.danger(title, detail);
    }
  }

  const bin = util.recycleBin;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="lg"
          aria-pressed={keepAwake}
          loading={util.busy === "keepAwake"}
          onClick={() => void toggleKeepAwake()}
          icon={<Monitor className="size-4" aria-hidden />}
          className={cn(keepAwake && "border-success/50 bg-success-soft text-success")}
        >
          {keepAwake ? t("actions.keepAwakeOn") : t("actions.keepAwake")}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          aria-pressed={iconsHidden}
          loading={util.busy === "desktop"}
          disabled={util.state ? !util.state.desktopIconsSupported : false}
          onClick={() => void toggleDesktopIcons()}
          icon={<Sparkles className="size-4" aria-hidden />}
          className={cn(iconsHidden && "border-primary/50 bg-primary-soft text-primary")}
        >
          {iconsHidden ? t("actions.cleanScreenRestore") : t("actions.cleanScreen")}
        </Button>
      </div>

      <Button
        variant="primary"
        size="cta"
        block
        onClick={() => setPage("cleaning")}
        icon={<Sparkles className="size-5" aria-hidden />}
      >
        {t("actions.scanJunk")}
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => void openBinDialog()}
          loading={util.busy === "recycleBin"}
          icon={<Trash2 className="size-4" aria-hidden />}
        >
          {t("actions.emptyRecycleBin")}
        </Button>
        {mode === "compact" ? (
          <Button
            variant="secondary"
            size="lg"
            onClick={() => onToggleMode("full")}
            icon={<ExternalLink className="size-4" aria-hidden />}
          >
            {t("actions.openCleanWin")}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="lg"
            onClick={() => onToggleMode("compact")}
            icon={<Minimize2 className="size-4" aria-hidden />}
          >
            {t("app.openCompact")}
          </Button>
        )}
      </div>

      <Dialog
        open={confirmBin}
        tone="danger"
        title={t("utilities.confirmEmptyTitle")}
        description={
          bin && bin.itemCount > 0
            ? t("utilities.confirmEmptyBody", {
                count: f.integer(bin.itemCount),
                size: f.bytes(bin.sizeBytes),
              })
            : t("utilities.recycleBinEmpty")
        }
        confirmLabel={t("actions.emptyRecycleBin")}
        confirmDisabled={!bin || bin.itemCount === 0}
        confirmLoading={util.busy === "recycleBin"}
        locked={util.busy === "recycleBin"}
        onConfirm={() => void emptyBin()}
        onClose={() => setConfirmBin(false)}
        cancelLabel={t("actions.cancel")}
      />
    </div>
  );
}
