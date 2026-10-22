import React from 'react';
import { cn } from '../../lib/utils';

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'special' | 'muted';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Chip: React.FC<ChipProps> = ({
  children,
  className,
  variant = 'default',
  size = 'md',
  dot = false,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-slate-50 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    special: 'bg-blue-50 text-blue-700 border-blue-200',
    muted: 'bg-slate-100 text-slate-600 border-slate-200'
  };

  const dotStyles = {
    default: 'bg-slate-400',
    success: 'bg-emerald-500',
    danger: 'bg-red-500',
    warning: 'bg-amber-500',
    special: 'bg-blue-500',
    muted: 'bg-slate-400'
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-[10px] tracking-[0.06em]',
    md: 'px-2.5 py-1 text-[11px] tracking-[0.07em]'
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-md border font-mono select-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotStyles[variant])}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
};
