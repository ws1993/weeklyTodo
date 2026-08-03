import type { ProxyConfigPayload } from '../../shared/contracts/types';

export type ProxyMode = 'none' | 'system' | 'custom';

export interface ProxySettings {
  mode: ProxyMode;
  customUrl?: string;
  customUsername?: string;
  customPassword?: string;
}

const PROXY_SETTINGS_STORAGE_KEY = 'weeklyTodo.proxySettings';

export function createDefaultProxySettings(): ProxySettings {
  return {
    mode: 'system',
    customUrl: '',
    customUsername: '',
    customPassword: '',
  };
}

export function isValidProxyUrl(url: string): boolean {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'socks4:', 'socks5:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/** 转换为更新检查使用的代理配置（camelCase，直接传给 Rust 命令）。 */
export function getProxyConfig(settings: ProxySettings): ProxyConfigPayload {
  return {
    useSystemProxy: settings.mode === 'system',
    customProxyUrl: settings.mode === 'custom' ? settings.customUrl : undefined,
    username: settings.mode === 'custom' ? settings.customUsername : undefined,
    password: settings.mode === 'custom' ? settings.customPassword : undefined,
  };
}

export function loadProxySettings(): ProxySettings {
  if (typeof window === 'undefined') {
    return createDefaultProxySettings();
  }
  try {
    const raw = window.localStorage.getItem(PROXY_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return createDefaultProxySettings();
    }
    const parsed = JSON.parse(raw) as Partial<ProxySettings>;
    const mode: ProxyMode =
      parsed.mode === 'none' || parsed.mode === 'custom' ? parsed.mode : 'system';
    return {
      ...createDefaultProxySettings(),
      ...parsed,
      mode,
    };
  } catch {
    return createDefaultProxySettings();
  }
}

export function saveProxySettings(settings: ProxySettings): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(PROXY_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 存储失败时静默忽略，代理设置仅影响更新检查。
  }
}

/** 当前已保存的代理配置，供更新检查/下载直接使用。 */
export function getSavedProxyConfig(): ProxyConfigPayload {
  return getProxyConfig(loadProxySettings());
}
