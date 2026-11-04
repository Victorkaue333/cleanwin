import { cn } from "@/lib/cn";

export function Skeleton({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      role={label ? "status" : undefined}
      aria-label={label}
      aria-busy="true"
      className={cn(
        "rounded-md bg-track",
        "animate-[cw-shimmer_1.6s_linear_infinite] bg-[length:200%_100%]",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(90deg, var(--color-track) 0%, var(--color-surface-raised) 50%, var(--color-track) 100%)",
      }}
    />
  );
}
