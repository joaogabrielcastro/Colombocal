import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BRAND.backgroundColor,
        }}
      >
        <svg viewBox="0 0 96 96" width="140" height="140">
          <path
            d="M12 48c0-22 14-38 32-42"
            fill="none"
            stroke={BRAND.colors.navy}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d="M84 48c0 22-14 38-32 42"
            fill="none"
            stroke={BRAND.colors.navy}
            strokeWidth="7"
            strokeLinecap="round"
          />
          <ellipse cx="48" cy="50" rx="26" ry="24" fill={BRAND.colors.sky} />
          <path
            d="M30 56 L66 56 L62 62 L34 62 Z"
            fill="none"
            stroke={BRAND.colors.red}
            strokeWidth="2.5"
          />
          <path
            d="M40 56 V34 M48 56 V28 M56 56 V34"
            stroke={BRAND.colors.red}
            strokeWidth="2"
          />
          <path
            d="M40 34 L48 28 L56 34 L56 50 L40 50 Z"
            fill="none"
            stroke={BRAND.colors.red}
            strokeWidth="2"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
