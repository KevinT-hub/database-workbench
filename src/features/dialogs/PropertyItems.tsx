import React, { useState } from 'react';
import { Icon } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

/* ---------- PropertyItem ---------- */
interface PropertyItemProps {
  label: string;
  value: string | number | boolean | undefined | null;
  isPassword?: boolean;
  isCopyable?: boolean;
}

export const PropertyItem: React.FC<PropertyItemProps> = ({
  label,
  value,
  isPassword = false,
  isCopyable = true,
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const hasValue = value !== '' && value !== undefined && value !== null;

  const displayValue = isPassword
    ? '••••••••'
    : !hasValue
      ? '-'
      : String(value);

  const handleCopy = () => {
    if (isCopyable && !isPassword && hasValue) {
      navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const canCopy = isCopyable && !isPassword && hasValue;

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-[var(--properties-item-border)] last:border-b-0 animate-[property-item-fade-in_0.3s_ease-out]">
      <div className="text-[13px] text-[var(--bp6-text-color-muted)] shrink-0 min-w-[100px]">
        {label}
      </div>
      <div
        className={cn(
          'flex items-center gap-2 flex-1 justify-end text-[13px] font-medium break-all',
          canCopy && 'cursor-pointer px-2 py-1 rounded transition-all duration-150 hover:bg-[var(--properties-item-hover)]',
          copied && 'text-[var(--bp6-intent-success)]'
        )}
        onClick={handleCopy}
        title={canCopy ? t('propertiesDialog.clickToCopy') : ''}
      >
        <span>{displayValue}</span>
        {canCopy && (
          <Icon
            icon={copied ? 'tick' : 'duplicate'}
            size={14}
            className={cn(
              'transition-opacity duration-150',
              copied ? 'opacity-100' : 'opacity-50'
            )}
          />
        )}
      </div>
    </div>
  );
};

/* ---------- PropertyGroup ---------- */
interface PropertyGroupProps {
  title: string;
  children: React.ReactNode;
}

export const PropertyGroup: React.FC<PropertyGroupProps> = ({ title, children }) => (
  <div className="flex flex-col gap-2">
    <div className="text-xs font-semibold text-[var(--bp6-text-color-muted)] uppercase tracking-wide mb-1">
      {title}
    </div>
    <div className="flex flex-col rounded-lg overflow-hidden border border-[var(--properties-group-border)] bg-[var(--properties-group-bg)]">
      {children}
    </div>
  </div>
);
