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

export function ChevronDownIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function CalendarIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3.5 9.5h17M8 2.8v3.6M16 2.8v3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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

export function ZapIcon({ size = 15 }: { size?: number }) {
  return <BoltIcon size={size} />;
}

export function ChevronLeftIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function SunMoonIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  );
}

export function PanelLeftIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 3v18" stroke="currentColor" strokeWidth="1.7" />
    </Svg>
  );
}

export function PanelRightIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M15 3v18" stroke="currentColor" strokeWidth="1.7" />
    </Svg>
  );
}

export function KanbanIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M6 5v11M12 5v6M18 5v14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

export function NetworkIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect x="16" y="16" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="2" y="16" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <rect x="9" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8" stroke="currentColor" strokeWidth="1.6" />
    </Svg>
  );
}

/** 定位：十字准星，用于在任务树中定位某任务。 */
export function LocateIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
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

/** 负责人：人形头像（头部 + 肩部轮廓）。 */
export function PersonIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M4.5 20c1.2-3.4 4-5 7.5-5s6.3 1.6 7.5 5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** 标签：圆角标签形。 */
export function TagIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path
        d="M3.5 11.8V5a1.5 1.5 0 0 1 1.5-1.5h6.8a1.5 1.5 0 0 1 1.06.44l6.7 6.7a1.5 1.5 0 0 1 0 2.12l-5.4 5.4a1.5 1.5 0 0 1-2.12 0l-6.7-6.7A1.5 1.5 0 0 1 3.5 11.8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.2" fill="currentColor" />
    </Svg>
  );
}

/** 统计：三根柱子的柱状图。 */
export function ChartIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M5 20V9M12 20V4M19 20v-7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M3 20h18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
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

/** 重命名：文本输入框 + 光标，比通用铅笔更贴合「重命名标题」。 */
export function RenameIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect
        x="3.2"
        y="5.2"
        width="17.6"
        height="13.6"
        rx="2.6"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8.6 9.2v5.6M7 14.8h3.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SettingsIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TrashIcon({ size = 14 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path
        d="M5 7.5h14M9 7.5V5.8a1.8 1.8 0 0 1 1.8-1.8h2.4A1.8 1.8 0 0 1 15 5.8v1.7M6.7 7.5l.8 11a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l.8-11M10 11v5M14 11v5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** 分享：右上角发出的共享箭头，用于「任务分享」入口。 */
export function ShareIcon({ size = 15 }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8.6 10.8 15.4 6.7M8.6 13.2l6.8 4.1"
        stroke="currentColor"
        strokeWidth="1.7"
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

/** 亮色年轮树桩 Logo：年轮代表周循环，七段刻度代表七天，中心嫩芽代表本周新任务。 */
export function LogoIcon({ size = 21 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      aria-hidden="true"
    >
      <rect width="200" height="200" rx="38" fill="#1557D0" />
      <circle cx="100" cy="102" r="64" fill="#0B43AC" />
      <circle cx="100" cy="102" r="64" stroke="#FFFFFF" strokeWidth="7" />
      <circle cx="100" cy="102" r="42" stroke="#A9C7FF" strokeWidth="5" />
      {/* Seven equal radial ticks keep the same gap from both rings. */}
      <g stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round">
        <line x1="100" y1="47" x2="100" y2="53" />
        <line x1="100" y1="47" x2="100" y2="53" transform="rotate(51.4286 100 102)" />
        <line x1="100" y1="47" x2="100" y2="53" transform="rotate(102.8571 100 102)" />
        <line x1="100" y1="47" x2="100" y2="53" transform="rotate(154.2857 100 102)" />
        <line x1="100" y1="47" x2="100" y2="53" transform="rotate(205.7143 100 102)" />
        <line x1="100" y1="47" x2="100" y2="53" transform="rotate(257.1429 100 102)" />
        <line x1="100" y1="47" x2="100" y2="53" transform="rotate(308.5714 100 102)" />
      </g>
      <path d="M100 102C84 102 72 92 71 76c16 0 28 10 29 26Z" fill="#FFFFFF" />
      <path d="M100 102c1-16 13-26 29-26-1 16-13 26-29 26Z" fill="#FFFFFF" />
      <path d="M97 99h6v30a3 3 0 0 1-6 0Z" fill="#FFFFFF" />
    </svg>
  );
}
