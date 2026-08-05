export type CloseBehavior = 'ask' | 'minimize-to-tray' | 'exit';

export interface CloseBehaviorSettings {
  /** 点击窗口关闭按钮（×）时执行的行为。 */
  behavior: CloseBehavior;
}

const CLOSE_BEHAVIOR_STORAGE_KEY = 'weeklyTodo.closeBehavior';

export function createDefaultCloseBehaviorSettings(): CloseBehaviorSettings {
  return { behavior: 'ask' };
}

export function isValidCloseBehavior(value: unknown): value is CloseBehavior {
  return value === 'ask' || value === 'minimize-to-tray' || value === 'exit';
}

export function loadCloseBehaviorSettings(): CloseBehaviorSettings {
  if (typeof window === 'undefined') {
    return createDefaultCloseBehaviorSettings();
  }
  try {
    const raw = window.localStorage.getItem(CLOSE_BEHAVIOR_STORAGE_KEY);
    if (!raw) {
      return createDefaultCloseBehaviorSettings();
    }
    const parsed = JSON.parse(raw) as Partial<CloseBehaviorSettings>;
    return {
      behavior: isValidCloseBehavior(parsed.behavior) ? parsed.behavior : 'ask',
    };
  } catch {
    return createDefaultCloseBehaviorSettings();
  }
}

export function saveCloseBehaviorSettings(settings: CloseBehaviorSettings): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(CLOSE_BEHAVIOR_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 存储失败时静默忽略，关闭行为设置不影响本地数据读写。
  }
}
