// components/icons/ActionIcons.tsx

import type React from 'react';

export interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

const SVG_ATTRS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const RefreshIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" {...SVG_ATTRS} stroke={color}>
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

export const AddRowIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" {...SVG_ATTRS} stroke={color}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const DeleteRowIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" {...SVG_ATTRS} stroke={color}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export const SubmitIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" {...SVG_ATTRS} stroke={color}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

export const WithdrawIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" {...SVG_ATTRS} stroke={color}>
    <path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
  </svg>
);

export const PreviewIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" {...SVG_ATTRS} stroke={color}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const ExportCsvIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" {...SVG_ATTRS} stroke={color}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="18" x2="12" y2="12" />
    <line x1="9" y1="15" x2="12" y2="12" />
    <line x1="15" y1="15" x2="12" y2="12" />
  </svg>
);

export const ImportIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor', className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" {...SVG_ATTRS} stroke={color}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="12" y1="12" x2="12" y2="18" />
    <line x1="9" y1="15" x2="12" y2="18" />
    <line x1="15" y1="15" x2="12" y2="18" />
  </svg>
);
