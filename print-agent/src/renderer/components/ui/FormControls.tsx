import React, { useState } from 'react';
import { Check, Copy, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  description?: string;
  error?: string;
  badge?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  description,
  error,
  badge,
  required,
  className,
  children
}) => {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={htmlFor}
          className="block text-xs font-semibold text-[var(--text-secondary)] select-none"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {badge}
      </div>

      {children}

      {description && !error && (
        <p className="text-[11.5px] leading-relaxed text-[var(--text-muted)] select-none">
          {description}
        </p>
      )}

      {error && (
        <p role="alert" className="text-[11.5px] text-red-600 dark:text-red-400 font-medium flex items-center gap-1 select-none">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

export interface ReadOnlyFieldProps {
  label: string;
  value: string;
  badge?: React.ReactNode;
  description?: string;
  icon?: React.ReactNode;
  copyable?: boolean;
  onCopy?: (val: string) => Promise<boolean>;
  className?: string;
}

export const ReadOnlyField: React.FC<ReadOnlyFieldProps> = ({
  label,
  value,
  badge,
  description,
  icon,
  copyable,
  onCopy,
  className
}) => {
  const [hasCopied, setHasCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    let success = false;
    if (onCopy) {
      success = await onCopy(value);
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(value);
        success = true;
      } catch {
        success = false;
      }
    }
    if (success) {
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2200);
    }
  };

  return (
    <FormField label={label} badge={badge} description={description} className={className}>
      <div className="relative flex items-center">
        {icon && (
          <span className="absolute left-3.5 text-[var(--text-faint)] pointer-events-none shrink-0">
            {icon}
          </span>
        )}
        <input
          type="text"
          readOnly
          value={value}
          className={cn(
            'pf-form-input !font-mono !text-xs !bg-[var(--bg-subtle)] !text-[var(--text-secondary)] select-all',
            icon ? '!pl-10' : '!pl-3.5',
            copyable ? '!pr-24' : '!pr-3.5'
          )}
        />
        {copyable && value && (
          <button
            type="button"
            onClick={handleCopy}
            className="absolute right-2 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-default)] shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Copy to clipboard"
          >
            {hasCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>
    </FormField>
  );
};

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, icon, action, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {icon && (
          <span className="absolute left-3.5 text-[var(--text-faint)] pointer-events-none shrink-0">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            'pf-form-input',
            icon ? '!pl-10' : '!pl-3.5',
            action ? '!pr-24' : '!pr-3.5',
            className
          )}
          {...props}
        />
        {action && <div className="absolute right-2 flex items-center">{action}</div>}
      </div>
    );
  }
);
TextInput.displayName = 'TextInput';

export interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: React.ReactNode;
}

export const SelectInput = React.forwardRef<HTMLSelectElement, SelectInputProps>(
  ({ className, icon, children, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {icon && (
          <span className="absolute left-3.5 text-[var(--text-faint)] pointer-events-none shrink-0 z-10">
            {icon}
          </span>
        )}
        <select
          ref={ref}
          className={cn('pf-form-input pf-form-select', icon ? '!pl-10' : '!pl-3.5', className)}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  }
);
SelectInput.displayName = 'SelectInput';

export interface ToggleSwitchProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  id,
  checked,
  onChange,
  label,
  description,
  disabled,
  className
}) => {
  return (
    <div
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      className={cn(
        'flex items-start justify-between gap-4 p-3.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer select-none',
        disabled && 'opacity-60 cursor-not-allowed hover:bg-[var(--bg-surface)]',
        className
      )}
    >
      <div className="space-y-0.5 min-w-0 flex-1">
        <label
          htmlFor={id}
          className="text-xs font-semibold text-[var(--text-primary)] cursor-pointer block"
        >
          {label}
        </label>
        {description && (
          <p className="text-[11.5px] leading-relaxed text-[var(--text-muted)]">
            {description}
          </p>
        )}
      </div>

      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) onChange(!checked);
        }}
        className="pf-switch-track mt-0.5"
        data-checked={checked}
      >
        <span className="pf-switch-thumb" />
      </button>
    </div>
  );
};

export interface SettingsCardProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const SettingsCard: React.FC<SettingsCardProps> = ({
  title,
  description,
  icon,
  badge,
  headerAction,
  children,
  className
}) => {
  return (
    <div className={cn('pf-card p-5 space-y-4', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-[var(--border-default)]">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0 border border-teal-500/20">
              {icon}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
              {badge}
            </div>
            {description && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {headerAction}
      </div>

      <div className="space-y-4">{children}</div>
    </div>
  );
};

export interface SaveButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  status: 'idle' | 'saving' | 'saved' | 'error';
  idleText?: string;
  savingText?: string;
  savedText?: string;
  errorText?: string;
  icon?: React.ReactNode;
}

export const SaveButton: React.FC<SaveButtonProps> = ({
  status,
  idleText = 'Save',
  savingText = 'Saving...',
  savedText = 'Saved ✓',
  errorText = 'Save Failed',
  icon,
  disabled,
  className,
  ...props
}) => {
  const isSaving = status === 'saving';
  const isSaved = status === 'saved';
  const isError = status === 'error';

  return (
    <button
      type="submit"
      disabled={disabled || isSaving}
      className={cn(
        'primary-button !min-h-[44px] !px-4 !text-xs font-semibold transition-all',
        isSaved && '!bg-emerald-600 !border-emerald-500 text-white',
        isError && '!bg-red-600 !border-red-500 text-white',
        className
      )}
      {...props}
    >
      {isSaving ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isSaved ? (
        <Check className="w-4 h-4" />
      ) : isError ? (
        <AlertCircle className="w-4 h-4" />
      ) : (
        icon
      )}
      <span>{isSaving ? savingText : isSaved ? savedText : isError ? errorText : idleText}</span>
    </button>
  );
};

