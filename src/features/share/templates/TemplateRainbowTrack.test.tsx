// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { ShareData, ShareTaskRow } from '../shareData';
import { createDefaultShareSettings } from '../shareSettings';
import { TemplateRainbowTrack } from './TemplateRainbowTrack';

function makeRow(partial: Partial<ShareTaskRow>): ShareTaskRow {
  return {
    id: 1,
    title: '任务',
    description: '',
    closed: false,
    priority: 2,
    executionMode: 'self',
    ownerName: null,
    assignerName: null,
    tags: [],
    hasChildren: false,
    depth: 0,
    groupTitle: '工作',
    ...partial,
  };
}

function makeData(rows: ShareTaskRow[]): ShareData {
  return {
    rows,
    totalTasks: rows.length,
    doneTasks: 0,
    doneRatio: 0,
    groupCount: 1,
    weekId: '20260803-20260809',
    weekRangeCn: '8月3日 – 8月9日',
  };
}

afterEach(cleanup);

describe('TemplateRainbowTrack', () => {
  it('renders follow-up owners joined by 、 in the header title, deduplicated', () => {
    const rows = [
      makeRow({ id: 1, executionMode: 'follow_up', ownerName: '王丽晴' }),
      makeRow({ id: 2, executionMode: 'follow_up', ownerName: '李明' }),
      makeRow({ id: 3, executionMode: 'follow_up', ownerName: '王丽晴' }),
    ];
    render(
      <TemplateRainbowTrack data={makeData(rows)} settings={createDefaultShareSettings()} />,
    );

    expect(screen.getByText('「王丽晴、李明的任务」')).toBeTruthy();
  });

  it('falls back to 「周计划」 when no task has a follow-up owner', () => {
    render(
      <TemplateRainbowTrack
        data={makeData([makeRow({ executionMode: 'self' })])}
        settings={createDefaultShareSettings()}
      />,
    );

    expect(screen.getByText('「周计划」')).toBeTruthy();
  });

  it('does not render assigner or follow-up badges in rows', () => {
    render(
      <TemplateRainbowTrack
        data={makeData([
          makeRow({ executionMode: 'follow_up', ownerName: '王丽晴', assignerName: '张三' }),
        ])}
        settings={createDefaultShareSettings()}
      />,
    );

    expect(screen.queryByText(/分派·/)).toBeNull();
    expect(screen.queryByText(/跟进·/)).toBeNull();
  });

  it('keeps the 自己 badge for self-executed tasks', () => {
    render(
      <TemplateRainbowTrack
        data={makeData([makeRow({ executionMode: 'self' })])}
        settings={createDefaultShareSettings()}
      />,
    );

    expect(screen.getByText('自己')).toBeTruthy();
  });
});
