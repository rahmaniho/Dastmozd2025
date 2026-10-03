'use client';

import * as React from 'react';
import { cn } from '../lib/cn';

/* --------------------------------------------------------------------- Input */

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** نمایش ارقام فارسی در حالت غیرفعال/نمایشی. */
  numeric?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, numeric = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-[var(--dm-radius-md)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))] px-3 text-sm text-[rgb(var(--dm-text))] shadow-[var(--dm-shadow-xs)] transition-colors placeholder:text-[rgb(var(--dm-text-subtle))] hover:border-[rgb(var(--dm-border-strong))] focus-visible:border-[rgb(var(--dm-primary))] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
        numeric && 'dm-numeric',
        'aria-[invalid=true]:border-[rgb(var(--dm-danger))] aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-[rgb(var(--dm-danger))]',
        className,
      )}
      {...props}
    />
  );
});

/* ------------------------------------------------------------------ Textarea */

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'min-h-24 w-full rounded-[var(--dm-radius-md)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))] p-3 text-sm text-[rgb(var(--dm-text))] shadow-[var(--dm-shadow-xs)] transition-colors placeholder:text-[rgb(var(--dm-text-subtle))] focus-visible:border-[rgb(var(--dm-primary))] focus-visible:outline-none',
        className,
      )}
      {...props}
    />
  );
});

/* ------------------------------------------------------------------- Select */

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
}

/** لیست انتخابی بومی مرورگر — دسترس‌پذیر، راست‌چین و بدون وابستگی اضافی. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, options, placeholder, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-10 w-full appearance-none rounded-[var(--dm-radius-md)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))] px-3 text-sm text-[rgb(var(--dm-text))] shadow-[var(--dm-shadow-xs)] transition-colors hover:border-[rgb(var(--dm-border-strong))] focus-visible:border-[rgb(var(--dm-primary))] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
});

/* -------------------------------------------------------------------- Label */

export const Label = React.forwardRef<
  HTMLLabelElement | HTMLSpanElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(function Label({ className, htmlFor, children, ...props }, ref) {
  const classes = cn(
    'mb-1.5 block text-xs font-semibold text-[rgb(var(--dm-text-muted))]',
    className,
  );
  // برچسب بدون کنترل متناظر (مثلاً عنوان گروه) به‌صورت span رندر می‌شود تا
  // پیوند برچسب و کنترل در صفحه‌خوان‌ها مخدوش نشود.
  if (!htmlFor) {
    return (
      <span ref={ref as React.Ref<HTMLSpanElement>} className={classes} {...props}>
        {children}
      </span>
    );
  }
  return (
    <label
      ref={ref as React.Ref<HTMLLabelElement>}
      htmlFor={htmlFor}
      className={classes}
      {...props}
    >
      {children}
    </label>
  );
});

/* --------------------------------------------------------------- Form field */

export interface FormFieldProps {
  label: string;
  htmlFor?: string;
  /** پیام خطای اعتبارسنجی (فارسی). */
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

/** ترکیب برچسب، ورودی، راهنما و پیام خطا با ویژگی‌های دسترس‌پذیری کامل. */
export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn('w-full', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="mr-1 text-[rgb(var(--dm-danger))]">*</span> : null}
      </Label>
      {children}
      {hint && !error ? (
        <p className="mt-1 text-xs text-[rgb(var(--dm-text-subtle))]">{hint}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-[rgb(var(--dm-danger))]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Checkbox */

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, id, ...props },
  ref,
) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="size-4 rounded border-[rgb(var(--dm-border-strong))] text-[rgb(var(--dm-primary))] accent-[rgb(var(--dm-primary))]"
        {...props}
      />
      {label ? (
        <label htmlFor={inputId} className="text-sm text-[rgb(var(--dm-text))]">
          {label}
        </label>
      ) : null}
    </div>
  );
});

/* -------------------------------------------------------------------- Switch */

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

/** کلید دوحالته دسترس‌پذیر با نقش switch. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  id,
}: SwitchProps) {
  const autoId = React.useId();
  const switchId = id ?? autoId;
  return (
    <div className="flex items-start justify-between gap-4">
      {label ? (
        <div className="flex flex-col">
          <label htmlFor={switchId} className="text-sm font-medium text-[rgb(var(--dm-text))]">
            {label}
          </label>
          {description ? (
            <span className="text-xs text-[rgb(var(--dm-text-muted))]">{description}</span>
          ) : null}
        </div>
      ) : null}
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--dm-ring))] disabled:opacity-50',
          checked
            ? 'border-transparent bg-[rgb(var(--dm-primary))]'
            : 'border-[rgb(var(--dm-border-strong))] bg-[rgb(var(--dm-surface-sunken))]',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'pointer-events-none block size-5 translate-x-0 rounded-full bg-white shadow transition-transform',
            checked ? '-translate-x-5' : '-translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}
