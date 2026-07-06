import { BrandMark, BrandWordmark } from "@/components/brand/BrandMark";
import { BRAND } from "@/lib/brand";

type BrandLogoProps = {
  /**
   * full — emblema + nome (login, telas públicas)
   * compact — só emblema (sidebar)
   * sidebar — emblema + nome em fundo escuro
   */
  variant?: "full" | "compact" | "sidebar";
  className?: string;
};

export default function BrandLogo({
  variant = "full",
  className = "",
}: BrandLogoProps) {
  if (variant === "compact") {
    return <BrandMark className={`h-10 w-10 ${className}`} />;
  }

  if (variant === "sidebar") {
    return (
      <div className={`flex items-center gap-3 min-w-0 ${className}`}>
        <BrandMark className="h-11 w-11" />
        <div className="min-w-0">
          <BrandWordmark light className="text-[15px] block truncate" />
          <p className="text-gray-400 text-xs truncate mt-0.5">{BRAND.tagline}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center gap-3 ${className}`}
      aria-label={BRAND.name}
    >
      <BrandMark className="h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20" />
      <BrandWordmark className="text-[1.65rem] sm:text-3xl" />
    </div>
  );
}
