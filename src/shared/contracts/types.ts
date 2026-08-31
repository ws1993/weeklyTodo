export interface Week {
  id: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  carriedFromWeekId?: string | null;
}

export type TaskStatus = 'in_progress' | 'closed';
export type ExecutionMode = 'self' | 'follow_up';

export interface Owner {
  id: number;
  name: string;
}

export interface Assigner {
  id: number;
  name: string;
}

export interface Tag {
  id: number;
  name: string;
}

/** Color mapping for one root task (group), keyed by the root task title. */
export interface GroupColor {
  name: string;
  color: string;
  isManual: boolean;
}

export interface Task {
  id: number;
  weekId: string;
  parentId: number | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: number;
  sortIndex: number;
  originWeekId?: string | null;
  carriedFromTaskId?: number | null;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  executionMode: ExecutionMode;
  ownerId?: number | null;
  ownerName?: string | null;
  assignerId?: number | null;
  assignerName?: string | null;
  tags: string[];
}

export interface WeekTreePayload {
  week: Week;
  tasks: Task[];
}

export interface AppStatePayload {
  storageDir: string;
  currentWeekId: string;
}

export interface QueryFilter {
  weekId?: string;
  /** 按顶层任务（项目）标题过滤，跨周同名合并。 */
  groupFilter?: string;
  keyword?: string;
  status?: string;
  carriedOverOnly?: boolean;
  leafOnly?: boolean;
  startWeekId?: string;
  endWeekId?: string;
  ownerId?: number;
  assignerId?: number;
  tagId?: number;
}

export interface QueryTaskRow {
  task: Task;
  weekId: string;
  weekLabel: string;
  path: string;
  /** 顶层任务（分组轨道 / 项目）标题。 */
  rootTitle: string;
  /** Whether the task has any children (regardless of their status). */
  hasChildren: boolean;
}

/** Row returned by `week_summaries`: [weekId, total, open]. */
export type WeekSummary = [string, number, number];

/** 单周趋势：总量 / 完成 / 进行中 / 带入（含带入完成数）。 */
export interface WeekTrendStat {
  weekId: string;
  total: number;
  done: number;
  open: number;
  carried: number;
  carriedDone: number;
}

/** 名称 + 计数（标签 / 负责人分布用）。 */
export interface NamedCount {
  name: string;
  count: number;
}

/** 某优先级下的任务数与完成数。 */
export interface PriorityStat {
  priority: number;
  count: number;
  done: number;
}

/** 历史统计 / 复盘视图的一次性聚合结果。 */
export interface StatisticsOverview {
  weeks: WeekTrendStat[];
  totalTasks: number;
  totalDone: number;
  totalOpen: number;
  totalCarried: number;
  /** 范围内进行中且属带入的任务数（拖期未完成）。 */
  carriedOpen: number;
  byPriority: PriorityStat[];
  byTag: NamedCount[];
  byOwner: NamedCount[];
  byAssigner: NamedCount[];
}

export interface MigrateResult {
  dataDir: string;
  message: string;
}

export interface ProxyConfigPayload {
  useSystemProxy?: boolean;
  customProxyUrl?: string;
  username?: string;
  password?: string;
}

export interface UpdateCheckResult {
  available: boolean;
  version?: string;
  body?: string;
  downloadUrl?: string;
  downloadSize?: number;
}

export interface UpdateDownloadProgress {
  percent: number;
  downloaded: number;
  total: number;
}

/** A current or historical SQLite database file discovered on WebDAV. */
export interface RemoteDatabaseVersion {
  fileName: string;
  lastModifiedUtc: number;
  size: number;
  isCurrent: boolean;
}

/** Result of replacing local storage with an explicitly selected WebDAV version. */
export interface RestoreDatabaseVersionResult {
  restoredFileName: string;
  localBackupFileName: string;
  restoredAt: string;
  message: string;
}
