import type { Week } from '../shared/contracts/types';

/** Convert `20260803-20260809` into a human label like `08/03 - 08/09`. */
export function formatWeekRange(weekId: string): string {
  const [start, end] = weekId.split('-');
  if (!start || !end) {
    return weekId;
  }
  const short = (value: string) => `${value.slice(4, 6)}/${value.slice(6, 8)}`;
  return `${short(start)} - ${short(end)}`;
}

export function formatWeekYear(weekId: string): string {
  return weekId.slice(0, 4);
}

/** Week id for the Monday of the current local week. */
export function currentWeekId(): string {
  const now = new Date();
  const dayIndex = (now.getDay() + 6) % 7; // Monday = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayIndex);
  const key = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  };
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${key(monday)}-${key(sunday)}`;
}

export function isCurrentWeek(weekId: string): boolean {
  return weekId === currentWeekId();
}

/** Display label for a task status. */
export function statusLabel(status: string): string {
  return status === 'closed' ? '已完成' : '进行中';
}

export function weekDisplayName(week: Week): string {
  return week.id;
}

export function formatDateLong(value: string): string {
  // `20260803` -> `2026/08/03`
  return `${value.slice(0, 4)}/${value.slice(4, 6)}/${value.slice(6, 8)}`;
}

export type WeekStatusLabel = '待开始' | '进行中' | '已收尾';

export function weekStatus(weekId: string): { label: WeekStatusLabel; cls: 'future' | 'active' | 'past' } {
  const today = new Date();
  const start = new Date(
    Number(weekId.slice(0, 4)),
    Number(weekId.slice(4, 6)) - 1,
    Number(weekId.slice(6, 8)),
  );
  const end = new Date(
    Number(weekId.slice(9, 13)),
    Number(weekId.slice(13, 15)) - 1,
    Number(weekId.slice(15, 17)),
  );
  if (today < start) {
    return { label: '待开始', cls: 'future' };
  }
  if (today > end) {
    return { label: '已收尾', cls: 'past' };
  }
  return { label: '进行中', cls: 'active' };
}

/** 中文月日，如 `8月3日`。 */
export function formatCnDay(ymd: string): string {
  return `${Number(ymd.slice(4, 6))}月${Number(ymd.slice(6, 8))}日`;
}

/** 中文周范围，如 `8月3日 – 8月9日`。 */
export function formatCnRange(weekId: string): string {
  const [start, end] = weekId.split('-');
  if (!start || !end) {
    return weekId;
  }
  return `${formatCnDay(start)} – ${formatCnDay(end)}`;
}

/** 顶栏日期，如 `2026 年 8 月 3 日 · 周一`。 */
export function todayLabel(date = new Date()): string {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日 · 周${weekdays[date.getDay()]}`;
}
