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
  const [tables, setTables] = useState<TableState[]>([]);
  const [activeTableId, setActiveTableId] = useState(0);
  const [stats, setStats] = useState<SessionStats>({ total: 0, correct: 0, mistakes: [], history: [] });
  const [activePositions, setActivePositions] = useState<Position[]>([...RFI_POSITIONS]);
  const [activeDrill, setActiveDrill] = useState<string | null>(null);

  const dealForTable = useCallback((tableId: number): TableState => {
    return createTableState(tableId, activePositions, activeDrill);
  }, [activePositions, activeDrill]);

  const startSession = useCallback(() => {
    setTables([dealForTable(0)]);
    setActiveTableId(0);
    setIsPaused(false);
  }, [dealForTable]);

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
      severity: table.severity,
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
      }]).then(({ error }) => { if (error) console.error(error.message); });
    }

    setTables(prev => prev.map(t => t.id === tableId ? { ...t, playerAction: action, showFeedback: true } : t));

    setTimeout(() => {
      setTables(prev => prev.map(t => t.id === tableId ? dealForTable(tableId) : t));
    }, 1800);
  }, [tables, dealForTable]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (view !== 'trainer' || isPaused) return;
      const key = e.key.toLowerCase();
      if (key === 'r') makeDecision(activeTableId, 'raise');
      else if (key === 'f') makeDecision(activeTableId, 'fold');
      else if (key === ' ') { e.preventDefault(); setIsPaused(p => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, isPaused, activeTableId, makeDecision]);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-slate-100">
      <header className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center"><Layers className="w-4 h-4 text-green-500" /></div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">PLO6 <span className="text-green-500">Trainer</span></h1>
        </div>
        <nav className="flex items-center gap-0.5">
          {([{ v: 'trainer', icon: Play, label: 'Train' }, { v: 'analytics', icon: BarChart3, label: 'Leak Finder' }, { v: 'history', icon: History, label: 'History' }, { v: 'settings', icon: Settings, label: 'Settings' }]).map(({ v, icon: Icon, label }) => (
            <button key={v} onClick={() => setView(v as View)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${view === v ? 'bg-green-600 text-white' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}`}>
              <Icon className="w-3.5 h-3.5" /><span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>
      </header>
      <main className="flex-1 flex flex-col">
        {view === 'trainer' && <TrainerView tables={tables} activeTableId={activeTableId} isPaused={isPaused} stats={stats} accuracy={stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0} activeDrill={activeDrill} onDecision={makeDecision} onStart={startSession} onPause={() => setIsPaused(true)} onResume={() => setIsPaused(false)} onReset={resetSession} onClearDrill={() => setActiveDrill(null)} />}
        {view === 'analytics' && <AnalyticsView stats={stats} onStartDrill={(tag: string) => { setActiveDrill(tag); setView('trainer'); startSession(); }} />}
        {view === 'history' && <HistoryView stats={stats} />}
        {view === 'settings' && <SettingsView activePositions={activePositions} setActivePositions={setActivePositions} />}
      </main>
    </div>
  );
}

function TrainerView({ tables, isPaused, stats, accuracy, activeDrill, onDecision, onStart, onPause, onResume, onReset, onClearDrill }: any) {
  const hasStarted = tables.length > 0;
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 gap-6 bg-zinc-950 overflow-hidden relative">
      {activeDrill && (
        <div className="absolute top-4 z-50 flex items-center gap-3 bg-blue-900/40 border border-blue-500/50 px-6 py-2 rounded-full text-blue-400 text-sm font-bold shadow-[0_0_20px_rgba(59,130,246,0.2)]">
          <Target className="w-4 h-4" /> DRILL: {activeDrill} {hasStarted && <button onClick={onClearDrill} className="ml-4 text-xs bg-blue-950 px-3 py-1 rounded-full">Clear</button>}
        </div>
      )}
      {hasStarted && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-6 text-xs text-zinc-400 font-mono bg-zinc-900/80 px-6 py-2 rounded-full border border-zinc-800">
          <span>Hands <span className="text-zinc-100 ml-1">{stats.total}</span></span>
          <span>Accuracy <span className={accuracy >= 70 ? 'text-green-500' : 'text-red-500'}>{accuracy}%</span></span>
        </div>
      )}
      {!hasStarted ? (
        <div className="bg-zinc-900 rounded-3xl border border-zinc-800 p-12 text-center max-w-xl w-full shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-6"><Layers className="w-8 h-8 text-green-500" /></div>
          <h2 className="text-2xl font-bold mb-2 text-white">Take Your Seat</h2>
          <p className="text-zinc-400 text-sm mb-8">Train RFI across all 5-Max positions with solver-backed severity grading.</p>
          <button onClick={onStart} className="px-10 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-500 transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)]">Sit & Deal</button>
        </div>
      ) : (
        <div className="w-full max-w-5xl flex flex-col items-center relative mt-12">
          {tables.map((table: any) => <PokerTable key={table.id} table={table} isActive={true} isPaused={isPaused} onDecision={(action: any) => onDecision(table.id, action)} />)}
        </div>
      )}
      {hasStarted && (
        <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-2">
          <button onClick={isPaused ? onResume : onPause} className={`w-12 h-12 flex items-center justify-center rounded-full border border-zinc-700 text-zinc-300 ${isPaused ? 'bg-green-600' : 'bg-zinc-800'}`}>{isPaused ? <Play className="w-5 h-5 ml-1" /> : <Pause className="w-5 h-5" />}</button>
          <button onClick={onReset} className="w-12 h-12 flex items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300"><RotateCcw className="w-5 h-5" /></button>
        </div>
      )}
    </div>
  );
}

function PokerTable({ table, isActive, isPaused, onDecision }: any) {
  const canAct = isActive && !isPaused && !table.showFeedback && !table.playerAction;
  const CLOCKWISE_POSITIONS = ['SB', 'BB', 'UTG', 'CO', 'BTN'];
  const heroIdx = CLOCKWISE_POSITIONS.indexOf(table.position);
  
  const opponentSeats = [
    { pos: CLOCKWISE_POSITIONS[(heroIdx + 1) % 5], style: "bottom-[12%] sm:bottom-[20%] left-[2%]", chipStyle: "-top-6 sm:-top-8 left-1/2 -translate-x-1/2" },
    { pos: CLOCKWISE_POSITIONS[(heroIdx + 2) % 5], style: "top-[8%] sm:top-[15%] left-[8%] sm:left-[15%]", chipStyle: "-bottom-6 sm:-bottom-8 left-1/2 -translate-x-1/2" },
    { pos: CLOCKWISE_POSITIONS[(heroIdx + 3) % 5], style: "top-[8%] sm:top-[15%] right-[8%] sm:right-[15%]", chipStyle: "-bottom-6 sm:-bottom-8 left-1/2 -translate-x-1/2" },
    { pos: CLOCKWISE_POSITIONS[(heroIdx + 4) % 5], style: "bottom-[12%] sm:bottom-[20%] right-[2%]", chipStyle: "-top-6 sm:-top-8 left-1/2 -translate-x-1/2" },
  ];

  const renderPostedChip = (pos: string) => {
    if (pos !== 'SB' && pos !== 'BB') return null;
    const amount = pos === 'SB' ? '0.5' : '1';
    return (
      <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 px-2 py-0.5 rounded-full z-20 shadow-lg">
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-gradient-to-br from-red-400 to-red-700 border border-red-300/50"></div>
        <span className="text-[10px] text-white font-bold">{amount}</span>
      </div>
    );
  };

  let dealerStyle = "bottom-[22%] sm:bottom-[25%] right-[28%] sm:right-[35%]";
  if (opponentSeats[0].pos === 'BTN') dealerStyle = "bottom-[22%] sm:bottom-[25%] left-[12%] sm:left-[18%]";
  else if (opponentSeats[1].pos === 'BTN') dealerStyle = "top-[22%] sm:top-[25%] left-[22%] sm:left-[28%]";
  else if (opponentSeats[2].pos === 'BTN') dealerStyle = "top-[22%] sm:top-[25%] right-[22%] sm:right-[28%]";
  else if (opponentSeats[3].pos === 'BTN') dealerStyle = "bottom-[22%] sm:bottom-[25%] right-[12%] sm:right-[18%]";

  const getFeedback = () => {
    if (table.playerAction === table.correctAction) return { label: 'Perfect', color: 'text-green-500', bg: 'bg-emerald-950/95', border: 'border-green-500/50' };
    if (table.severity === 'marginal') return { label: 'Marginal', color: 'text-yellow-500', bg: 'bg-zinc-900/95', border: 'border-yellow-500/50' };
    if (table.severity === 'bad') return { label: 'Bad Miss', color: 'text-orange-500', bg: 'bg-orange-950/95', border: 'border-orange-500/50' };
    return { label: 'Blunder', color: 'text-red-500', bg: 'bg-rose-950/95', border: 'border-red-500/50' };
  };

  const fb = getFeedback();

  return (
    <div className="flex flex-col items-center w-full max-w-[850px] relative">
      <div className="relative w-full aspect-[1.5/1] sm:aspect-[2.2/1] min-h-[220px] rounded-[300px] p-2 sm:p-4 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-2xl overflow-hidden border-zinc-700">
        <div className="relative w-full h-full rounded-[250px] flex items-center justify-center border-4 border-zinc-800/80 overflow-hidden" style={{ background: 'radial-gradient(ellipse at center, #0f766e 0%, #064e3b 100%)' }}>
          <div className={`absolute ${dealerStyle} z-20 w-5 h-5 sm:w-7 sm:h-7 bg-red-600 rounded-full flex items-center justify-center shadow-lg border border-red-300/50 transition-all`}><span className="text-white font-black text-[8px] sm:text-[10px]">D</span></div>
          {(table.position === 'SB' || table.position === 'BB') && <div className="absolute bottom-[10%] sm:bottom-[12%] left-1/2 -translate-x-1/2 z-20">{renderPostedChip(table.position)}</div>}
          {opponentSeats.map((seat, i) => (
            <div key={i} className={`absolute ${seat.style} z-10 flex flex-col items-center`}>
              {(seat.pos === 'SB' || seat.pos === 'BB') && <div className={`absolute ${seat.chipStyle}`}>{renderPostedChip(seat.pos)}</div>}
              <div className="flex -mb-2 sm:-mb-4 opacity-80 scale-50 sm:scale-75">{[1,2,3,4,5,6].map(n => <div key={n} className="w-8 h-12 bg-red-800 border border-red-950 rounded-sm -ml-3 shadow-md rotate-[-5deg]" />)}</div>
              <div className="relative bg-zinc-900 border-t-2 border-zinc-600 rounded-md px-3 sm:px-6 py-0.5 sm:py-1 text-center shadow-xl z-20"><span className="text-[9px] sm:text-xs font-medium text-zinc-100">{seat.pos}</span></div>
            </div>
          ))}
          <div className="absolute top-[35%] bg-blue-900/40 text-blue-300 text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-1 rounded-full border border-blue-500/30">Pot 1.5</div>
          {table.showFeedback && (
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center justify-center p-4 sm:p-6 rounded-2xl backdrop-blur-md border shadow-2xl ${fb.bg} ${fb.border}`}>
              <span className={`font-black text-sm sm:text-xl uppercase tracking-widest ${fb.color} mb-2`}>{fb.label}</span>
              <div className="text-[10px] sm:text-xs text-zinc-200 bg-black/50 px-3 py-2 rounded-lg border border-white/10 w-full text-center">
                <div className="flex justify-between w-full border-b border-white/10 pb-1"><span>Value:</span><span className="font-mono font-bold">Top {table.percentile?.toFixed(1)}%</span></div>
                <div className="flex justify-between w-full pt-1"><span>Solver:</span><span className={`font-black uppercase ${table.correctAction === 'raise' ? 'text-green-400' : 'text-red-400'}`}>{table.correctAction}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="relative z-30 -mt-8 sm:-mt-16 flex flex-col items-center w-full scale-[0.85] sm:scale-100 origin-top">
        <div className="flex justify-center items-end h-[120px] sm:h-[150px] w-full">
          {isPaused ? table.hand.map((c: any, i: any) => <div key={i} className="relative shadow-2xl origin-bottom" style={{ transform: `rotate(${(i-2.5)*6}deg)`, zIndex: i, marginLeft: i===0?0:'-1rem' }}><PlayingCard card={c} index={i} revealed={false} /></div>)
          : <AnimatePresence mode="popLayout">{table.hand.map((c: any, i: any) => (
            <motion.div key={i} initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: [18,6,0,0,6,18][i], rotate: [-15,-9,-3,3,9,15][i], marginLeft: i===0?'0px':'-1rem' }} transition={{ duration: 0.3, delay: i*0.04 }} style={{ zIndex: i+10, transformOrigin: 'bottom center' }} className="relative cursor-pointer shadow-lg rounded-lg">
              <PlayingCard card={c} index={i} />
            </motion.div>
          ))}</AnimatePresence>}
        </div>
        <div className="relative z-40 mt-[-5px] bg-zinc-900 border-t border-zinc-600 rounded-md px-6 sm:px-10 py-1 shadow-2xl text-center">
          <span className="text-zinc-200 text-xs sm:text-sm font-medium block">{table.position}</span>
          <span className="text-yellow-500 font-bold text-xs sm:text-sm uppercase">Hero</span>
        </div>
      </div>
      <div className={`mt-2 sm:mt-6 w-full max-w-[450px] flex gap-2 sm:gap-3 px-2 sm:px-0 transition-all ${canAct ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <button onClick={() => onDecision('fold')} className="flex-1 py-3 rounded-lg bg-rose-600 border-b-4 border-rose-800 text-white font-bold hover:bg-rose-500 active:translate-y-1 active:border-b-0">Fold</button>
        <button onClick={() => onDecision('raise')} className="flex-1 py-3 rounded-lg bg-emerald-600 border-b-4 border-emerald-800 text-white font-bold hover:bg-emerald-500 active:translate-y-1 active:border-b-0">Raise</button>
      </div>
    </div>
  );
}

function AnalyticsView({ stats, onStartDrill }: any) {
  if (stats.total === 0) return <div className="text-center py-20 text-zinc-500">Play some hands to generate analytics.</div>;
  const tagStats: any = {};
  stats.history.forEach((h: any) => h.tags.forEach((tag: any) => { if (!tagStats[tag]) tagStats[tag] = { t: 0, c: 0 }; tagStats[tag].t++; if (h.isCorrect) tagStats[tag].c++; }));
  const sorted = Object.entries(tagStats).map(([tag, d]: any) => ({ tag, accuracy: Math.round((d.c/d.t)*100), t: d.t })).sort((a,b) => a.accuracy - b.accuracy);
  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full overflow-y-auto space-y-8">
      <h2 className="text-2xl font-bold">Leak Finder</h2>
      {sorted.filter(l => l.accuracy <= 60 && l.t >= 3).map(leak => (
        <div key={leak.tag} className="flex justify-between items-center p-4 bg-rose-950/20 border border-rose-900 rounded-xl">
          <div><h4 className="font-bold">{leak.tag}</h4><p className="text-sm opacity-60">Accuracy: {leak.accuracy}%</p></div>
          <button onClick={() => onStartDrill(leak.tag)} className="px-6 py-2 bg-rose-600 font-bold rounded-lg hover:bg-rose-500">Drill</button>
        </div>
      ))}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sorted.map(t => (
          <div key={t.tag} className="flex justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800">
            <span className="text-sm">{t.tag}</span><span className={`text-xs font-mono ${t.accuracy > 75 ? 'text-green-500' : 'text-red-500'}`}>{t.accuracy}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistoryView({ stats }: any) {
  return (
    <div className="flex-1 p-8 max-w-5xl mx-auto w-full overflow-y-auto">
      <h2 className="text-xl font-bold mb-5">Hand History</h2>
      {stats.history.length === 0 ? <p className="opacity-40">No hands played yet.</p> : stats.history.map((h: any, i: any) => (
        <div key={i} className={`flex items-center gap-4 px-4 py-3 rounded-lg border mb-1 ${h.isCorrect ? 'bg-zinc-900' : 'bg-red-950/20 border-red-900/30'}`}>
          <PositionBadge position={h.position} size="sm" />
          <div className="flex gap-1">{h.hand.map((c: any, ci: any) => <InlineCard key={ci} card={c} />)}</div>
          <div className="ml-auto text-xs font-mono uppercase"><span className={h.correctAction === 'raise' ? 'text-green-500' : 'text-red-500'}>{h.correctAction}</span></div>
        </div>
      ))}
    </div>
  );
}

function SettingsView({ activePositions, setActivePositions }: any) {
  const toggle = (p: any) => activePositions.includes(p) ? (activePositions.length > 1 && setActivePositions(activePositions.filter((x: any) => x !== p))) : setActivePositions([...activePositions, p]);
  return (
    <div className="flex-1 p-8 max-w-2xl mx-auto w-full">
      <h2 className="text-xl font-bold mb-6">Settings</h2>
      <div className="flex flex-wrap gap-2">
        {RFI_POSITIONS.map(p => <button key={p} onClick={() => toggle(p)} className={`px-4 py-2 rounded-lg border font-bold ${activePositions.includes(p) ? 'bg-green-600' : 'bg-zinc-900'}`}>{p}</button>)}
      </div>
    </div>
  );
}