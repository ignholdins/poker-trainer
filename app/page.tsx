'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase, getUserId } from '@/lib/supabase';
import {
  Card as CardType, Position, Action, HandResult, SessionStats, TableState,
  RFI_POSITIONS, dealHand, createTableState,
} from '@/lib/poker';
import { PlayingCard, InlineCard } from '@/components/PlayingCard';
import { PositionBadge } from '@/components/PositionBadge';
import { Settings, BarChart3, History, Play, Layers } from 'lucide-react';

type View = 'trainer' | 'analytics' | 'history' | 'settings';

export default function PLO6Trainer() {
  const [view, setView] = useState<View>('trainer');
  const [isPaused, setIsPaused] = useState(true);
  const [tables, setTables] = useState<TableState[]>([]);
  const [stats, setStats] = useState<SessionStats>({ total: 0, correct: 0, mistakes: [], history: [] });
  const [activePositions, setActivePositions] = useState<Position[]>([...RFI_POSITIONS]);

  useEffect(() => {
    async function loadPersistentHistory() {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
      const { data } = await supabase.from('hand_history').select('*').eq('user_id', getUserId()).order('created_at', { ascending: false }).limit(100);
      if (data) {
        const formatted: HandResult[] = data.map(item => ({
          hand: item.hand, position: item.position, scenario: item.scenario || 'RFI',
          percentile: item.percentile, tags: item.tags || [],
          correctAction: item.correct_action, playerAction: item.player_action,
          isCorrect: item.is_correct, timestamp: new Date(item.created_at).getTime()
        }));
        setStats({ total: formatted.length, correct: formatted.filter(h => h.isCorrect).length, mistakes: formatted.filter(h => !h.isCorrect), history: formatted });
      }
    }
    loadPersistentHistory();
  }, []);

  const startSession = useCallback(() => {
    setTables([createTableState(0, activePositions)]);
    setIsPaused(false);
  }, [activePositions]);

  const makeDecision = useCallback(async (tableId: number, action: Action) => {
    const table = tables.find(t => t.id === tableId);
    if (!table || table.playerAction || table.showFeedback || !table.correctAction) return;
    
    const isCorrect = action === table.correctAction;
    const result: HandResult = {
      hand: [...table.hand], position: table.position, scenario: table.scenario || 'RFI',
      percentile: table.percentile!, tags: table.tags,
      correctAction: table.correctAction, playerAction: action,
      isCorrect, timestamp: Date.now()
    };
    
    setStats(s => ({
      total: s.total + 1, correct: s.correct + (isCorrect ? 1 : 0),
      mistakes: isCorrect ? s.mistakes : [result, ...s.mistakes],
      history: [result, ...s.history].slice(0, 100)
    }));

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      await supabase.from('hand_history').insert([{
        user_id: getUserId(), position: result.position, scenario: result.scenario || 'RFI',
        hand: result.hand, percentile: result.percentile, tags: result.tags,
        correct_action: result.correctAction, player_action: result.playerAction, is_correct: result.isCorrect
      }]);
    }

    setTables(prev => prev.map(t => t.id === tableId ? { ...t, playerAction: action, showFeedback: true } : t));
    
    setTimeout(() => {
      setTables(prev => prev.map(t => t.id === tableId ? createTableState(tableId, activePositions) : t));
    }, 1500);
  }, [tables, activePositions]);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-slate-100 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center"><Layers className="w-4 h-4 text-green-500" /></div>
          <h1 className="text-base font-bold text-white">PLO6 <span className="text-green-500">Trainer v3</span></h1>
        </div>
        <nav className="flex items-center gap-1">
          {([{ v: 'trainer', icon: Play }, { v: 'analytics', icon: BarChart3 }, { v: 'history', icon: History }, { v: 'settings', icon: Settings }]).map(({ v, icon: Icon }) => (
            <button key={v} onClick={() => setView(v as View)} className={`p-2 rounded-lg transition-all ${view === v ? 'bg-green-600 text-white' : 'text-zinc-400'}`}><Icon className="w-5 h-5" /></button>
          ))}
        </nav>
      </header>

      <main className="flex-1 flex flex-col overflow-y-auto">
        {view === 'trainer' && (
          <div className="flex flex-col items-center justify-center p-4 w-full h-full max-w-md mx-auto">
            {isPaused ? (
              <button onClick={startSession} className="px-8 py-4 bg-green-600 rounded-xl font-bold text-xl shadow-lg hover:bg-green-500 transition-colors">Start Session</button>
            ) : (
              tables.map(table => <PokerTable key={table.id} table={table} isActive={true} isPaused={isPaused} onDecision={(act: Action) => makeDecision(table.id, act)} />)
            )}
          </div>
        )}
        {view === 'history' && (
          <div className="p-4 space-y-2">
            <h2 className="text-xl font-bold mb-4">Hand History</h2>
            {stats.history.map((h, i) => (
              <div key={i} className="bg-zinc-900 p-3 rounded-xl flex justify-between items-center border border-zinc-800">
                <div className="flex items-center gap-3">
                  <PositionBadge position={h.position} />
                  <div className="flex text-xs">{h.hand[0].rank}{h.hand[0].suit}...</div>
                </div>
                <span className={`text-xs font-bold uppercase ${h.isCorrect ? 'text-green-500' : 'text-red-500'}`}>{h.playerAction}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// POKER TABLE COMPONENT
// ═══════════════════════════════════════════════════════════
function PokerTable({ table, isActive, isPaused, onDecision }: any) {
  const canAct = isActive && !isPaused && !table.showFeedback && !table.playerAction;
  
  // Logical order of action preflop
  const ACTION_ORDER = ['UTG', 'CO', 'BTN', 'SB', 'BB'];
  const heroActionIdx = ACTION_ORDER.indexOf(table.position);

  // Clockwise rendering order around the table
  const CLOCKWISE_POSITIONS = ['SB', 'BB', 'UTG', 'CO', 'BTN'];
  const heroIdx = CLOCKWISE_POSITIONS.indexOf(table.position);
  
  const opponentSeats = [
    { pos: CLOCKWISE_POSITIONS[(heroIdx + 1) % 5], style: "bottom-[12%] sm:bottom-[20%] left-[2%]", chipStyle: "-top-6 sm:-top-8 left-1/2 -translate-x-1/2" },
    { pos: CLOCKWISE_POSITIONS[(heroIdx + 2) % 5], style: "top-[8%] sm:top-[15%] left-[8%] sm:left-[15%]", chipStyle: "-bottom-6 sm:-bottom-8 left-1/2 -translate-x-1/2" },
    { pos: CLOCKWISE_POSITIONS[(heroIdx + 3) % 5], style: "top-[8%] sm:top-[15%] right-[8%] sm:right-[15%]", chipStyle: "-bottom-6 sm:-bottom-8 left-1/2 -translate-x-1/2" },
    { pos: CLOCKWISE_POSITIONS[(heroIdx + 4) % 5], style: "bottom-[12%] sm:bottom-[20%] right-[2%]", chipStyle: "-top-6 sm:-top-8 left-1/2 -translate-x-1/2" },
  ];

  // BULLETPROOF FOLD LOGIC
  const isFolded = (pos: string) => {
    const safeScenario = table.scenario || 'RFI';
    if (safeScenario === 'RFI') {
      const posIdx = ACTION_ORDER.indexOf(pos);
      return posIdx < heroActionIdx;
    }
    return false;
  };

  const foldedCount = opponentSeats.filter(s => isFolded(s.pos)).length;

  const renderChip = (amount: string) => (
    <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 px-2 py-0.5 rounded-full z-20 shadow-lg animate-in fade-in zoom-in duration-300">
      <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-red-400 to-red-700 border border-red-300/50"></div>
      <span className="text-[10px] text-white font-bold">{amount}</span>
    </div>
  );

  return (
    <div className="flex flex-col items-center w-full max-w-[850px] relative">
      <div className="relative w-full aspect-[1.5/1] sm:aspect-[2.2/1] min-h-[220px] rounded-[300px] p-2 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-2xl overflow-hidden border-zinc-700">
        <div className="relative w-full h-full rounded-[250px] flex items-center justify-center border-4 border-zinc-800/80 overflow-hidden" style={{ background: 'radial-gradient(ellipse at center, #0f766e 0%, #064e3b 100%)' }}>
          
          {/* HUD for debugging */}
          <div className="absolute top-4 w-full text-center z-50">
             <span className="text-[10px] font-bold text-zinc-300 bg-black/50 px-2 py-1 rounded">
               DEBUG HUD | Hero: {table.position} | Opponents Folded: {foldedCount}
             </span>
          </div>

          {(table.position === 'SB' || table.position === 'BB') && <div className="absolute bottom-[10%] sm:bottom-[12%] left-1/2 -translate-x-1/2 z-20">{renderChip(table.position === 'SB' ? '0.5' : '1')}</div>}
          
          {opponentSeats.map((seat, i) => {
            const isRaiser = table.raiserPosition === seat.pos;
            const folded = isFolded(seat.pos);
            
            return (
              <div key={i} className={`absolute ${seat.style} z-10 flex flex-col items-center transition-all duration-500`}>
                {isRaiser && <div className={`absolute ${seat.chipStyle}`}>{renderChip('3.5')}</div>}
                {!isRaiser && !folded && (seat.pos === 'SB' || seat.pos === 'BB') && <div className={`absolute ${seat.chipStyle}`}>{renderChip(seat.pos === 'SB' ? '0.5' : '1')}</div>}
                
                {/* Only render cards if mathematically FALSE */}
                {!folded && (
                  <div className="flex -mb-2 sm:-mb-4 opacity-80 scale-50 sm:scale-75 animate-in slide-in-from-top-4 duration-500">
                    {[1,2,3,4,5,6].map(n => <div key={n} className="w-8 h-12 bg-red-800 border border-red-950 rounded-sm -ml-3 shadow-md rotate-[-5deg]" />)}
                  </div>
                )}
                
                <div className={`relative bg-zinc-900 border-t-2 border-zinc-600 rounded-md px-3 py-0.5 text-center shadow-xl z-20 ${isRaiser ? 'ring-2 ring-red-500' : ''} ${folded ? 'opacity-20' : 'opacity-100'}`}>
                  <span className="text-[9px] font-medium text-zinc-100">{seat.pos} {folded ? '(Folded)' : ''}</span>
                </div>
              </div>
            );
          })}

          {table.showFeedback && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center justify-center p-4 rounded-2xl backdrop-blur-md border border-white/20 shadow-2xl bg-black/60">
              <span className={`font-black text-xl uppercase tracking-widest mb-2 ${table.playerAction === table.correctAction ? 'text-green-500' : 'text-red-500'}`}>
                {table.playerAction === table.correctAction ? 'Perfect' : 'Mistake'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-30 -mt-8 sm:-mt-16 flex flex-col items-center w-full scale-[0.85] sm:scale-100 origin-top">
        <div className="flex justify-center items-end h-[120px] w-full">
          {table.hand.map((c: any, i: any) => (
             <div key={i} className="relative shadow-2xl origin-bottom" style={{ transform: `rotate(${(i-2.5)*6}deg)`, zIndex: i, marginLeft: i===0?0:'-1rem' }}>
                <PlayingCard card={c} index={i} revealed={true} />
             </div>
          ))}
        </div>
        <div className="relative z-40 mt-[-5px] bg-zinc-900 border-t border-zinc-600 rounded-md px-6 py-1 shadow-2xl text-center">
            <span className="text-zinc-200 text-xs font-medium block">{table.position}</span>
        </div>
      </div>

      <div className="mt-2 sm:mt-6 w-full max-w-[500px] flex gap-2 px-2">
        <button onClick={() => onDecision('fold')} disabled={!canAct} className={`flex-1 py-3 rounded-lg border-b-4 font-bold text-white transition-all ${canAct ? 'bg-rose-600 border-rose-800 hover:bg-rose-500 active:border-b-0 active:translate-y-1' : 'bg-zinc-700 border-zinc-800 text-zinc-500'}`}>Fold</button>
        <button onClick={() => onDecision('raise')} disabled={!canAct} className={`flex-1 py-3 rounded-lg border-b-4 font-bold text-white transition-all ${canAct ? 'bg-emerald-600 border-emerald-800 hover:bg-emerald-500 active:border-b-0 active:translate-y-1' : 'bg-zinc-700 border-zinc-800 text-zinc-500'}`}>Raise</button>
      </div>
    </div>
  );
}