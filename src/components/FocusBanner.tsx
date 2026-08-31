import { useEffect, useState, useRef } from 'react';
import type { Task } from '../shared/contracts/types';
import { useAppStore } from '../store/appStore';
import { CheckIcon, CrossIcon, ZapIcon } from './ForestIcons';
import { fireConfetti } from '../utils/confetti';

interface FocusBannerProps {
  task: Task | null;
  onClose: () => void;
}

const DEFAULT_FOCUS_SECONDS = 25 * 60;

export function FocusBanner({ task, onClose }: FocusBannerProps) {
  const toggleTask = useAppStore((state) => state.toggleTask);
  const [secondsRemaining, setSecondsRemaining] = useState(DEFAULT_FOCUS_SECONDS);
  const [isRunning, setIsRunning] = useState(true);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setSecondsRemaining(DEFAULT_FOCUS_SECONDS);
    setIsRunning(true);
  }, [task?.id]);

  useEffect(() => {
    if (!isRunning || !task) {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
      return;
    }

    timerRef.current = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerRef.current!);
          setIsRunning(false);
          fireConfetti();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [isRunning, task]);

  if (!task) {
    return null;
  }

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleFinish = async () => {
    fireConfetti();
    if (task.status !== 'closed') {
      await toggleTask(task.id, task.weekId, task.status);
    }
    onClose();
  };

  return (
    <div className="focus-timer-banner" role="region" aria-label="专注倒计时">
      <div className="focus-banner-left">
        <div className="focus-glyph">
          <ZapIcon size={18} />
        </div>
        <div className="focus-text-block">
          <span className="focus-tagline">当前专注行动 (Focus Mode)</span>
          <span className="focus-task-title" title={task.title}>
            {task.title}
          </span>
        </div>
      </div>

      <div className="focus-banner-right">
        <span className="focus-timer-digits" aria-live="polite">
          {timeFormatted}
        </span>
        <button
          type="button"
          className="btn-focus-action"
          onClick={() => setIsRunning((r) => !r)}
          title={isRunning ? '暂停' : '继续'}
        >
          {isRunning ? '暂停' : '继续'}
        </button>
        <button
          type="button"
          className="btn-focus-action finish"
          onClick={() => void handleFinish()}
          title="完成该任务"
        >
          <CheckIcon size={14} />
          完成专注
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ color: '#94A3B8', padding: '0 6px' }}
          onClick={onClose}
          title="退出专注模式"
        >
          <CrossIcon size={16} />
        </button>
      </div>
    </div>
  );
}
