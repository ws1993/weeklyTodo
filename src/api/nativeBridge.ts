import type {
  AppStatePayload,
  Assigner,
  ExecutionMode,
  GroupColor,
  MigrateResult,
  Owner,
  ProxyConfigPayload,
  QueryFilter,
  QueryTaskRow,
  RemoteDatabaseVersion,
  RestoreDatabaseVersionResult,
  StatisticsOverview,
  Tag,
  Task,
  UpdateCheckResult,
  UpdateDownloadProgress,
  Week,
  WeekSummary,
  WeekTreePayload,
} from '../shared/contracts/types';

interface TauriWindow {
  __TAURI_INTERNALS__?: unknown;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

async function invokeCommand<TResponse>(
  commandName: string,
  args?: Record<string, unknown>,
): Promise<TResponse> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<TResponse>(commandName, args);
}

export async function initializeApp(): Promise<AppStatePayload> {
  return invokeCommand<AppStatePayload>('initialize_app');
}

export async function listWeeks(): Promise<Week[]> {
  return invokeCommand<Week[]>('list_weeks');
}

export async function recentWeeks(limit?: number): Promise<Week[]> {
  return invokeCommand<Week[]>('recent_weeks', { limit: limit ?? 4 });
}

export async function getWeekTree(weekId: string): Promise<WeekTreePayload> {
  return invokeCommand<WeekTreePayload>('get_week_tree', { weekId });
}

export async function getCurrentWeekTree(): Promise<WeekTreePayload> {
  return invokeCommand<WeekTreePayload>('get_current_week_tree');
}

export async function createWeek(mondayDate: string): Promise<Week> {
  return invokeCommand<Week>('create_week', { mondayDate });
}

export async function createTask(input: {
  weekId: string;
  title: string;
  description?: string;
  parentId?: number | null;
  priority?: number;
  executionMode?: ExecutionMode;
  ownerName?: string | null;
  assignerName?: string | null;
  tagNames?: string[];
}): Promise<Task> {
  return invokeCommand<Task>('create_task', {
    weekId: input.weekId,
    title: input.title,
    description: input.description,
    parentId: input.parentId ?? null,
    priority: input.priority,
    executionMode: input.executionMode,
    ownerName: input.ownerName,
    assignerName: input.assignerName,
    tagNames: input.tagNames,
  });
}

export async function updateTask(input: {
  weekId: string;
  taskId: number;
  title?: string;
  description?: string;
  priority?: number;
  executionMode?: ExecutionMode;
  ownerName?: string | null;
  assignerName?: string | null;
  tagNames?: string[];
}): Promise<Task> {
  return invokeCommand<Task>('update_task', {
    weekId: input.weekId,
    taskId: input.taskId,
    title: input.title,
    description: input.description,
    priority: input.priority,
    executionMode: input.executionMode,
    ownerName: input.ownerName,
    assignerName: input.assignerName,
    tagNames: input.tagNames,
  });
}

export async function listAssigners(): Promise<Assigner[]> {
  return invokeCommand<Assigner[]>('list_assigners');
}

export async function createAssigner(name: string): Promise<Assigner> {
  return invokeCommand<Assigner>('create_assigner', { name });
}

export async function renameAssigner(id: number, name: string): Promise<Assigner> {
  return invokeCommand<Assigner>('rename_assigner', { id, name });
}

export async function deleteAssigner(id: number): Promise<void> {
  return invokeCommand<void>('delete_assigner', { id });
}

export async function listOwners(): Promise<Owner[]> {
  return invokeCommand<Owner[]>('list_owners');
}

export async function listTags(): Promise<Tag[]> {
  return invokeCommand<Tag[]>('list_tags');
}

export async function createOwner(name: string): Promise<Owner> {
  return invokeCommand<Owner>('create_owner', { name });
}

export async function renameOwner(id: number, name: string): Promise<Owner> {
  return invokeCommand<Owner>('rename_owner', { id, name });
}

export async function deleteOwner(id: number): Promise<void> {
  return invokeCommand<void>('delete_owner', { id });
}

export async function createTag(name: string): Promise<Tag> {
  return invokeCommand<Tag>('create_tag', { name });
}

export async function renameTag(id: number, name: string): Promise<Tag> {
  return invokeCommand<Tag>('rename_tag', { id, name });
}

