export interface Week {
  id: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  carriedFromWeekId?: string | null;
}

export type TaskStatus = 'in_progress' | 'closed';

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
  keyword?: string;
  status?: string;
  carriedOverOnly?: boolean;
  startWeekId?: string;
  endWeekId?: string;
}

export interface QueryTaskRow {
  task: Task;
  weekId: string;
  weekLabel: string;
  path: string;
}

/** Row returned by `week_summaries`: [weekId, total, open]. */
export type WeekSummary = [string, number, number];

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
