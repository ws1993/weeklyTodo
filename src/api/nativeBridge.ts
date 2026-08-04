import type {
  AppStatePayload,
  ExecutionMode,
  MigrateResult,
  Owner,
  ProxyConfigPayload,
  QueryFilter,
  QueryTaskRow,
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
    tagNames: input.tagNames,
  });
}

export async function listOwners(): Promise<Owner[]> {
  return invokeCommand<Owner[]>('list_owners');
}

export async function listTags(): Promise<Tag[]> {
  return invokeCommand<Tag[]>('list_tags');
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

export async function weekSummaries(): Promise<WeekSummary[]> {
  return invokeCommand<WeekSummary[]>('week_summaries');
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

export async function openReleasePage(): Promise<void> {
  if (!isTauriRuntime()) {
    window.open('https://github.com/ws1993/weeklytodo/releases/latest', '_blank');
    return;
  }
  await invokeCommand('open_release_page');
}

/** 一次 WebDAV 同步的返回结果。 */
export interface SyncResult {
  direction: 'upload' | 'download' | 'noop';
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
export async function syncWebDav(url: string, username: string): Promise<SyncResult> {
  return invokeCommand<SyncResult>('webdav_sync_now', { url, username });
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
