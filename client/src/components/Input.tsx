import { forwardRef, type InputHTMLAttributes } from 'react';
import { t } from '../i18n/i18n';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Grey line under the label: an example or what the field is for. */
  helperText?: string;
  required?: boolean;
  containerClassName?: string;
  /** Width class that matches the expected answer, e.g. "w-chars-7" for a blood pressure. */
  width?: string;
}

/** A labelled text field: label, hint, error message, then the box. */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, required, containerClassName = '', className = '', width = 'w-full', id, ...props }, ref) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const describedBy = [helperText && `${inputId}-hint`, error && `${inputId}-error`].filter(Boolean).join(' ') || undefined;
    return (
      <div className={`form-group ${error ? 'form-group-error' : ''} ${containerClassName}`}>
        {label && (
          <label htmlFor={inputId} className="form-label">
            {label}
            {!required && <span className="font-normal text-muted"> {t('(optional)')}</span>}
          </label>
        )}
        {helperText && (
          <span className="form-hint" id={`${inputId}-hint`}>
            {helperText}
          </span>
        )}
        {error && (
          <span className="form-error" id={`${inputId}-error`}>
            <span className="sr-only">{t('Error:')} </span>
            {t(error)}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`input ${width} ${error ? 'input-error' : ''} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        />
      </div>
    );
  },
);

Input.displayName = 'Input';
