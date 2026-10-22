import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'soft' | 'outline' | 'ghost' | 'danger';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'solid', size = 'md', children, disabled, type = 'button', ...props }, ref) => {
    const variantStyles = {
      solid: 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98] shadow-2xs focus-visible:ring-blue-500',
      soft: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/80 active:scale-[0.98] focus-visible:ring-blue-400',
      outline: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] focus-visible:ring-slate-400',
      ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400',
      danger: 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98] shadow-2xs focus-visible:ring-red-500'
    };

    const sizeStyles = {
      xs: 'h-7 px-2.5 text-[11px] gap-1 rounded-lg',
      sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
      md: 'h-9 px-3.5 text-xs font-medium gap-2 rounded-xl',
      lg: 'h-10 px-4 text-sm font-medium gap-2 rounded-xl',
      icon: 'h-8 w-8 p-0 rounded-lg flex items-center justify-center shrink-0'
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-all cursor-pointer whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none select-none',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
