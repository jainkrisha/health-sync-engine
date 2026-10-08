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
          <label htmlFor={inputId} className="flex items-center gap-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
            {label}
            {required && <span className="text-rose-500 font-bold">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center justify-center">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`form-input ${icon ? 'pl-10' : ''} ${error ? 'form-input-error' : ''} ${className}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error && inputId ? `${inputId}-error` : undefined}
            {...props}
          />
        </div>
        {error ? (
          <p className="form-error mt-0" role="alert" id={`${inputId}-error`}>
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

Input.displayName = 'Input';
