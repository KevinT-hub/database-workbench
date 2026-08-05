import React from 'react';
import { NumericInput, HTMLSelect } from '@blueprintjs/core';

/* ---------- CustomSwitch ---------- */
interface CustomSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const CustomSwitch: React.FC<CustomSwitchProps> = ({ checked, onChange }) => (
  <label className="options-switch">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="options-switch-slider" />
  </label>
);

/* ---------- SettingItemSwitch ---------- */
interface SettingItemSwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const SettingItemSwitch: React.FC<SettingItemSwitchProps> = ({
  label,
  description,
  checked,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-[var(--options-item-bg)] hover:bg-[var(--options-item-hover)] transition-colors duration-150 animate-[setting-item-fade-in_0.3s_ease-out]">
    <div className="flex-1 min-w-0 flex flex-col gap-1">
      <div className="text-[13px] font-medium text-[var(--bp6-text-color)] leading-snug">
        {label}
      </div>
      {description && (
        <div className="text-xs text-[var(--bp6-text-color-muted)] leading-snug">
          {description}
        </div>
      )}
    </div>
    <CustomSwitch checked={checked} onChange={onChange} />
  </div>
);

/* ---------- SettingItemNumber ---------- */
interface SettingItemNumberProps {
  label: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  stepSize?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

export const SettingItemNumber: React.FC<SettingItemNumberProps> = ({
  label,
  description,
  value,
  min,
  max,
  stepSize = 1,
  suffix,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-[var(--options-item-bg)] hover:bg-[var(--options-item-hover)] transition-colors duration-150 animate-[setting-item-fade-in_0.3s_ease-out]">
    <div className="flex-1 min-w-0 flex flex-col gap-1">
      <div className="text-[13px] font-medium text-[var(--bp6-text-color)] leading-snug">
        {label}
      </div>
      {description && (
        <div className="text-xs text-[var(--bp6-text-color-muted)] leading-snug">
          {description}
        </div>
      )}
    </div>
    <div className="flex items-center gap-2 shrink-0 options-numeric">
      <NumericInput
        value={value}
        min={min}
        max={max}
        stepSize={stepSize}
        onValueChange={onChange}
        buttonPosition="right"
      />
      {suffix && (
        <span className="text-xs text-[var(--bp6-text-color-muted)] min-w-[30px]">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

/* ---------- SettingItemSelect ---------- */
interface SettingItemSelectProps {
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export const SettingItemSelect: React.FC<SettingItemSelectProps> = ({
  label,
  description,
  value,
  options,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-4 px-4 py-3.5 bg-[var(--options-item-bg)] hover:bg-[var(--options-item-hover)] transition-colors duration-150 animate-[setting-item-fade-in_0.3s_ease-out]">
    <div className="flex-1 min-w-0 flex flex-col gap-1">
      <div className="text-[13px] font-medium text-[var(--bp6-text-color)] leading-snug">
        {label}
      </div>
      {description && (
        <div className="text-xs text-[var(--bp6-text-color-muted)] leading-snug">
          {description}
        </div>
      )}
    </div>
    <HTMLSelect
      value={value}
      options={options}
      onChange={(e) => onChange(e.currentTarget.value)}
      className="options-select shrink-0 min-w-[140px]"
    />
  </div>
);

/* ---------- SettingGroup ---------- */
interface SettingGroupProps {
  title?: string;
  children: React.ReactNode;
}

export const SettingGroup: React.FC<SettingGroupProps> = ({ title, children }) => (
  <div className="flex flex-col gap-3">
    {title && (
      <div className="text-xs font-semibold text-[var(--bp6-text-color-muted)] uppercase tracking-wide mb-1">
        {title}
      </div>
    )}
    <div className="flex flex-col gap-px rounded-lg overflow-hidden bg-[var(--options-group-divider)]">
      {children}
    </div>
  </div>
);
