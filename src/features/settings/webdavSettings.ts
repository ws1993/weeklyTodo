export interface WebDavSettings {
  url: string;
  username: string;
  /** 应用启动时自动执行一次同步。 */
  syncOnStartup: boolean;
  /** 定时同步间隔（小时）。0 表示关闭定时同步。 */
  syncIntervalHours: number;
  /** 最近一次同步时间（ISO 8601），用于展示与判断定时到期。 */
  lastSyncedAt?: string;
  /** 最近一次同步的状态文案（成功或失败原因）。 */
  lastSyncStatus?: string;
}

export const SYNC_INTERVAL_HOURS_OPTIONS = [0, 1, 2, 4, 6, 12, 24];

const WEBDAV_SETTINGS_STORAGE_KEY = 'weeklyTodo.webdavSettings';

export function createDefaultWebDavSettings(): WebDavSettings {
  return {
    url: '',
    username: '',
    syncOnStartup: false,
    syncIntervalHours: 0,
  };
}

export function isValidWebDavUrl(url: string): boolean {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidIntervalHours(value: number): boolean {
  return SYNC_INTERVAL_HOURS_OPTIONS.includes(value);
}

export function loadWebDavSettings(): WebDavSettings {
  if (typeof window === 'undefined') {
    return createDefaultWebDavSettings();
  }
  try {
    const raw = window.localStorage.getItem(WEBDAV_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return createDefaultWebDavSettings();
    }
    const parsed = JSON.parse(raw) as Partial<WebDavSettings>;
    return {
      ...createDefaultWebDavSettings(),
      ...parsed,
      url: typeof parsed.url === 'string' ? parsed.url : '',
      username: typeof parsed.username === 'string' ? parsed.username : '',
      syncOnStartup: Boolean(parsed.syncOnStartup),
      syncIntervalHours: isValidIntervalHours(Number(parsed.syncIntervalHours))
        ? Number(parsed.syncIntervalHours)
        : 0,
    };
  } catch {
    return createDefaultWebDavSettings();
  }
}

export function saveWebDavSettings(settings: WebDavSettings): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(WEBDAV_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 存储失败时静默忽略，同步设置不影响本地数据读写。
  }
}

/** 定时同步是否已经到期（基于最近一次同步时间）。未同步过则视为到期。 */
export function isSyncDue(
  settings: WebDavSettings,
  now: Date,
  tickIntervalMs: number,
): boolean {
  if (settings.syncIntervalHours <= 0 || !settings.url) {
    return false;
  }
  if (!settings.lastSyncedAt) {
    return true;
  }
  const last = new Date(settings.lastSyncedAt).getTime();
  if (Number.isNaN(last)) {
    return true;
  }
  return now.getTime() - last >= settings.syncIntervalHours * 60 * 60 * 1000 - tickIntervalMs;
}
