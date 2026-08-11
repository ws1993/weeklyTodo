/**
 * 分享图的持久化设置：模板选择 + 展示字段开关 + 是否包含已完成任务。
 * 仿照 features/settings/closeBehavior.ts 的防御性读写模式。
 */

export type ShareTemplateId = 'rainbow-track';

export interface ShareSettings {
  /** 当前选中的分享图模板。 */
  templateId: ShareTemplateId;
  /** 是否在分享图中展示任务描述（默认关闭：描述易长且杂）。 */
  showDescription: boolean;
  /** 是否展示优先级徽章。 */
  showPriority: boolean;
  /** 是否展示执行方式（自己 / 跟进）/ 负责人 / 分派人。 */
  showAssignments: boolean;
  /** 是否展示标签。 */
  showTags: boolean;
  /** 是否包含已完成（closed）任务。 */
  includeCompleted: boolean;
  /** 是否展示周标题 / 周范围头部信息。 */
  showWeekHeader: boolean;
  /** 是否展示分组色条（轨道语义）。 */
  showGroupColors: boolean;
}

const SHARE_SETTINGS_STORAGE_KEY = 'weeklyTodo.shareSettings';

const SHARE_TEMPLATE_IDS: ShareTemplateId[] = ['rainbow-track'];

export function createDefaultShareSettings(): ShareSettings {
  return {
    templateId: 'rainbow-track',
    showDescription: false,
    showPriority: true,
    showAssignments: true,
    showTags: true,
    includeCompleted: true,
    showWeekHeader: true,
    showGroupColors: true,
  };
}

function isValidShareTemplateId(value: unknown): value is ShareTemplateId {
  return typeof value === 'string' && (SHARE_TEMPLATE_IDS as string[]).includes(value);
}

export function loadShareSettings(): ShareSettings {
  if (typeof window === 'undefined') {
    return createDefaultShareSettings();
  }
  try {
    const raw = window.localStorage.getItem(SHARE_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return createDefaultShareSettings();
    }
    const parsed = JSON.parse(raw) as Partial<ShareSettings>;
    const defaults = createDefaultShareSettings();
    return {
      templateId: isValidShareTemplateId(parsed.templateId) ? parsed.templateId : defaults.templateId,
      showDescription: typeof parsed.showDescription === 'boolean' ? parsed.showDescription : defaults.showDescription,
      showPriority: typeof parsed.showPriority === 'boolean' ? parsed.showPriority : defaults.showPriority,
      showAssignments: typeof parsed.showAssignments === 'boolean' ? parsed.showAssignments : defaults.showAssignments,
      showTags: typeof parsed.showTags === 'boolean' ? parsed.showTags : defaults.showTags,
      includeCompleted: typeof parsed.includeCompleted === 'boolean' ? parsed.includeCompleted : defaults.includeCompleted,
      showWeekHeader: typeof parsed.showWeekHeader === 'boolean' ? parsed.showWeekHeader : defaults.showWeekHeader,
      showGroupColors: typeof parsed.showGroupColors === 'boolean' ? parsed.showGroupColors : defaults.showGroupColors,
    };
  } catch {
    return createDefaultShareSettings();
  }
}

export function saveShareSettings(settings: ShareSettings): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(SHARE_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 存储失败时静默忽略，分享设置不影响本地数据读写。
  }
}
