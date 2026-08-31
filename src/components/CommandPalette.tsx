import { useState, useEffect, useRef } from 'react';
import type { QueryTaskRow } from '../shared/contracts/types';
import { queryAllTasks } from '../api/nativeBridge';
import { useAppStore } from '../store/appStore';
import {
  CalendarIcon,
  ChartIcon,
  CheckIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  ZapIcon,
} from './ForestIcons';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onOpenStats: () => void;
  onOpenSettings: () => void;
  onOpenCreateWeek: () => void;
  onNewTask: () => void;
  onLocateTask?: (taskId: number, weekId: string) => void;
}

interface CommandItem {
  id: string;
  type: 'action' | 'task';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
  badge?: string;
}

export function CommandPalette({
  open,
  onClose,
  onOpenStats,
  onOpenSettings,
  onOpenCreateWeek,
  onNewTask,
  onLocateTask,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<QueryTaskRow[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const selectWeek = useAppStore((state) => state.selectWeek);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSearchResults([]);
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // Live search debounced
  useEffect(() => {
    if (!open || !query.trim()) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const rows = await queryAllTasks({ keyword: query.trim() });
        if (!cancelled) {
          setSearchResults(rows.slice(0, 8));
          setSelectedIndex(0);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  if (!open) {
    return null;
  }

  // System static commands
  const defaultCommands: CommandItem[] = [
    {
      id: 'cmd-new-task',
      type: 'action',
      title: '新建任务',
      subtitle: '在当前周新建顶层任务',
      icon: <PlusIcon size={16} />,
      action: () => {
        onClose();
        onNewTask();
      },
      badge: '快捷操作',
    },
    {
      id: 'cmd-stats',
      type: 'action',
      title: '打开全周期统计复盘',
      subtitle: '查看完成率、燃尽趋势及历史数据',
      icon: <ChartIcon size={16} />,
      action: () => {
        onClose();
        onOpenStats();
      },
      badge: '分析',
    },
    {
      id: 'cmd-create-week',
      type: 'action',
      title: '创建新周期周',
      subtitle: '手动指定周一日期创建新周',
      icon: <CalendarIcon size={16} />,
      action: () => {
        onClose();
        onOpenCreateWeek();
      },
      badge: '管理',
    },
    {
      id: 'cmd-settings',
      type: 'action',
      title: '偏好设置与 WebDAV 同步',
      subtitle: '存储路径、自动备份与代理配置',
      icon: <SettingsIcon size={16} />,
      action: () => {
        onClose();
        onOpenSettings();
      },
      badge: '系统',
    },
  ];

  const taskCommands: CommandItem[] = searchResults.map((row) => ({
    id: `task-${row.task.id}`,
    type: 'task',
    title: row.task.title,
    subtitle: `${row.weekId} · P${row.task.priority} · ${row.task.status === 'closed' ? '已完成' : '进行中'}`,
    icon: row.task.status === 'closed' ? <CheckIcon size={15} /> : <ZapIcon size={15} />,
    action: async () => {
      onClose();
      await selectWeek(row.weekId);
      onLocateTask?.(row.task.id, row.weekId);
    },
    badge: row.weekId,
  }));

  const allItems = query.trim() ? [...taskCommands, ...defaultCommands] : defaultCommands;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((idx) => (idx + 1) % allItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((idx) => (idx - 1 + allItems.length) % allItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        allItems[selectedIndex].action();
      }
    }
  };

  return (
    <div
      className="command-palette-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="快捷指令面板"
    >
      <div className="command-palette-box" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-input-row">
          <SearchIcon size={18} />
          <input
            ref={inputRef}
            type="text"
            className="cmd-search-field"
            placeholder="搜索跨周任务，或输入指令 (如: 新建、主题、统计)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="cmd-results-list">
          {loading && (
            <div className="cmd-empty-hint">正在跨周检索任务…</div>
          )}
          {!loading && allItems.length === 0 && (
            <div className="cmd-empty-hint">未找到匹配的任务或指令</div>
          )}
          {!loading &&
            allItems.map((item, index) => (
              <div
                key={item.id}
                className={`cmd-result-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={item.action}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div style={{ color: 'var(--brand)', display: 'flex', alignItems: 'center' }}>
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="cmd-item-title">{item.title}</div>
                  {item.subtitle && <div className="cmd-item-meta">{item.subtitle}</div>}
                </div>
                {item.badge && <span className="tag">{item.badge}</span>}
              </div>
            ))}
        </div>

        <div className="cmd-palette-footer">
          <div className="cmd-key-tips">
            <span className="cmd-key-tip">
              <kbd>↑</kbd> <kbd>↓</kbd> 移动选择
            </span>
            <span className="cmd-key-tip">
              <kbd>Enter</kbd> 确认执行
            </span>
            <span className="cmd-key-tip">
              <kbd>ESC</kbd> 退出
            </span>
          </div>
          <span>全键盘支持</span>
        </div>
      </div>
    </div>
  );
}
