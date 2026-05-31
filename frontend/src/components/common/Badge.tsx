import clsx from 'clsx';
import type { OptionType, PositionDirection, OrderStatus } from '@/types/paper';

type BadgeVariant = OptionType | 'ITM' | 'ATM' | 'OTM' | PositionDirection | OrderStatus;

interface BadgeProps {
  variant: BadgeVariant;
  children?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  CE: 'bg-blue-500/20 text-blue-400',
  PE: 'bg-orange-500/20 text-orange-400',
  ITM: 'bg-profit/20 text-profit',
  ATM: 'bg-atm/20 text-atm',
  OTM: 'bg-terminal-muted/20 text-terminal-muted',
  LONG: 'bg-transparent text-profit',
  SHORT: 'bg-transparent text-loss',
  FILLED: 'bg-transparent text-profit',
  PENDING: 'bg-transparent text-atm',
  CANCELLED: 'bg-transparent text-terminal-muted',
  REJECTED: 'bg-transparent text-loss',
};

export default function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center text-xs px-2 py-0.5 rounded font-mono font-medium',
        variantStyles[variant]
      )}
    >
      {children ?? variant}
    </span>
  );
}
