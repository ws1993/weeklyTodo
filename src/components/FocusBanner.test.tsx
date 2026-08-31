// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../shared/contracts/types';
import { useAppStore } from '../store/appStore';
import { FocusBanner } from './FocusBanner';

const mockedNativeBridge = vi.hoisted(() => ({
  closeTask: vi.fn(),
  reopenTask: vi.fn(),
  getWeekTree: vi.fn(),
}));

vi.mock('../api/nativeBridge', () => mockedNativeBridge);

function makeTask(partial: Partial<Task> = {}): Task {
  return {
    id: 101,
    weekId: '20260831-20260906',
    parentId: null,
    title: '架构重构核心任务',
    description: '',
    status: 'in_progress',
    priority: 0,
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

describe('FocusBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      activeWeekId: '20260831-20260906',
      tree: {
        week: { id: '20260831-20260906', startDate: '', endDate: '', createdAt: '' },
        tasks: [],
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when task is null', () => {
    const { container } = render(<FocusBanner task={null} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders task title and default 25:00 timer when task is provided', () => {
    const task = makeTask({ title: '沉浸专注测试任务' });
    render(<FocusBanner task={task} onClose={vi.fn()} />);

    expect(screen.getByText('沉浸专注测试任务')).toBeTruthy();
    expect(screen.getByText('25:00')).toBeTruthy();
  });

  it('calls toggleTask and onClose when clicking 完成专注', async () => {
    const task = makeTask({ id: 88, status: 'in_progress' });
    const onClose = vi.fn();
    render(<FocusBanner task={task} onClose={onClose} />);

    const finishBtn = screen.getByText('完成专注');
    fireEvent.click(finishBtn);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
      expect(mockedNativeBridge.closeTask).toHaveBeenCalledWith('20260831-20260906', 88);
    });
  });
});
