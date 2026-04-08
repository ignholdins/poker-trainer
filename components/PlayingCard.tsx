import React from 'react';
import { Card as CardType } from '@/lib/poker';

// Exact CoinPoker-style: soft gradient, very subtle border (no neon glow)
const SUIT_CONFIG: Record<string, { bg: string; border: string; glow: string; symbol: string }> = {
  s: {
    bg: 'linear-gradient(150deg, #1c5bb5 10%, #0c2f6e 100%)',
    border: 'rgba(80,130,220,0.5)',   // soft, not neon
    glow: 'rgba(30,80,180,0.4)',
    symbol: '♠',
  },
  h: {
    bg: 'linear-gradient(150deg, #c41424 10%, #7a0a14 100%)',
    border: 'rgba(200,60,80,0.5)',
    glow: 'rgba(180,30,50,0.4)',
    symbol: '♥',
  },
  d: {
    bg: 'linear-gradient(150deg, #c83210 10%, #7e1a04 100%)',
    border: 'rgba(200,80,40,0.5)',
    glow: 'rgba(170,50,20,0.4)',
    symbol: '♦',
  },
  c: {
    bg: 'linear-gradient(150deg, #136930 10%, #074018 100%)',
    border: 'rgba(40,140,70,0.5)',
    glow: 'rgba(20,100,40,0.4)',
    symbol: '♣',
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
          borderRadius: '7px',
          background: 'linear-gradient(150deg, #8e1520 0%, #501018 100%)',
          border: '1.5px solid rgba(160,40,60,0.4)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.55)',
        }}
      >
        <div
          className="absolute inset-[3px] rounded-[5px] opacity-20"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%),repeating-linear-gradient(-45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)',
            backgroundSize: '6px 6px',
          }}
        />
      </div>
    );
  }

  const { bg, border, glow, symbol } = SUIT_CONFIG[card.suit];

  const wrapper = compact
    ? 'w-9 h-[52px]'
    : 'w-12 h-[70px] sm:w-[60px] sm:h-[84px]';
  const cornerRank = compact ? 'text-[11px]' : 'text-sm sm:text-base';
  const cornerSuit = compact ? 'text-[9px]' : 'text-[10px] sm:text-xs';
  const centerRank = compact ? 'text-xl' : 'text-3xl sm:text-4xl';
  const centerSuit = compact ? 'text-xs' : 'text-sm sm:text-base';

  return (
    <div
      className={`relative flex-shrink-0 flex flex-col items-center justify-center ${wrapper}`}
      style={{
        borderRadius: '7px',
        background: bg,
        border: `1.5px solid ${border}`,
        boxShadow: `0 4px 14px ${glow}, inset 0 1px 0 rgba(255,255,255,0.10)`,
      }}
    >
      {/* Top-left corner */}
      <div className={`absolute top-[3px] left-[4px] flex flex-col items-center leading-none font-black text-white ${cornerRank}`}>
        <span>{card.rank}</span>
        <span className={`${cornerSuit} -mt-0.5 opacity-90`}>{symbol}</span>
      </div>

      {/* Center: large rank + suit */}
      <div className="flex flex-col items-center leading-none text-white font-black select-none">
        <span className={centerRank} style={{ lineHeight: 1 }}>{card.rank}</span>
        <span className={centerSuit} style={{ lineHeight: 1.1, opacity: 0.9 }}>{symbol}</span>
      </div>

      {/* Bottom-right corner flipped */}
      <div className={`absolute bottom-[3px] right-[4px] flex flex-col items-center leading-none font-black rotate-180 text-white ${cornerRank}`}>
        <span>{card.rank}</span>
        <span className={`${cornerSuit} -mt-0.5 opacity-90`}>{symbol}</span>
      </div>

      {/* Top gloss sheen */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: '5px',
          background: 'linear-gradient(160deg, rgba(255,255,255,0.10) 0%, transparent 50%)',
        }}
      />
    </div>
  );
}

export function InlineCard({ card }: { card: CardType }) {
  const { border, symbol } = SUIT_CONFIG[card.suit];
  const textColor: Record<string, string> = {
    s: '#6699ee', h: '#ee6677', d: '#ee7755', c: '#44bb66',
  };
  return (
    <span
      className="inline-flex items-center justify-center px-1 py-0.5 rounded font-black text-[10px] sm:text-xs w-6 sm:w-7"
      style={{
        background: '#0d1623',
        border: `1px solid ${border}`,
        color: textColor[card.suit],
      }}
    >
      {card.rank}{symbol}
    </span>
  );
}