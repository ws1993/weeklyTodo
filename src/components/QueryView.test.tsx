// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { QueryTaskRow } from '../shared/contracts/types';
import { useAppStore } from '../store/appStore';
import { QueryView } from './QueryView';

const mockedNativeBridge = vi.hoisted(() => ({
  queryAllTasks: vi.fn(),
  queryGroupOptions: vi.fn(),
  weekSummaries: vi.fn(),
  getWeekTree: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  listWeeks: vi.fn(),
  recentWeeks: vi.fn(),
  listOwners: vi.fn(),
  listAssigners: vi.fn(),
  listTags: vi.fn(),
  listGroupColors: vi.fn(),
  closeTask: vi.fn(),
  reopenTask: vi.fn(),
  moveTask: vi.fn(),
  createTask: vi.fn(),
  createWeek: vi.fn(),
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

function makeRow(partial: Partial<QueryTaskRow>): QueryTaskRow {
  return {
    weekId: '20260803-20260809',
    weekLabel: '20260803-20260809',
    path: '项目A > 子任务',
    rootTitle: '项目A',
    hasChildren: false,
    task: {
      id: 1,
      weekId: '20260803-20260809',
      parentId: null,
      title: '准备周报',
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
    },
    ...partial,
  };
}

describe('QueryView 项目筛选 / 时间显示 / 行交互', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      allWeeks: [
        { id: '20260803-20260809', startDate: '', endDate: '', createdAt: '' },
      ],
      owners: [],
      assigners: [],
      tags: [],
      activeWeekId: '20260803-20260809',
      tree: {
        week: { id: '20260803-20260809', startDate: '', endDate: '', createdAt: '' },
        tasks: [],
      },
    });
    mockedNativeBridge.queryAllTasks.mockResolvedValue([
      makeRow({}),
      makeRow({
        task: {
          id: 2,
          weekId: '20260803-20260809',
          parentId: null,
          title: '已完成的备份',
          description: '',
          status: 'closed',
          priority: 1,
          sortIndex: 1,
          createdAt: '2026-08-03T09:00:00.000',
          updatedAt: '2026-08-05T18:00:00.000',
          closedAt: '2026-08-05T18:00:00.000',
          executionMode: 'self',
          ownerId: null,
          ownerName: null,
          tags: [],
        },
      }),
    ]);
    mockedNativeBridge.queryGroupOptions.mockResolvedValue(['项目A', '项目B']);
    mockedNativeBridge.weekSummaries.mockResolvedValue([['20260803-20260809', 2, 1]]);
    mockedNativeBridge.getWeekTree.mockResolvedValue({
      week: { id: '20260803-20260809', startDate: '', endDate: '', createdAt: '' },
      tasks: [],
    });
    mockedNativeBridge.listOwners.mockResolvedValue([]);
    mockedNativeBridge.listAssigners.mockResolvedValue([]);
    mockedNativeBridge.listTags.mockResolvedValue([]);
    mockedNativeBridge.listGroupColors.mockResolvedValue([]);
    mockedNativeBridge.listWeeks.mockResolvedValue([]);
    mockedNativeBridge.recentWeeks.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('加载时按当前周拉取项目选项并展示全部项目', async () => {
    render(<QueryView open onClose={() => undefined} />);

    await waitFor(() => {
      expect(mockedNativeBridge.queryGroupOptions).toHaveBeenCalled();
    });
    // 项目下拉触发器存在。
    expect(screen.getByText('项目')).toBeTruthy();
  });

  it('行内展示开始与完成时间（到天）', async () => {
    render(<QueryView open onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByTitle('开始 2026-08-07')).toBeTruthy();
    });
    // 已完成任务显示完成时间。
    expect(screen.getByTitle('开始 2026-08-03 · 完成 2026-08-05')).toBeTruthy();
    // 时间胶囊内可见日期（未完成只有开始日期）。
    expect(screen.getAllByText('2026-08-07').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2026-08-05').length).toBeGreaterThan(0);
  });

  it('双击行打开任务详情，并按行所在周加载上下文', async () => {
    render(<QueryView open onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('准备周报')).toBeTruthy();
    });

    fireEvent.doubleClick(screen.getByText('准备周报'));

    await waitFor(() => {
      expect(mockedNativeBridge.getWeekTree).toHaveBeenCalledWith('20260803-20260809');
      expect(screen.getByText('任务详情')).toBeTruthy();
    });
  });

  it('悬浮提供重命名 / 设置 / 删除操作，双击确认后删除', async () => {
    mockedNativeBridge.deleteTask.mockResolvedValue(undefined);
    render(<QueryView open onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('准备周报')).toBeTruthy();
    });

    // 三个悬浮操作按钮存在。
    expect(screen.getAllByLabelText('重命名').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('打开任务设置').length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText('删除任务').length).toBeGreaterThan(0);

    // 第一次点击进入确认态，第二次点击真正删除。
    fireEvent.click(screen.getAllByLabelText('删除任务')[0]);
    expect(mockedNativeBridge.deleteTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByLabelText('删除任务')[0]);

    await waitFor(() => {
      expect(mockedNativeBridge.deleteTask).toHaveBeenCalledWith('20260803-20260809', 1);
    });
  });

  it('点击标题直接复制任务文本到剪贴板并显示提示', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextSpy,
      },
    });

    render(<QueryView open onClose={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('准备周报')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('准备周报'));

    expect(writeTextSpy).toHaveBeenCalledWith('准备周报');
    await waitFor(() => {
      expect(screen.getByText('已复制')).toBeTruthy();
    });
  });
});
