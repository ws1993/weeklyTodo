// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../shared/contracts/types';
import { useAppStore } from '../store/appStore';
import { CurrentActions } from './CurrentActions';

const mockedNativeBridge = vi.hoisted(() => ({
  initializeApp: vi.fn(),
  recentWeeks: vi.fn(),
  listWeeks: vi.fn(),
  getWeekTree: vi.fn(),
  listOwners: vi.fn(),
  listTags: vi.fn(),
  listGroupColors: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  closeTask: vi.fn(),
  reopenTask: vi.fn(),
  moveTask: vi.fn(),
  deleteTask: vi.fn(),
  createWeek: vi.fn(),
  ensureGroupColor: vi.fn(),
  setGroupColor: vi.fn(),
  resetGroupColor: vi.fn(),
}));

vi.mock('../api/nativeBridge', () => mockedNativeBridge);

const WEEK_ID = '20260803-20260809';

function makeTask(partial: Partial<Task> & { id: number; title: string }): Task {
  return {
    weekId: WEEK_ID,
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

function setStoreTree(tasks: Task[]) {
  useAppStore.setState({
    activeWeekId: WEEK_ID,
    tree: {
      week: { id: WEEK_ID, startDate: '2026-08-03', endDate: '2026-08-09', createdAt: '' },
      tasks,
    },
  });
}

describe('CurrentActions 完成淡出微动效', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockedNativeBridge.getWeekTree.mockResolvedValue({
      week: { id: WEEK_ID, startDate: '2026-08-03', endDate: '2026-08-09', createdAt: '' },
      tasks: [],
    });
    mockedNativeBridge.closeTask.mockResolvedValue(undefined);
    mockedNativeBridge.ensureGroupColor.mockResolvedValue({
      name: '写周报',
      color: '#1557D0',
      isManual: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('点击「完成」先播放淡出动画，动画结束后才真正关闭任务', async () => {
    const task = makeTask({ id: 1, title: '写周报' });
    setStoreTree([task]);
    const { container } = render(<CurrentActions tasks={[task]} onLocate={vi.fn()} />);

    const card = container.querySelector('.leaf-card') as Element;
    expect(card.classList.contains('leaving')).toBe(false);

    fireEvent.click(screen.getByText('完成'));

    // 淡出期间：卡片带 leaving 状态，尚未调用关闭命令。
    expect(card.classList.contains('leaving')).toBe(true);
    expect(mockedNativeBridge.closeTask).not.toHaveBeenCalled();

    // 动画播完后才真正关闭。
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(mockedNativeBridge.closeTask).toHaveBeenCalledWith(WEEK_ID, 1);
  });

  it('动画期间切换到其他周则不误关任务', async () => {
    const task = makeTask({ id: 1, title: '写周报' });
    setStoreTree([task]);
    render(<CurrentActions tasks={[task]} onLocate={vi.fn()} />);

    fireEvent.click(screen.getByText('完成'));
    // 模拟用户在淡出动画期间切到了另一周。
    useAppStore.setState({ activeWeekId: '20260810-20260816' });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    expect(mockedNativeBridge.closeTask).not.toHaveBeenCalled();
  });
});
