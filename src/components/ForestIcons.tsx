import type { ReactNode } from 'react';

function Svg({ children, size, viewBox }: { children: ReactNode; size: number; viewBox?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox ?? '0 0 24 24'}
      fill="none"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function LeafIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path
        d="M19.7 4.4C11.9 5.3 6.9 10 6.2 16.1c-.14 1.1.4 1.9 1.4 1.85 6.7-.35 11.6-5.3 12.1-13.55z"
        fill="currentColor"
      />
      <path
        d="M7.5 18c1.55-4.4 4.9-7.9 9.1-10.1"
        stroke="rgba(16,22,20,.55)"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function BranchIcon({ size = 17 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M12 4.5v7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M6.6 9c2.5 1.5 4.6 2.8 5.4 4.8M17.4 9c-2.5 1.5-4.6 2.8-5.4 4.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function PlusIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size} viewBox="0 0 16 16">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function CheckIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size} viewBox="0 0 16 16">
      <path
        d="M3.4 8.6l3 3 6.2-7.2"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CrossIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size} viewBox="0 0 16 16">
      <path d="M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function TrunkIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.7} viewBox="0 0 26 46" fill="currentColor" aria-hidden="true">
      <path d="M9 2h8v4.4c3.4 1.8 5.4 4.7 5.4 8.1v16.5c0 3.6-2.7 6.4-6.2 6.4h-6.4c-3.5 0-6.2-2.8-6.2-6.4V14.5c0-3.4 2-6.3 5.4-8.1V2z" fill="currentColor" />
      <path
        d="M10.6 2.6c-.2 1.6-1.4 2.6-3 2.8M14.8 3c.6 1.2 1.8 1.8 3.2 1.8"
        stroke="rgba(16,22,20,.28)"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      <path d="M9.5 15h7M9.5 20h7M9.5 25h7M9.5 30h5" stroke="rgba(16,22,20,.3)" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M8.2 37.5c-1.8.7-2.9 2-3 4M17.8 37.5c1.8.7 2.9 2 3 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="10.6" cy="10.6" r="6.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.4 15.4l4.6 4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

export function ChevronRightIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function ClockIcon({ size = 13 }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function ArrowRightIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M4 12h15M13.5 6.5 19 12l-5.5 5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BoltIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M13 2.5 5.5 13.5H11l-1 8 7.5-11H12l1-8z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </Svg>
  );
}

export function FolderIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path
        d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function UpdateIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 3v6h-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** 工作台四宫格 Logo：蓝色方块。 */
export function WorkbenchLogoIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}

export function EditIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path
        d="M15.6 4.2l-8.7 8.7L4.4 6.4 11.8 2.6l3.8 1.6zM4.4 15.4l1.4-1.6M13.9 7.6l2.7 3.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SettingsIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3.2v2.6M12 18.2v2.6M3.2 12h2.6M18.2 12h2.6M5.9 5.9l1.8 1.8M16.3 16.3l1.8 1.8M18.1 5.9l-1.8 1.8M7.7 16.3l-1.8 1.8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function GrassIcon({ width = 120 }: { width?: number }) {
  return (
    <svg width={width} height={12} viewBox="0 0 120 12" fill="none" aria-hidden="true">
      <path
        d="M5 11c.3-3.4 1.6-5.6 4.4-7M11 11c.6-2.8 2-4.8 4.6-6.2M19 11c1.4-2.3 1.6-4.6.7-7M28 11c1.9-2.2 5-3.4 8.4-3.8M40 11c2.3-1.4 3-3.4 2.6-5.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 年轮树桩 Logo：同心年轮 = 周期循环，七段金色刻度 = 一周七天，中心嫩芽 = 本周新任务。 */
export function LogoIcon({ size = 21 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
    >
      <rect width="200" height="200" fill="#1C2720" rx="36" />
      <circle cx="100" cy="104" r="68" fill="#233028" />
      <circle cx="100" cy="104" r="68" stroke="#7FB069" strokeWidth="5" opacity=".6" />
      <circle cx="100" cy="104" r="50" stroke="#7FB069" strokeWidth="3" opacity=".35" />
      <circle cx="100" cy="104" r="32" stroke="#96C982" strokeWidth="3" opacity=".55" />
      <circle cx="100" cy="104" r="16" stroke="#96C982" strokeWidth="2" opacity=".4" />
      <g stroke="#D9A441" strokeWidth="5" strokeLinecap="round">
        <line x1="100" y1="36" x2="100" y2="48" />
        <line x1="148" y1="56" x2="141" y2="63" />
        <line x1="168" y1="104" x2="156" y2="104" />
        <line x1="148" y1="152" x2="141" y2="145" />
        <line x1="100" y1="172" x2="100" y2="160" />
        <line x1="52" y1="152" x2="59" y2="145" />
        <line x1="32" y1="104" x2="44" y2="104" />
      </g>
      <path
        d="M100 84 C 92 84, 86 90, 86 98 C 86 106, 92 112, 100 112 C 108 112, 114 106, 114 98 C 114 90, 108 84, 100 84 Z"
        fill="#96C982"
      />
      <path
        d="M100 112 C 96 124, 98 134, 104 140"
        stroke="#96C982"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}
