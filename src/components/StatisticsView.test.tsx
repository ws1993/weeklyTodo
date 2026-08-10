// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatisticsOverview } from '../shared/contracts/types';
import { StatisticsView } from './StatisticsView';

const mockedNativeBridge = vi.hoisted(() => ({
  statisticsOverview: vi.fn(),
}));

vi.mock('../api/nativeBridge', () => mockedNativeBridge);

// 统计页会从 store 读取周列表来解析快捷时间范围，这里构造 13 个周，
// 让「近12周」与「近4周」解析出不同的起止范围以便验证重新请求。
const mockedStore = vi.hoisted(() => {
  const pad = (value: number) => String(value).padStart(2, '0');
  const ymd = (date: Date) =>
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const allWeeks = Array.from({ length: 13 }, (_, index) => {
    const monday = new Date(2026, 3, 6 + index * 7);
    const end = new Date(monday);
    end.setDate(monday.getDate() + 6);
    return {
      id: `${ymd(monday)}-${ymd(end)}`,
      startDate: ymd(monday),
      endDate: ymd(end),
      createdAt: '',
    };
  });
  return { allWeeks };
});

vi.mock('../store/appStore', () => ({
  useAppStore: (selector: (state: typeof mockedStore) => unknown) => selector(mockedStore),
}));

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
  carriedOpen: 1,
  byPriority: [
    { priority: 0, count: 2, done: 1 },
    { priority: 2, count: 7, done: 4 },
  ],
  byTag: [{ name: '工作', count: 3 }],
  byOwner: [
    { name: '小明', count: 2 },
    { name: '', count: 7 },
  ],
  byAssigner: [
    { name: '李四', count: 1 },
    { name: '', count: 8 },
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

    // 周趋势柱状图：按每周周一展示中文日期。
    expect(screen.getByText('8月10日')).toBeTruthy();
    expect(screen.getByText('8月3日')).toBeTruthy();
  });

  it('渲染复盘问题卡（拖期 / P0 积压）', async () => {
    render(<StatisticsView open onClose={vi.fn()} />);

    await screen.findByText('周完成率趋势');
    expect(screen.getByText('拖期未完成')).toBeTruthy();
    expect(screen.getByText('拖期率')).toBeTruthy();
    expect(screen.getByText('P0 未关闭')).toBeTruthy();
    // 范围内进行中 4 项、拖期 1 项 → 拖期率 25%。
    expect(screen.getByText('25%')).toBeTruthy();
    // P0：count 2 / done 1 → 未关闭 1。
    expect(screen.getByText('P0 未关闭').nextElementSibling?.textContent).toContain('1');
  });

  it('切换时间范围会重新请求统计', async () => {
    render(<StatisticsView open onClose={vi.fn()} />);
    await screen.findByText('时间范围');

    fireEvent.click(screen.getByRole('radio', { name: '近4周' }));
    expect(mockedNativeBridge.statisticsOverview).toHaveBeenCalledTimes(2);
  });

  it('渲染优先级 / 标签 / 负责人 / 分派人分布', async () => {
    render(<StatisticsView open onClose={vi.fn()} />);

    await screen.findByText('按优先级');
    expect(screen.getByText('P0')).toBeTruthy();
    expect(screen.getByText('P2')).toBeTruthy();
    expect(screen.getByText('按标签')).toBeTruthy();
    expect(screen.getByText('工作')).toBeTruthy();
    expect(screen.getByText('按负责人')).toBeTruthy();
    expect(screen.getByText('小明')).toBeTruthy();
    expect(screen.getByText('按分派人')).toBeTruthy();
    expect(screen.getByText('李四')).toBeTruthy();
    expect(screen.getAllByText('未指定').length).toBeGreaterThanOrEqual(1);
  });

  it('无数据时展示空状态', async () => {
    mockedNativeBridge.statisticsOverview.mockResolvedValue({
      weeks: [],
      totalTasks: 0,
      totalDone: 0,
      totalOpen: 0,
      totalCarried: 0,
      carriedOpen: 0,
      byPriority: [],
      byTag: [],
      byOwner: [],
      byAssigner: [],
    });
    render(<StatisticsView open onClose={vi.fn()} />);

    // store 中已有周但该时间段内没有任务，展示空范围提示。
    expect(await screen.findByText('该时间段暂无数据')).toBeTruthy();
  });
});
