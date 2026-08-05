import { useEffect, useState } from 'react';
import { openDataDir, pickAndMigrateStorage } from '../../api/nativeBridge';
import { CrossIcon, FolderIcon, LogoIcon, SettingsIcon } from '../../components/ForestIcons';
import { useAppStore } from '../../store/appStore';
import type { CloseBehaviorSettings } from './closeBehavior';
import { loadCloseBehaviorSettings, saveCloseBehaviorSettings } from './closeBehavior';
import { CloseBehaviorPanel } from './CloseBehaviorPanel';
import { ManagementPanel } from './ManagementPanel';
import { ProxySettingsPanel } from './ProxySettingsPanel';
import type { ProxySettings } from './proxySettings';
import { loadProxySettings, saveProxySettings } from './proxySettings';
import { WebDavSyncPanel } from './WebDavSyncPanel';
import type { WebDavSettings } from './webdavSettings';
import { loadWebDavSettings, saveWebDavSettings } from './webdavSettings';

type SettingsTab = 'network' | 'storage' | 'sync' | 'general' | 'management' | 'about';

interface SettingsTabMeta {
  id: SettingsTab;
  index: string;
  label: string;
  caption: string;
}

const settingsTabs: SettingsTabMeta[] = [
  { id: 'network', index: '01', label: '网络', caption: '代理与更新' },
  { id: 'storage', index: '02', label: '存储', caption: '数据目录' },
  { id: 'sync', index: '03', label: '同步', caption: 'WebDAV' },
  { id: 'general', index: '04', label: '通用', caption: '关闭行为' },
  { id: 'management', index: '05', label: '管理', caption: '负责人与标签' },
  { id: 'about', index: '06', label: '关于', caption: '版本信息' },
];

interface SettingsOverlayProps {
  open: boolean;
  onClose: () => void;
  /** 打开「检查更新」弹窗（由 App 控制 UpdateModal）。 */
  onCheckUpdate?: () => void;
  /** WebDAV 恢复完成后重新加载所有数据库状态。 */
  onDatabaseRestored: () => Promise<void>;
}

