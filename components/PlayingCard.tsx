import React from 'react';
import { Card as CardType } from '@/lib/poker';

// CoinPoker-style card colors — medium vibrant, clearly readable
const SUIT_CONFIG: Record<string, { bg: string; highlight: string; symbol: string }> = {
  s: {
    // Dark charcoal/black — spades (darkest suit)
    bg: 'linear-gradient(160deg, #2e3040 0%, #16181f 100%)',
    highlight: 'rgba(255,255,255,0.09)',
    symbol: '♠',
  },
  c: {
    // Medium green — clubs (clear, vibrant green)
    bg: 'linear-gradient(160deg, #1e7a30 0%, #0e4418 100%)',
    highlight: 'rgba(255,255,255,0.09)',
    symbol: '♣',
  },
  d: {
    // Medium blue — diamonds (clear, vibrant blue)
    bg: 'linear-gradient(160deg, #2655cc 0%, #132e80 100%)',
    highlight: 'rgba(255,255,255,0.09)',
    symbol: '♦',
  },
  h: {
    // Medium red — hearts (clear, vibrant red)
    bg: 'linear-gradient(160deg, #cc1c28 0%, #7a0e16 100%)',
    highlight: 'rgba(255,255,255,0.09)',
    symbol: '♥',
  },
};

export function PlayingCard({ card, compact = false, revealed = true }: {
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
          background: 'linear-gradient(150deg, #7e0f18 0%, #3e0609 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.7)',
        }}
      >
        <div
          className="absolute inset-[3px] rounded-[5px] opacity-15"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%),repeating-linear-gradient(-45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)',
            backgroundSize: '6px 6px',
          }}
        />
      </div>
    );
  }

  const { bg, highlight, symbol } = SUIT_CONFIG[card.suit];

  const wrapper = compact ? 'w-9 h-[52px]' : 'w-12 h-[70px] sm:w-[60px] sm:h-[84px]';
  const cornerRank = compact ? 'text-[11px]' : 'text-sm sm:text-[15px]';
  const cornerSuit = compact ? 'text-[9px]' : 'text-[9px] sm:text-[11px]';
  const centerRank = compact ? 'text-xl' : 'text-[28px] sm:text-[36px]';
  const centerSuit = compact ? 'text-sm' : 'text-base sm:text-xl';

  return (
    <div
      className={`relative flex-shrink-0 flex flex-col items-center justify-center ${wrapper}`}
      style={{
        borderRadius: '8px',
        background: bg,
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 5px 16px rgba(0,0,0,0.65)',
      }}
    >
      {/* Top-left corner */}
      <div
        className={`absolute top-[3px] left-[4px] flex flex-col items-center leading-none font-black text-white ${cornerRank}`}
      >
        <span className="leading-none">{card.rank}</span>
        <span className={`leading-none ${cornerSuit}`}>{symbol}</span>
      </div>

      {/* Center: large rank + suit symbol */}
      <div className="flex flex-col items-center text-white font-black select-none" style={{ lineHeight: 1 }}>
        <span className={centerRank}>{card.rank}</span>
        <span className={`${centerSuit} -mt-1`}>{symbol}</span>
      </div>

      {/* Bottom-right corner flipped */}
      <div
        className={`absolute bottom-[3px] right-[4px] flex flex-col items-center leading-none font-black rotate-180 text-white ${cornerRank}`}
      >
        <span className="leading-none">{card.rank}</span>
        <span className={`leading-none ${cornerSuit}`}>{symbol}</span>
      </div>

      {/* Subtle top-left gloss sheen only */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: '7px',
          background: `radial-gradient(ellipse at 30% 20%, ${highlight} 0%, transparent 65%)`,
        }}
      />
    </div>
  );
}

export function InlineCard({ card }: { card: CardType }) {
  const color: Record<string, string> = {
    s: '#9999bb', h: '#cc5566', d: '#6677cc', c: '#449966',
  };
  const { symbol } = SUIT_CONFIG[card.suit];
  return (
    <span
      className="inline-flex items-center justify-center px-1 py-0.5 rounded font-black text-[10px] sm:text-xs w-6 sm:w-7"
      style={{ background: '#0d1623', border: '1px solid rgba(255,255,255,0.1)', color: color[card.suit] }}
    >
      {card.rank}{symbol}
    </span>
  );
}