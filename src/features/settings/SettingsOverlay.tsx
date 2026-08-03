import { useEffect, useState } from 'react';
import { pickAndMigrateStorage } from '../../api/nativeBridge';
import { CrossIcon, SettingsIcon } from '../../components/ForestIcons';
import { useAppStore } from '../../store/appStore';
import { ProxySettingsPanel } from './ProxySettingsPanel';
import type { ProxySettings } from './proxySettings';
import { loadProxySettings, saveProxySettings } from './proxySettings';

interface SettingsOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsOverlay({ open, onClose }: SettingsOverlayProps) {
  const storageDir = useAppStore((state) => state.storageDir);
  const [proxySettings, setProxySettings] = useState<ProxySettings>(() => loadProxySettings());
  const [migrating, setMigrating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setProxySettings(loadProxySettings());
    setMessage(null);
    setError(null);
  }, [open]);

  if (!open) {
    return null;
  }

  const updateProxySettings = (next: ProxySettings) => {
    setProxySettings(next);
    saveProxySettings(next);
  };

  const runMigration = async () => {
    setMigrating(true);
    setMessage(null);
    setError(null);
    try {
      const result = await pickAndMigrateStorage();
      setMessage(`${result.message}：${result.dataDir}`);
    } catch (migrationError) {
      setError(String(migrationError));
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="settings-overlay">
      <header className="settings-overlay-header">
        <div className="settings-overlay-title">
          <span className="settings-overlay-glyph">
            <SettingsIcon size={15} />
          </span>
          设置
        </div>
        <button className="settings-overlay-close" title="关闭设置" onClick={onClose}>
          <CrossIcon size={15} />
        </button>
      </header>

      <div className="settings-overlay-body">
        <section className="settings-section">
          <div className="settings-section-head">
            <h3 className="settings-section-title">检查更新</h3>
            <span className="settings-section-index">01 / 网络</span>
          </div>
          <p className="settings-section-sub">
            检查更新时需要联网访问 GitHub Release，可在此配置网络代理。
          </p>
          <ProxySettingsPanel settings={proxySettings} onChange={updateProxySettings} />
        </section>

        <section className="settings-section">
          <div className="settings-section-head">
            <h3 className="settings-section-title">数据目录</h3>
            <span className="settings-section-index">02 / 存储</span>
          </div>
          <p className="settings-section-sub">所有周与任务保存在你选择的本地目录（SQLite）。</p>
          <div className="settings-section-hint" style={{ wordBreak: 'break-all' }}>
            当前数据保存在：<code>{storageDir || '…'}</code>
          </div>
          <div className="settings-section-hint">
            迁移会把数据库复制到新目录并自动备份原文件；迁移成功后原目录文件仍会保留。
          </div>
          <div className="settings-section-actions">
            <button
              className="btn btn-primary"
              onClick={() => void runMigration()}
              disabled={migrating}
            >
              {migrating ? '迁移中…' : '选择新目录并迁移'}
            </button>
          </div>
          {message && <div className="modal-message">{message}</div>}
          {error && <div className="modal-error">{error}</div>}
        </section>
      </div>
    </div>
  );
}
