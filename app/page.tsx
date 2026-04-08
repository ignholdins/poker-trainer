'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase, getUserId } from '@/lib/supabase';
import {
  Card as CardType, Position, Action, HandResult, SessionStats, TableState,
  RFI_POSITIONS, dealHand, createTableState,
} from '@/lib/poker';
import { PlayingCard, InlineCard } from '@/components/PlayingCard';
import { PositionBadge } from '@/components/PositionBadge';
import { Settings, BarChart3, History, Play, Layers, Target } from 'lucide-react';

type View = 'trainer' | 'drills' | 'analytics' | 'history' | 'settings';

export default function PLO6Trainer() {
  const [view, setView] = useState<View>('trainer');
  const [isPaused, setIsPaused] = useState(true);
  const [tables, setTables] = useState<TableState[]>([]);
  const [stats, setStats] = useState<SessionStats>({ total: 0, correct: 0, mistakes: [], history: [] });
  const [activePositions, setActivePositions] = useState<Position[]>([...RFI_POSITIONS]);
  const [activeDrill, setActiveDrill] = useState<string | null>(null);

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

  const startSession = useCallback((drill: string | null = null) => {
    setActiveDrill(drill);
    setTables([createTableState(0, activePositions, drill)]);
    setIsPaused(false);
    setView('trainer');
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
      try {
        const { error } = await supabase.from('hand_history').insert([{
          user_id: getUserId(), position: result.position, scenario: result.scenario || 'RFI',
          hand: result.hand,
          correct_action: result.correctAction, player_action: result.playerAction, is_correct: result.isCorrect
        }]);
        if (error) console.error('Failed to save hand history:', error);
      } catch (err) {
        console.error('Network error saving hand history:', err);
      }
    }

    setTables(prev => prev.map(t => t.id === tableId ? { ...t, playerAction: action, showFeedback: true } : t));
    
    const nextTable = createTableState(tableId, activePositions, activeDrill);
    setTimeout(() => {
      setTables(prev => prev.map(t => t.id === tableId ? nextTable : t));
    }, 1600);
  }, [tables, activePositions, activeDrill]);

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-slate-100 overflow-hidden font-sans select-none">
      
      {/* 5-Icon Top Navigation */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
            <Layers className="w-4 h-4 text-green-500" />
          </div>
          <h1 className="text-base font-bold text-white">PLO6 <span className="text-green-500">Trainer v5</span></h1>
        </div>
        <nav className="flex items-center gap-1">
          {[
            { v: 'trainer', icon: Play }, { v: 'drills', icon: Target }, 
            { v: 'analytics', icon: BarChart3 }, { v: 'history', icon: History }, 
            { v: 'settings', icon: Settings }
          ].map(({ v, icon: Icon }) => (
            <button 
              key={v} onClick={() => setView(v as View)} 
              className={`p-2 rounded-xl transition-all active:scale-95 ${view === v ? 'bg-green-600 text-white' : 'text-zinc-400 hover:bg-zinc-800'}`}
            >
              <Icon className="w-5 h-5" />
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 flex flex-col overflow-y-auto px-4 sm:px-8 py-6">
        {view === 'trainer' && (
          <div className="flex flex-col items-center justify-center w-full h-full max-w-5xl mx-auto space-y-8">
            {isPaused ? (
              <button onClick={() => startSession(null)} className="px-10 py-5 bg-green-600 rounded-2xl font-black text-2xl shadow-2xl hover:bg-green-500 hover:scale-105 transition-all active:scale-95">Start Session</button>
            ) : (
              tables.map(table => <PokerTable key={table.id} table={table} isActive={true} isPaused={isPaused} onDecision={(act: Action) => makeDecision(table.id, act)} />)
            )}
          </div>
        )}
        {view === 'drills' && <DrillsView onSelectDrill={startSession} />}
        {view === 'analytics' && <AnalyticsView stats={stats} />}
        {view === 'history' && <HistoryView history={stats.history} />}
        {view === 'settings' && <SettingsView activePositions={activePositions} setActivePositions={setActivePositions} />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// POKER TABLE COMPONENT (The Engine)
// ═══════════════════════════════════════════════════════════
function PokerTable({ table, isActive, isPaused, onDecision }: { table: TableState, isActive: boolean, isPaused: boolean, onDecision: (act: Action) => void }) {
  const ACTION_ORDER = ['UTG', 'CO', 'BTN', 'SB', 'BB'];
  const heroActionIdx = ACTION_ORDER.indexOf(table.position);

  const [currentActorIdx, setCurrentActorIdx] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line
    setCurrentActorIdx(0);
  }, [table.id]);

  useEffect(() => {
    const safeScenario = table.scenario || 'RFI';
    if (safeScenario === 'RFI') {
      if (currentActorIdx < heroActionIdx && !isPaused && !table.playerAction) {
        const timer = setTimeout(() => {
          setCurrentActorIdx(prev => prev + 1);
        }, 700);
        return () => clearTimeout(timer);
      }
    } else {
      // eslint-disable-next-line
      setCurrentActorIdx(heroActionIdx);
    }
  }, [currentActorIdx, heroActionIdx, isPaused, table.scenario, table.playerAction]);

  const isHeroTurn = currentActorIdx === heroActionIdx;
  const canAct = isActive && !isPaused && !table.showFeedback && !table.playerAction && isHeroTurn;

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
      return posIdx < currentActorIdx;
    }
    return false;
  };

  const isThinking = (pos: string) => {
    const posIdx = ACTION_ORDER.indexOf(pos);
    return posIdx === currentActorIdx && !table.playerAction && posIdx <= heroActionIdx;
  };

  const foldedCount = opponentSeats.filter(s => isFolded(s.pos)).length;

  const renderChip = (amount: string) => (
    <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 px-2 py-0.5 rounded-full z-20 shadow-lg animate-in fade-in zoom-in duration-300">
      <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-red-400 to-red-700 border border-red-300/50"></div>
      <span className="text-[10px] text-white font-bold">{amount}</span>
    </div>
  );

  return (
    <div className="flex flex-col items-center w-full max-w-[1100px] relative">
      <div className="relative w-full aspect-[1.3/1] sm:aspect-[2.2/1] min-h-[300px] sm:min-h-[400px] rounded-[300px] p-2 bg-gradient-to-b from-zinc-800 to-zinc-950 shadow-2xl overflow-hidden border-zinc-700">
        <div className="relative w-full h-full rounded-[250px] flex items-center justify-center border-4 border-zinc-800/80 overflow-hidden" style={{ background: 'radial-gradient(ellipse at center, #0f766e 0%, #064e3b 100%)' }}>
          
          {/* Dealer Button */}
          {table.position === 'BTN' ? (
            <div className="absolute bottom-[28%] sm:bottom-[32%] right-[38%] z-40 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white border border-zinc-400 flex items-center justify-center shadow-lg animate-in fade-in zoom-in duration-500">
               <span className="text-[10px] sm:text-xs font-black text-black leading-none">D</span>
            </div>
          ) : (
            opponentSeats.map((seat, i) => seat.pos === 'BTN' && (
              <div key={`d-${i}`} className={`absolute ${seat.style} z-40 -translate-x-8 sm:-translate-x-12 translate-y-4 sm:translate-y-6 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white border border-zinc-400 flex items-center justify-center shadow-lg animate-in fade-in zoom-in duration-500`}>
                 <span className="text-[10px] sm:text-xs font-black text-black leading-none">D</span>
              </div>
            ))
          )}

          {(table.position === 'SB' || table.position === 'BB') && <div className="absolute bottom-[10%] sm:bottom-[12%] left-1/2 -translate-x-1/2 z-20">{renderChip(table.position === 'SB' ? '0.5' : '1')}</div>}
          
          {opponentSeats.map((seat, i) => {
            const isRaiser = table.raiserPosition === seat.pos;
            const folded = isFolded(seat.pos);
            const thinking = isThinking(seat.pos);
            
            return (
              <div key={i} className={`absolute ${seat.style} z-10 flex flex-col items-center transition-all duration-500`}>
                {isRaiser && <div className={`absolute ${seat.chipStyle}`}>{renderChip('3.5')}</div>}
                {!isRaiser && !folded && (seat.pos === 'SB' || seat.pos === 'BB') && <div className={`absolute ${seat.chipStyle}`}>{renderChip(seat.pos === 'SB' ? '0.5' : '1')}</div>}
                
                <div 
                  className={`flex -mb-2 sm:-mb-4 transition-all duration-500 origin-center ${!folded ? 'scale-50 sm:scale-75' : ''} ${thinking ? '-translate-y-2' : ''}`}
                  style={{ opacity: folded ? 0 : 0.8, transform: folded ? 'scale(0) translateY(-20px)' : undefined, pointerEvents: folded ? 'none' : 'auto' }}
                >
                  {[1,2,3,4,5,6].map(n => <div key={n} className="w-8 h-12 bg-red-800 border border-red-950 rounded-sm -ml-3 shadow-md rotate-[-5deg]" />)}
                </div>
                
                <div className={`relative bg-zinc-900 border-t-2 border-zinc-600 rounded-md px-3 py-0.5 text-center shadow-xl z-20 transition-all duration-300 ${thinking ? 'ring-2 ring-yellow-400' : ''} ${isRaiser ? 'ring-2 ring-red-500' : ''} ${folded ? 'opacity-20' : 'opacity-100'}`}>
                  <span className="text-[9px] font-medium text-zinc-100">{seat.pos} {folded ? '(Folded)' : ''}</span>
                </div>
              </div>
            );
          })}

          {table.showFeedback && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 flex flex-col items-center justify-center p-6 sm:p-8 rounded-[32px] backdrop-blur-xl border border-white/20 shadow-2xl bg-black/70 animate-in zoom-in duration-300">
              <span className={`font-black text-2xl sm:text-4xl uppercase tracking-[0.2em] mb-4 ${table.playerAction === table.correctAction ? 'text-green-500' : 'text-red-500'}`}>
                {table.playerAction === table.correctAction ? 'Perfect' : 'Mistake'}
              </span>
              <div className="flex flex-col items-center gap-1">
                <span className="text-zinc-400 text-xs sm:text-sm font-bold uppercase tracking-widest">Hand Strength</span>
                <span className="text-white text-2xl sm:text-3xl font-mono font-black">{table.percentile?.toFixed(1)}%</span>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                {table.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-white/10 border border-white/10 rounded-full text-[10px] sm:text-xs font-black text-zinc-300 uppercase letter-spacing-wide">{tag}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-30 mt-2 sm:mt-4 flex flex-col items-center w-full scale-[0.85] sm:scale-100 origin-top">
        <div className="flex justify-center items-center h-[120px] w-full gap-0">
          {table.hand.map((c: CardType, i: number) => (
             <div key={i} className="relative shadow-2xl origin-bottom transition-all duration-300" style={{ transform: `rotate(${(i-2.5)*3}deg) translateY(${Math.abs(i-2.5)*4}px)`, zIndex: i, marginLeft: i===0?0:'-0.75rem' }}>
                <PlayingCard card={c} revealed={true} />
             </div>
          ))}
        </div>
        <div className={`relative z-40 mt-[-5px] bg-zinc-900 border-t border-zinc-600 rounded-md px-6 py-1 shadow-2xl text-center transition-all duration-300 ${isHeroTurn && !table.playerAction ? 'ring-2 ring-yellow-400 bg-zinc-800' : ''}`}>
            <span className="text-zinc-200 text-xs font-medium block">{table.position}</span>
        </div>
      </div>

      <div className="mt-4 sm:mt-10 w-full max-w-[600px] flex gap-3 px-2">
        <button onClick={() => onDecision('fold')} disabled={!canAct} className={`flex-1 py-4 rounded-xl border-b-[6px] font-black text-lg sm:text-xl text-white transition-all ${canAct ? 'bg-rose-600 border-rose-800 hover:bg-rose-500 active:border-b-0 active:translate-y-1.5' : 'bg-zinc-700 border-zinc-800 text-zinc-500'}`}>Fold</button>
        <button onClick={() => onDecision('raise')} disabled={!canAct} className={`flex-1 py-4 rounded-xl border-b-[6px] font-black text-lg sm:text-xl text-white transition-all ${canAct ? 'bg-emerald-600 border-emerald-800 hover:bg-emerald-500 active:border-b-0 active:translate-y-1.5' : 'bg-zinc-700 border-zinc-800 text-zinc-500'}`}>Raise</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DRILLS VIEW
// ═══════════════════════════════════════════════════════════
function DrillsView({ onSelectDrill }: { onSelectDrill: (drill: string) => void }) {
  const drills = [
    { name: "The Premiums", desc: "Top 5% AA, KK, & High Rundowns", color: "from-amber-500/20 to-amber-900/20", border: "border-amber-500/50" },
    { name: "The Traps", desc: "Naked Kings, Danglers, Weak Aces", color: "from-red-500/20 to-red-900/20", border: "border-red-500/50" },
    { name: "Connectors", desc: "Mid & Weak Rundown Playability", color: "from-blue-500/20 to-blue-900/20", border: "border-blue-500/50" },
  ];

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2">Drill Library</h2>
      <p className="text-xs text-zinc-400 mb-6">Proactively target specific hand archetypes.</p>
      <div className="grid grid-cols-1 gap-3">
        {drills.map(drill => (
          <button key={drill.name} onClick={() => onSelectDrill(drill.name)} className={`w-full text-left p-5 rounded-2xl bg-gradient-to-br ${drill.color} border ${drill.border} active:scale-95 transition-all`}>
            <h3 className="text-lg font-bold text-white mb-1">{drill.name}</h3>
            <p className="text-xs text-zinc-300">{drill.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ANALYTICS VIEW
// ═══════════════════════════════════════════════════════════
function AnalyticsView({ stats }: { stats: SessionStats }) {
  const winRate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold mb-2">Session Analytics</h2>
      
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col items-center justify-center">
        <span className="text-sm text-zinc-400 uppercase tracking-widest font-bold mb-2">Overall Accuracy</span>
        <span className={`text-6xl font-black ${winRate >= 80 ? 'text-green-500' : winRate >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
          {winRate}%
        </span>
        <span className="text-xs text-zinc-500 mt-2">{stats.correct} correct out of {stats.total} hands</span>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
         <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <span className="text-xs text-zinc-400 block mb-1">Passives</span>
            <span className="text-xl font-bold text-red-400">12 Mistakes</span>
         </div>
         <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <span className="text-xs text-zinc-400 block mb-1">Aggression</span>
            <span className="text-xl font-bold text-blue-400">8 Punts</span>
         </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// HISTORY VIEW
// ═══════════════════════════════════════════════════════════
function HistoryView({ history }: { history: HandResult[] }) {
  return (
    <div className="p-4 sm:p-8 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-white">Hand History</h2>
        <span className="text-xs text-zinc-500 uppercase font-black tracking-widest">{history.length} Hands</span>
      </div>
      {history.map((hand, i) => (
        <div key={i} className="bg-zinc-900/50 backdrop-blur-sm rounded-2xl border border-zinc-800/50 p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 hover:bg-zinc-800/50 transition-colors">
          <div className="flex items-center gap-4">
            <PositionBadge position={hand.position} />
            <div className="flex gap-1 sm:gap-1.5">
              {(Array.isArray(hand.hand) ? hand.hand : []).map((c, idx) => <InlineCard key={idx} card={c} />)}
            </div>
          </div>
          
          <div className="flex items-center justify-between lg:justify-end gap-6 w-full lg:w-auto overflow-hidden">
            <div className="flex flex-col min-w-[70px]">
              <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">Grade</span>
              <span className={`text-sm font-mono font-black ${hand.percentile !== undefined && hand.percentile <= 20 ? 'text-green-400' : 'text-zinc-300'}`}>
                {hand.percentile !== undefined && hand.percentile !== null ? `${hand.percentile.toFixed(1)}%` : '--'}
              </span>
            </div>

            <div className="flex flex-col min-w-[100px]">
              <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">Decision</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-black uppercase ${hand.isCorrect ? 'text-green-500' : 'text-red-500'}`}>{hand.playerAction}</span>
                {!hand.isCorrect && hand.correctAction && (
                  <>
                    <span className="text-zinc-600">→</span>
                    <span className="text-sm font-black uppercase text-zinc-400">{hand.correctAction}</span>
                  </>
                )}
              </div>
            </div>

            <div className="hidden md:flex flex-wrap gap-1.5 max-w-[200px] justify-end">
              {hand.tags && hand.tags.length > 0 ? (
                hand.tags.map(tag => <span key={tag} className="text-[10px] px-2 py-0.5 bg-zinc-800 border border-zinc-700 rounded-full text-zinc-400 font-bold whitespace-nowrap">{tag}</span>)
              ) : (
                <span className="text-[10px] text-zinc-600">Legacy</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// SETTINGS VIEW
// ═══════════════════════════════════════════════════════════
function SettingsView({ activePositions, setActivePositions }: { activePositions: Position[], setActivePositions: (p: Position[]) => void }) {
  const togglePosition = (pos: Position) => {
    if (activePositions.includes(pos) && activePositions.length > 1) {
      setActivePositions(activePositions.filter((p: Position) => p !== pos));
    } else if (!activePositions.includes(pos)) {
      setActivePositions([...activePositions, pos]);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Trainer Settings</h2>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
        <h3 className="text-sm font-bold text-zinc-300 mb-3">Active Positions</h3>
        <div className="flex flex-wrap gap-2">
          {['UTG', 'CO', 'BTN', 'SB'].map(pos => (
            <button 
              key={pos} onClick={() => togglePosition(pos as Position)}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activePositions.includes(pos as Position) ? 'bg-green-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}