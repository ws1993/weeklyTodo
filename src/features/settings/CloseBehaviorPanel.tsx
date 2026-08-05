import { HelpCircle, LogOut, MinusCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { CloseBehavior, CloseBehaviorSettings } from './closeBehavior';

interface CloseBehaviorPanelProps {
  settings: CloseBehaviorSettings;
  onChange: (settings: CloseBehaviorSettings) => void;
}

const closeBehaviorOptions: Array<{
  value: CloseBehavior;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  {
    value: 'ask',
    label: '每次询问',
    description: '点击关闭按钮时弹窗选择最小化到托盘或退出',
    icon: <HelpCircle size={18} />,
  },
  {
    value: 'minimize-to-tray',
    label: '最小化到托盘',
    description: '点击关闭按钮后隐藏到系统托盘，应用继续在后台运行',
    icon: <MinusCircle size={18} />,
  },
  {
    value: 'exit',
    label: '直接退出',
    description: '点击关闭按钮后直接退出应用',
    icon: <LogOut size={18} />,
  },
];

export function CloseBehaviorPanel({ settings, onChange }: CloseBehaviorPanelProps) {
  return (
    <div className="proxy-settings-panel">
      <div className="proxy-settings-hint">
        点击窗口右上角关闭按钮（×）时，应用会按这里的设置处理；默认每次询问。
      </div>
      <div className="proxy-mode-cards">
        {closeBehaviorOptions.map((option) => {
          const isActive = settings.behavior === option.value;
          return (
            <button
              key={option.value}
              type="button"
              className={`proxy-mode-card${isActive ? ' active' : ''}`}
              onClick={() => onChange({ ...settings, behavior: option.value })}
            >
              <span className="proxy-mode-icon">{option.icon}</span>
              <span className="proxy-mode-content">
                <span className="proxy-mode-label">{option.label}</span>
                <span className="proxy-mode-desc">{option.description}</span>
              </span>
              <span className={`proxy-mode-indicator${isActive ? ' active' : ''}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
