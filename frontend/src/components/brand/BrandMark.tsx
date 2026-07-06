import { BRAND } from "@/lib/brand";

type BrandMarkProps = {
  className?: string;
  title?: string;
};

/** Emblema Colombocal — caravela em arcos azuis, fundo transparente. */
export function BrandMark({
  className = "h-10 w-10",
  title = BRAND.name,
}: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 96 96"
      role="img"
      aria-label={title}
      className={`shrink-0 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      {/* arco esquerdo */}
      <path
        d="M12 48c0-22 14-38 32-42"
        fill="none"
        stroke={BRAND.colors.navy}
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* arco direito */}
      <path
        d="M84 48c0 22-14 38-32 42"
        fill="none"
        stroke={BRAND.colors.navy}
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* oval interno */}
      <ellipse cx="48" cy="50" rx="26" ry="24" fill={BRAND.colors.sky} />
      {/* água */}
      <path
        d="M26 58c6 3 12 4 22 4s16-1 22-4"
        fill="none"
        stroke={BRAND.colors.skyDeep}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.55"
      />
      {/* casco */}
      <path
        d="M30 56 L66 56 L62 62 L34 62 Z"
        fill="none"
        stroke={BRAND.colors.red}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* mastros e velas */}
      <path
        d="M40 56 V34 M48 56 V28 M56 56 V34"
        stroke={BRAND.colors.red}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M40 34 L48 28 L56 34 L56 50 L40 50 Z"
        fill="none"
        stroke={BRAND.colors.red}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M40 38 L48 32 L48 46 L40 46 Z"
        fill="none"
        stroke={BRAND.colors.red}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M48 32 L56 38 L56 46 L48 46 Z"
        fill="none"
        stroke={BRAND.colors.red}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* C nas velas */}
      <text
        x="43.5"
        y="43"
        fill={BRAND.colors.red}
        fontSize="9"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
      >
        C
      </text>
      <text
        x="51.5"
        y="41"
        fill={BRAND.colors.red}
        fontSize="9"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
      >
        C
      </text>
    </svg>
  );
}

type BrandWordmarkProps = {
  className?: string;
  /** Texto claro para fundos escuros (sidebar) */
  light?: boolean;
};

export function BrandWordmark({
  className = "",
  light = false,
}: BrandWordmarkProps) {
  return (
    <span
      className={`font-semibold tracking-tight lowercase leading-none ${
        light ? "text-white" : "text-[#004071]"
      } ${className}`}
      style={{ fontFamily: "var(--font-brand, Inter, system-ui, sans-serif)" }}
    >
      colombocal
    </span>
  );
}
