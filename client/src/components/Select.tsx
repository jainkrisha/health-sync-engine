import { forwardRef, type SelectHTMLAttributes } from 'react';
import { t } from '../i18n/i18n';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: readonly (string | SelectOption)[];
  error?: string;
  helperText?: string;
  required?: boolean;
  containerClassName?: string;
  placeholder?: string;
}

/** A labelled drop-down, laid out like Input. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, error, helperText, required = true, containerClassName = '', className = '', id, placeholder, ...props }, ref) => {
    const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const describedBy = [helperText && `${selectId}-hint`, error && `${selectId}-error`].filter(Boolean).join(' ') || undefined;
    const items: SelectOption[] = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
    return (
      <div className={`form-group ${error ? 'form-group-error' : ''} ${containerClassName}`}>
        {label && (
          <label htmlFor={selectId} className="form-label">
            {label}
            {!required && <span className="font-normal text-muted"> {t('(optional)')}</span>}
          </label>
        )}
        {helperText && (
          <span className="form-hint" id={`${selectId}-hint`}>
            {helperText}
          </span>
        )}
        {error && (
          <span className="form-error" id={`${selectId}-error`}>
            <span className="sr-only">{t('Error:')} </span>
            {t(error)}
          </span>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`select ${error ? 'input-error' : ''} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...props}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {items.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  },
);

Select.displayName = 'Select';
