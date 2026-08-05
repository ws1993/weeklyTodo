// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatisticsOverview } from '../shared/contracts/types';
import { StatisticsView } from './StatisticsView';

const mockedNativeBridge = vi.hoisted(() => ({
  statisticsOverview: vi.fn(),
}));

vi.mock('../api/nativeBridge', () => mockedNativeBridge);

const sampleData: StatisticsOverview = {
  weeks: [
    {
      weekId: '20260810-20260816',
      total: 4,
      done: 3,
      open: 1,
      carried: 2,
      carriedDone: 2,
    },
    {
      weekId: '20260803-20260809',
      total: 5,
      done: 2,
      open: 3,
      carried: 0,
      carriedDone: 0,
    },
  ],
  totalTasks: 9,
  totalDone: 5,
  totalOpen: 4,
  totalCarried: 2,
  byPriority: [
    { priority: 0, count: 2, done: 1 },
    { priority: 2, count: 7, done: 4 },
  ],
  byTag: [{ name: '工作', count: 3 }],
  byOwner: [
    { name: '小明', count: 2 },
    { name: '', count: 7 },
  ],
};

describe('StatisticsView 统计 / 复盘', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedNativeBridge.statisticsOverview.mockResolvedValue(sampleData);
  });

  afterEach(() => {
    cleanup();
  });

  it('关闭时不渲染', () => {
    const { container } = render(<StatisticsView open={false} onClose={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('渲染总览数字与周趋势', async () => {
    const { container } = render(<StatisticsView open onClose={vi.fn()} />);

    expect(await screen.findByText('统计 / 复盘')).toBeTruthy();
    expect(screen.getByText('累计任务')).toBeTruthy();
    const values = Array.from(
      container.querySelectorAll('.stats-stat-value'),
    ).map((node) => node.textContent);
    expect(values).toEqual(['9', '5', '4', '2']);

    // 周趋势行。
    expect(screen.getByText('20260810-20260816')).toBeTruthy();
    expect(screen.getByText('20260803-20260809')).toBeTruthy();
    expect(screen.getAllByText('带入 2').length).toBeGreaterThan(0);
  });

  it('渲染优先级 / 标签 / 负责人分布', async () => {
    render(<StatisticsView open onClose={vi.fn()} />);

    await screen.findByText('按优先级');
    expect(screen.getByText('P0')).toBeTruthy();
    expect(screen.getByText('P2')).toBeTruthy();
    expect(screen.getByText('按标签')).toBeTruthy();
    expect(screen.getByText('工作')).toBeTruthy();
    expect(screen.getByText('按负责人')).toBeTruthy();
    expect(screen.getByText('小明')).toBeTruthy();
    expect(screen.getByText('未指定')).toBeTruthy();
  });

  it('无数据时展示空状态', async () => {
    mockedNativeBridge.statisticsOverview.mockResolvedValue({
      weeks: [],
      totalTasks: 0,
      totalDone: 0,
      totalOpen: 0,
      totalCarried: 0,
      byPriority: [],
      byTag: [],
      byOwner: [],
    });
    render(<StatisticsView open onClose={vi.fn()} />);

    expect(await screen.findByText('暂无统计数据')).toBeTruthy();
  });
});
