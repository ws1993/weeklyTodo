import type { ExecutionMode } from '../shared/contracts/types';

export interface ParsedQuickTask {
  title: string;
  priority?: number;
  executionMode?: ExecutionMode;
  ownerName?: string;
  assignerName?: string;
  tagNames?: string[];
}

/**
 * 解析任务树行内快速创建语法：
 * - `!p0` ~ `!p3`（或全角 `！p0`）：设置优先级 P0~P3
 * - `@负责人`：设置为「需要跟进」并指定负责人
 * - `←分派人` 或 `<-分派人`：设置分派人
 * - `#标签`：添加标签（可多个）
 *
 * 若输入不包含任何快捷语法标记，则仅返回清理首尾空格后的 `title`，其余字段均为 `undefined`。
 */
export function parseQuickTaskInput(rawInput: string): ParsedQuickTask {
  let working = rawInput.trim();
  if (!working) {
    return { title: '' };
  }

  let priority: number | undefined;
  let ownerName: string | undefined;
  let assignerName: string | undefined;
  const tagNames: string[] = [];

  // 1. 解析优先级 !p0 ~ !p3 或 ！p0 ~ ！p3（独立词边界或空白分隔）
  working = working.replace(/(?:^|\s)[!！]p([0-3])(?=\s|$)/gi, (_match, pDigit: string) => {
    priority = Number(pDigit);
    return ' ';
  });

  // 2. 解析跟进负责人 @姓名
  working = working.replace(/(?:^|\s)@([^\s#@!！←]+)(?=\s|$)/g, (_match, owner: string) => {
    ownerName = owner.trim();
    return ' ';
  });

  // 3. 解析分派人 ←姓名 或 <-姓名
  working = working.replace(/(?:^|\s)(?:←|<-)([^\s#@!！←]+)(?=\s|$)/g, (_match, assigner: string) => {
    assignerName = assigner.trim();
    return ' ';
  });

  // 4. 解析标签 #标签名
  working = working.replace(/(?:^|\s)#([^\s#@!！←]+)(?=\s|$)/g, (_match, tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tagNames.includes(trimmed)) {
      tagNames.push(trimmed);
    }
    return ' ';
  });

  const cleanedTitle = working.replace(/\s+/g, ' ').trim();
  const finalTitle = cleanedTitle || rawInput.trim();

  const result: ParsedQuickTask = { title: finalTitle };
  if (priority !== undefined) {
    result.priority = priority;
  }
  if (ownerName) {
    result.executionMode = 'follow_up';
    result.ownerName = ownerName;
  }
  if (assignerName) {
    result.assignerName = assignerName;
  }
  if (tagNames.length > 0) {
    result.tagNames = tagNames;
  }
  return result;
}

