import type { Task } from '../../shared/contracts/types';
import { sortedChildren } from '../../utils/tree';
import { formatCnRange } from '../../utils/weekFormat';

/** 分享图中一行的扁平化数据，模板组件据此渲染。 */
export interface ShareTaskRow {
  id: number;
  title: string;
  description: string;
  closed: boolean;
  priority: number;
  executionMode: Task['executionMode'];
  ownerName?: string | null;
  assignerName?: string | null;
  tags: string[];
  /** Whether the source task has any child task, regardless of share selection or status. */
  hasChildren: boolean;
  /** 树内层级（0 = 分组根任务）。 */
  depth: number;
  /** 所属分组（根任务）标题。 */
  groupTitle: string;
  /** 分组轨道色；未配置时为 undefined。 */
  groupColor?: string;
}

export interface ShareData {
  rows: ShareTaskRow[];
  /** 分享集合中的叶子任务总数（父任务不计入统计）。 */
  totalTasks: number;
  /** 叶子任务中的已完成数。 */
  doneTasks: number;
  /** 叶子任务完成率（0-100 整数）。 */
  doneRatio: number;
  /** 分享集合覆盖的分组轨道数。 */
  groupCount: number;
  weekId: string;
  /** 中文周范围，如 `8月10日 – 8月16日`。 */
  weekRangeCn: string;
}

function collectOpenSubtree(tasks: Task[], rootId: number, target: Set<number>): void {
  for (const child of sortedChildren(tasks, rootId)) {
    if (child.status === 'in_progress') {
      target.add(child.id);
      collectOpenSubtree(tasks, child.id, target);
    }
  }
}

/** 判断某子树（含 root 自身）下是否存在有效选中任务。 */
function subtreeHasEffective(tasks: Task[], rootId: number, effective: Set<number>): boolean {
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (effective.has(current)) {
      return true;
    }
    for (const child of sortedChildren(tasks, current)) {
      stack.push(child.id);
    }
  }
  return false;
}

/**
 * 把选中任务集合展开为分享图行数据。
 * - 选中父任务时自动包含其未关闭子树（已关闭子任务不自动带入）。
 * - includeCompleted=false 时，显式选中的已完成任务也会被过滤。
 * - 按分组轨道（根任务）聚合，轨道内按层级缩进排列。
 */
export function buildShareData(
  tasks: Task[],
  selectedIds: Set<number>,
  includeCompleted: boolean,
  colorMap: Map<string, string>,
  weekId: string,
): ShareData {
  // 非叶子任务的执行方式与负责人在整个产品内均不展示。该集合不受筛选或状态影响。
  const parentTaskIds = new Set(
    tasks.flatMap((task) => task.parentId === null ? [] : [task.parentId]),
  );

  // 1. 有效选中集合：过滤 includeCompleted=false 时的已完成任务。
  const effective = new Set<number>();
  for (const id of selectedIds) {
    const task = tasks.find((item) => item.id === id);
    if (!task) {
      continue;
    }
    if (!includeCompleted && task.status === 'closed') {
      continue;
    }
    effective.add(id);
  }

  // 2. 自动扩展：选中任务的未关闭子树一并加入。
  for (const id of [...effective]) {
    if (tasks.find((item) => item.id === id)?.status === 'in_progress') {
      collectOpenSubtree(tasks, id, effective);
    }
  }

  // 3. 按分组轨道聚合，输出有序扁平行（根轨道有任一有效任务即纳入）。
  const rows: ShareTaskRow[] = [];
  const groupTitles = new Set<string>();

  for (const root of sortedChildren(tasks, null)) {
    if (!subtreeHasEffective(tasks, root.id, effective)) {
      continue;
    }
    groupTitles.add(root.title);
    const groupColor = colorMap.get(root.title);
    const rowsBefore = rows.length;

    const walk = (parentId: number | null, depth: number) => {
      for (const task of sortedChildren(tasks, parentId)) {
        const included = effective.has(task.id);
        // 中间祖先可能未被选中：只要子树下仍有有效任务就继续下钻，
        // 避免「只选深层叶子」时因祖先不在集合中而整支丢失。
        if (!included && !subtreeHasEffective(tasks, task.id, effective)) {
          continue;
        }
        if (included) {
          rows.push({
            id: task.id,
            title: task.title,
            description: task.description,
            closed: task.status === 'closed',
            priority: task.priority,
            executionMode: task.executionMode,
            ownerName: task.ownerName,
            assignerName: task.assignerName,
            tags: task.tags,
            hasChildren: parentTaskIds.has(task.id),
            depth,
            groupTitle: root.title,
            groupColor,
          });
        }
        walk(task.id, depth + 1);
      }
    };
    walk(root.id, 0);

    // 兜底：该轨道没有任何任务行，但根任务自身被选中
    // （例如选中了一个没有子任务的叶子根任务）——把根任务输出为唯一的一行。
    if (rows.length === rowsBefore && effective.has(root.id)) {
      rows.push({
        id: root.id,
        title: root.title,
        description: root.description,
        closed: root.status === 'closed',
        priority: root.priority,
        executionMode: root.executionMode,
        ownerName: root.ownerName,
        assignerName: root.assignerName,
        tags: root.tags,
        hasChildren: parentTaskIds.has(root.id),
        depth: 0,
        groupTitle: root.title,
        groupColor,
      });
    }
  }

  // 统计口径：任务总数与完成率只计算叶子节点（无子任务的行），
  // 与任务树中「非叶子任务不展示执行方式/负责人」的口径保持一致。
  const leafRows = rows.filter((row) => !row.hasChildren);
  const totalTasks = leafRows.length;
  const doneTasks = leafRows.filter((row) => row.closed).length;
  return {
    rows,
    totalTasks,
    doneTasks,
    doneRatio: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
    groupCount: groupTitles.size,
    weekId,
    weekRangeCn: formatCnRange(weekId),
  };
}
