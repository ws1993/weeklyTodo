// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../shared/contracts/types';
import { useAppStore } from '../store/appStore';
import { TaskTree } from './TaskTree';

const mockedNativeBridge = vi.hoisted(() => ({
  initializeApp: vi.fn(),
  recentWeeks: vi.fn(),
  listWeeks: vi.fn(),
  getWeekTree: vi.fn(),
  listOwners: vi.fn(),
  listAssigners: vi.fn(),
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
    createdAt: '',
    updatedAt: '',
    executionMode: 'self',
    ownerId: null,
    ownerName: null,
    tags: [],
    ...partial,
  };
}

describe('TaskTree 徽章区双击打开详情', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 让 TaskDetailPanel 的 treeTasks 选择器返回稳定引用，避免 useSyncExternalStore 无限循环。
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

  it('双击优先级/标签区域打开任务详情面板', () => {
    const task = makeTask({ id: 1, title: '写周报', tags: ['工作'] });
    const { container } = render(<TaskTree tasks={[task]} />);

    const meta = container.querySelector('.node-meta');
    expect(meta).not.toBeNull();
    expect(container.querySelector('.modal.task-detail')).toBeNull();

    fireEvent.doubleClick(meta as Element);

    expect(container.querySelector('.modal.task-detail')).not.toBeNull();
    expect(screen.getByText('任务详情')).toBeTruthy();
  });

  it('双击徽章区不会折叠子树', () => {
    const parent = makeTask({ id: 1, title: '父任务' });
    const child = makeTask({ id: 2, title: '子任务', parentId: 1 });
    const { container } = render(<TaskTree tasks={[parent, child]} />);

    expect(screen.getByText('子任务')).toBeTruthy();

    const meta = container.querySelector('.node-meta') as Element;
    fireEvent.doubleClick(meta);

    // 子任务仍然可见，说明双击未触发行单击的折叠/展开。
    expect(screen.getByText('子任务')).toBeTruthy();
    expect(container.querySelector('.modal.task-detail')).not.toBeNull();
  });

  it('单击徽章区不参与行的折叠/展开', () => {
    const parent = makeTask({ id: 1, title: '父任务' });
    const child = makeTask({ id: 2, title: '子任务', parentId: 1 });
    const { container } = render(<TaskTree tasks={[parent, child]} />);

    expect(screen.getByText('子任务')).toBeTruthy();

    const meta = container.querySelector('.node-meta') as Element;
    fireEvent.click(meta);

    // 单击徽章区不应折叠子树，也不应打开详情。
    expect(screen.getByText('子任务')).toBeTruthy();
    expect(container.querySelector('.modal.task-detail')).toBeNull();
  });
});

describe('TaskTree 合并徽章（跟进 / 分派）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('叶子任务同时显示「分派·X」与「跟进·X」整体徽章，分派在前', () => {
    const task = makeTask({
      id: 1,
      title: '写周报',
      executionMode: 'follow_up',
      ownerName: '张三',
      assignerName: '李四',
    });
    render(<TaskTree tasks={[task]} />);

    const meta = screen.getByTitle('双击打开任务详情');
    const badges = Array.from(meta.querySelectorAll('.tag')).map((node) => node.textContent);
    expect(badges).toContain('分派·李四');
    expect(badges).toContain('跟进·张三');
    // 分派徽章应排在跟进徽章之前。
    expect(badges.indexOf('分派·李四')).toBeLessThan(badges.indexOf('跟进·张三'));
    // 不再渲染拆分的小 tag。
    expect(meta.querySelector('.tag-owner')).toBeNull();
    expect(meta.querySelector('.tag-follow')).toBeNull();
  });

  it('自己执行且未分派的叶子任务不显示合并徽章', () => {
    const task = makeTask({ id: 1, title: '普通任务' });
    render(<TaskTree tasks={[task]} />);

    expect(screen.queryByText(/分派·/)).toBeNull();
    expect(screen.queryByText(/跟进·/)).toBeNull();
  });

  it('非叶子任务不显示跟进 / 分派徽章', () => {
    const parent = makeTask({
      id: 1,
      title: '父任务',
      executionMode: 'follow_up',
      ownerName: '张三',
      assignerName: '李四',
    });
    const child = makeTask({ id: 2, title: '子任务', parentId: 1 });
    const { container } = render(<TaskTree tasks={[parent, child]} />);

    const meta = container.querySelectorAll('.node-meta')[0];
    expect(meta.querySelector('.tag-assign-combo')).toBeNull();
    expect(meta.querySelector('.tag-follow-combo')).toBeNull();
  });
});

describe('TaskTree 已关闭任务仍可添加子任务', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('父任务与其全部子任务都已关闭时，父任务行仍显示添加子任务按钮', () => {
    const parent = makeTask({ id: 1, title: '父任务', status: 'closed' });
    const child = makeTask({ id: 2, title: '子任务', parentId: 1, status: 'closed' });
    const { container } = render(<TaskTree tasks={[parent, child]} />);

    const parentRow = container.querySelector('[data-node="1"] .tree-row') as Element;
    expect(parentRow.classList.contains('closed')).toBe(true);
    const addBtn = parentRow.querySelector('.task-actions .add-btn');
    expect(addBtn).not.toBeNull();
  });

  it('点击已关闭任务的添加按钮后，提交的子任务仍挂在原父任务下', async () => {
    mockedNativeBridge.createTask.mockResolvedValue(
      makeTask({ id: 3, title: '新的子任务', parentId: 1 }),
    );
    mockedNativeBridge.getWeekTree.mockResolvedValue({
      week: { id: '20260803-20260809', startDate: '', endDate: '', createdAt: '' },
      tasks: [],
    });
    mockedNativeBridge.listOwners.mockResolvedValue([]);
    mockedNativeBridge.listTags.mockResolvedValue([]);
    mockedNativeBridge.listGroupColors.mockResolvedValue([]);

    const parent = makeTask({ id: 1, title: '父任务', status: 'closed' });
    const { container } = render(<TaskTree tasks={[parent]} />);

    fireEvent.click(container.querySelector('[data-node="1"] .task-actions .add-btn') as Element);

    const input = container.querySelector('[data-node="1"] .add-inline input') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: '新的子任务' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(mockedNativeBridge.createTask).toHaveBeenCalledTimes(1));
    expect(mockedNativeBridge.createTask.mock.calls[0][0]).toMatchObject({
      title: '新的子任务',
      parentId: 1,
    });
  });
});
