import React, { forwardRef } from 'react';
import { Icon } from './Icon';
import { t } from '../i18n/i18n';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  containerClassName?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      required,
      containerClassName = '',
      className = '',
      id,
      icon,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);

    return (
      <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
        {label && (
          <label htmlFor={inputId} className="flex flex-wrap items-baseline gap-x-1.5 text-base font-semibold text-slate-900 dark:text-slate-100">
            {label}
            {required && <span className="text-sm font-normal text-slate-700 dark:text-slate-300">{t('(required)')}</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3 text-slate-500 pointer-events-none flex items-center justify-center">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`form-input ${icon ? 'pl-10' : ''} ${error ? 'form-input-error' : ''} ${className}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error && inputId ? `${inputId}-error` : helperText && inputId ? `${inputId}-help` : undefined}
            {...props}
          />
        </div>
        {error ? (
          <p className="form-error mt-0" role="alert" id={`${inputId}-error`}>
            <Icon name="alert" className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{t(error)}</span>
          </p>
        ) : helperText ? (
          <p className="form-help mt-0" id={`${inputId}-help`}>{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
