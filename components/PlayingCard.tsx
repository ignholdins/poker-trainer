import React from 'react';
import { Card as CardType } from '@/lib/poker';

export function PlayingCard({ card, compact = false, revealed = true }: { card: CardType, compact?: boolean, revealed?: boolean }) {
  const suitColors = {
    s: 'text-black', 
    h: 'text-[#e11d48]', // Vibrant Red
    d: 'text-[#2563eb]', // Vibrant Blue
    c: 'text-[#059669]'  // Vibrant Green
  };
  const suitSymbols = { s: '♠', h: '♥', d: '♦', c: '♣' };

  if (!revealed) {
    return (
      <div className={`relative rounded-xl border-2 border-white/10 shadow-lg bg-slate-800 ${compact ? 'w-10 h-14' : 'w-14 h-20 sm:w-20 sm:h-28 lg:w-24 lg:h-34'}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-transparent rounded-xl" />
        <div className="absolute inset-1 border border-white/5 rounded-lg" />
      </div>
    );
  }

  // Adjusted sizes for even bigger indices
  const baseSize = compact ? 'w-10 h-14' : 'w-14 h-20 sm:w-20 sm:h-28 lg:w-24 lg:h-34';
  const fontSize = compact ? 'text-xs' : 'text-base sm:text-2xl lg:text-3xl';
  const centerSize = compact ? 'text-2xl' : 'text-4xl sm:text-6xl lg:text-8xl';

  return (
    <div className={`bg-white relative rounded-xl border-2 border-slate-100 shadow-xl flex items-center justify-center font-black ${suitColors[card.suit]} ${baseSize}`}>
      {/* Top Left Index - MASSIVE */}
      <div className={`absolute top-1 left-1 flex flex-col items-center leading-none ${fontSize}`}>
        <span className="tracking-tighter">{card.rank}</span>
        <span className="-mt-0.5">{suitSymbols[card.suit]}</span>
      </div>

      {/* Center Large Suit - SOLID COLOR, BOLD */}
      <div className={`${centerSize} opacity-15 select-none`}>
        {suitSymbols[card.suit]}
      </div>

      {/* Bottom Right Index - flipped */}
      <div className={`absolute bottom-1 right-1 flex flex-col items-center leading-none rotate-180 ${fontSize}`}>
        <span className="tracking-tighter">{card.rank}</span>
        <span className="-mt-0.5">{suitSymbols[card.suit]}</span>
      </div>
    </div>
  );
}

export function InlineCard({ card }: { card: CardType }) {
  const suitColors = { s: 'text-slate-900', h: 'text-red-600', d: 'text-blue-600', c: 'text-green-600' };
  const suitSymbols = { s: '♠', h: '♥', d: '♦', c: '♣' };
  return (
    <span className={`inline-flex items-center justify-center px-1 py-0.5 bg-white border rounded font-bold ${suitColors[card.suit]} text-[10px] sm:text-xs lg:text-sm w-6 sm:w-7 lg:w-9`}>
      {card.rank}{suitSymbols[card.suit]}
    </span>
  );
}