'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, getUserId } from '@/lib/supabase';
import {
  Card as CardType, Position, Action, HandResult, SessionStats, TableState,
  RFI_POSITIONS, RFI_THRESHOLDS, dealHand, getRandomPosition, createTableState,
} from '@/lib/poker';
import { PlayingCard, InlineCard } from '@/components/PlayingCard';
import { PositionBadge } from '@/components/PositionBadge';
import {
  Settings, BarChart3, History, Play, Pause, RotateCcw,
  Layers, CheckCircle2, XCircle, AlertTriangle, Target
} from 'lucide-react';

type View = 'trainer' | 'analytics' | 'history' | 'settings';

export default function PLO6Trainer() {
  const [view, setView] = useState<View>('trainer');
  const [isPaused, setIsPaused] = useState(true);
  
  const [tableCount] = useState(1);
  const [tables, setTables] = useState<TableState[]>([]);
  const [activeTableId, setActiveTableId] = useState(0);
  const [stats, setStats] = useState<SessionStats>({ total: 0, correct: 0, mistakes: [], history: [] });

  const [activePositions, setActivePositions] = useState<Position[]>([...RFI_POSITIONS]);
  const [raiseKey, setRaiseKey] = useState('r');
  const [foldKey, setFoldKey] = useState('f');
  
  const [activeDrill, setActiveDrill] = useState<string | null>(null);

  const dealForTable = useCallback((tableId: number): TableState => {
    return createTableState(tableId, activePositions, activeDrill);
  }, [activePositions, activeDrill]);

  const startSession = useCallback(() => {
    const newTables = Array.from({ length: tableCount }, (_, i) => dealForTable(i));
    setTables(newTables);
    setActiveTableId(0);
    setIsPaused(false);
  }, [tableCount, dealForTable]);

  const resetSession = useCallback(() => {
    setIsPaused(true);
    setTables([]);
    setActiveDrill(null); 
    setStats({ total: 0, correct: 0, mistakes: [], history: [] });
  }, []);

  const makeDecision = useCallback(async (tableId: number, action: Action) => {
    const table = tables.find(t => t.id === tableId);
    if (!table || table.playerAction || table.showFeedback || !table.correctAction || table.percentile === null) return;

    const isCorrect = action === table.correctAction;
    const result: HandResult = {
      hand: [...table.hand],
      position: table.position,
      percentile: table.percentile,
      tags: table.tags,
      correctAction: table.correctAction,
      playerAction: action,
      isCorrect,
      timestamp: Date.now(),
    };

    setStats(s => ({
      total: s.total + 1,
      correct: s.correct + (isCorrect ? 1 : 0),
      mistakes: isCorrect ? s.mistakes : [result, ...s.mistakes],
      history: [result, ...s.history].slice(0, 500),
    }));

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      supabase.from('hand_history').insert([{
        user_id: getUserId(),
        position: result.position,
        hand: result.hand,
        percentile: result.percentile,
        tags: result.tags,
        correct_action: result.correctAction,
        player_action: result.playerAction,
        is_correct: result.isCorrect
      }]).then(({ error }) => {
        if (error) console.error("Error saving hand:", error.message || error);
      });
    }

    setTables(prev => prev.map(t =>
      t.id === tableId ? { ...t, playerAction: action, showFeedback: true } : t
    ));

    setTimeout(() => {
      setTables(prev => prev.map(t =>
        t.id === tableId ? dealForTable(tableId) : t
      ));
      if (tableCount > 1) {
        setActiveTableId(id => (id + 1) % tableCount);
      }
    }, 1800);
  }, [tables, dealForTable, tableCount]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (view !== 'trainer' || isPaused) return;
      const key = e.key.toLowerCase();
      if (key === raiseKey) makeDecision(activeTableId, 'raise');
      else if (key === foldKey) makeDecision(activeTableId, 'fold');
      else if (key === ' ') { e.preventDefault(); setIsPaused(p => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, isPaused, raiseKey, foldKey, activeTableId, tableCount, makeDecision]);

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-slate-100">
      <header className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
            <Layers className="w-4 h-4 text-green-500" />
          </div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
            PLO6 <span className="text-green-500">Trainer</span>
          </h1>
        </div>

        <nav className="flex items-center gap-0.5">
          {([
            { v: 'trainer' as View, icon: Play, label: 'Train' },
            { v: 'analytics' as View, icon: BarChart3, label: 'Leak Finder' },
            { v: 'history' as View, icon: History, label: 'History' },
            { v: 'settings' as View, icon: Settings, label: 'Settings' },
          ]).map(({ v, icon: Icon, label }) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                view === v ? 'bg-green-600 text-white' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 flex flex-col">
        {view === 'trainer' && (
          <TrainerView
            tables={tables}
            activeTableId={activeTableId}
            isPaused={isPaused}
            stats={stats}
            accuracy={accuracy}
            activeDrill={activeDrill}
            onDecision={makeDecision}
            onStart={startSession}
            onPause={() => setIsPaused(true)}
            onResume={() => setIsPaused(false)}
            onReset={resetSession}
            onClearDrill={() => setActiveDrill(null)}
          />
        )}
        {view === 'analytics' && (
          <AnalyticsView 
            stats={stats} 
            onStartDrill={(tag: string) => {
              setActiveDrill(tag);
              setView('trainer');
              startSession();
            }} 
          />
        )}
        {view === 'history' && <HistoryView stats={stats} />}
        {view === 'settings' && (
          <SettingsView activePositions={activePositions} setActivePositions={setActivePositions} />
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Trainer View
// ═══════════════════════════════════════════════════════════

function TrainerView({
  tables, activeTableId, isPaused, stats, accuracy, activeDrill,
  onDecision, onStart, onPause, onResume, onReset, onClearDrill
}: any) {
  const hasStarted = tables.length > 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 gap-6 bg-zinc-950 overflow-hidden relative">
      
      {activeDrill && (
        <div className="absolute top-4 z-50 flex items-center gap-3 bg-blue-900/40 border border-blue-500/50 px-6 py-2 rounded-full text-blue-400 text-sm font-bold shadow-[0_0_20px_rgba(59,130,246,0.2)]">
          <Target className="w-4 h-4" /> DRILL MODE: {activeDrill}
          {hasStarted && (
            <button onClick={onClearDrill} className="ml-4 text-xs bg-blue-950 hover:bg-blue-900 border border-blue-500/30 px-3 py-1 rounded-full text-blue-300">
              Clear
            </button>
          )}
        </div>
      )}

      {hasStarted && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-6 text-xs text-zinc-400 font-mono bg-zinc-900/80 backdrop-blur px-6 py-2 rounded-full border border-zinc-800">
          <span>Hands <span className="text-zinc-100 ml-1">{stats.total}</span></span>
          <span>Accuracy <span className={accuracy >= 70 ? 'text-green-500' : accuracy >= 50 ? 'text-yellow-500' : 'text-red-500'}>{accuracy}%</span></span>
        </div>
      )}

      {!hasStarted ? (
        <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-12 sm:p-16 text-center max-w-xl w-full shadow-2xl relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-6">
            <Layers className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2 text-white">Take Your Seat</h2>
          <p className="text-zinc-400 text-sm mb-8">
            {activeDrill 
              ? `You are about to drill your leak: ${activeDrill}. You will only be dealt these hands.` 
              : `Train your PLO6 RFI decisions across all 5-Max positions.`}
          </p>
          <button onClick={onStart} className="px-10 py-3 rounded-xl bg-green-600 text-white font-bold text-base hover:bg-green-500 transition-all active:scale-95 shadow-[0_0_20px_rgba(34,197,94,0.3)]">
            Sit & Deal
          </button>
        </div>
      ) : (
        <div className="w-full max-w-5xl flex flex-col items-center relative mt-12">
          {tables.map((table: TableState) => (
            <PokerTable
              key={table.id} table={table} isActive={activeTableId === table.id}
              isPaused={isPaused} onDecision={(action: Action) => onDecision(table.id, action)}
            />
          ))}
        </div>
      )}

      {hasStarted && (
        <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-2">
          {!isPaused ? (
            <button onClick={onPause} className="w-12 h-12 flex items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 shadow-xl">
              <Pause className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={onResume} className="w-12 h-12 flex items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]">
              <Play className="w-5 h-5 ml-1" />
            </button>
          )}
          <button onClick={onReset} className="w-12 h-12 flex items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-red-900 hover:text-red-400 hover:border-red-800 shadow-xl transition-colors">
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Single Poker Table (CoinPoker Responsive Layout)
// ═══════════════════════════════════════════════════════════

function PokerTable({ table, isActive, isPaused, onDecision }: any) {
  const canAct = isActive && !isPaused && !table.showFeedback && !table.playerAction;
  const CLOCKWISE_POSITIONS = ['SB', 'BB', 'UTG', 'CO', 'BTN'];
  const heroIdx = CLOCKWISE_POSITIONS.indexOf(table.position);
  
  // Responsive seating
  const opponentSeats = [
    { pos: CLOCKWISE_POSITIONS[(heroIdx + 1) % 5], style: "bottom-[12%] sm:bottom-[20%] left-[2%]", chipStyle: "-top-6 sm:-top-8 left-1/2 -translate-x-1/2" },
    { pos: CLOCKWISE_POSITIONS[(heroIdx + 2) % 5], style: "top-[8%] sm:top-[15%] left-[8%] sm:left-[15%]", chipStyle: "-bottom-6 sm:-bottom-8 left-1/2 -translate-x-1/2" },
    { pos: CLOCKWISE_POSITIONS[(heroIdx + 3) % 5], style: "top-[8%] sm:top-[15%] right-[8%] sm:right-[15%]", chipStyle: "-bottom-6 sm:-bottom-8 left-1/2 -translate-x-1/2" },
    { pos: CLOCKWISE_POSITIONS[(heroIdx + 4) % 5], style: "bottom-[12%] sm:bottom-[20%] right-[2%]", chipStyle: "-top-6 sm:-top-8 left-1/2 -translate-x-1/2" },
  ];

  // Render Posted Blinds
  const renderPostedChip = (pos: string) => {
    if (pos !== 'SB' && pos !== 'BB') return null;
    const amount = pos === 'SB' ? '0.5' : '1';
    return (
      <div className="flex items-center gap-1 sm:gap-1.5 bg-black/60 border border-white/10 px-1.5 sm:px-2 py-0.5 rounded-full z-20 shadow-lg">
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gradient-to-br from-red-400 to-red-700 border border-red-300/50 shadow-sm"></div>
        <span className="text-[8px] sm:text-[10px] text-white font-bold">{amount}</span>
      </div>
    );
  };

  // Dealer Button Position Logic
  let dealerStyle = "bottom-[22%] sm:bottom-[25%] right-[28%] sm:right-[35%]";
  if (opponentSeats[0].pos === 'BTN') dealerStyle = "bottom-[22%] sm:bottom-[25%] left-[12%] sm:left-[18%]";
  else if (opponentSeats[1].pos === 'BTN') dealerStyle = "top-[22%] sm:top-[25%] left-[22%] sm:left-[28%]";
  else if (opponentSeats[2].pos === 'BTN') dealerStyle = "top-[22%] sm:top-[25%] right-[22%] sm:right-[28%]";
  else if (opponentSeats[3].pos === 'BTN') dealerStyle = "bottom-[22%] sm:bottom-[25%] right-[12%] sm:right-[18%]";

  return (
    <div className="flex flex-col items-center w-full max-w-[850px] relative">
      
      {/* 1. THE BACKGROUND TABLE FELT */}
      <div className={`relative w-full aspect-[1.5/1] sm:aspect-[2.2/1] min-h-[220px] rounded-[300px] p-2 sm:p-4 transition-all ${isActive ? '' : 'opacity-50 grayscale'}`}
           style={{ background: 'linear-gradient(to bottom, #1f2937, #111827)', boxShadow: 'inset 0 4px 10px rgba(255,255,255,0.05), 0 20px 40px rgba(0,0,0,0.8)' }}>
        
        <div className="relative w-full h-full rounded-[250px] flex items-center justify-center border-4 border-zinc-800/80 overflow-hidden"
             style={{ background: 'radial-gradient(ellipse at center, #0f766e 0%, #064e3b 100%)', boxShadow: 'inset 0 10px 40px rgba(0,0,0,0.7)' }}>
          
          {/* Floating Dealer Button */}
          <div className={`absolute ${dealerStyle} z-20 w-5 h-5 sm:w-7 sm:h-7 bg-gradient-to-b from-red-500 to-red-700 rounded-full flex items-center justify-center shadow-[0_4px_10px_rgba(0,0,0,0.6)] border border-red-300/50 transition-all duration-500`}>
             <span className="text-white font-black text-[8px] sm:text-[10px] drop-shadow-md">D</span>
          </div>

          {/* Hero Posted Chips */}
          {(table.position === 'SB' || table.position === 'BB') && (
            <div className="absolute bottom-[10%] sm:bottom-[12%] left-1/2 -translate-x-1/2 z-20">
              {renderPostedChip(table.position)}
            </div>
          )}

          {/* Opponent Seats & Chips */}
          {opponentSeats.map((seat, i) => (
            <div key={i} className={`absolute ${seat.style} z-10 flex flex-col items-center`}>
              {(seat.pos === 'SB' || seat.pos === 'BB') && (
                <div className={`absolute ${seat.chipStyle}`}>
                  {renderPostedChip(seat.pos)}
                </div>
              )}
              
              <div className="flex -mb-2 sm:-mb-4 opacity-80 scale-50 sm:scale-75">
                 {[1,2,3,4,5,6].map(n => <div key={n} className="w-8 h-12 bg-red-800 border border-red-950 rounded-sm -ml-3 shadow-md rotate-[-5deg]" />)}
              </div>
              <div className="relative bg-zinc-900 border-t-2 border-zinc-600 rounded-md px-3 sm:px-6 py-0.5 sm:py-1 text-center shadow-xl z-20">
                <span className="text-[9px] sm:text-xs font-medium text-zinc-100">{seat.pos}</span>
              </div>
            </div>
          ))}

          {/* Pot Display */}
          <div className="absolute top-[35%] bg-blue-900/40 text-blue-300 text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-0.5 sm:py-1 rounded-full border border-blue-500/30 shadow-inner">
            Pot 1.5
          </div>

          {/* Feedback Overlay */}
          {table.showFeedback && table.percentile !== null && (
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center justify-center p-4 sm:p-6 rounded-2xl backdrop-blur-md border shadow-2xl animate-in fade-in zoom-in duration-200 ${
              table.playerAction === table.correctAction ? 'bg-emerald-950/95 border-green-500/50' : 'bg-rose-950/95 border-red-500/50'
            }`}>
              <div className="flex items-center gap-2 sm:gap-3 mb-2">
                {table.playerAction === table.correctAction ? <CheckCircle2 className="w-5 h-5 sm:w-7 sm:h-7 text-green-500" /> : <XCircle className="w-5 h-5 sm:w-7 sm:h-7 text-red-500" />}
                <span className={`font-black text-sm sm:text-xl uppercase tracking-widest ${table.playerAction === table.correctAction ? 'text-green-500' : 'text-red-500'}`}>
                  {table.playerAction === table.correctAction ? 'Perfect' : 'Mistake'}
                </span>
              </div>
              <div className="text-[10px] sm:text-xs text-zinc-200 flex flex-col gap-1 items-center bg-black/50 px-3 sm:px-4 py-1 sm:py-2 rounded-lg border border-white/10 w-full text-center">
                <div className="flex justify-between w-full border-b border-white/10 pb-1">
                   <span className="opacity-70">Solver Top:</span>
                   <span className="font-mono font-bold">{table.percentile.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between w-full pt-1">
                   <span className="opacity-70">Answer:</span>
                   <span className={`font-black uppercase ${table.correctAction === 'raise' ? 'text-green-400' : 'text-red-400'}`}>{table.correctAction}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. THE HERO AREA */}
      <div className="relative z-30 -mt-8 sm:-mt-16 flex flex-col items-center w-full max-w-[600px] scale-[0.85] sm:scale-100 origin-top">
        
        <div className="flex justify-center items-end h-[120px] sm:h-[150px] w-full">
          {isPaused ? (
            table.hand.map((card: CardType, i: number) => {
              const rotations = [-15, -9, -3, 3, 9, 15];
              const yOffsets = [18, 6, 0, 0, 6, 18];
              return (
                <div key={i} className="relative shadow-2xl origin-bottom" style={{ transform: `rotate(${rotations[i]}deg) translateY(${yOffsets[i]}px)`, zIndex: i, marginLeft: i === 0 ? '0px' : '-1rem' }}>
                   <PlayingCard card={card} index={i} revealed={false} compact={false} />
                </div>
              );
            })
          ) : (
            <AnimatePresence mode="popLayout">
              {table.hand.map((card: CardType, i: number) => {
                const rotations = [-15, -9, -3, 3, 9, 15];
                const yOffsets = [18, 6, 0, 0, 6, 18];
                
                return (
                  <motion.div 
                    key={`${table.id}-${card.rank}${card.suit}-${i}`} 
                    initial={{ opacity: 0, y: 100, scale: 0.5, rotate: 0 }} 
                    animate={{ opacity: 1, y: yOffsets[i], scale: 1, rotate: rotations[i], marginLeft: i === 0 ? '0px' : '-1rem' }}
                    exit={{ opacity: 0, y: -50, scale: 0.8 }} 
                    whileHover={{ y: yOffsets[i] - 20, zIndex: 100, scale: 1.05 }}
                    transition={{ duration: 0.3, delay: i * 0.04, type: "spring", stiffness: 250, damping: 25 }}
                    style={{ zIndex: i + 10, transformOrigin: 'bottom center' }}
                    className="relative cursor-pointer shadow-[2px_4px_12px_rgba(0,0,0,0.5)] rounded-lg"
                  >
                    <PlayingCard card={card} index={i} compact={false} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <div className="relative z-40 mt-[-5px] sm:mt-[-10px] bg-zinc-900 border-t border-zinc-600 rounded-md px-6 sm:px-10 py-1 shadow-[0_10px_20px_rgba(0,0,0,0.8)] flex flex-col items-center">
          <span className="text-zinc-200 text-xs sm:text-sm font-medium">{table.position}</span>
          <span className="text-yellow-500 font-bold text-xs sm:text-sm tracking-wide">HERO</span>
        </div>
      </div>

      {/* 3. THE ACTION BUTTONS */}
      <div className={`mt-2 sm:mt-6 w-full max-w-[450px] flex gap-2 sm:gap-3 px-2 sm:px-0 transition-all duration-300 ${canAct ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <button onClick={(e) => { e.stopPropagation(); onDecision('fold'); }}
          className="flex-1 py-2.5 sm:py-3 rounded-lg bg-gradient-to-b from-rose-500 to-rose-700 border border-rose-800 shadow-[0_4px_0_rgb(136,19,55)] hover:from-rose-400 active:translate-y-[4px] active:shadow-none transition-all text-white font-bold text-base sm:text-lg tracking-wide">
          Fold
        </button>
        <button onClick={(e) => { e.stopPropagation(); onDecision('raise'); }}
          className="flex-1 py-2.5 sm:py-3 rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-700 border border-emerald-800 shadow-[0_4px_0_rgb(6,95,70)] hover:from-emerald-400 active:translate-y-[4px] active:shadow-none transition-all text-white font-bold text-base sm:text-lg tracking-wide">
          Raise
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Leak Finder Analytics View
// ═══════════════════════════════════════════════════════════

function AnalyticsView({ stats, onStartDrill }: any) {
  if (stats.total === 0) return <div className="text-center py-20 text-zinc-500"><BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>Play some hands to generate analytics.</p></div>;

  const tagStats: Record<string, { total: number; correct: number }> = {};
  stats.history.forEach((h: HandResult) => {
    h.tags.forEach(tag => {
      if (!tagStats[tag]) tagStats[tag] = { total: 0, correct: 0 };
      tagStats[tag].total++;
      if (h.isCorrect) tagStats[tag].correct++;
    });
  });

  const sortedTags = Object.entries(tagStats)
    .map(([tag, data]) => ({ tag, ...data, accuracy: Math.round((data.correct / data.total) * 100) }))
    .filter(t => t.total >= 3) 
    .sort((a, b) => a.accuracy - b.accuracy);

  const majorLeaks = sortedTags.filter(t => t.accuracy <= 60);

  return (
    <div className="flex-1 p-4 sm:p-8 max-w-4xl mx-auto w-full overflow-y-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-1 text-white">Leak Finder</h2>
        <p className="text-zinc-400 text-sm mb-6">Cross-referencing your decisions against heuristic categories.</p>
      </div>

      {majorLeaks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-rose-500 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Major Leaks Detected
          </h3>
          {majorLeaks.map(leak => (
            <div key={leak.tag} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-rose-950/20 border border-rose-900/50 rounded-xl gap-4">
              <div>
                <h4 className="text-white font-bold text-lg">{leak.tag}</h4>
                <p className="text-zinc-400 text-sm">
                  You are misplaying these hands. Accuracy: <span className="text-rose-400 font-mono">{leak.accuracy}%</span> ({leak.correct}/{leak.total})
                </p>
              </div>
              <button onClick={() => onStartDrill(leak.tag)} className="w-full sm:w-auto px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2">
                <Target className="w-4 h-4" /> Drill This Leak
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">All Category Accuracy</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {sortedTags.map(t => (
            <div key={t.tag} className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800">
              <span className="text-zinc-300 font-medium text-sm">{t.tag}</span>
              <div className="flex items-center gap-3">
                <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden hidden sm:block">
                  <div className={`h-full rounded-full ${t.accuracy > 75 ? 'bg-green-500' : t.accuracy > 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${t.accuracy}%` }} />
                </div>
                <span className={`font-mono text-xs w-10 text-right ${t.accuracy > 75 ? 'text-green-400' : t.accuracy > 60 ? 'text-yellow-400' : 'text-red-400'}`}>{t.accuracy}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// History & Settings
// ═══════════════════════════════════════════════════════════

function HistoryView({ stats }: any) {
  return (
    <div className="flex-1 p-4 sm:p-8 max-w-5xl mx-auto w-full overflow-y-auto">
      <h2 className="text-xl font-bold text-white mb-5">Hand History</h2>
      {stats.history.length === 0 ? <p className="text-zinc-500">No hands played yet.</p> : (
        <div className="space-y-1">
          {stats.history.map((h: HandResult, i: number) => (
            <div key={i} className={`flex items-center gap-4 px-4 py-3 rounded-lg border ${h.isCorrect ? 'bg-zinc-900 border-zinc-800' : 'bg-red-950/20 border-red-900/30'}`}>
              {h.isCorrect ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
              <PositionBadge position={h.position} size="sm" />
              <div className="flex items-center gap-1.5">{h.hand.map((c, ci) => <InlineCard key={ci} card={c} />)}</div>
              
              <div className="hidden lg:flex gap-1 ml-4">
                {h.tags.map(t => <span key={t} className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{t}</span>)}
              </div>

              <div className="ml-auto text-right font-mono text-xs text-zinc-400">
                Action: <span className={h.correctAction === 'raise' ? 'text-green-500' : 'text-red-500'}>{h.correctAction.toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsView({ activePositions, setActivePositions }: any) {
  const toggle = (pos: Position) => {
    if (activePositions.includes(pos) && activePositions.length > 1) setActivePositions(activePositions.filter((p: Position) => p !== pos));
    else if (!activePositions.includes(pos)) setActivePositions([...activePositions, pos]);
  };
  return (
    <div className="flex-1 p-4 sm:p-8 max-w-2xl mx-auto w-full overflow-y-auto">
      <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2"><Settings className="w-5 h-5 text-zinc-500" /> Settings</h2>
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-semibold mb-2 text-zinc-300">RFI Positions</h3>
          <div className="flex flex-wrap gap-2">
            {RFI_POSITIONS.map(pos => (
              <button 
                key={pos} onClick={() => toggle(pos)} 
                className={`px-4 py-2 rounded-lg border font-mono font-bold text-sm ${activePositions.includes(pos) ? 'bg-green-600 border-green-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}