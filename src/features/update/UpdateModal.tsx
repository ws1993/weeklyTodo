import { useEffect, useState } from 'react';
import {
  checkForAppUpdate,
  downloadAndInstallUpdate,
  openReleasePage,
  subscribeUpdateDownloadProgress,
} from '../../api/nativeBridge';
import { CrossIcon } from '../../components/ForestIcons';
import { getSavedProxyConfig } from '../settings/proxySettings';

interface UpdateModalProps {
  open: boolean;
  onClose: () => void;
}

export function UpdateModal({ open, onClose }: UpdateModalProps) {
  const [state, setState] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'error'>(
    'idle',
  );
  const [version, setVersion] = useState('');
  const [body, setBody] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }
    setState('checking');
    setError('');
    void checkForAppUpdate(getSavedProxyConfig())
      .then((result) => {
        if (result.available && result.version && result.downloadUrl) {
          setVersion(result.version);
          setBody(result.body ?? '');
          setDownloadUrl(result.downloadUrl);
          setState('available');
        } else {
          setState('idle');
        }
      })
      .catch((checkError) => {
        setError(String(checkError));
        setState('error');
      });
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    return subscribeUpdateDownloadProgress((progress) => {
      setPercent(progress.percent);
    });
  }, [open]);

  if (!open) {
    return null;
  }

  const startDownload = async () => {
    setState('downloading');
    setPercent(0);
    try {
      await downloadAndInstallUpdate(downloadUrl, getSavedProxyConfig());
      // The installer launches after app exit; the window may stay open briefly.
    } catch (downloadError) {
      setError(String(downloadError));
      setState('error');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        style={{ width: 480 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modal-close" title="关闭" onClick={onClose}>
          <CrossIcon size={14} />
        </button>
        <h2 className="modal-title">检查更新</h2>
        <p className="modal-sub">从 GitHub Release 获取最新安装包。</p>
        <div className="modal-body">
          {state === 'checking' && <div className="modal-hint">正在检查最新版本…</div>}
          {state === 'idle' && (
            <>
              <div className="modal-hint">当前已是最新版本。若发布页存在更新，可前往查看。</div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => void openReleasePage()}>打开发布页</button>
                <button className="btn btn-primary" onClick={onClose}>关闭</button>
              </div>
            </>
          )}
          {state === 'available' && (
            <>
              <div className="modal-hint" style={{ fontSize: 14 }}>
                发现新版本 <span className="mono" style={{ color: 'var(--brand)' }}>v{version}</span>
              </div>
              <div className="modal-hint" style={{ whiteSpace: 'pre-wrap', marginTop: 10 }}>
                {body || '暂无更新说明'}
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={onClose}>稍后</button>
                <button className="btn btn-primary" onClick={() => void startDownload()}>下载并安装</button>
              </div>
            </>
          )}
          {state === 'downloading' && (
            <>
              <div className="modal-hint" style={{ marginBottom: 12 }}>
                正在下载 <span className="mono">v{version}</span>… {percent}%
              </div>
              <div
                style={{
                  height: 8,
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 99,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${percent}%`,
                    height: '100%',
                    background: 'var(--brand)',
                  }}
                />
              </div>
            </>
          )}
          {state === 'error' && <div className="modal-error">{error}</div>}
        </div>
      </div>
    </div>
  );
}
