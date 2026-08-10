// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../shared/contracts/types';
import { useAppStore } from '../store/appStore';
import { TaskDetailPanel } from './TaskDetailPanel';

const mockedNativeBridge = vi.hoisted(() => ({
  initializeApp: vi.fn(),
  recentWeeks: vi.fn(),
  listWeeks: vi.fn(),
  getWeekTree: vi.fn().mockResolvedValue({ week: null, tasks: [] }),
  listOwners: vi.fn().mockResolvedValue([]),
  listAssigners: vi.fn().mockResolvedValue([]),
  listTags: vi.fn().mockResolvedValue([]),
  listGroupColors: vi.fn().mockResolvedValue([]),
  createTask: vi.fn(),
  updateTask: vi.fn().mockResolvedValue(undefined),
  closeTask: vi.fn().mockResolvedValue(undefined),
  reopenTask: vi.fn().mockResolvedValue(undefined),
  moveTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  createWeek: vi.fn(),
  ensureGroupColor: vi.fn(),
  setGroupColor: vi.fn(),
  resetGroupColor: vi.fn(),
}));

vi.mock('../api/nativeBridge', () => mockedNativeBridge);

// antd 组件在 jsdom 下需要 matchMedia 才能挂载。
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

function makeTask(partial: Partial<Task> & { id: number; title: string }): Task {
  return {
    weekId: '20260803-20260809',
    parentId: null,
    description: '',
    status: 'in_progress',
    priority: 2,
    sortIndex: 0,
    createdAt: '2026-08-07T14:30:00.000',
    updatedAt: '2026-08-07T14:30:00.000',
    executionMode: 'self',
    ownerId: null,
    ownerName: null,
    tags: [],
    ...partial,
  };
}

describe('TaskDetailPanel 时间行', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 让 treeTasks 选择器返回稳定引用，避免 useSyncExternalStore 无限循环。
    useAppStore.setState({
      tree: {
        week: { id: '20260803-20260809', startDate: '', endDate: '', createdAt: '' },
        tasks: [],
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('未完成任务只显示创建时间', () => {
    render(
      <TaskDetailPanel
        task={makeTask({ id: 1, title: '写周报' })}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText('2026-08-07 14:30')).toBeTruthy();
    expect(screen.queryByText('完成')).toBeNull();
  });

  it('已完成任务同时显示创建时间与完成时间', () => {
    render(
      <TaskDetailPanel
        task={makeTask({
          id: 1,
          title: '写周报',
          status: 'closed',
          closedAt: '2026-08-09T18:05:00.000',
        })}
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText('创建')).toBeTruthy();
    expect(screen.getByText('2026-08-07 14:30')).toBeTruthy();
    expect(screen.getByText('完成')).toBeTruthy();
    expect(screen.getByText('2026-08-09 18:05')).toBeTruthy();
  });

  it('标记完成前先保存当前编辑内容', async () => {
    render(
      <TaskDetailPanel
        task={makeTask({ id: 1, title: '写周报' })}
        weekId="20260803-20260809"
        onClose={() => undefined}
      />,
    );

    const titleInput = screen.getByPlaceholderText('任务标题…');
    fireEvent.change(titleInput, { target: { value: '写周报（已改）' } });

    fireEvent.click(screen.getByRole('button', { name: '标记完成' }));

    await waitFor(() => {
      expect(mockedNativeBridge.updateTask).toHaveBeenCalledWith(
        expect.objectContaining({
          weekId: '20260803-20260809',
          taskId: 1,
          title: '写周报（已改）',
        }),
      );
      expect(mockedNativeBridge.closeTask).toHaveBeenCalledWith('20260803-20260809', 1);
    });
  });
});
