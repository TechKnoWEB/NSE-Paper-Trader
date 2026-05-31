import clsx from 'clsx';
import Spinner from './Spinner';

interface ButtonProps {
  variant?: 'primary' | 'ghost' | 'danger' | 'success' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  type?: 'button' | 'submit';
  className?: string;
}

const variantStyles = {
  primary: 'bg-accent text-white hover:bg-accent/90',
  ghost: 'bg-transparent text-terminal-text hover:bg-terminal-surface',
  danger: 'bg-loss text-white hover:bg-loss/90',
  success: 'bg-profit text-white hover:bg-profit/90',
  outline: 'border border-terminal-border text-terminal-text hover:bg-terminal-surface',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-lg',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  children,
  type = 'button',
  className,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-accent/50',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        isDisabled && 'opacity-50 cursor-not-allowed',
        !isDisabled && 'cursor-pointer',
        className
      )}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