export async function deleteTag(id: number): Promise<void> {
  return invokeCommand<void>('delete_tag', { id });
}

export async function listGroupColors(): Promise<GroupColor[]> {
  return invokeCommand<GroupColor[]>('list_group_colors');
}

export async function ensureGroupColor(name: string): Promise<GroupColor> {
  return invokeCommand<GroupColor>('ensure_group_color', { name });
}

export async function setGroupColor(name: string, color: string): Promise<GroupColor> {
  return invokeCommand<GroupColor>('set_group_color', { name, color });
}

export async function resetGroupColor(name: string): Promise<GroupColor> {
  return invokeCommand<GroupColor>('reset_group_color', { name });
}

export async function closeTask(weekId: string, taskId: number): Promise<Task> {
  return invokeCommand<Task>('close_task', { weekId, taskId });
}

export async function reopenTask(weekId: string, taskId: number): Promise<Task> {
  return invokeCommand<Task>('reopen_task', { weekId, taskId });
}

export async function moveTask(
  weekId: string,
  taskId: number,
  newParentId: number | null,
  newIndex: number,
): Promise<void> {
  return invokeCommand<void>('move_task', { weekId, taskId, newParentId, newIndex });
}

export async function deleteTask(weekId: string, taskId: number): Promise<void> {
  return invokeCommand<void>('delete_task', { weekId, taskId });
}

export async function queryAllTasks(filter: QueryFilter): Promise<QueryTaskRow[]> {
  return invokeCommand<QueryTaskRow[]>('query_all_tasks', { filter });
}

/** 项目（顶层任务）标题列表：不传周返回跨周去重后的全部项目，传周只返回该周项目。 */
export async function queryGroupOptions(weekId?: string): Promise<string[]> {
  return invokeCommand<string[]>('query_group_options', { weekId: weekId ?? null });
}

export async function weekSummaries(): Promise<WeekSummary[]> {
  return invokeCommand<WeekSummary[]>('week_summaries');
}

/** 历史统计 / 复盘视图的一次性聚合数据（可按起止周过滤，缺省为全部历史）。 */
export async function statisticsOverview(
  startWeekId?: string,
  endWeekId?: string,
): Promise<StatisticsOverview> {
  return invokeCommand<StatisticsOverview>('statistics_overview', {
    startWeekId: startWeekId ?? null,
    endWeekId: endWeekId ?? null,
  });
}

export async function getStorageDir(): Promise<string> {
  return invokeCommand<string>('get_storage_dir');
}

export async function pickAndMigrateStorage(): Promise<MigrateResult> {
  return invokeCommand<MigrateResult>('pick_and_migrate_storage');
}

export async function migrateStorageTo(newDataDir: string): Promise<MigrateResult> {
  return invokeCommand<MigrateResult>('migrate_storage_to', { newDataDir });
}

export async function checkForAppUpdate(
  proxy?: ProxyConfigPayload,
): Promise<UpdateCheckResult> {
  if (!isTauriRuntime()) {
    return { available: false };
  }
  return invokeCommand<UpdateCheckResult>('check_for_app_update', { proxy: proxy ?? null });
}

export async function downloadAndInstallUpdate(
  downloadUrl: string,
  proxy?: ProxyConfigPayload,
): Promise<string> {
  if (!isTauriRuntime()) {
    throw new Error('当前不在桌面运行时中，无法下载更新');
  }
  return invokeCommand<string>('download_and_install_update', { downloadUrl, proxy: proxy ?? null });
}

export async function exitAppForUpdate(): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error('当前不在桌面运行时中，无法退出应用安装更新');
  }
  await invokeCommand('exit_app_for_update');
}

/** 隐藏主窗口到系统托盘，应用继续在后台运行。 */
export async function hideMainWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invokeCommand('hide_main_window');
}

/** 彻底退出应用（跳过关闭询问逻辑，直接结束进程）。 */
export async function exitApp(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invokeCommand('exit_app');
}

