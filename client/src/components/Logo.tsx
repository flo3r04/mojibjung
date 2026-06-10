import React from "react";

interface LogoProps {
  size?: number;
  variant?: "owl-only" | "card";
  className?: string;
}

export default function Logo({ size = 32, variant = "owl-only", className = "" }: LogoProps) {
  // SVG drawing of the owl logo
  if (variant === "card") {
    return (
      <div 
        className={`bg-white rounded-3xl p-4 shadow-sm flex flex-col items-center justify-between border border-slate-100 ${className}`}
        style={{ width: size, height: size }}
      >
        <div className="flex-1 w-full flex items-center justify-center min-h-0">
          <svg 
            viewBox="0 0 200 200" 
            className="w-full h-full max-h-full"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Main Owl Body */}
            <path d="M 60,40 C 75,45 85,50 100,50 C 115,50 125,45 140,40 C 155,50 162,65 162,80 C 175,95 178,115 172,130 C 168,140 160,148 152,150 C 142,168 122,175 100,175 C 78,175 58,168 48,150 C 40,148 32,140 28,130 C 22,115 25,95 38,80 C 38,65 45,50 60,40 Z" fill="#0F2547" />
            
            {/* Feet */}
            <path d="M 72,173 Q 72,182 76,180 Q 80,182 84,180 Q 88,182 88,173" fill="none" stroke="#0F2547" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M 112,173 Q 112,182 116,180 Q 120,182 124,180 Q 128,182 128,173" fill="none" stroke="#0F2547" strokeWidth="3.5" strokeLinecap="round" />
            
            {/* Eyes */}
            <circle cx="74" cy="92" r="23" fill="#FFFFFF" />
            <circle cx="126" cy="92" r="23" fill="#FFFFFF" />
            <circle cx="74" cy="92" r="9.5" fill="#0F2547" />
            <circle cx="126" cy="92" r="9.5" fill="#0F2547" />
            
            {/* Beak */}
            <path d="M 94,92 Q 100,91 106,92 L 100,105 Z" fill="#0F2547" />
            
            {/* Belly */}
            <path d="M 60,135 C 60,121 140,121 140,135 C 140,154 125,165 100,165 C 75,165 60,154 60,135 Z" fill="#FFFFFF" />
            
            {/* Icons */}
            {/* 1. Map Pin */}
            <path d="M 74,139 C 72,139 70.5,140.5 70.5,142 C 70.5,144.5 74,148 74,148 C 74,148 77.5,144.5 77.5,142 C 77.5,140.5 76,139 74,139 Z" fill="#2563EB" />
            <circle cx="74" cy="142" r="1" fill="#FFFFFF" />
            
            {/* 2. Speech Bubble */}
            <rect x="93.5" y="131" width="13" height="8.5" rx="4" fill="#2563EB" />
            <path d="M 98,139.5 L 100,142 L 102,139.5 Z" fill="#2563EB" />
            <circle cx="97" cy="135.2" r="0.8" fill="#FFFFFF" />
            <circle cx="103" cy="135.2" r="0.8" fill="#FFFFFF" />
            
            {/* 3. Globe */}
            <circle cx="124" cy="136.5" r="5.5" stroke="#2563EB" strokeWidth="0.9" fill="none" />
            <ellipse cx="124" cy="136.5" rx="2.2" ry="5.5" stroke="#2563EB" strokeWidth="0.8" fill="none" />
            <line x1="118.5" y1="136.5" x2="129.5" y2="136.5" stroke="#2563EB" strokeWidth="0.8" />
            <line x1="124" y1="131" x2="124" y2="142" stroke="#2563EB" strokeWidth="0.8" />
            
            {/* 4. Smiley */}
            <path d="M 94.5,148 Q 100,153 105.5,148" stroke="#2563EB" strokeWidth="1.6" strokeLinecap="round" fill="none" />
            
            {/* 5. Arrow */}
            <line x1="123" y1="143" x2="129" y2="149" stroke="#2563EB" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M 126,149 L 129,149 L 129,146" stroke="#2563EB" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            
            {/* 6. Angle bracket */}
            <path d="M 87.5,138 L 84,142.5 L 87.5,147" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            
            {/* 7. Dots and Pills */}
            <circle cx="116.5" cy="150" r="2.8" fill="#2563EB" />
            <rect x="80" y="150.5" width="6.5" height="2.2" rx="1.1" fill="#2563EB" />
            <rect x="73.5" y="132.5" width="6.5" height="2.2" rx="1.1" fill="#2563EB" />
            <circle cx="131.5" cy="134.5" r="1.1" fill="#2563EB" />
          </svg>
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

  // Owl Only SVG
  return (
    <svg 
      viewBox="0 0 200 200" 
      width={size} 
      height={size}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Main Owl Body (Uses currentColor in dark/light transitions or default navy) */}
      <path 
        d="M 60,40 C 75,45 85,50 100,50 C 115,50 125,45 140,40 C 155,50 162,65 162,80 C 175,95 178,115 172,130 C 168,140 160,148 152,150 C 142,168 122,175 100,175 C 78,175 58,168 48,150 C 40,148 32,140 28,130 C 22,115 25,95 38,80 C 38,65 45,50 60,40 Z" 
        className="fill-current text-[#0F2547] dark:text-slate-100" 
      />
      
      {/* Feet */}
      <path 
        d="M 72,173 Q 72,182 76,180 Q 80,182 84,180 Q 88,182 88,173" 
        fill="none" 
        className="stroke-current text-[#0F2547] dark:text-slate-100" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
      />
      <path 
        d="M 112,173 Q 112,182 116,180 Q 120,182 124,180 Q 128,182 128,173" 
        fill="none" 
        className="stroke-current text-[#0F2547] dark:text-slate-100" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
      />
      
      {/* Eyes */}
      <circle cx="74" cy="92" r="23" fill="#FFFFFF" />
      <circle cx="126" cy="92" r="23" fill="#FFFFFF" />
      
      <circle 
        cx="74" 
        cy="92" 
        r="9.5" 
        className="fill-current text-[#0F2547] dark:text-slate-900" 
      />
      <circle 
        cx="126" 
        cy="92" 
        r="9.5" 
        className="fill-current text-[#0F2547] dark:text-slate-900" 
      />
      
      {/* Beak */}
      <path 
        d="M 94,92 Q 100,91 106,92 L 100,105 Z" 
        className="fill-current text-[#0F2547] dark:text-slate-100" 
      />
      
      {/* Owl Belly */}
      <path 
        d="M 60,135 C 60,121 140,121 140,135 C 140,154 125,165 100,165 C 75,165 60,154 60,135 Z" 
        className="fill-current text-[#FFFFFF] dark:text-slate-100" 
      />
      
      {/* Belly Icons / Glyphs */}
      {/* 1. Map Pin */}
      <path d="M 74,139 C 72,139 70.5,140.5 70.5,142 C 70.5,144.5 74,148 74,148 C 74,148 77.5,144.5 77.5,142 C 77.5,140.5 76,139 74,139 Z" className="fill-current text-[#2563EB] dark:text-[#3B82F6]" />
      <circle cx="74" cy="142" r="1" className="fill-current text-white dark:text-slate-100" />
      
      {/* 2. Speech Bubble */}
      <rect x="93.5" y="131" width="13" height="8.5" rx="4" className="fill-current text-[#2563EB] dark:text-[#3B82F6]" />
      <path d="M 98,139.5 L 100,142 L 102,139.5 Z" className="fill-current text-[#2563EB] dark:text-[#3B82F6]" />
      <circle cx="97" cy="135.2" r="0.8" className="fill-current text-white dark:text-slate-100" />
      <circle cx="103" cy="135.2" r="0.8" className="fill-current text-white dark:text-slate-100" />
      
      {/* 3. Globe */}
      <circle cx="124" cy="136.5" r="5.5" className="stroke-current text-[#2563EB] dark:text-[#3B82F6]" strokeWidth="0.9" fill="none" />
      <ellipse cx="124" cy="136.5" rx="2.2" ry="5.5" className="stroke-current text-[#2563EB] dark:text-[#3B82F6]" strokeWidth="0.8" fill="none" />
      <line x1="118.5" y1="136.5" x2="129.5" y2="136.5" className="stroke-current text-[#2563EB] dark:text-[#3B82F6]" strokeWidth="0.8" />
      <line x1="124" y1="131" x2="124" y2="142" className="stroke-current text-[#2563EB] dark:text-[#3B82F6]" strokeWidth="0.8" />
      
      {/* 4. Smiling mouth curve */}
      <path d="M 94.5,148 Q 100,153 105.5,148" className="stroke-current text-[#2563EB] dark:text-[#3B82F6]" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      
      {/* 5. Arrow */}
      <line x1="123" y1="143" x2="129" y2="149" className="stroke-current text-[#2563EB] dark:text-[#3B82F6]" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M 126,149 L 129,149 L 129,146" className="stroke-current text-[#2563EB] dark:text-[#3B82F6]" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      
      {/* 6. Angle bracket */}
      <path d="M 87.5,138 L 84,142.5 L 87.5,147" className="stroke-current text-[#2563EB] dark:text-[#3B82F6]" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      
      {/* 7. Dots and Pills */}
      <circle cx="116.5" cy="150" r="2.8" className="fill-current text-[#2563EB] dark:text-[#3B82F6]" />
      <rect x="80" y="150.5" width="6.5" height="2.2" rx="1.1" className="fill-current text-[#2563EB] dark:text-[#3B82F6]" />
      <rect x="73.5" y="132.5" width="6.5" height="2.2" rx="1.1" className="fill-current text-[#2563EB] dark:text-[#3B82F6]" />
      <circle cx="131.5" cy="134.5" r="1.1" className="fill-current text-[#2563EB] dark:text-[#3B82F6]" />
    </svg>
  );
}
