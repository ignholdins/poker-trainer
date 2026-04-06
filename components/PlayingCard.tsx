import React from 'react';
import { Card as CardType } from '@/lib/poker';

export function PlayingCard({ card, index, compact = false, revealed = true }: { card: CardType, index: number, compact?: boolean, revealed?: boolean }) {
  const suitColors = {
    s: 'text-slate-900', // Spades = Black
    h: 'text-red-600',   // Hearts = Red
    d: 'text-blue-600',  // Diamonds = Blue
    c: 'text-green-600'  // Clubs = Green
  };
  const suitSymbols = { s: '♠', h: '♥', d: '♦', c: '♣' };

  if (!revealed) {
    return (
      <div className={`relative rounded-lg sm:rounded-xl border-2 border-white/10 shadow-lg bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-blue-900 ${compact ? 'w-10 h-14 sm:w-12 sm:h-16' : 'w-12 h-16 sm:w-16 sm:h-24'}`}>
        <div className="absolute inset-1 rounded border border-white/20" />
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg sm:rounded-xl border shadow-lg flex flex-col items-center justify-center font-bold ${suitColors[card.suit]} ${compact ? 'w-10 h-14 sm:w-12 sm:h-16 text-sm sm:text-base' : 'w-12 h-16 sm:w-16 sm:h-24 text-base sm:text-xl'}`}>
      <div>{card.rank}</div>
      <div className={compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-3xl'}>{suitSymbols[card.suit]}</div>
    </div>
  );
}

export function InlineCard({ card }: { card: CardType }) {
  const suitColors = { s: 'text-slate-900', h: 'text-red-600', d: 'text-blue-600', c: 'text-green-600' };
  const suitSymbols = { s: '♠', h: '♥', d: '♦', c: '♣' };
  return (
    <span className={`inline-flex items-center justify-center px-1 py-0.5 bg-white border rounded text-[10px] sm:text-xs font-bold w-6 sm:w-7 ${suitColors[card.suit]}`}>
      {card.rank}{suitSymbols[card.suit]}
    </span>
  );
}