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
