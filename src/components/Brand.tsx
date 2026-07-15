import React from 'react';

export const BRAND_NAME = 'Cronos Labs';
export const BRAND_GOLD = '#E7B24A';

export function BrandMark({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative shrink-0 rounded-xl flex items-center justify-center shadow-lg shadow-black/20 ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #F4CD7C 0%, #E7B24A 45%, #B9812A 100%)',
      }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.56} height={size * 0.56} fill="none">
        <circle cx="12" cy="12" r="8.25" stroke="#1A1207" strokeWidth="1.8" />
        <path d="M12 7.5V12L15 14" stroke="#1A1207" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function BrandLabsTag({ className = '' }: { className?: string }) {
  return (
    <span
      className={`text-[10px] bg-[#E7B24A]/15 text-[#E7B24A] border border-[#E7B24A]/30 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${className}`}
    >
      Labs
    </span>
  );
}
