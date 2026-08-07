import { create } from 'zustand';
import type {
  Assigner,
  ExecutionMode,
  GroupColor,
  Owner,
  Tag,
  Task,
  Week,
  WeekTreePayload,
} from '../shared/contracts/types';
import * as bridge from '../api/nativeBridge';

interface AppState {
  storageDir: string;
  currentWeekId: string;
  activeWeekId: string;
  recentWeeks: Week[];
  allWeeks: Week[];
  owners: Owner[];
  assigners: Assigner[];
  tags: Tag[];
  groupColors: GroupColor[];
  tree: WeekTreePayload | null;
  loading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  refreshWeeks: () => Promise<void>;
  refreshMetadata: () => Promise<void>;
  selectWeek: (weekId: string) => Promise<void>;
  refreshTree: () => Promise<void>;
  addTask: (input: {
    title: string;
    description?: string;
    parentId?: number | null;
    executionMode?: ExecutionMode;
    ownerName?: string | null;
    assignerName?: string | null;
    tagNames?: string[];
  }) => Promise<Task>;
  editTask: (
    taskId: number,
    input: {
      title?: string;
      description?: string;
      priority?: number;
      executionMode?: ExecutionMode;
      ownerName?: string | null;
      assignerName?: string | null;
      tagNames?: string[];
    },
  ) => Promise<void>;
  toggleTask: (taskId: number) => Promise<void>;
  moveTask: (taskId: number, newParentId: number | null, newIndex: number) => Promise<void>;
  deleteTask: (taskId: number) => Promise<void>;
  createWeek: (mondayDate: string) => Promise<Week>;
  ensureGroupColor: (name: string) => Promise<void>;
  setGroupColor: (name: string, color: string) => Promise<void>;
  resetGroupColor: (name: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  storageDir: '',
  currentWeekId: '',
  activeWeekId: '',
  recentWeeks: [],
  allWeeks: [],
  owners: [],
  assigners: [],
  tags: [],
  groupColors: [],
  tree: null,
  loading: true,
  error: null,

  initialize: async () => {
    set({ loading: true, error: null });
    try {
      const state = await bridge.initializeApp();
      const [recentWeeks, allWeeks] = await Promise.all([
        bridge.recentWeeks(4),
        bridge.listWeeks(),
      ]);
      set({
        storageDir: state.storageDir,
        currentWeekId: state.currentWeekId,
        activeWeekId: state.currentWeekId,
        recentWeeks,
        allWeeks,
        loading: false,
      });
      await get().refreshTree();
      await get().refreshMetadata();
    } catch (error) {
      set({ loading: false, error: String(error) });
    }
  },

  refreshWeeks: async () => {
    const [recentWeeks, allWeeks] = await Promise.all([
      bridge.recentWeeks(4),
      bridge.listWeeks(),
    ]);
    set({ recentWeeks, allWeeks });
  },

  refreshMetadata: async () => {
    const [owners, assigners, tags, groupColors] = await Promise.all([
      bridge.listOwners(),
      bridge.listAssigners(),
      bridge.listTags(),
      bridge.listGroupColors(),
    ]);
    set({ owners, assigners, tags, groupColors });
  },

  ensureGroupColor: async (name) => {
    const entry = await bridge.ensureGroupColor(name);
    set((state) => {
      const rest = state.groupColors.filter((item) => item.name !== entry.name);
      return { groupColors: [...rest, entry] };
    });
  },

  setGroupColor: async (name, color) => {
    const entry = await bridge.setGroupColor(name, color);
    set((state) => {
      const rest = state.groupColors.filter((item) => item.name !== entry.name);
      return { groupColors: [...rest, entry] };
    });
  },

  resetGroupColor: async (name) => {
    const entry = await bridge.resetGroupColor(name);
    set((state) => {
      const rest = state.groupColors.filter((item) => item.name !== entry.name);
      return { groupColors: [...rest, entry] };
    });
  },

  selectWeek: async (weekId) => {
    set({ activeWeekId: weekId, error: null });
    const tree = await bridge.getWeekTree(weekId);
    set({ tree });
  },

  refreshTree: async () => {
    const { activeWeekId } = get();
    if (!activeWeekId) {
      return;
    }
    const tree = await bridge.getWeekTree(activeWeekId);
    set({ tree });
  },

  addTask: async ({ title, description, parentId, executionMode, ownerName, assignerName, tagNames }) => {
    const { activeWeekId } = get();
    const task = await bridge.createTask({
      weekId: activeWeekId,
      title,
      description,
      parentId: parentId ?? null,
      executionMode,
      ownerName,
      assignerName,
      tagNames,
    });
    await get().refreshTree();
    await get().refreshMetadata();
    return task;
  },

  editTask: async (taskId, { title, description, priority, executionMode, ownerName, assignerName, tagNames }) => {
    const { activeWeekId } = get();
    await bridge.updateTask({
      weekId: activeWeekId,
      taskId,
      title,
      description,
      priority,
      executionMode,
      ownerName,
      assignerName,
      tagNames,
    });
    await get().refreshTree();
    await get().refreshMetadata();
  },

  toggleTask: async (taskId) => {
    const { activeWeekId, tree } = get();
    const task = tree?.tasks.find((item) => item.id === taskId);
    if (!task) {
      return;
    }
    if (task.status === 'closed') {
      await bridge.reopenTask(activeWeekId, taskId);
    } else {
      await bridge.closeTask(activeWeekId, taskId);
    }
    await get().refreshTree();
  },

  moveTask: async (taskId, newParentId, newIndex) => {
    const { activeWeekId } = get();
    await bridge.moveTask(activeWeekId, taskId, newParentId, newIndex);
    await get().refreshTree();
  },

  deleteTask: async (taskId) => {
    const { activeWeekId } = get();
    await bridge.deleteTask(activeWeekId, taskId);
    await get().refreshTree();
    await get().refreshMetadata();
  },

  createWeek: async (mondayDate) => {
    const week = await bridge.createWeek(mondayDate);
    await get().refreshWeeks();
    return week;
  },
}));

/** Flatten the task forest in display order. */
export function flattenTasks(tasks: Task[], parentId: number | null = null): Task[] {
  const result: Task[] = [];
  const children = tasks
    .filter((task) => task.parentId === parentId)
    .sort((a, b) => a.sortIndex - b.sortIndex || a.id - b.id);
  for (const child of children) {
    result.push(child);
    result.push(...flattenTasks(tasks, child.id));
  }
  return result;
}

export function taskDepth(tasks: Task[], taskId: number): number {
  let depth = 0;
  let current = tasks.find((task) => task.id === taskId);
  while (current?.parentId != null) {
    depth += 1;
    current = tasks.find((task) => task.id === current?.parentId);
  }
  return depth;
}

/** Active leaves: open tasks with no open children (or no children at all). */
export function activeLeaves(tasks: Task[]): Task[] {
  return tasks.filter((task) => {
    if (task.status !== 'in_progress') {
      return false;
    }
    const hasOpenChild = tasks.some(
      (child) => child.parentId === task.id && child.status === 'in_progress',
    );
    return !hasOpenChild;
  });
}

export function isCarriedOver(task: Task): boolean {
  return task.carriedFromTaskId != null;
}
