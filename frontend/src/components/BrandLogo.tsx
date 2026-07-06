import Image from "next/image";
import { BRAND } from "@/lib/brand";

type BrandLogoProps = {
  /** Logo completa (emblema + texto) ou só emblema compacto */
  variant?: "full" | "compact";
  className?: string;
  priority?: boolean;
};

export default function BrandLogo({
  variant = "full",
  className = "",
  priority = false,
}: BrandLogoProps) {
  if (variant === "full") {
    return (
      <Image
        src={BRAND.logo}
        alt={BRAND.name}
        width={220}
        height={88}
        priority={priority}
        className={`h-auto w-auto max-h-20 object-contain ${className}`}
      />
    );
  }

  return (
    <Image
      src={BRAND.logo}
      alt={BRAND.name}
      width={40}
      height={40}
      priority={priority}
      className={`h-10 w-10 rounded-lg object-cover object-top bg-white ${className}`}
    />
  );
}
