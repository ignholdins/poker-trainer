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
  Keyboard, Layers, CheckCircle2, XCircle,
  ArrowUp, ArrowDown, Filter,
} from 'lucide-react';

type View = 'trainer' | 'analytics' | 'history' | 'settings';
type HistoryFilter = 'all' | 'mistakes' | 'correct';

export default function PLO6Trainer() {
  const [view, setView] = useState<View>('trainer');
  const [isPaused, setIsPaused] = useState(true);
  const [tableCount, setTableCount] = useState(1);
  const [tables, setTables] = useState<TableState[]>([]);
  const [activeTableId, setActiveTableId] = useState(0);
  const [stats, setStats] = useState<SessionStats>({ total: 0, correct: 0, mistakes: [], history: [] });

  const [activePositions, setActivePositions] = useState<Position[]>([...RFI_POSITIONS]);
  const [raiseKey, setRaiseKey] = useState('r');
  const [foldKey, setFoldKey] = useState('f');

  const dealForTable = useCallback((tableId: number): TableState => {
    return createTableState(tableId, activePositions, 999);
  }, [activePositions]);

  const startSession = useCallback(() => {
    const newTables = Array.from({ length: tableCount }, (_, i) => dealForTable(i));
    setTables(newTables);
    setActiveTableId(0);
    setIsPaused(false);
  }, [tableCount, dealForTable]);

  const resetSession = useCallback(() => {
    setIsPaused(true);
    setTables([]);
    setStats({ total: 0, correct: 0, mistakes: [], history: [] });
  }, []);

  const makeDecision = useCallback(async (tableId: number, action: Action) => {
    setTables(prev => {
      const table = prev.find(t => t.id === tableId);
      if (!table || table.playerAction || table.showFeedback || !table.correctAction || table.percentile === null) return prev;

      const isCorrect = action === table.correctAction;
      const result: HandResult = {
        hand: [...table.hand],
        position: table.position,
        percentile: table.percentile,
        correctAction: table.correctAction,
        playerAction: action,
        isCorrect,
        timestamp: Date.now(),
      };

      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        supabase.from('hand_history').insert([{
          user_id: getUserId(),
          position: result.position,
          hand: result.hand,
          percentile: result.percentile,
          correct_action: result.correctAction,
          player_action: result.playerAction,
          is_correct: result.isCorrect
        }]).then(({ error }) => {
         if (error) console.error("True Error:", error.message || JSON.stringify(error));
        });
      }

      setStats(s => ({
        total: s.total + 1,
        correct: s.correct + (isCorrect ? 1 : 0),
        mistakes: isCorrect ? s.mistakes : [result, ...s.mistakes],
        history: [result, ...s.history].slice(0, 500),
      }));

      return prev.map(t =>
        t.id === tableId ? { ...t, playerAction: action, showFeedback: true } : t
      );
    });

    setTimeout(() => {
      setTables(prev => prev.map(t =>
        t.id === tableId ? dealForTable(tableId) : t
      ));
      if (tableCount > 1) {
        setActiveTableId(id => (id + 1) % tableCount);
      }
    }, 1800);
  }, [dealForTable, tableCount]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (view !== 'trainer' || isPaused) return;
      const key = e.key.toLowerCase();
      if (key === raiseKey) makeDecision(activeTableId, 'raise');
      else if (key === foldKey) makeDecision(activeTableId, 'fold');
      else if (key === ' ') { e.preventDefault(); setIsPaused(p => !p); }
      else if (key === 'tab' && tableCount > 1) {
        e.preventDefault();
        setActiveTableId(id => (id + 1) % tableCount);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, isPaused, raiseKey, foldKey, activeTableId, tableCount, makeDecision]);

  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-slate-100">
      <header className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
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
            { v: 'analytics' as View, icon: BarChart3, label: 'Stats' },
            { v: 'history' as View, icon: History, label: 'History' },
            { v: 'settings' as View, icon: Settings, label: 'Settings' },
          ]).map(({ v, icon: Icon, label }) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                view === v
                  ? 'bg-green-600 text-white'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
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
            setActiveTableId={setActiveTableId}
            isPaused={isPaused}
            stats={stats}
            accuracy={accuracy}
            raiseKey={raiseKey}
            foldKey={foldKey}
            tableCount={tableCount}
            onDecision={makeDecision}
            onStart={startSession}
            onPause={() => setIsPaused(true)}
            onResume={() => setIsPaused(false)}
            onReset={resetSession}
          />
        )}
        {view === 'analytics' && <AnalyticsView stats={stats} />}
        {view === 'history' && <HistoryView stats={stats} />}
        {view === 'settings' && (
          <SettingsView
            activePositions={activePositions}
            setActivePositions={setActivePositions}
            raiseKey={raiseKey}
            setRaiseKey={setRaiseKey}
            foldKey={foldKey}
            setFoldKey={setFoldKey}
            tableCount={tableCount}
            setTableCount={setTableCount}
          />
        )}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Trainer View
