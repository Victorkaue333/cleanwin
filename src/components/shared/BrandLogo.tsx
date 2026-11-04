import { cn } from "@/lib/cn";

/** Official brand assets from public/assets/branding (never redrawn). */
export const BRAND = {
  logoHorizontal: "/assets/branding/logo-horizontal.svg",
  logoHorizontalWhite: "/assets/branding/logo-horizontal-white.svg",
  symbol: "/assets/branding/symbol.svg",
  symbolWhite: "/assets/branding/symbol-white.svg",
  appIcon: "/assets/branding/app-icon.svg",
  icon256: "/assets/app-icons/icon-256.png",
} as const;

export function BrandLogo({
  variant = "horizontal",
  height = 28,
  className,
}: {
  variant?: "horizontal" | "horizontal-white" | "symbol" | "symbol-white" | "app-icon";
  height?: number;
  className?: string;
}) {
  const src =
    variant === "horizontal"
      ? BRAND.logoHorizontal
      : variant === "horizontal-white"
        ? BRAND.logoHorizontalWhite
        : variant === "symbol"
          ? BRAND.symbol
          : variant === "symbol-white"
            ? BRAND.symbolWhite
            : BRAND.appIcon;
  // Horizontal lockup is 430×128; symbols are square.
  const width = variant.startsWith("horizontal") ? Math.round((height * 430) / 128) : height;
  return (
    <img
      src={src}
      alt="CleanWin"
      width={width}
      height={height}
      draggable={false}
      className={cn("block select-none", className)}
      style={{ width, height }}
    />
  );
}
