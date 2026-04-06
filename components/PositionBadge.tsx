import React from 'react';
import { Position } from '@/lib/poker';

export function PositionBadge({ position, isActive = false, size = 'md' }: { position: Position, isActive?: boolean, size?: 'sm' | 'md' | 'lg' }) {
  const colors: Record<Position, string> = {
    UTG: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    CO: 'bg-green-500/10 text-green-500 border-green-500/20',
    BTN: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    SB: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    BB: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span className={`inline-flex items-center justify-center font-bold font-mono rounded border uppercase tracking-wider ${colors[position]} ${sizes[size]} ${isActive ? 'ring-2 ring-current/30 shadow-sm' : ''}`}>
      {position}
    </span>
  );
}