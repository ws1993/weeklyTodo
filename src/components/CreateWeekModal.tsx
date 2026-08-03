import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { formatCnRange, weekStatus } from '../utils/weekFormat';
import { CrossIcon } from './ForestIcons';

interface CreateWeekModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateWeekModal({ open, onClose }: CreateWeekModalProps) {
  const createWeek = useAppStore((state) => state.createWeek);
  const selectWeek = useAppStore((state) => state.selectWeek);
  const refreshWeeks = useAppStore((state) => state.refreshWeeks);
  const [mondayDate, setMondayDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 根据所选周一推算周 id（YYYYMMDD-YYYYMMDD）
  const previewWeekId = (() => {
    const value = mondayDate.trim();
    if (!/^\d{8}$/.test(value)) {
      return null;
    }
    const base = new Date(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6, 8)));
    if (base.getDay() !== 1) {
      // 接受任意日期，自动吸附到该周周一
      base.setDate(base.getDate() - ((base.getDay() + 6) % 7));
    }
    const key = (date: Date) =>
      `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const sunday = new Date(base);
    sunday.setDate(base.getDate() + 6);
    return `${key(base)}-${key(sunday)}`;
  })();

  if (!open) {
    return null;
  }

  const submit = async () => {
    if (!previewWeekId) {
      setError('请输入日期，格式 YYYYMMDD，例如 20260810');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const week = await createWeek(previewWeekId.slice(0, 8));
      await refreshWeeks();
      await selectWeek(week.id);
      onClose();
    } catch (createError) {
      setError(String(createError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" title="关闭" onClick={onClose}>
          <CrossIcon size={14} />
        </button>
        <h2 className="modal-title">种下新的一周</h2>
        <p className="modal-sub">选择一周中的任意一天，将以周一为起点，种下一棵新的树干。</p>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="createDate">日期（YYYYMMDD）</label>
            <input
              id="createDate"
              autoFocus
              placeholder="如 20260810"
              value={mondayDate}
              onChange={(event) => {
                setMondayDate(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void submit();
                }
              }}
            />
          </div>
          <div className="week-preview">
            {previewWeekId ? (
              <>
                新的一周：<b>{previewWeekId}</b> · {formatCnRange(previewWeekId)} · {weekStatus(previewWeekId).label}
              </>
            ) : (
              '请选择日期。'
            )}
          </div>
          <div className="week-error">{error}</div>
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose}>取消</button>
            <button className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
              {busy ? '种下中…' : '种下'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
