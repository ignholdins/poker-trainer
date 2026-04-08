import React from 'react';
import { Card as CardType } from '@/lib/poker';

// CoinPoker-style colored card backgrounds per suit
const SUIT_BG: Record<string, string> = {
  s: 'linear-gradient(145deg, #1a6fd4 0%, #0d3f80 100%)',  // Blue for Spades
  h: 'linear-gradient(145deg, #e8293a 0%, #9b0e1f 100%)',  // Red for Hearts
  d: 'linear-gradient(145deg, #d44a1a 0%, #8b2800 100%)',  // Orange-Red for Diamonds
  c: 'linear-gradient(145deg, #1d9444 0%, #0a5225 100%)',  // Green for Clubs
};

const SUIT_BORDER: Record<string, string> = {
  s: '#3d8ef5',
  h: '#f55566',
  d: '#f57040',
  c: '#3db866',
};

const SUIT_SYMBOLS: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

export function PlayingCard({ card, compact = false, revealed = true }: { card: CardType, compact?: boolean, revealed?: boolean }) {
  if (!revealed) {
    return (
      <div
        className={`relative shadow-xl flex-shrink-0 ${compact ? 'w-10 h-14' : 'w-14 h-20 sm:w-[72px] sm:h-[100px]'}`}
        style={{
          borderRadius: '8px',
          background: 'linear-gradient(145deg, #8b1a2a 0%, #5a0e1a 100%)',
          border: '2px solid #c43050',
          boxShadow: '0 4px 14px rgba(0,0,0,0.6)',
        }}
      >
        {/* Card back crosshatch pattern */}
        <div className="absolute inset-[3px] rounded-[6px] opacity-30"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 0, transparent 50%), repeating-linear-gradient(-45deg, #fff 0, #fff 1px, transparent 0, transparent 50%)', backgroundSize: '8px 8px' }}
        />
      </div>
    );
  }

  const baseSize = compact ? 'w-10 h-14' : 'w-14 h-20 sm:w-[72px] sm:h-[100px]';
  const rankSize = compact ? 'text-sm' : 'text-xl sm:text-2xl';
  const suitSize = compact ? 'text-xs' : 'text-base sm:text-lg';
  const centerSize = compact ? 'text-3xl' : 'text-5xl sm:text-6xl';

  return (
    <div
      className={`relative flex-shrink-0 ${baseSize}`}
      style={{
        borderRadius: '9px',
        background: SUIT_BG[card.suit],
        border: `2px solid ${SUIT_BORDER[card.suit]}`,
        boxShadow: '0 6px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)',
      }}
    >
      {/* Top-left rank+suit */}
      <div className={`absolute top-1 left-1.5 flex flex-col items-center leading-none font-black text-white ${rankSize}`}>
        <span>{card.rank}</span>
        <span className={suitSize}>{SUIT_SYMBOLS[card.suit]}</span>
      </div>

      {/* Center large suit */}
      <div className={`absolute inset-0 flex items-center justify-center font-black text-white select-none opacity-70 ${centerSize}`}>
        {SUIT_SYMBOLS[card.suit]}
      </div>

      {/* Bottom-right rank+suit (flipped) */}
      <div className={`absolute bottom-1 right-1.5 flex flex-col items-center leading-none font-black rotate-180 text-white ${rankSize}`}>
        <span>{card.rank}</span>
        <span className={suitSize}>{SUIT_SYMBOLS[card.suit]}</span>
      </div>

      {/* Subtle inner gloss */}
      <div className="absolute inset-0 rounded-[7px] pointer-events-none"
        style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.15) 0%, transparent 60%)' }}
      />
    </div>
  );
}

export function InlineCard({ card }: { card: CardType }) {
  const suitColors: Record<string, string> = {
    s: 'text-[#3d8ef5]',
    h: 'text-[#f55566]',
    d: 'text-[#f57040]',
    c: 'text-[#3db866]',
  };
  return (
    <span className={`inline-flex items-center justify-center px-1 py-0.5 bg-[#0d1623] border rounded font-black ${suitColors[card.suit]} text-[10px] sm:text-xs w-6 sm:w-7`}
      style={{ borderColor: SUIT_BORDER[card.suit] + '66' }}>
      {card.rank}{SUIT_SYMBOLS[card.suit]}
    </span>
  );
}