import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';
import { Slot } from '../lib/slot.js';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet';
export type ButtonSize = 'small' | 'medium';
export type ButtonTone = 'neutral' | 'accent';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  tone?: ButtonTone | undefined;
  /** Render the child element instead of a `<button>`, merging props onto it. */
  asChild?: boolean | undefined;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  className,
  variant = 'secondary',
  size = 'medium',
  tone = 'neutral',
  type,
  asChild = false,
  ...props
}, ref) {
  const Component = asChild ? Slot : 'button';
  return (
    <Component
      data-slot="button"
      {...props}
      {...(asChild ? (type ? { type } : {}) : { type: type ?? 'button' })}
      ref={ref}
      className={cn('astra-button', className)}
      data-variant={variant}
      data-size={size}
      data-tone={tone}
    />
  );
});

export interface IconButtonProps extends ButtonProps {
  /** Accessible name; icon buttons never rely on visible text. */
  label: string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, className, ...props }, ref) {
    return (
      <Button
        data-slot="icon-button"
        {...props}
        ref={ref}
        className={cn('astra-icon-button', className)}
        aria-label={label}
      />
    );
  },
);
