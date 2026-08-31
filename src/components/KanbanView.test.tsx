// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../shared/contracts/types';
import { KanbanView } from './KanbanView';

const mockedNativeBridge = vi.hoisted(() => ({
  closeTask: vi.fn(),
  reopenTask: vi.fn(),
  getWeekTree: vi.fn(),
}));

vi.mock('../api/nativeBridge', () => mockedNativeBridge);

function makeTask(partial: Partial<Task> & { id: number; title: string }): Task {
  return {
    weekId: '20260831-20260906',
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

describe('KanbanView', () => {
  afterEach(() => {
    cleanup();
  });

  it('categorizes tasks correctly into P0/P1, todo, following, and closed columns', () => {
    const p0Task = makeTask({ id: 1, title: '紧急修复', priority: 0 });
    const todoTask = makeTask({ id: 2, title: '日常待办', priority: 2 });
    const followTask = makeTask({ id: 3, title: '跟进联调', executionMode: 'follow_up' });
    const closedTask = makeTask({ id: 4, title: '已归档任务', status: 'closed' });

    render(
      <KanbanView
        tasks={[p0Task, todoTask, followTask, closedTask]}
        onSelectTask={vi.fn()}
      />,
    );

    expect(screen.getByText('紧急修复')).toBeTruthy();
    expect(screen.getByText('日常待办')).toBeTruthy();
    expect(screen.getByText('跟进联调')).toBeTruthy();
    expect(screen.getByText('已归档任务')).toBeTruthy();
  });

  it('triggers onSelectTask callback when clicking a kanban card', () => {
    const task = makeTask({ id: 10, title: '点击卡片测试' });
    const onSelectTask = vi.fn();
    render(<KanbanView tasks={[task]} onSelectTask={onSelectTask} />);

    fireEvent.click(screen.getByText('点击卡片测试'));
    expect(onSelectTask).toHaveBeenCalledWith(task);
  });
});
