// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';

const mockedNativeBridge = vi.hoisted(() => ({
  queryAllTasks: vi.fn().mockResolvedValue([]),
  selectWeek: vi.fn(),
  getWeekTree: vi.fn(),
}));

vi.mock('../api/nativeBridge', () => mockedNativeBridge);

describe('CommandPalette', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders nothing when open is false', () => {
    const { container } = render(
      <CommandPalette
        open={false}
        onClose={vi.fn()}
        onOpenStats={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenCreateWeek={vi.fn()}
        onNewTask={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders default system commands when open is true', () => {
    render(
      <CommandPalette
        open={true}
        onClose={vi.fn()}
        onOpenStats={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenCreateWeek={vi.fn()}
        onNewTask={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText(/搜索跨周任务/)).toBeTruthy();
    expect(screen.getByText('新建任务')).toBeTruthy();
    expect(screen.getByText('打开全周期统计复盘')).toBeTruthy();
  });

  it('triggers onNewTask when clicking 新建任务 command', () => {
    const onNewTask = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandPalette
        open={true}
        onClose={onClose}
        onOpenStats={vi.fn()}
        onOpenSettings={vi.fn()}
        onOpenCreateWeek={vi.fn()}
        onNewTask={onNewTask}
      />,
    );

    fireEvent.click(screen.getByText('新建任务'));
    expect(onClose).toHaveBeenCalled();
    expect(onNewTask).toHaveBeenCalled();
  });
});
