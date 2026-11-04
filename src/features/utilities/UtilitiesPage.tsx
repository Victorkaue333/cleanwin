import { Monitor, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, SectionTitle } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toggle } from "@/components/ui/Toggle";
import { useErrorMessage } from "@/hooks/useErrorMessage";
import { useFormat, useT } from "@/hooks/useT";
import { toast } from "@/stores/toastStore";
import { useUtilitiesStore } from "@/stores/utilitiesStore";

export function UtilitiesPage() {
  const t = useT();
  const f = useFormat();
  const describe = useErrorMessage();
  const util = useUtilitiesStore();
  const [confirmBin, setConfirmBin] = useState(false);

  useEffect(() => {
    void util.load();
    void util.loadRecycleBin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const state = util.state;
  const keepAwake = state?.keepAwake ?? false;
  const iconsVisible = state?.desktopIconsVisible;

  async function onKeepAwake(next: boolean) {
    try {
      await util.setKeepAwake(next);
    } catch (error) {
      const { title, detail } = describe(error);
      toast.danger(title, detail);
    }
  }

  async function onDesktopIcons(visible: boolean) {
    try {
      await util.setDesktopIcons(visible);
    } catch (error) {
      const { title, detail } = describe(error);
      toast.danger(title, detail);
    }
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
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      <SectionTitle title={t("utilities.title")} subtitle={t("utilities.subtitle")} />

      {util.error && !state && (
        <ErrorState
          title={describe(util.error).title}
          details={util.error.message}
          detailsLabel={t("errors.details")}
          retryLabel={t("actions.retry")}
          onRetry={() => void util.load()}
        />
      )}

      <Card className="flex flex-col gap-3">
        <CardHeader
          icon={<Monitor />}
          title={t("utilities.keepAwake")}
          aside={keepAwake && <Badge tone="success">{t("common.on")}</Badge>}
        />
        <Toggle
          checked={keepAwake}
          onChange={(v) => void onKeepAwake(v)}
          loading={util.busy === "keepAwake"}
          disabled={!state}
          label={keepAwake ? t("actions.keepAwakeOn") : t("common.off")}
          description={keepAwake ? t("utilities.keepAwakeActive") : t("utilities.keepAwakeDesc")}
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <CardHeader
          icon={<Sparkles />}
          title={t("utilities.desktopIcons")}
          aside={
            iconsVisible === false && <Badge tone="primary">{t("utilities.desktopIconsHidden")}</Badge>
          }
        />
        <p className="text-xs text-muted">{t("utilities.desktopIconsDesc")}</p>
        {state && !state.desktopIconsSupported ? (
          <p className="text-xs text-warning">{t("utilities.desktopIconsUnsupported")}</p>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              variant={iconsVisible === false ? "primary" : "secondary"}
              onClick={() => void onDesktopIcons(iconsVisible === false)}
              loading={util.busy === "desktop"}
              disabled={!state}
              icon={<Sparkles className="size-4" aria-hidden />}
            >
              {iconsVisible === false ? t("utilities.showIcons") : t("utilities.hideIcons")}
            </Button>
            <span className="text-xs text-muted">
              {iconsVisible === false
                ? t("utilities.desktopIconsHidden")
                : iconsVisible === true
                  ? t("utilities.desktopIconsVisible")
                  : ""}
            </span>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <CardHeader
          icon={<Trash2 />}
          title={t("utilities.recycleBin")}
          aside={
            <Button
              size="sm"
              variant="ghost"
              icon={<RefreshCw className="size-3.5" aria-hidden />}
              onClick={() => void util.loadRecycleBin()}
            >
              {t("actions.refresh")}
            </Button>
          }
        />
        <p className="text-xs text-muted">{t("utilities.recycleBinDesc")}</p>
        {util.recycleBinError ? (
          <ErrorState
            title={describe(util.recycleBinError).title}
            details={util.recycleBinError.message}
            detailsLabel={t("errors.details")}
          />
        ) : bin ? (
          <p className="tabular text-sm font-medium text-text">
            {bin.itemCount === 0
              ? t("utilities.recycleBinEmpty")
              : t("utilities.recycleBinItems", {
                  count: f.integer(bin.itemCount),
                  size: f.bytes(bin.sizeBytes),
                })}
          </p>
        ) : (
          <Skeleton className="h-4 w-40" />
        )}
        <div>
          <Button
            variant="danger"
            onClick={() => setConfirmBin(true)}
            disabled={!bin || bin.itemCount === 0}
            loading={util.busy === "recycleBin"}
            icon={<Trash2 className="size-4" aria-hidden />}
          >
            {t("utilities.emptyRecycleBin")}
          </Button>
        </div>
      </Card>

      <Dialog
        open={confirmBin}
        tone="danger"
        title={t("utilities.confirmEmptyTitle")}
        description={t("utilities.confirmEmptyBody", {
          count: f.integer(bin?.itemCount ?? 0),
          size: f.bytes(bin?.sizeBytes ?? 0),
        })}
        confirmLabel={t("utilities.emptyRecycleBin")}
        confirmLoading={util.busy === "recycleBin"}
        locked={util.busy === "recycleBin"}
        onConfirm={() => void emptyBin()}
        onClose={() => setConfirmBin(false)}
        cancelLabel={t("actions.cancel")}
      />
    </div>
  );
}
