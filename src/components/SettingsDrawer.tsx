import { useState } from 'react';
import { pickAndMigrateStorage } from '../api/nativeBridge';
import { useAppStore } from '../store/appStore';
import { CrossIcon } from './ForestIcons';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const storageDir = useAppStore((state) => state.storageDir);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  const runMigration = async () => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const result = await pickAndMigrateStorage();
      setMessage(`${result.message}：${result.dataDir}`);
    } catch (migrationError) {
      setError(String(migrationError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 520 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" title="关闭" onClick={onClose}>
          <CrossIcon size={14} />
        </button>
        <h2 className="modal-title">数据目录</h2>
        <p className="modal-sub">所有周与任务保存在你选择的本地目录（SQLite）。</p>
        <div className="modal-body">
          <div className="modal-hint" style={{ wordBreak: 'break-all' }}>
            当前数据保存在：<code>{storageDir || '…'}</code>
          </div>
          <div className="modal-hint" style={{ marginTop: 10 }}>
            迁移会把数据库复制到新目录并自动备份原文件；迁移成功后原目录文件仍会保留。
          </div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose}>关闭</button>
            <button className="btn btn-primary" onClick={() => void runMigration()} disabled={busy}>
            {busy ? '迁移中…' : '选择新目录并迁移'}
            </button>
          </div>
          {message && <div className="modal-message">{message}</div>}
          {error && <div className="modal-error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
