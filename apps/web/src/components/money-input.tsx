'use client';

import { formatPersianNumber, toLatinDigits } from '@dastmozd/core';
import { Input, type InputProps } from '@dastmozd/ui';
import { useEffect, useState } from 'react';

export interface MoneyInputProps extends Omit<InputProps, 'value' | 'onChange' | 'numeric'> {
  value: number;
  onChange: (value: number) => void;
  /** واحد نمایشی؛ فقط برای راهنمای زیر فیلد استفاده می‌شود. */
  unit?: 'IRR' | 'IRT';
}

function parseAmount(input: string): number {
  const latin = toLatinDigits(input).replace(/[^\d]/g, '');
  if (!latin) return 0;
  const parsed = Number(latin);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * ورودی مبلغ ریالی/تومانی با پذیرش ارقام فارسی و لاتین.
 * هنگام تایپ، ورودی آزاد است و با خروج از فیلد، مبلغ با جداکننده هزارگان مرتب می‌شود.
 */
export function MoneyInput({ value, onChange, onBlur, unit = 'IRR', ...props }: MoneyInputProps) {
  const [text, setText] = useState(() => (value ? formatPersianNumber(value) : ''));

  useEffect(() => {
    setText(value ? formatPersianNumber(value) : '');
  }, [value]);

  return (
    <div className="relative">
      <Input
        {...props}
        numeric
        inputMode="numeric"
        dir="rtl"
        value={text}
        onBlur={(event) => {
          const parsed = parseAmount(text);
          setText(parsed ? formatPersianNumber(parsed) : '');
          onChange(parsed);
          onBlur?.(event);
        }}
        onChange={(event) => {
          const raw = event.target.value;
          setText(raw);
          onChange(parseAmount(raw));
        }}
      />
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[rgb(var(--dm-text-subtle))]">
        {unit === 'IRR' ? 'ریال' : 'تومان'}
      </span>
    </div>
  );
}
