import React from 'react';
import { Card as CardType } from '@/lib/poker';

// CoinPoker-style: colored background per suit
const SUIT_CONFIG: Record<string, { bg: string; border: string; symbol: string }> = {
  s: { bg: 'linear-gradient(150deg, #1155bb 0%, #0a3580 100%)', border: '#4488ff', symbol: '♠' },
  h: { bg: 'linear-gradient(150deg, #cc2233 0%, #880011 100%)', border: '#ff6677', symbol: '♥' },
  d: { bg: 'linear-gradient(150deg, #cc3311 0%, #881100 100%)', border: '#ff7755', symbol: '♦' },
  c: { bg: 'linear-gradient(150deg, #117733 0%, #084d1e 100%)', border: '#44bb66', symbol: '♣' },
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
          background: 'linear-gradient(150deg, #961827 0%, #570c18 100%)',
          border: '2px solid #c03050',
          boxShadow: '0 4px 12px rgba(0,0,0,0.55)',
        }}
      >
        <div
          className="absolute inset-[3px] rounded-[5px] opacity-25"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%),repeating-linear-gradient(-45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)',
            backgroundSize: '7px 7px',
          }}
        />
      </div>
    );
  }

  const { bg, border, symbol } = SUIT_CONFIG[card.suit];

  // Sizing
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
        border: `2px solid ${border}`,
        boxShadow: '0 5px 16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
      }}
    >
      {/* Top-left corner */}
      <div className={`absolute top-[3px] left-[4px] flex flex-col items-center leading-none font-black text-white ${cornerRank}`}>
        <span>{card.rank}</span>
        <span className={`${cornerSuit} -mt-0.5`}>{symbol}</span>
      </div>

      {/* Center: large rank + suit */}
      <div className="flex flex-col items-center leading-none text-white font-black select-none">
        <span className={centerRank} style={{ lineHeight: 1 }}>{card.rank}</span>
        <span className={centerSuit} style={{ lineHeight: 1.1 }}>{symbol}</span>
      </div>

      {/* Bottom-right corner flipped */}
      <div className={`absolute bottom-[3px] right-[4px] flex flex-col items-center leading-none font-black text-white rotate-180 ${cornerRank}`}>
        <span>{card.rank}</span>
        <span className={`${cornerSuit} -mt-0.5`}>{symbol}</span>
      </div>

      {/* Gloss sheen */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: '5px',
          background: 'linear-gradient(160deg, rgba(255,255,255,0.13) 0%, transparent 55%)',
        }}
      />
    </div>
  );
}

export function InlineCard({ card }: { card: CardType }) {
  const { border, symbol } = SUIT_CONFIG[card.suit];
  const textColor: Record<string, string> = {
    s: '#4488ff', h: '#ff6677', d: '#ff7755', c: '#44bb66',
  };
  return (
    <span
      className="inline-flex items-center justify-center px-1 py-0.5 rounded font-black text-[10px] sm:text-xs w-6 sm:w-7"
      style={{
        background: '#0d1623',
        border: `1px solid ${border}66`,
        color: textColor[card.suit],
      }}
    >
      {card.rank}{symbol}
    </span>
  );
}