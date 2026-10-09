import React, { forwardRef } from 'react';
import { Icon } from './Icon';
import { t } from '../i18n/i18n';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: readonly (string | SelectOption)[];
  error?: string;
  helperText?: string;
  required?: boolean;
  containerClassName?: string;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      options,
      error,
      helperText,
      required,
      containerClassName = '',
      className = '',
      id,
      placeholder = t('Select an option'),
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    const formattedOptions: SelectOption[] = options.map((opt) =>
      typeof opt === 'string' ? { value: opt, label: opt } : opt
    );

    return (
      <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
        {label && (
          <label htmlFor={selectId} className="flex items-center gap-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {label}
            {required && <span className="text-rose-500 font-bold">*</span>}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`form-input cursor-pointer appearance-none pr-10 ${error ? 'form-input-error' : ''} ${className}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error && selectId ? `${selectId}-error` : undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled hidden>
                {placeholder}
              </option>
            )}
            {formattedOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
        {error ? (
          <p className="form-error mt-0" role="alert" id={`${selectId}-error`}>
            <Icon name="alert" className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{t(error)}</span>
          </p>
        ) : helperText ? (
          <p className="form-help mt-0">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
