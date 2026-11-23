import React from "react";

interface BrandLogoProps {
  variant?: "light" | "dark" | "mono";
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}

export function BrandLogo({
  variant = "light",
  size = "md",
  showTagline = false,
}: BrandLogoProps) {
  const iconSize = size === "sm" ? 28 : size === "lg" ? 44 : 34;
  const textSize =
    size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-xl";

  const pinFill = variant === "mono" ? "#263238" : "#3A9D4A";
  const rightLeafFill = variant === "mono" ? "#90A4AE" : "#F4B400";
  const rutaColor =
    variant === "dark"
      ? "text-white"
      : variant === "mono"
      ? "text-[#263238]"
      : "text-[#263238]";
  const frescaColor =
    variant === "mono" ? "text-[#263238]" : "text-[#3A9D4A]";

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 64 64"
        fill="none"
        aria-label="Ícono Ruta Fresca"
      >
        <path
          d="M32 4C18.745 4 8 14.745 8 28C8 44.5 32 60 32 60C32 60 56 44.5 56 28C56 14.745 45.255 4 32 4Z"
          fill={pinFill}
        />
        <path
          d="M32 44V26"
          stroke="#FFFFFF"
          strokeWidth="3.4"
          strokeLinecap="round"
        />
        <path
          d="M32 30C24 29.5 19.5 23.5 21 16.5C27.5 17 32 22 32 30Z"
          fill="#FFFFFF"
        />
        <path
          d="M32 28C40 27.5 44.5 21.5 43 14.5C36.5 15 32 20 32 28Z"
          fill={rightLeafFill}
        />
      </svg>
      <div className="flex flex-col">
        <div className={`font-display font-bold tracking-tight leading-none ${textSize}`}>
          <span className={rutaColor}>Ruta</span>
          <span className={frescaColor}>Fresca</span>
        </div>
        <div
          className="mt-1 h-[3px] w-full"
          style={{
            backgroundImage:
              variant === "mono"
                ? "radial-gradient(circle, #263238 1.5px, transparent 2px)"
                : "radial-gradient(circle, #F4B400 1.6px, transparent 2.1px)",
            backgroundSize: "7px 3px",
            backgroundRepeat: "repeat-x",
          }}
        />
        {showTagline && (
          <span
            className={`mt-1 text-[11px] font-medium ${
              variant === "dark" ? "text-slate-300" : "text-slate-500"
            }`}
          >
            Se cosecha lo que usted ya pidió.
          </span>
        )}
      </div>
    </div>
  );
}
