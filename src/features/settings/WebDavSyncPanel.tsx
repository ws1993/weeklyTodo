import { useEffect, useState } from 'react';
import { Globe, Lock, RefreshCw, User } from 'lucide-react';
import {
  clearWebDavCredentials,
  hasWebDavCredentials,
  saveWebDavCredentials,
  syncWebDav,
  testWebDavConnection,
} from '../../api/nativeBridge';
import { DropdownSelect, ToggleSwitch } from '../../components/QueryControls';
import type { WebDavSettings } from './webdavSettings';
import { isValidWebDavUrl, SYNC_INTERVAL_HOURS_OPTIONS } from './webdavSettings';

interface WebDavSyncPanelProps {
  settings: WebDavSettings;
  onChange: (settings: WebDavSettings) => void;
}

const intervalOptions = SYNC_INTERVAL_HOURS_OPTIONS.map((hours) => ({
  value: String(hours),
  label: hours === 0 ? '关闭' : `每 ${hours} 小时`,
}));

export function WebDavSyncPanel({ settings, onChange }: WebDavSyncPanelProps) {
  const [password, setPassword] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const urlInvalid = settings.url !== '' && !isValidWebDavUrl(settings.url);
  const canConnect =
    settings.url.trim() !== '' &&
    settings.username.trim() !== '' &&
    (password !== '' || passwordSaved);

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
      const result = await syncWebDav(settings.url, settings.username);
      const backupText =
        result.backupFiles.length > 0 ? `；备份：${result.backupFiles.join('、')}` : '';
      setNotice(`${result.message}${backupText}`);
      patchSettings({
        lastSyncedAt: new Date().toISOString(),
        lastSyncStatus: `同步完成（${result.direction}）`,
      });
    } catch (syncError) {
      const message = String(syncError);
      setError(message);
      patchSettings({ lastSyncStatus: `同步失败：${message}` });
    } finally {
      setSyncing(false);
    }
  };

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
            disabled={testing || !canConnect}
          >
            {testing ? '测试中…' : '测试连接'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void runSync()}
            disabled={syncing || !canConnect}
          >
            <RefreshCw size={14} />
            <span>{syncing ? '同步中…' : '立即同步'}</span>
          </button>
        </div>
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
      </div>

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
