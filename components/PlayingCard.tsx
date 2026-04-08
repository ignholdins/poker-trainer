import React from 'react';
import { Card as CardType } from '@/lib/poker';

// CoinPoker-style card colors — medium vibrant, clearly readable
const SUIT_CONFIG: Record<string, { bg: string; symbol: string }> = {
  s: {
    bg: 'linear-gradient(160deg, #2e3040 0%, #16181f 100%)',
    symbol: '♠',
  },
  c: {
    bg: 'linear-gradient(160deg, #1e7a30 0%, #0e4418 100%)',
    symbol: '♣',
  },
  d: {
    bg: 'linear-gradient(160deg, #2655cc 0%, #132e80 100%)',
    symbol: '♦',
  },
  h: {
    bg: 'linear-gradient(160deg, #cc1c28 0%, #7a0e16 100%)',
    symbol: '♥',
  },
};

export function PlayingCard({
  card,
  compact = false,
  revealed = true,
}: {
  card: CardType;
  compact?: boolean;
  revealed?: boolean;
}) {
  if (!revealed) {
    return (
      <div
        className={`relative flex-shrink-0 ${compact ? 'w-9 h-[52px]' : 'w-12 h-[70px] sm:w-[60px] sm:h-[84px]'}`}
        style={{
          borderRadius: '8px',
          background: 'linear-gradient(150deg, #7e1020 0%, #3e0610 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.7)',
        }}
      >
        <div
          className="absolute inset-[3px] rounded-[5px] opacity-15"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%),' +
              'repeating-linear-gradient(-45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)',
            backgroundSize: '6px 6px',
          }}
        />
      </div>
    );
  }

  const { bg, symbol } = SUIT_CONFIG[card.suit];

  // Card dimensions
  const wrapper = compact
    ? 'w-9 h-[52px]'
    : 'w-12 h-[70px] sm:w-[60px] sm:h-[84px]';

  // Corner rank: very large — dominant like CoinPoker
  const rankSize = compact ? 'text-[22px]' : 'text-[28px] sm:text-[34px]';
  // Suit below rank: smaller
  const suitSize = compact ? 'text-[12px]' : 'text-[14px] sm:text-[17px]';

  return (
    <div
      className={`relative flex-shrink-0 overflow-hidden select-none ${wrapper}`}
      style={{
        borderRadius: '8px',
        background: bg,
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 5px 16px rgba(0,0,0,0.6)',
      }}
    >
      {/* TOP-LEFT: large rank + suit below — CoinPoker style */}
      <div
        className="absolute top-[2px] left-[4px] flex flex-col items-start leading-none font-black text-white"
      >
        <span className={rankSize} style={{ lineHeight: 1 }}>{card.rank}</span>
        <span className={suitSize} style={{ lineHeight: 1, marginTop: '1px' }}>{symbol}</span>
      </div>

      {/* BOTTOM-RIGHT: same, rotated 180° */}
      <div
        className="absolute bottom-[2px] right-[4px] flex flex-col items-start leading-none font-black text-white rotate-180"
      >
        <span className={rankSize} style={{ lineHeight: 1 }}>{card.rank}</span>
        <span className={suitSize} style={{ lineHeight: 1, marginTop: '1px' }}>{symbol}</span>
      </div>

      {/* Subtle top gloss only */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(170deg, rgba(255,255,255,0.10) 0%, transparent 45%)',
          borderRadius: '7px',
        }}
      />
    </div>
  );
}

export function InlineCard({ card }: { card: CardType }) {
  const color: Record<string, string> = {
    s: '#9999cc', h: '#dd5566', d: '#6688dd', c: '#44aa66',
  };
  const { symbol } = SUIT_CONFIG[card.suit];
  return (
    <span
      className="inline-flex items-center justify-center px-1 py-0.5 rounded font-black text-[10px] sm:text-xs w-6 sm:w-7"
      style={{
        background: '#0d1623',
        border: '1px solid rgba(255,255,255,0.1)',
        color: color[card.suit],
      }}
    >
      {card.rank}{symbol}
    </span>
  );
}