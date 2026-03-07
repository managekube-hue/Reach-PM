interface NotificationBadgeProps {
  count: number;
  type: 'channel' | 'dm' | 'mention';
  size?: 'sm' | 'md';
}

export function NotificationBadge({ count, type, size = 'sm' }: NotificationBadgeProps) {
  if (count === 0) return null;

  const sizeClasses = size === 'sm' 
    ? 'min-w-[18px] h-[18px] text-[10px] px-1.5' 
    : 'min-w-[22px] h-[22px] text-[11px] px-2';

  const colorClasses = type === 'mention'
    ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
    : type === 'dm'
    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
    : 'bg-[#94a3b8] text-[#16171d] font-bold';

  return (
    <span className={`${sizeClasses} ${colorClasses} rounded-full flex items-center justify-center font-bold`}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
