import { cn } from '@/lib/utils';

interface CountdownProps {
  /** Time remaining in seconds */
  timeRemaining: number;
  /** Warning threshold in seconds (time turns red and pulses below this) */
  warningThreshold?: number;
  /** CSS class name for the container */
  className?: string;
  /** Label to show above the timer */
  label?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses = {
  sm: {
    timer: 'text-4xl',
    label: 'text-xl',
  },
  md: {
    timer: 'text-6xl',
    label: 'text-2xl',
  },
  lg: {
    timer: 'text-8xl',
    label: 'text-3xl',
  },
  xl: {
    timer: 'text-9xl',
    label: 'text-4xl',
  },
};

/**
 * Shared countdown timer component
 * Shows time remaining with optional warning state (red/pulsing) when time is low
 */
function Countdown({
  timeRemaining,
  warningThreshold = 10,
  className,
  label,
  size = 'lg',
}: CountdownProps) {
  const isWarning = timeRemaining <= warningThreshold;
  const sizes = sizeClasses[size];

  return (
    <div className={cn('text-center', className)}>
      {label && (
        <div className={cn('text-muted-foreground mb-2', sizes.label)}>
          {label}
        </div>
      )}
      <div
        className={cn(
          'font-extrabold transition-colors',
          sizes.timer,
          isWarning ? 'text-destructive animate-pulse' : 'text-success'
        )}
      >
        {timeRemaining}s
      </div>
    </div>
  );
}

export default Countdown;
