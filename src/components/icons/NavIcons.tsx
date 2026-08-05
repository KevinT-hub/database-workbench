// components/icons/NavIcons.tsx

import type React from 'react';
import type { IconProps } from './ActionIcons';

export const ChevronDownIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor', className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const ChevronUpIcon: React.FC<IconProps> = ({ size = 14, color = 'currentColor', className }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);
