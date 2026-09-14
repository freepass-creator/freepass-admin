import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';

export function Button({
  children,
  className = '',
  variant = 'secondary',
  busy = false,
  disabled,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  busy?: boolean;
}) {
  return <button
    {...props}
    type={type}
    className={`ui-button ui-button--${variant} ${className}`.trim()}
    disabled={disabled || busy}
    aria-busy={busy || undefined}
  >{children}</button>;
}
