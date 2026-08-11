import { useEffect, useState } from 'react';
import { Globe, Lock, RefreshCw, User } from 'lucide-react';
import {
  clearWebDavCredentials,
  hasWebDavCredentials,
  listWebDavDatabaseVersions,
  restoreWebDavDatabaseVersion,
  saveWebDavCredentials,
  syncWebDav,
  testWebDavConnection,
} from '../../api/nativeBridge';
import { DropdownSelect, ToggleSwitch } from '../../components/QueryControls';
import type { RemoteDatabaseVersion } from '../../shared/contracts/types';
import type { WebDavSettings, BackupRetention } from './webdavSettings';
import { isValidWebDavUrl, SYNC_INTERVAL_HOURS_OPTIONS, BACKUP_RETENTION_OPTIONS } from './webdavSettings';

interface WebDavSyncPanelProps {
  settings: WebDavSettings;
  onChange: (settings: WebDavSettings) => void;
  onDatabaseRestored: () => Promise<void>;
}

const intervalOptions = SYNC_INTERVAL_HOURS_OPTIONS.map((hours) => ({
  value: String(hours),
  label: hours === 0 ? '关闭' : `每 ${hours} 小时`,
}));

const backupRetentionOptions = BACKUP_RETENTION_OPTIONS.map((option) => ({
  value: String(option),
  label: option === 'unlimited' ? '无限制' : `保留 ${option} 个`,
}));

