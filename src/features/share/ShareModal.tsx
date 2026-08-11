import { useMemo, useRef, useState, type CSSProperties } from 'react';
import type { GroupColor, Task } from '../../shared/contracts/types';
import { groupColorMap } from '../../utils/groupColors';
import { CrossIcon } from '../../components/ForestIcons';
import {
  captureShareCard,
  copyShareCardToClipboard,
  saveShareCardToFile,
} from './captureImage';
import { buildShareData } from './shareData';
import {
  loadShareSettings,
  saveShareSettings,
  type ShareSettings,
} from './shareSettings';
import { ShareCard } from './templates/ShareCard';
import { SHARE_CARD_PREVIEW_SCALE } from './shareLayout';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  tasks: Task[];
  weekId: string;
  groupColors: GroupColor[];
  selectedIds: Set<number>;
}

interface FieldOption {
  key: keyof ShareSettings;
  label: string;
}

const FIELD_OPTIONS: FieldOption[] = [
  { key: 'showWeekHeader', label: '周头部信息' },
  { key: 'showDescription', label: '任务描述' },
  { key: 'showPriority', label: '优先级' },
  { key: 'showAssignments', label: '执行方式 / 负责人 / 分派人' },
  { key: 'showTags', label: '标签' },
  { key: 'showGroupColors', label: '分组色条' },
  { key: 'includeCompleted', label: '包含已完成任务' },
];

const SHARE_CARD_PREVIEW_STYLE: CSSProperties = {
  zoom: SHARE_CARD_PREVIEW_SCALE,
};

export function ShareModal({
  open,
  onClose,
  tasks,
  weekId,
  groupColors,
  selectedIds,
}: ShareModalProps) {
  const [settings, setSettings] = useState<ShareSettings>(() => loadShareSettings());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const previewRef = useRef<HTMLDivElement | null>(null);

  const colorMap = useMemo(() => groupColorMap(groupColors), [groupColors]);
  const shareData = useMemo(
    () => buildShareData(tasks, selectedIds, settings.includeCompleted, colorMap, weekId),
    [tasks, selectedIds, settings.includeCompleted, colorMap, weekId],
  );

  if (!open) {
    return null;
  }

  const updateSetting = (key: keyof ShareSettings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveShareSettings(next);
    setMessage('');
    setError('');
  };

  const handleCopy = async () => {
    if (!previewRef.current) {
      return;
    }
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const dataUrl = await captureShareCard(previewRef.current);
      await copyShareCardToClipboard(dataUrl);
      setMessage('已复制到剪贴板，可直接粘贴');
    } catch (copyError) {
      setError(`复制失败：${String(copyError)}。请改用「另存为 PNG」。`);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!previewRef.current) {
      return;
    }
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const dataUrl = await captureShareCard(previewRef.current);
      const suggestedName = `weeklytodo-share-${weekId}.png`;
      const savedPath = await saveShareCardToFile(dataUrl, suggestedName);
      if (savedPath) {
        setMessage(`已保存到 ${savedPath}`);
      }
    } catch (saveError) {
      setError(`保存失败：${String(saveError)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal-wide share-modal" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" title="关闭" onClick={onClose}>
          <CrossIcon size={15} />
        </button>
        <div className="modal-title">任务分享</div>
        <div className="modal-sub">
          已选 {selectedIds.size} 项 · 预览可实时调整展示字段，生成后复制或保存为 PNG
        </div>

        <div className="share-modal-body">
          <div className="share-modal-config">
            <div className="share-config-section">
              <div className="share-config-title">展示字段</div>
              {FIELD_OPTIONS.map((option) => {
                // FIELD_OPTIONS 只含可切换的布尔展示字段。
                const checked = settings[option.key] as boolean;
                return (
                  <label className="share-field-row" key={option.key}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => updateSetting(option.key, event.target.checked)}
                    />
                    <span>{option.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="share-modal-preview">
            <div className="share-preview-scroll">
              <div className="share-preview-scale" style={SHARE_CARD_PREVIEW_STYLE}>
                <div ref={previewRef}>
                  <ShareCard data={shareData} settings={settings} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          {message && <span className="modal-message share-modal-message">{message}</span>}
          {error && <span className="modal-error share-modal-error">{error}</span>}
          <button
            className="btn btn-ghost"
            onClick={handleCopy}
            disabled={busy || shareData.rows.length === 0}
          >
            复制到剪贴板
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={busy || shareData.rows.length === 0}
          >
            另存为 PNG
          </button>
        </div>
      </div>
    </div>
  );
}