export function SettingsOverlay({
  open,
  onClose,
  onCheckUpdate,
  onDatabaseRestored,
}: SettingsOverlayProps) {
  const storageDir = useAppStore((state) => state.storageDir);
  const [activeTab, setActiveTab] = useState<SettingsTab>('network');
  const [proxySettings, setProxySettings] = useState<ProxySettings>(() => loadProxySettings());
  const [closeBehaviorSettings, setCloseBehaviorSettings] = useState<CloseBehaviorSettings>(() =>
    loadCloseBehaviorSettings(),
  );
  const [webdavSettings, setWebdavSettings] = useState<WebDavSettings>(() =>
    loadWebDavSettings(),
  );
  const [migrating, setMigrating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setProxySettings(loadProxySettings());
    setCloseBehaviorSettings(loadCloseBehaviorSettings());
    setWebdavSettings(loadWebDavSettings());
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

  const updateWebDavSettings = (next: WebDavSettings) => {
    setWebdavSettings(next);
    saveWebDavSettings(next);
  };

  const updateCloseBehaviorSettings = (next: CloseBehaviorSettings) => {
    setCloseBehaviorSettings(next);
    saveCloseBehaviorSettings(next);
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

  const runOpenDataDir = async () => {
    setMessage(null);
    setError(null);
    try {
      const dir = await openDataDir();
      setMessage(`已在文件管理器中打开数据目录：${dir}`);
    } catch (openError) {
      setError(String(openError));
    }
  };

  return (
    <div className="settings-overlay">
      <header className="settings-overlay-header">
        <div className="settings-overlay-title">
          <span className="settings-overlay-glyph">
            <SettingsIcon size={17} />
          </span>
          设置
        </div>
        <button className="settings-overlay-close" title="关闭设置" aria-label="关闭设置" onClick={onClose}>
          <CrossIcon size={15} />
        </button>
      </header>

      <div className="settings-shell">
        <nav className="settings-nav" aria-label="设置分类">
          <span className="settings-nav-head">偏好设置</span>
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`settings-nav-item${activeTab === tab.id ? ' active' : ''}`}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="settings-nav-index">{tab.index}</span>
              <span className="settings-nav-text">
                <span className="settings-nav-label">{tab.label}</span>
                <span className="settings-nav-caption">{tab.caption}</span>
              </span>
            </button>
          ))}
        </nav>

        <main className="settings-content">
          {activeTab === 'network' && (
            <section className="settings-page">
              <header className="settings-page-head">
                <h2 className="settings-page-title">网络</h2>
                <p className="settings-page-sub">
                  检查更新时需要联网访问 GitHub Release，可在此配置网络代理。
                </p>
              </header>
              <ProxySettingsPanel settings={proxySettings} onChange={updateProxySettings} />
            </section>
          )}

          {activeTab === 'storage' && (
            <section className="settings-page">
              <header className="settings-page-head">
                <h2 className="settings-page-title">存储</h2>
                <p className="settings-page-sub">所有周与任务保存在你选择的本地目录（SQLite）。</p>
              </header>

              <dl className="settings-info-list">
                <div className="settings-info-row">
                  <dt>当前数据目录</dt>
                  <dd className="settings-info-code">{storageDir || '…'}</dd>
                </div>
                <div className="settings-info-row">
                  <dt>迁移说明</dt>
                  <dd>
                    迁移会把数据库复制到新目录并自动备份原文件；迁移成功后原目录文件仍会保留。
                  </dd>
                </div>
              </dl>

              <div className="settings-page-actions">
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
          )}

          {activeTab === 'sync' && (
            <section className="settings-page">
              <header className="settings-page-head">
                <h2 className="settings-page-title">同步</h2>
                <p className="settings-page-sub">
                  将本地数据库备份到 WebDAV，支持手动、启动时与定时同步。
                </p>
              </header>
              <WebDavSyncPanel
                settings={webdavSettings}
                onChange={updateWebDavSettings}
                onDatabaseRestored={onDatabaseRestored}
              />
            </section>
          )}

          {activeTab === 'general' && (
            <section className="settings-page">
              <header className="settings-page-head">
                <h2 className="settings-page-title">通用</h2>
                <p className="settings-page-sub">设置点击关闭按钮（×）时应用的处理方式。</p>
              </header>
              <CloseBehaviorPanel
                settings={closeBehaviorSettings}
                onChange={updateCloseBehaviorSettings}
              />
            </section>
          )}

          {activeTab === 'management' && (
            <section className="settings-page">
              <header className="settings-page-head">
                <h2 className="settings-page-title">管理</h2>
                <p className="settings-page-sub">
                  管理所有任务中使用的负责人和标签。修改后会自动同步到任务编辑中。
                </p>
              </header>
              <ManagementPanel />
            </section>
          )}

          {activeTab === 'about' && (
            <section className="settings-page">
              <header className="settings-page-head">
                <h2 className="settings-page-title">关于</h2>
                <p className="settings-page-sub">周计划 · 以周为单位的高效执行</p>
              </header>

              <div className="about-hero">
                <span className="about-logo">
                  <LogoIcon size={52} />
                </span>
                <span className="about-name">周计划</span>
                <p className="about-sub">以「周」为单位组织的本地任务管理工具</p>
              </div>

              <dl className="settings-info-list">
                <div className="settings-info-row">
                  <dt>当前版本</dt>
                  <dd>
                    <span className="mono">v{__APP_VERSION__}</span>
                  </dd>
                </div>
                <div className="settings-info-row">
                  <dt>数据存储</dt>
                  <dd>本地 SQLite · 数据仅保存在本机，不会上传</dd>
                </div>
                <div className="settings-info-row">
                  <dt>数据目录</dt>
                  <dd>
                    <span className="settings-info-code">{storageDir || '…'}</span>
                  </dd>
                </div>
              </dl>

              <div className="settings-page-actions">
                <button
                  className="btn"
                  title="在文件管理器中打开数据目录，便于手动备份"
                  onClick={() => void runOpenDataDir()}
                >
                  <FolderIcon size={15} />
                  打开数据目录
                </button>
                <button className="btn btn-primary" onClick={onCheckUpdate}>
                  检查更新
                </button>
              </div>
              {message && <div className="modal-message">{message}</div>}
              {error && <div className="modal-error">{error}</div>}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
