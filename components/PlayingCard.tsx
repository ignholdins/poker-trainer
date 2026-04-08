import React from 'react';
import { Card as CardType } from '@/lib/poker';

export function PlayingCard({ card, compact = false, revealed = true }: { card: CardType, compact?: boolean, revealed?: boolean }) {
  const suitColors = {
    s: 'text-slate-900', // Spades = Black
    h: 'text-rose-600',  // Hearts = Red
    d: 'text-blue-500',  // Diamonds = Blue
    c: 'text-emerald-500' // Clubs = Green
  };
  const suitSymbols = { s: '♠', h: '♥', d: '♦', c: '♣' };

  if (!revealed) {
    return (
      <div className={`relative rounded-lg sm:rounded-xl border-2 border-white/10 shadow-2xl bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-slate-900 ${compact ? 'w-10 h-14 sm:w-12 sm:h-16 lg:w-14 lg:h-20' : 'w-12 h-16 sm:w-16 sm:h-24 lg:w-20 lg:h-32'}`}>
        <div className="absolute inset-1.5 rounded border border-white/10" />
      </div>
    );
  }

  const baseSize = compact ? 'w-10 h-14 sm:w-12 sm:h-16 lg:w-14 lg:h-20' : 'w-12 h-16 sm:w-16 sm:h-24 lg:w-20 lg:h-32';
  const fontSize = compact ? 'text-[11px] sm:text-sm' : 'text-xs sm:text-base lg:text-xl';
  const centerSuitSize = compact ? 'text-2xl sm:text-3xl' : 'text-3xl sm:text-5xl lg:text-7xl';

  return (
    <div className={`bg-neutral-50 relative rounded-lg sm:rounded-xl border border-slate-300 shadow-2xl flex items-center justify-center font-black ${suitColors[card.suit]} ${baseSize}`} style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)' }}>
      {/* Top Left Index */}
      <div className={`absolute top-1 left-1.5 flex flex-col items-center leading-none ${fontSize}`}>
        <span className="mb-0.5">{card.rank}</span>
        <span className="text-[0.9em]">{suitSymbols[card.suit]}</span>
      </div>

      {/* Center Large Suit - much more visible now */}
      <div className={`${centerSuitSize} opacity-[0.18] select-none filter blur-[0.5px]`}>
        {suitSymbols[card.suit]}
      </div>

      {/* Bottom Right Index - flipped */}
      <div className={`absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180 ${fontSize}`}>
        <span className="mb-0.5">{card.rank}</span>
        <span className="text-[0.9em]">{suitSymbols[card.suit]}</span>
      </div>
      
      {/* Subtle Sheen */}
      <div className="absolute inset-0 rounded-lg sm:rounded-xl pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%)' }} />
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