/** 订阅窗口关闭按钮请求事件（点击右上角 × 时触发），返回取消订阅函数。 */
export function onCloseRequested(callback: () => void): () => void {
  if (!isTauriRuntime()) {
    return () => undefined;
  }

  let disposed = false;
  let unlisten: (() => void) | undefined;

  void import('@tauri-apps/api/event').then(({ listen }) => {
    if (disposed) {
      return;
    }
    void listen<void>('app-close-requested', () => {
      callback();
    }).then((stop) => {
      if (disposed) {
        stop();
        return;
      }
      unlisten = stop;
    });
  });

  return () => {
    disposed = true;
    unlisten?.();
  };
}

export async function openReleasePage(): Promise<void> {
  if (!isTauriRuntime()) {
    window.open('https://github.com/ws1993/weeklytodo/releases/latest', '_blank');
    return;
  }
  await invokeCommand('open_release_page');
}

/** 在系统文件管理器中打开数据目录（Windows 上直接选中数据库文件，便于手动备份）。 */
export async function openDataDir(): Promise<string> {
  return invokeCommand<string>('open_data_dir');
}

/** 一次 WebDAV 同步的返回结果。 */
export interface SyncResult {
  direction: 'upload' | 'download' | 'noop' | 'skipped';
  backupFiles: string[];
  syncedAt: string;
  message: string;
}

/** 校验 WebDAV 配置连通性（会创建缺失的同步目录）。 */
export async function testWebDavConnection(
  url: string,
  username: string,
  password: string,
): Promise<string> {
  return invokeCommand<string>('webdav_test_connection', { url, username, password });
}

/** 将密码存入系统凭据管理器。返回是否实际保存（空密码不保存）。 */
export async function saveWebDavCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  return invokeCommand<boolean>('webdav_save_credentials', { username, password });
}

/** 系统凭据管理器中是否已保存该用户名的密码。 */
export async function hasWebDavCredentials(username: string): Promise<boolean> {
  return invokeCommand<boolean>('webdav_has_credentials', { username });
}

/** 清除系统凭据管理器中该用户名的密码。 */
export async function clearWebDavCredentials(username: string): Promise<void> {
  return invokeCommand<void>('webdav_clear_credentials', { username });
}

/** 执行一次文件级同步，密码由 Rust 侧从系统凭据管理器读取。 */
export async function syncWebDav(
  url: string,
  username: string,
  backupRetention?: number | 'unlimited',
): Promise<SyncResult> {
  // 将 'unlimited' 转换为 null，数字直接传递
  const retentionLimit = backupRetention === 'unlimited' ? null : backupRetention;
  return invokeCommand<SyncResult>('webdav_sync_now', {
    url,
    username,
    backupRetention: retentionLimit,
  });
}

/** Runs scheduler-driven synchronization with the empty-local overwrite guard enabled. */
export async function syncWebDavAutomatically(
  url: string,
  username: string,
  backupRetention?: number | 'unlimited',
): Promise<SyncResult> {
  // 将 'unlimited' 转换为 null，数字直接传递
  const retentionLimit = backupRetention === 'unlimited' ? null : backupRetention;
  return invokeCommand<SyncResult>('webdav_sync_automatic', {
    url,
    username,
    backupRetention: retentionLimit,
  });
}

/** Lists the current remote database and timestamped restore points. */
export async function listWebDavDatabaseVersions(
  url: string,
  username: string,
): Promise<RemoteDatabaseVersion[]> {
  return invokeCommand<RemoteDatabaseVersion[]>('webdav_list_versions', { url, username });
}

/** Backs up local data remotely, then restores one selected server version. */
export async function restoreWebDavDatabaseVersion(
  url: string,
  username: string,
  fileName: string,
): Promise<RestoreDatabaseVersionResult> {
  return invokeCommand<RestoreDatabaseVersionResult>('webdav_restore_version', {
    url,
    username,
    fileName,
  });
}

export function subscribeUpdateDownloadProgress(
  onProgress: (progress: UpdateDownloadProgress) => void,
): () => void {
  if (!isTauriRuntime()) {
    return () => undefined;
  }

  let disposed = false;
  let unlisten: (() => void) | undefined;

  void import('@tauri-apps/api/event').then(({ listen }) => {
    if (disposed) {
      return;
    }
    void listen<UpdateDownloadProgress>('update-download-progress', (event) => {
      onProgress(event.payload);
    }).then((stop) => {
      if (disposed) {
        stop();
        return;
      }
      unlisten = stop;
    });
  });

  return () => {
    disposed = true;
    unlisten?.();
  };
}

export { isTauriRuntime };