export function WebDavSyncPanel({ settings, onChange, onDatabaseRestored }: WebDavSyncPanelProps) {
  const [password, setPassword] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringFileName, setRestoringFileName] = useState<string | null>(null);
  const [armedRestoreFileName, setArmedRestoreFileName] = useState<string | null>(null);
  const [versions, setVersions] = useState<RemoteDatabaseVersion[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const urlInvalid = settings.url !== '' && !isValidWebDavUrl(settings.url);
  const canConnect =
    settings.url.trim() !== '' &&
    settings.username.trim() !== '' &&
    (password !== '' || passwordSaved);
  const operationInProgress = testing || syncing || loadingVersions || restoringFileName !== null;

  useEffect(() => {
    let disposed = false;
    if (!settings.username) {
      setPasswordSaved(false);
      return;
    }
    void hasWebDavCredentials(settings.username)
      .then((saved) => {
        if (!disposed) {
          setPasswordSaved(saved);
        }
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
    };
  }, [settings.username]);

  const patchSettings = (patch: Partial<WebDavSettings>) => {
    onChange({ ...settings, ...patch });
  };

  /** 用户填了密码就把密码存入系统凭据，供后续自动同步使用。 */
  const persistPasswordIfProvided = async (): Promise<boolean> => {
    if (!password) {
      return true;
    }
    try {
      const saved = await saveWebDavCredentials(settings.username, password);
      setPasswordSaved(saved);
      return true;
    } catch (saveError) {
      setError(String(saveError));
      return false;
    }
  };

  const runTest = async () => {
    setTesting(true);
    setNotice(null);
    setError(null);
    try {
      const persisted = await persistPasswordIfProvided();
      if (!persisted) {
        return;
      }
      const message = await testWebDavConnection(settings.url, settings.username, password);
      setNotice(message);
    } catch (testError) {
      setError(String(testError));
    } finally {
      setTesting(false);
    }
  };

  const runSync = async () => {
    setSyncing(true);
    setNotice(null);
    setError(null);
    try {
      const persisted = await persistPasswordIfProvided();
      if (!persisted) {
        return;
      }
      const result = await syncWebDav(settings.url, settings.username, settings.backupRetention);
      const backupText =
        result.backupFiles.length > 0 ? `；备份：${result.backupFiles.join('、')}` : '';
      setNotice(`${result.message}${backupText}`);
      patchSettings({
        lastSyncedAt: result.direction === 'skipped' ? settings.lastSyncedAt : new Date().toISOString(),
        lastSyncStatus:
          result.direction === 'skipped' ? `同步已跳过：${result.message}` : `同步完成（${result.direction}）`,
      });
    } catch (syncError) {
      const message = String(syncError);
      setError(message);
      patchSettings({ lastSyncStatus: `同步失败：${message}` });
    } finally {
      setSyncing(false);
    }
  };

  const loadVersions = async () => {
    setLoadingVersions(true);
    setNotice(null);
    setError(null);
    try {
      const persisted = await persistPasswordIfProvided();
      if (!persisted) {
        return;
      }
      setVersions(await listWebDavDatabaseVersions(settings.url, settings.username));
    } catch (listError) {
      setError(String(listError));
    } finally {
      setLoadingVersions(false);
    }
  };

  const restoreVersion = async (version: RemoteDatabaseVersion) => {
    if (armedRestoreFileName !== version.fileName) {
      setArmedRestoreFileName(version.fileName);
      setNotice(`再次点击“确认恢复”以覆盖本地数据；恢复前会先将当前本地库备份到 WebDAV。`);
      setError(null);
      return;
    }

    setRestoringFileName(version.fileName);
    setNotice(null);
    setError(null);
    try {
      const persisted = await persistPasswordIfProvided();
      if (!persisted) {
        return;
      }
      const result = await restoreWebDavDatabaseVersion(
        settings.url,
        settings.username,
        version.fileName,
      );
      patchSettings({
        autoSyncPausedAfterRestore: true,
        lastSyncedAt: undefined,
        lastSyncStatus: `已恢复 ${result.restoredFileName}；自动同步已暂停`,
      });
      await onDatabaseRestored();
      setArmedRestoreFileName(null);
      setNotice(`${result.message}。恢复前备份：${result.localBackupFileName}`);
    } catch (restoreError) {
      setError(String(restoreError));
    } finally {
      setRestoringFileName(null);
    }
  };

  const resumeAutomaticSync = () => {
    patchSettings({
      autoSyncPausedAfterRestore: false,
      lastSyncStatus: '已恢复自动同步；下次按启动或定时设置执行。',
    });
    setNotice('自动同步已恢复');
  };

  const formatVersionTime = (utcSeconds: number) => new Date(utcSeconds * 1000).toLocaleString();

  const formatFileSize = (bytes: number) => `${(bytes / 1024).toFixed(bytes < 1024 * 1024 ? 0 : 1)} KB`;

  const forgetPassword = async () => {
    setError(null);
    setNotice(null);
    try {
      await clearWebDavCredentials(settings.username);
      setPasswordSaved(false);
      setPassword('');
      setNotice('已清除系统凭据中保存的密码');
    } catch (clearError) {
      setError(String(clearError));
    }
  };

  return (
    <div className="webdav-sync-panel">
      <div className="proxy-settings-hint">
        将本地数据库文件同步到 WebDAV 目录（每次同步为整库文件级同步）。
        密码只保存在系统凭据管理器，不写入本地配置。
      </div>

      <div className="proxy-custom-fields">
        <div className="proxy-field">
          <label className="proxy-field-label" htmlFor="webdav-url">
            <Globe size={12} />
            <span>服务器地址</span>
          </label>
          <input
            id="webdav-url"
            type="text"
            className={urlInvalid ? 'proxy-input-error' : ''}
            placeholder="https://dav.example.com/weeklytodo"
            value={settings.url}
            onChange={(event) => patchSettings({ url: event.target.value })}
          />
          {urlInvalid && (
            <span className="proxy-field-error">请输入有效的 http/https 地址</span>
          )}
        </div>

        <div className="proxy-auth-row">
          <div className="proxy-field">
            <label className="proxy-field-label" htmlFor="webdav-username">
              <User size={12} />
              <span>用户名</span>
            </label>
            <input
              id="webdav-username"
              type="text"
              placeholder="WebDAV 账号"
              value={settings.username}
              onChange={(event) => patchSettings({ username: event.target.value })}
            />
          </div>

          <div className="proxy-field">
            <label className="proxy-field-label" htmlFor="webdav-password">
              <Lock size={12} />
              <span>密码</span>
            </label>
            <input
              id="webdav-password"
              type="password"
              placeholder={passwordSaved ? '已保存，留空保持不变' : '应用密码'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {passwordSaved && (
              <button
                type="button"
                className="btn btn-ghost btn-sm webdav-forget"
                onClick={() => void forgetPassword()}
              >
                清除已保存的密码
              </button>
            )}
          </div>
        </div>

        <div className="webdav-actions-row">
          <button
            type="button"
            className="btn"
            onClick={() => void runTest()}
            disabled={operationInProgress || !canConnect}
          >
            {testing ? '测试中…' : '测试连接'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void runSync()}
            disabled={operationInProgress || !canConnect}
          >
            <RefreshCw size={14} />
            <span>{syncing ? '同步中…' : '立即同步'}</span>
          </button>
        </div>

        <section className="webdav-recovery" aria-labelledby="webdav-recovery-title">
          <div className="webdav-recovery-head">
            <div>
              <h3 id="webdav-recovery-title">远端版本与恢复</h3>
              <p>恢复会覆盖本地数据库；当前本地库会先备份为新的 WebDAV 历史版本。</p>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => void loadVersions()}
              disabled={operationInProgress || !canConnect}
            >
              <RefreshCw size={14} />
              <span>{loadingVersions ? '读取中…' : '刷新版本'}</span>
            </button>
          </div>

          {versions.length > 0 && (
            <div className="webdav-version-list">
              {versions.map((version) => {
                const isArmed = armedRestoreFileName === version.fileName;
                const isRestoring = restoringFileName === version.fileName;
                return (
                  <article className="webdav-version-row" key={version.fileName}>
                    <div className="webdav-version-meta">
                      <strong>{version.isCurrent ? '当前远端版本' : '历史备份'}</strong>
                      <code>{version.fileName}</code>
                      <span>
                        {formatVersionTime(version.lastModifiedUtc)} · {formatFileSize(version.size)}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={isArmed ? 'btn btn-danger btn-sm' : 'btn btn-sm'}
                      onClick={() => void restoreVersion(version)}
                      disabled={operationInProgress && !isRestoring}
                    >
                      {isRestoring ? '恢复中…' : isArmed ? '确认恢复' : '恢复到本地'}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="webdav-strategy">
        <ToggleSwitch
          label="启动时自动同步"
          checked={settings.syncOnStartup}
          onChange={(checked) => patchSettings({ syncOnStartup: checked })}
        />
        <DropdownSelect
          label="定时同步"
          allowAll={false}
          options={intervalOptions}
          value={String(settings.syncIntervalHours)}
          onChange={(value) => patchSettings({ syncIntervalHours: Number(value) })}
        />
        <div className="webdav-backup-retention">
          <DropdownSelect
            label="备份保留数量"
            allowAll={false}
            options={backupRetentionOptions}
            value={String(settings.backupRetention)}
            onChange={(value) => {
              const newValue = value === 'unlimited' ? 'unlimited' : Number(value);
              patchSettings({ backupRetention: newValue as BackupRetention });
            }}
          />
          {settings.backupRetention === 'unlimited' && (
            <span className="webdav-backup-retention-warning">
              无限备份可能占用大量存储空间，请谨慎选择
            </span>
          )}
        </div>
      </div>

      {settings.autoSyncPausedAfterRestore && (
        <div className="webdav-recovery-paused">
          <span>恢复完成后，自动同步已暂停，避免恢复数据被自动覆盖。</span>
          <button type="button" className="btn btn-sm" onClick={resumeAutomaticSync}>
            恢复自动同步
          </button>
        </div>
      )}

      {(notice !== null || error !== null || settings.lastSyncStatus || settings.lastSyncedAt) && (
        <div className="webdav-status">
          {notice && <div className="modal-message">{notice}</div>}
          {error && <div className="modal-error">{error}</div>}
          {notice === null && error === null && settings.lastSyncStatus && (
            <div className="webdav-status-line">{settings.lastSyncStatus}</div>
          )}
          {settings.lastSyncedAt && (
            <div className="webdav-status-line">
              上次同步：{new Date(settings.lastSyncedAt).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
