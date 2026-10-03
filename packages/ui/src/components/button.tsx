'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '../lib/cn';

/**
 * دکمه پایه سامانه. همه حالت‌ها با رنگ‌های توکن‌شده ساخته می‌شوند تا در تم روشن و
 * تیره کنتراست کافی داشته باشند.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--dm-radius-md)] text-sm font-semibold transition-[background-color,box-shadow,transform] duration-[var(--dm-duration-fast)] ease-[var(--dm-ease-standard)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--dm-ring))] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--dm-background))] disabled:pointer-events-none disabled:opacity-55 active:translate-y-[1px] [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-[rgb(var(--dm-primary))] text-white shadow-[var(--dm-shadow-xs)] hover:bg-[rgb(var(--dm-primary-hover))]',
        secondary:
          'bg-[rgb(var(--dm-secondary))] text-white hover:bg-[rgb(var(--dm-secondary-soft))] shadow-[var(--dm-shadow-xs)]',
        outline:
          'border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))] text-[rgb(var(--dm-text))] hover:border-[rgb(var(--dm-border-strong))] hover:bg-[rgb(var(--dm-surface-sunken))]',
        ghost:
          'text-[rgb(var(--dm-text-muted))] hover:bg-[rgb(var(--dm-surface-sunken))] hover:text-[rgb(var(--dm-text))]',
        danger: 'bg-[rgb(var(--dm-danger))] text-white hover:opacity-90',
        success: 'bg-[rgb(var(--dm-success))] text-white hover:opacity-90',
        accent: 'bg-[rgb(var(--dm-accent))] text-white hover:opacity-90',
        link: 'text-[rgb(var(--dm-primary))] underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4',
        lg: 'h-11 px-6 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** رندر به‌صورت فرزند (برای لینک‌های Next.js). */
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild = false, type = 'button', ...props },
  ref,
) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
});

export { buttonVariants };
