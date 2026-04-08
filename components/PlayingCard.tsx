import React from 'react';
import { Card as CardType } from '@/lib/poker';

export function PlayingCard({ card, compact = false, revealed = true }: { card: CardType, compact?: boolean, revealed?: boolean }) {
  const suitColors = {
    s: 'text-slate-950', 
    h: 'text-red-600',   
    d: 'text-blue-600',  
    c: 'text-green-600'  
  };
  const suitSymbols = { s: '♠', h: '♥', d: '♦', c: '♣' };

  if (!revealed) {
    return (
      <div className={`relative rounded-lg sm:rounded-xl border-2 border-white/10 shadow-xl bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] bg-slate-900 ${compact ? 'w-10 h-14 sm:w-12 sm:h-16 lg:w-14 lg:h-20' : 'w-12 h-16 sm:w-16 sm:h-24 lg:w-20 lg:h-32'}`}>
        <div className="absolute inset-1.5 rounded border border-white/10" />
      </div>
    );
  }

  const baseSize = compact ? 'w-10 h-14 sm:w-12 sm:h-16 lg:w-14 lg:h-20' : 'w-12 h-16 sm:w-16 sm:h-24 lg:w-20 lg:h-32';
  const fontSize = compact ? 'text-[10px] sm:text-xs' : 'text-xs sm:text-base lg:text-xl';
  const centerSuitSize = compact ? 'text-lg sm:text-xl' : 'text-2xl sm:text-4xl lg:text-6xl';

  return (
    <div className={`bg-white relative rounded-lg sm:rounded-xl border border-slate-200 shadow-xl flex items-center justify-center font-black ${suitColors[card.suit]} ${baseSize}`}>
      {/* Top Left Index */}
      <div className={`absolute top-1 left-1 flex flex-col items-center leading-none ${fontSize}`}>
        <span>{card.rank}</span>
        <span className="text-[0.8em]">{suitSymbols[card.suit]}</span>
      </div>

      {/* Center Large Suit - subtle */}
      <div className={`${centerSuitSize} opacity-10 select-none`}>
        {suitSymbols[card.suit]}
      </div>

      {/* Bottom Right Index - flipped */}
      <div className={`absolute bottom-1 right-1 flex flex-col items-center leading-none rotate-180 ${fontSize}`}>
        <span>{card.rank}</span>
        <span className="text-[0.8em]">{suitSymbols[card.suit]}</span>
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