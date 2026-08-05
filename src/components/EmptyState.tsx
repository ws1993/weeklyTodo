import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** 空状态插图（使用 ForestIcons 图标）。 */
  icon: ReactNode;
  title: string;
  /** 补充说明文案：告诉用户当前状态与下一步可以做什么。 */
  sub?: string;
  /** 可选操作区（如「新建任务」按钮）。 */
  children?: ReactNode;
  /** 紧凑模式：左侧窄栏 / 内嵌列表等小空间场景。 */
  compact?: boolean;
}

/**
 * 全局统一的空状态：图标 + 标题 + 引导文案（+ 可选操作）。
 * 视觉规范见 styles.css 的 `.empty-state` 系列。
 */
export function EmptyState({ icon, title, sub, children, compact = false }: EmptyStateProps) {
  return (
    <div className={`empty-state${compact ? ' compact' : ''}`}>
      <span className="empty-state-icon">{icon}</span>
      <span className="empty-state-title">{title}</span>
      {sub && <span className="empty-state-sub">{sub}</span>}
      {children && <div className="empty-state-action">{children}</div>}
    </div>
  );
}
