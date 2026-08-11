import { describe, expect, it } from 'vitest';
import type { Task } from '../../shared/contracts/types';
import { buildShareData } from './shareData';

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
    assignerId: null,
    assignerName: null,
    tags: [],
    ...partial,
  };
}

function buildForest(): Task[] {
  return [
    makeTask({ id: 1, title: '根A', parentId: null, sortIndex: 0 }),
    makeTask({ id: 2, title: '子A1', parentId: 1, sortIndex: 0 }),
    makeTask({ id: 3, title: '孙A1', parentId: 2, sortIndex: 0 }),
    makeTask({ id: 4, title: '根B', parentId: null, sortIndex: 1 }),
    makeTask({ id: 5, title: '子B1', parentId: 4, sortIndex: 0 }),
  ];
}

describe('buildShareData', () => {
  it('只选一个深层叶子时仍然输出该任务（回归：祖先不在选中集时整支丢失）', () => {
    const data = buildShareData(
      buildForest(),
      new Set([3]),
      true,
      new Map(),
      WEEK_ID,
    );
    expect(data.rows.map((row) => row.id)).toEqual([3]);
    expect(data.rows[0].title).toBe('孙A1');
    expect(data.rows[0].depth).toBe(1);
    expect(data.rows[0].groupTitle).toBe('根A');
    expect(data.totalTasks).toBe(1);
    expect(data.groupCount).toBe(1);
  });

  it('只选一个直接子叶子（无子任务）时正常输出', () => {
    const tasks = buildForest();
    const leafChild = makeTask({ id: 9, title: '子A2', parentId: 1, sortIndex: 1 });
    const data = buildShareData(
      [...tasks, leafChild],
      new Set([9]),
      true,
      new Map(),
      WEEK_ID,
    );
    expect(data.rows.map((row) => row.id)).toEqual([9]);
    expect(data.rows[0].depth).toBe(0);
  });

  it('选中根任务时自动带上未关闭子树（根任务本身作为轨道头，不入行）', () => {
    const data = buildShareData(
      buildForest(),
      new Set([1]),
      true,
      new Map(),
      WEEK_ID,
    );
    expect(data.rows.map((row) => row.id)).toEqual([2, 3]);
    expect(data.rows.map((row) => row.depth)).toEqual([0, 1]);
  });

  it('为非叶子任务标记真实子任务，用于隐藏执行方式和负责人', () => {
    const tasks = buildForest().map((task) => (
      task.id === 2
        ? makeTask({
          ...task,
          executionMode: 'follow_up',
          ownerName: '成侃小',
          assignerName: '大仓水务-王韵婕',
        })
        : task
    ));
    const data = buildShareData(tasks, new Set([1]), true, new Map(), WEEK_ID);

    expect(data.rows.find((row) => row.id === 2)).toMatchObject({
      hasChildren: true,
      executionMode: 'follow_up',
      ownerName: '成侃小',
      assignerName: '大仓水务-王韵婕',
    });
    expect(data.rows.find((row) => row.id === 3)).toMatchObject({ hasChildren: false });
  });

  it('只选一个无子任务的叶子根任务时，兜底输出该根任务为一行', () => {
    const tasks = buildForest();
    const leafRoot = makeTask({ id: 8, title: '叶子根', parentId: null, sortIndex: 2 });
    const data = buildShareData(
      [...tasks, leafRoot],
      new Set([8]),
      true,
      new Map(),
      WEEK_ID,
    );
    expect(data.rows.map((row) => row.id)).toEqual([8]);
    expect(data.rows[0].depth).toBe(0);
    expect(data.totalTasks).toBe(1);
  });

  it('多轨道各选一个任务时按根轨道聚合', () => {
    const data = buildShareData(
      buildForest(),
      new Set([3, 5]),
      true,
      new Map(),
      WEEK_ID,
    );
    expect(data.rows.map((row) => row.id)).toEqual([3, 5]);
    expect(data.rows.map((row) => row.groupTitle)).toEqual(['根A', '根B']);
    expect(data.groupCount).toBe(2);
  });

  it('includeCompleted=false 时过滤显式选中的已完成任务', () => {
    const tasks = buildForest();
    const closedLeaf = makeTask({ id: 6, title: '已完成孙', parentId: 2, status: 'closed' });
    const data = buildShareData(
      [...tasks, closedLeaf],
      new Set([3, 6]),
      false,
      new Map(),
      WEEK_ID,
    );
    expect(data.rows.map((row) => row.id)).toEqual([3]);
  });

  it('已完成任务计入完成数与完成率（含兜底输出的已完成根任务）', () => {
    const tasks = buildForest();
    const closedRoot = makeTask({ id: 7, title: '根C', parentId: null, status: 'closed' });
    const data = buildShareData(
      [...tasks, closedRoot],
      new Set([1, 7]),
      true,
      new Map(),
      WEEK_ID,
    );
    expect(data.rows.map((row) => row.id)).toEqual([2, 3, 7]);
    expect(data.doneTasks).toBe(1);
    expect(data.totalTasks).toBe(3);
    expect(data.doneRatio).toBe(33);
  });
});
