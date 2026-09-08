import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task, Week, WeekTreePayload } from '../shared/contracts/types';
import { activeLeaves, flattenTasks, taskDepth, useAppStore } from './appStore';

const mockedBridge = vi.hoisted(() => ({
  ensureCurrentWeek: vi.fn(),
  recentWeeks: vi.fn(),
  listWeeks: vi.fn(),
  getWeekTree: vi.fn(),
}));

const mockedCurrentWeekId = vi.hoisted(() => vi.fn<() => string>());

vi.mock('../api/nativeBridge', () => mockedBridge);
vi.mock('../utils/weekFormat', () => ({ currentWeekId: mockedCurrentWeekId }));

function makeWeek(id: string): Week {
  return { id, startDate: id.slice(0, 8), endDate: id.slice(9), createdAt: '' };
}

describe('rolloverToNewWeekIfDue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedBridge.recentWeeks.mockResolvedValue([]);
    mockedBridge.listWeeks.mockResolvedValue([]);
    mockedBridge.getWeekTree.mockImplementation(
      async (weekId: string): Promise<WeekTreePayload> => ({
        week: makeWeek(weekId),
        tasks: [],
      }),
    );
  });

  it('does nothing before the week rolls over', async () => {
    useAppStore.setState({
      currentWeekId: '20260803-20260809',
      activeWeekId: '20260803-20260809',
    });
    mockedCurrentWeekId.mockReturnValue('20260803-20260809');

    const created = await useAppStore.getState().rolloverToNewWeekIfDue();

    expect(created).toBeNull();
    expect(mockedBridge.ensureCurrentWeek).not.toHaveBeenCalled();
  });

  it('creates the new week and jumps when the user was on the old current week', async () => {
    useAppStore.setState({
      currentWeekId: '20260803-20260809',
      activeWeekId: '20260803-20260809',
    });
    mockedCurrentWeekId.mockReturnValue('20260810-20260816');
    const newWeek = makeWeek('20260810-20260816');
    newWeek.carriedFromWeekId = '20260803-20260809';
    mockedBridge.ensureCurrentWeek.mockResolvedValue(newWeek);

    const created = await useAppStore.getState().rolloverToNewWeekIfDue();

    expect(created).toEqual(newWeek);
    expect(useAppStore.getState().currentWeekId).toBe('20260810-20260816');
    expect(useAppStore.getState().activeWeekId).toBe('20260810-20260816');
    expect(mockedBridge.getWeekTree).toHaveBeenCalledWith('20260810-20260816');
    expect(mockedBridge.listWeeks).toHaveBeenCalled();
  });

  it('refreshes weeks without interrupting when the user is viewing an older week', async () => {
    useAppStore.setState({
      currentWeekId: '20260803-20260809',
      activeWeekId: '20260727-20260802',
    });
    mockedCurrentWeekId.mockReturnValue('20260810-20260816');
    mockedBridge.ensureCurrentWeek.mockResolvedValue(makeWeek('20260810-20260816'));

    const created = await useAppStore.getState().rolloverToNewWeekIfDue();

    expect(created).not.toBeNull();
    expect(useAppStore.getState().currentWeekId).toBe('20260810-20260816');
    expect(useAppStore.getState().activeWeekId).toBe('20260727-20260802');
    expect(mockedBridge.getWeekTree).not.toHaveBeenCalled();
    expect(mockedBridge.listWeeks).toHaveBeenCalled();
  });

  it('still switches to the new week when it was created earlier manually', async () => {
    useAppStore.setState({
      currentWeekId: '20260803-20260809',
      activeWeekId: '20260803-20260809',
    });
    mockedCurrentWeekId.mockReturnValue('20260810-20260816');
    // ensure_current_week 发现周已存在（如手动提前建周）时返回 null。
    mockedBridge.ensureCurrentWeek.mockResolvedValue(null);

    const created = await useAppStore.getState().rolloverToNewWeekIfDue();

    expect(created).toBeNull();
    expect(useAppStore.getState().activeWeekId).toBe('20260810-20260816');
  });
});

function makeTask(partial: Partial<Task> & { id: number; title: string }): Task {
  return {
    weekId: '20260803-20260809',
    parentId: null,
    description: '',
    status: 'in_progress',
    priority: 2,
    sortIndex: 0,
    createdAt: '',
    updatedAt: '',
    executionMode: 'self',
    ownerId: null,
    ownerName: null,
    tags: [],
    ...partial,
  };
}

describe('flattenTasks', () => {
  it('returns tasks in parent-then-children display order', () => {
    const tasks = [
      makeTask({ id: 1, title: 'root', parentId: null, sortIndex: 0 }),
      makeTask({ id: 2, title: 'child', parentId: 1, sortIndex: 0 }),
      makeTask({ id: 3, title: 'root2', parentId: null, sortIndex: 1 }),
    ];
    expect(flattenTasks(tasks).map((task) => task.id)).toEqual([1, 2, 3]);
  });
});

describe('taskDepth', () => {
  it('counts ancestor levels', () => {
    const tasks = [
      makeTask({ id: 1, title: 'a', parentId: null }),
      makeTask({ id: 2, title: 'b', parentId: 1 }),
      makeTask({ id: 3, title: 'c', parentId: 2 }),
    ];
    expect(taskDepth(tasks, 1)).toBe(0);
    expect(taskDepth(tasks, 2)).toBe(1);
    expect(taskDepth(tasks, 3)).toBe(2);
  });
});

describe('activeLeaves', () => {
  it('includes open tasks without open children and excludes closed and parented-open', () => {
    const tasks = [
      makeTask({ id: 1, title: 'open root', parentId: null }),
      makeTask({ id: 2, title: 'open child', parentId: 1 }),
      makeTask({ id: 3, title: 'closed leaf', parentId: null, status: 'closed' }),
    ];
    const leaves = activeLeaves(tasks).map((task) => task.id);
    // Task 1 has an open child (2), so it is not an active leaf; 2 is.
    expect(leaves).toEqual([2]);
  });
});
