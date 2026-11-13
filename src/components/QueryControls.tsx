import { useEffect, useRef, useState } from 'react';
import { CheckIcon, ChevronDownIcon, CrossIcon, SearchIcon } from './ForestIcons';

/* ------------------------------------------------------------------ */
/* SegmentedControl —— 替代原生 `<select>` / 单选项分组按钮               */
/* ------------------------------------------------------------------ */

interface SegmentedOption<TValue extends string> {
  value: TValue;
  label: string;
}

interface SegmentedControlProps<TValue extends string> {
  label: string;
  options: SegmentedOption<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
}

export function SegmentedControl<TValue extends string>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<TValue>) {
  return (
    <div className="segmented-wrap">
      <span className="control-label">{label}</span>
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={option.value === value}
            className={`segmented-item${option.value === value ? ' active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DropdownSelect —— 自定义下拉选择器，替代原生 `<select>`                */
/* ------------------------------------------------------------------ */

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownSelectProps {
  label: string;
  options: DropdownOption[];
  /** 空字符串表示「全部」，由调用方负责与具体类型互转。 */
  value: string;
  onChange: (value: string) => void;
  /** 是否在选项前追加「全部」项，默认 true。 */
  allowAll?: boolean;
}

export function DropdownSelect({
  label,
  options,
  value,
  onChange,
  allowAll = true,
}: DropdownSelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const menuOptions: DropdownOption[] = allowAll
    ? [{ value: '', label: `全部${label}` }, ...options]
    : options;
  const selected = options.find((option) => option.value === value);
  const isAll = allowAll && value === '';

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  const chooseOption = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightIndex((index) => Math.min(index + 1, menuOptions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = menuOptions[highlightIndex];
      if (option) {
        chooseOption(option.value);
      }
    }
  };

  return (
    <div className="dropdown" ref={rootRef}>
      <button
        type="button"
        className={`dropdown-trigger${isAll ? '' : ' active'}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="dropdown-label">{label}</span>
        <span className="dropdown-value">{selected ? selected.label : `全部${label}`}</span>
        <span className={`dropdown-chevron${open ? ' open' : ''}`}>
          <ChevronDownIcon size={13} />
        </span>
      </button>
      {open && (
        <div className="dropdown-menu" role="listbox" aria-label={label}>
          {menuOptions.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`dropdown-option${isSelected ? ' selected' : ''}${
                  index === highlightIndex ? ' highlighted' : ''
                }`}
                onMouseEnter={() => setHighlightIndex(index)}
                onClick={() => chooseOption(option.value)}
              >
                <span className="dropdown-option-check">
                  {isSelected && <CheckIcon size={12} />}
                </span>
                <span className="dropdown-option-label">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ToggleSwitch —— 自定义开关，替代原生 `<input type="checkbox">`        */
/* ------------------------------------------------------------------ */

interface ToggleSwitchProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function ToggleSwitch({ label, checked, onChange }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      className={`toggle${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-label">{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* SearchField —— 带图标与清空按钮的搜索输入框                            */
/* ------------------------------------------------------------------ */

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export function SearchField({ value, onChange, placeholder }: SearchFieldProps) {
  return (
    <div className="search-field">
      <span className="search-field-icon">
        <SearchIcon size={14} />
      </span>
      <input
        type="text"
        className="search-field-input"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={placeholder}
      />
      {value !== '' && (
        <button
          type="button"
          className="search-field-clear"
          title="清空关键词"
          onClick={() => onChange('')}
        >
          <CrossIcon size={12} />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ChipMultiSelect —— 铺开的多选标签组（带计数，0 计数置灰禁用）        */
/* ------------------------------------------------------------------ */

export interface ChipOption {
  value: string;
  label: string;
  /** 当前其它筛选条件下的任务数量；为 0 时标签置灰且不可点击。 */
  count: number;
}

interface ChipMultiSelectProps {
  label: string;
  options: ChipOption[];
  /** 已选中的项目集合；空数组表示「全部」，由调用方负责过滤展示。 */
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
}

export function ChipMultiSelect({ label, options, selected, onToggle, onClear }: ChipMultiSelectProps) {
  return (
    <div className="chip-multiselect">
      <span className="control-label">{label}</span>
      <div className="chip-row" role="group" aria-label={`${label}多选`}>
        <button
          type="button"
          className={`chip-toggle all${selected.length === 0 ? ' active' : ''}`}
          aria-pressed={selected.length === 0}
          onClick={onClear}
        >
          全部
        </button>
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          // 已选中的标签即使计数为 0 也保持可点击，否则无法取消选择。
          const isEmpty = option.count === 0 && !isSelected;
          return (
            <button
              key={option.value}
              type="button"
              className={`chip-toggle${isSelected ? ' active' : ''}${isEmpty ? ' empty' : ''}`}
              aria-pressed={isSelected}
              disabled={isEmpty}
              title={isEmpty ? `${option.label}：当前筛选下没有任务` : option.label}
              onClick={() => onToggle(option.value)}
            >
              <span className="chip-toggle-label">{option.label}</span>
              <span className="chip-toggle-count">{option.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
