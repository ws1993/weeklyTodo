import { exitApp, hideMainWindow } from '../api/nativeBridge';
import { CrossIcon, LogoIcon } from './ForestIcons';

interface CloseBehaviorModalProps {
  open: boolean;
  onClose: () => void;
}

/** 点击关闭按钮（×）时询问：最小化到托盘还是退出应用。 */
export function CloseBehaviorModal({ open, onClose }: CloseBehaviorModalProps) {
  if (!open) {
    return null;
  }

  const handleMinimizeToTray = async () => {
    await hideMainWindow();
    onClose();
  };

  const handleExit = async () => {
    await exitApp();
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 460 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" title="取消" aria-label="取消" onClick={onClose}>
          <CrossIcon size={14} />
        </button>
        <h2 className="modal-title">关闭周计划？</h2>
        <p className="modal-sub">选择关闭后的行为；可随时在设置中更改。</p>
        <div className="modal-body">
          <div className="close-behavior-modal-hint">
            <span className="close-behavior-modal-logo">
              <LogoIcon size={22} />
            </span>
            <span>最小化到托盘后应用仍在后台运行，可点击托盘图标或再次启动快捷方式唤起。</span>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              取消
            </button>
            <button type="button" className="btn btn-danger" onClick={() => void handleExit()}>
              退出应用
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleMinimizeToTray()}
            >
              最小化到托盘
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