// ═══════════════════════════════════════════════════════════

interface TrainerViewProps {
  tables: TableState[];
  activeTableId: number;
  setActiveTableId: (id: number) => void;
  isPaused: boolean;
  stats: SessionStats;
  accuracy: number;
  raiseKey: string;
  foldKey: string;
  tableCount: number;
  onDecision: (tableId: number, action: Action) => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}

function TrainerView({
  tables, activeTableId, setActiveTableId, isPaused, stats, accuracy,
  raiseKey, foldKey, tableCount,
  onDecision, onStart, onPause, onResume, onReset,
}: TrainerViewProps) {
  const hasStarted = tables.length > 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 gap-6 bg-zinc-950">
      {hasStarted && (
        <div className="flex items-center gap-6 text-xs text-zinc-400 font-mono bg-zinc-900/40 px-6 py-2 rounded-full border border-zinc-800">
          <span>Hands <span className="text-zinc-100 ml-1">{stats.total}</span></span>
          <span>Correct <span className="text-green-500 ml-1">{stats.correct}</span></span>
          <span>Accuracy <span className={accuracy >= 70 ? 'text-green-500' : accuracy >= 50 ? 'text-yellow-500' : 'text-red-500'}>{accuracy}%</span></span>
          <span>Errors <span className="text-red-500 ml-1">{stats.mistakes.length}</span></span>
        </div>
      )}

      {!hasStarted ? (
        <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-12 sm:p-16 text-center max-w-xl w-full shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-green-900/10 pointer-events-none" />
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-6 relative z-10">
            <Layers className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2 relative z-10 text-white">Take Your Seat</h2>
          <p className="text-zinc-400 text-sm mb-8 relative z-10">
            Train your PLO6 RFI decisions across all 5-Max positions.<br />
            {tableCount > 1 ? `${tableCount} tables active` : 'Single table mode'}
          </p>
          <button
            onClick={onStart}
            className="px-10 py-3 rounded-xl bg-green-600 text-white font-bold text-base hover:bg-green-500 transition-all active:scale-95 shadow-[0_0_20px_rgba(34,197,94,0.3)] relative z-10"
          >
            Sit & Deal
          </button>
        </div>
      ) : (
        <div className={`w-full max-w-6xl ${tableCount > 1 ? 'grid grid-cols-1 lg:grid-cols-2 gap-8' : 'flex justify-center'}`}>
          {tables.map(table => (
            <PokerTable
              key={table.id}
              table={table}
              isActive={activeTableId === table.id}
              isPaused={isPaused}
              raiseKey={raiseKey}
              foldKey={foldKey}
              multiTable={tableCount > 1}
              onSelect={() => setActiveTableId(table.id)}
              onDecision={(action) => onDecision(table.id, action)}
            />
          ))}
        </div>
      )}

      {hasStarted && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            {!isPaused ? (
              <button onClick={onPause} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors">
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
            ) : (
              <button onClick={onResume} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm hover:bg-green-500 transition-opacity">
                <Play className="w-3.5 h-3.5" /> Resume
              </button>
            )}
            <button onClick={onReset} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Leave Table
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Single Poker Table (5-Max Visuals)
// ═══════════════════════════════════════════════════════════

interface PokerTableProps {
  table: TableState;
  isActive: boolean;
  isPaused: boolean;
  raiseKey: string;
  foldKey: string;
  multiTable: boolean;
  onSelect: () => void;
  onDecision: (action: Action) => void;
}

function PokerTable({
  table, isActive, isPaused, raiseKey, foldKey, multiTable, onSelect, onDecision,
}: PokerTableProps) {
  const canAct = isActive && !isPaused && !table.showFeedback && !table.playerAction;

  const CLOCKWISE_POSITIONS = ['SB', 'BB', 'UTG', 'CO', 'BTN'];
  const heroIdx = CLOCKWISE_POSITIONS.indexOf(table.position);
  
  const opponentSeats = [
    { pos: CLOCKWISE_POSITIONS[(heroIdx + 1) % 5], style: "bottom-[25%] left-[5%] sm:left-[8%]" },
    { pos: CLOCKWISE_POSITIONS[(heroIdx + 2) % 5], style: "top-[15%] left-[20%] sm:left-[25%]" },
    { pos: CLOCKWISE_POSITIONS[(heroIdx + 3) % 5], style: "top-[15%] right-[20%] sm:right-[25%]" },
    { pos: CLOCKWISE_POSITIONS[(heroIdx + 4) % 5], style: "bottom-[25%] right-[5%] sm:right-[8%]" },
  ];

  const renderDealerButton = (pos: string) => {
    if (pos !== 'BTN') return null;
    return (
      <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md absolute -bottom-2 -right-2 border border-zinc-300 z-20">
        <span className="text-[10px] font-bold text-black">D</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center w-full">
      <div
        onClick={multiTable ? onSelect : undefined}
        className={`relative w-full aspect-[2/1] min-h-[250px] max-w-[700px] rounded-[200px] p-3 sm:p-5 transition-all ${
          multiTable ? 'cursor-pointer' : ''
        } ${isActive ? 'ring-4 ring-green-500/50 shadow-[0_0_40px_rgba(34,197,94,0.15)]' : 'opacity-60 grayscale-[30%]'}`}
        style={{
          background: 'linear-gradient(to bottom, #18181b, #09090b)',
          boxShadow: 'inset 0 4px 10px rgba(255,255,255,0.1), 0 10px 30px rgba(0,0,0,0.5)',
        }}
      >
        <div className="relative w-full h-full rounded-[180px] flex flex-col items-center justify-between p-4 sm:p-6 overflow-hidden border-2 border-emerald-900/50"
             style={{
               background: 'radial-gradient(ellipse at center, #065f46 0%, #022c22 100%)',
               boxShadow: 'inset 0 10px 30px rgba(0,0,0,0.6)'
             }}>
          
          <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />

          {opponentSeats.map((seat, i) => (
            <div key={i} className={`absolute ${seat.style} z-10 flex flex-col items-center`}>
              <div className="relative bg-zinc-900 border border-white/10 rounded-full px-4 py-1.5 text-center shadow-xl">
                <span className="text-[10px] sm:text-xs font-bold text-zinc-300 uppercase tracking-wider">{seat.pos}</span>
                {renderDealerButton(seat.pos)}
              </div>
            </div>
          ))}

          <div className="relative z-10 flex flex-col items-center mt-2">
            <div className="bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-3 shadow-xl">
               {multiTable && (
                <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest border-r border-white/10 pr-3">
                  T{table.id + 1}
                </span>
              )}
              <span className="text-[11px] text-zinc-300 font-mono font-bold uppercase tracking-wider">
                Hero: {table.position}
              </span>
            </div>
          </div>

          {/* Feedback Area */}
          {table.showFeedback && table.percentile !== null && (
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center p-5 rounded-2xl backdrop-blur-md border shadow-2xl animate-in fade-in zoom-in duration-200 ${
              table.playerAction === table.correctAction
                ? 'bg-emerald-950/90 border-green-500/40'
                : 'bg-rose-950/90 border-red-500/40'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                {table.playerAction === table.correctAction
                  ? <CheckCircle2 className="w-7 h-7 text-green-500" />
                  : <XCircle className="w-7 h-7 text-red-500" />
                }
                <span className={`font-bold text-xl ${
                  table.playerAction === table.correctAction ? 'text-green-500' : 'text-red-500'
                }`}>
                  {table.playerAction === table.correctAction ? 'Correct' : 'Mistake'}
                </span>
              </div>
              
              <div className="text-sm text-zinc-200 flex gap-2 items-center bg-black/40 px-4 py-1.5 rounded-full border border-white/10">
                <span className="opacity-70">Top:</span> <span className="font-mono font-bold text-white">{table.percentile.toFixed(1)}%</span>
                <span className="opacity-40">|</span>
                <span className="opacity-70">Answer:</span> 
                <span className={`font-bold tracking-wider ${table.correctAction === 'raise' ? 'text-green-400' : 'text-red-400'}`}>
                  {table.correctAction?.toUpperCase()}
                </span>
              </div>
            </div>
          )}

          {isPaused && !table.showFeedback && (
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-black/60 px-6 py-2 rounded-full border border-white/10">
               <span className="text-sm font-medium text-white/70 tracking-widest uppercase">Paused</span>
             </div>
          )}

          <div className="relative z-10 mt-auto translate-y-4 sm:translate-y-6">
            <div className="flex items-center justify-center gap-1 sm:gap-1.5 shadow-2xl relative">
              {isPaused ? (
                table.hand.map((card, i) => (
                  <PlayingCard key={i} card={card} index={i} revealed={false} compact={multiTable} />
                ))
              ) : (
                <AnimatePresence mode="popLayout">
                  {table.hand.map((card, i) => (
                    <motion.div
                      key={`${table.id}-${card.rank}${card.suit}-${i}`} 
                      initial={{ opacity: 0, y: -120, x: (2.5 - i) * 20, scale: 0.5 }}
                      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8, y: 20 }}
                      transition={{ 
                        duration: 0.35, 
                        delay: i * 0.08, 
                        type: "spring",
                        stiffness: 250,
                        damping: 20
                      }}
                      className="hover:-translate-y-2 transition-transform duration-200 cursor-default"
                    >
                      <PlayingCard card={card} index={i} compact={multiTable} />
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
            
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
              className="mt-3 relative mx-auto w-max"
            >
              <div className="bg-zinc-900 border border-green-500/30 rounded-full px-6 py-1.5 text-center shadow-lg">
                <span className="text-xs font-bold text-green-400 uppercase tracking-widest">{table.position}</span>
                {renderDealerButton(table.position)}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <div className={`mt-6 w-full max-w-[400px] flex gap-3 transition-opacity duration-200 ${canAct ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <button
          onClick={(e) => { e.stopPropagation(); onDecision('fold'); }}
          className="flex-1 flex flex-col items-center justify-center py-3 sm:py-4 rounded-xl bg-gradient-to-b from-rose-600 to-rose-800 border border-rose-500 shadow-[0_4px_0_rgb(159,18,57)] hover:from-rose-500 hover:to-rose-700 active:translate-y-[4px] active:shadow-none transition-all"
        >
          <span className="text-white font-bold text-lg leading-none shadow-black drop-shadow-md">Fold</span>
          <span className="text-[10px] text-white/60 font-mono mt-1">[{foldKey.toUpperCase()}]</span>
        </button>
        
        <button
          onClick={(e) => { e.stopPropagation(); onDecision('raise'); }}
          className="flex-1 flex flex-col items-center justify-center py-3 sm:py-4 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-700 border border-emerald-400 shadow-[0_4px_0_rgb(6,95,70)] hover:from-emerald-400 hover:to-emerald-600 active:translate-y-[4px] active:shadow-none transition-all"
        >
          <span className="text-white font-bold text-lg leading-none shadow-black drop-shadow-md">Raise</span>
          <span className="text-[10px] text-white/60 font-mono mt-1">[{raiseKey.toUpperCase()}]</span>
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Analytics & Other Views
// ═══════════════════════════════════════════════════════════

function AnalyticsView({ stats }: { stats: SessionStats }) {
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const posStats: Record<string, { total: number; correct: number }> = {};
  
  stats.history.forEach(h => {
    if (!posStats[h.position]) posStats[h.position] = { total: 0, correct: 0 };
    posStats[h.position].total++;
    if (h.isCorrect) posStats[h.position].correct++;
  });

  return (
    <div className="flex-1 p-4 sm:p-8 max-w-3xl mx-auto w-full overflow-y-auto">
      <h2 className="text-xl font-bold mb-5 text-white">Session Analytics</h2>
      {stats.total === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No hands played yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Total" value={stats.total} />
            <Stat label="Correct" value={stats.correct} accent="text-green-500" />
            <Stat label="Mistakes" value={stats.mistakes.length} accent="text-red-500" />
            <Stat label="Accuracy" value={`${accuracy}%`} accent={accuracy >= 70 ? 'text-green-500' : 'text-red-500'} />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-3 text-zinc-400 uppercase tracking-wider">By Position</h3>
            <div className="space-y-1.5">
              {Object.entries(posStats).sort(([a], [b]) => RFI_POSITIONS.indexOf(a as Position) - RFI_POSITIONS.indexOf(b as Position)).map(([pos, d]) => {
                const acc = Math.round((d.correct / d.total) * 100);
                return (
                  <div key={pos} className="flex items-center gap-3 p-2.5 bg-zinc-900 rounded-lg border border-zinc-800">
                    <PositionBadge position={pos as Position} size="sm" />
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${acc}%` }} />
                    </div>
                    <span className="font-mono text-xs w-24 text-right text-zinc-400">
                      {acc}% <span className="opacity-50">({d.correct}/{d.total})</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
      <div className={`text-xl font-bold font-mono ${accent || 'text-white'}`}>{value}</div>
      <div className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function HistoryView({ stats }: { stats: SessionStats }) {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const sorted = stats.history.filter(h => filter === 'all' ? true : filter === 'correct' ? h.isCorrect : !h.isCorrect);

  return (
    <div className="flex-1 p-4 sm:p-8 max-w-5xl mx-auto w-full overflow-y-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-white">Hand History</h2>
      </div>
      {stats.history.length === 0 ? (
        <div className="text-center py-20 text-zinc-500">
          <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No hands played yet.</p>
        </div>
      ) : (
        <div className="space-y-0.5">
          {sorted.map((h, i) => (
            <div key={i} className={`flex items-center gap-4 px-4 py-3 rounded-lg border ${h.isCorrect ? 'bg-zinc-900 border-zinc-800' : 'bg-red-950/20 border-red-900/30'}`}>
              {h.isCorrect ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
              <PositionBadge position={h.position} size="sm" />
              <div className="flex items-center gap-1.5">
                {h.hand.map((c, ci) => <InlineCard key={ci} card={c} />)}
              </div>
              <div className="ml-auto text-right font-mono text-xs text-zinc-400">
                Correct: <span className={h.correctAction === 'raise' ? 'text-green-500' : 'text-red-500'}>{h.correctAction.toUpperCase()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface SettingsViewProps {
  activePositions: Position[];
  setActivePositions: (p: Position[]) => void;
  raiseKey: string;
  setRaiseKey: (k: string) => void;
  foldKey: string;
  setFoldKey: (k: string) => void;
  tableCount: number;
  setTableCount: (n: number) => void;
}

function SettingsView({ activePositions, setActivePositions, raiseKey, setRaiseKey, foldKey, setFoldKey, tableCount, setTableCount }: SettingsViewProps) {
  const toggle = (pos: Position) => {
    if (activePositions.includes(pos) && activePositions.length > 1) setActivePositions(activePositions.filter(p => p !== pos));
    else if (!activePositions.includes(pos)) setActivePositions([...activePositions, pos]);
  };

  return (
    <div className="flex-1 p-4 sm:p-8 max-w-2xl mx-auto w-full overflow-y-auto">
      <h2 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
        <Settings className="w-5 h-5 text-zinc-500" /> Settings
      </h2>
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-semibold mb-2 text-zinc-300">Tables</h3>
          <div className="flex gap-2">
            {[1, 2].map(n => (
              <button key={n} onClick={() => setTableCount(n)} className={`px-5 py-2 rounded-lg border font-mono text-sm font-bold ${tableCount === n ? 'bg-green-600 border-green-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
                {n} {n === 1 ? 'Table' : 'Tables'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold mb-2 text-zinc-300">RFI Positions</h3>
          <div className="flex flex-wrap gap-2">
            {RFI_POSITIONS.map(pos => (
              <button key={pos} onClick={() => toggle(pos)} className={`px-4 py-2 rounded-lg border font-mono font-bold text-sm ${activePositions.includes(pos) ? 'bg-green-600 border-green-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>
                {pos}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}