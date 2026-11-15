import Image from "next/image";

export function BrandLogo({
  className,
  height,
  variant = "light",
}: {
  className?: string;
  height: number;
  variant?: "light" | "dark" | "icon" | "adaptive";
}) {
  const width = variant === "icon" ? height : Math.round(height * 314 / 72);
  const src = variant === "icon" ? "/favicon.svg" : "/brand/jellyshop.svg";

  if (variant === "adaptive") {
    return (
      <span className={className}>
        <Image className="brand-logo-light" src={src} alt="" width={width} height={height} />
        <Image className="brand-logo-dark" src="/brand/jellyshop-dark.svg" alt="" width={width} height={height} />
      </span>
    );
  }

  return <Image className={className} src={variant === "dark" ? "/brand/jellyshop-dark.svg" : src} alt="" width={width} height={height} />;
}
