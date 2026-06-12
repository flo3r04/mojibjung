import React from "react";

interface LogoProps {
  size?: number;
  variant?: "owl-only" | "card";
  className?: string;
}

export default function Logo({ size = 32, variant = "owl-only", className = "" }: LogoProps) {
  if (variant === "card") {
    return (
      <div 
        className={`bg-white rounded-3xl p-4 shadow-sm flex flex-col items-center justify-between border border-slate-100 ${className}`}
        style={{ width: size, height: size }}
      >
        <div className="flex-1 w-full flex items-center justify-center min-h-0">
          <img 
            src="/logo.png" 
            alt="모집중 로고" 
            className="w-full h-full object-contain max-h-full"
          />
        </div>
        <span 
          className="text-center font-black tracking-tight text-[#0F2547] select-none mt-2.5 leading-none shrink-0"
          style={{ fontSize: size * 0.115 }}
        >
          모집중
        </span>
      </div>
    );
  }

  return (
    <img 
      src="/logo.png" 
      alt="모집중 로고" 
      width={size} 
      height={size}
      className={`object-contain ${className}`}
    />
  );
}
