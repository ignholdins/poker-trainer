'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase, getUserId } from '@/lib/supabase';
import {
  Card as CardType, Position, Action, HandResult, SessionStats, TableState,
  RFI_POSITIONS, createTableState, calculateEVLoss
} from '@/lib/poker';
import { PlayingCard, InlineCard } from '@/components/PlayingCard';
import { PositionBadge } from '@/components/PositionBadge';
import { Settings, BarChart3, History, Play, Layers, Target, TrendingUp, Award } from 'lucide-react';

type View = 'trainer' | 'drills' | 'analytics' | 'history' | 'settings';

// ────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ────────────────────────────────────────────────────────────────────────────
export default function PLO6Trainer() {
  const [view, setView] = useState<View>('trainer');
  const [isPaused, setIsPaused] = useState(true);
  const [tables, setTables] = useState<TableState[]>([]);
  const [stats, setStats] = useState<SessionStats>({ total: 0, correct: 0, evScore: 0, currentStreak: 0, bestStreak: 0, mistakes: [], history: [] });
  const [activePositions, setActivePositions] = useState<Position[]>([...RFI_POSITIONS]);
  const [activeDrill, setActiveDrill] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [proModalOpen, setProModalOpen] = useState(false);

  const playSound = (type: 'correct' | 'mistake') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'correct') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(); osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(); osc.stop(ctx.currentTime + 0.3);
      }
    } catch(e) {}
  };

  useEffect(() => {
    async function loadHistory() {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
      const { data } = await supabase
        .from('hand_history').select('*')
        .eq('user_id', getUserId())
        .order('created_at', { ascending: false }).limit(100);
      if (data) {
        const formatted: HandResult[] = data.map(item => ({
          hand: item.hand, position: item.position, scenario: item.scenario || 'RFI',
          percentile: item.percentile, tags: item.tags || [], explanation: item.explanation || '',
          correctAction: item.correct_action, playerAction: item.player_action,
          isCorrect: item.is_correct, timestamp: new Date(item.created_at).getTime(), evDiff: 0
        }));
        setStats(s => ({ ...s, total: formatted.length, correct: formatted.filter(h => h.isCorrect).length, mistakes: formatted.filter(h => !h.isCorrect), history: formatted }));
      }
    }
    loadHistory();
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
    const evDiff = calculateEVLoss(table.percentile!, action, table.correctAction);
    playSound(isCorrect ? 'correct' : 'mistake');

    const result: HandResult = {
      hand: [...table.hand], position: table.position, scenario: table.scenario || 'RFI',
      percentile: table.percentile!, tags: table.tags, explanation: table.explanation,
      correctAction: table.correctAction, playerAction: action,
      isCorrect, timestamp: Date.now(), evDiff
    };

    setStreak(s => isCorrect ? s + 1 : 0);
    setStats(s => {
      const newStreak = isCorrect ? s.currentStreak + 1 : 0;
      return {
        ...s,
        total: s.total + 1, correct: s.correct + (isCorrect ? 1 : 0),
        evScore: s.evScore + evDiff,
        currentStreak: newStreak,
        bestStreak: Math.max(s.bestStreak, newStreak),
        mistakes: isCorrect ? s.mistakes : [result, ...s.mistakes],
        history: [result, ...s.history].slice(0, 100)
      };
    });

    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        const { error } = await supabase.from('hand_history').insert([{
          user_id: getUserId(), position: result.position, scenario: result.scenario || 'RFI',
          hand: result.hand, correct_action: result.correctAction,
          player_action: result.playerAction, is_correct: result.isCorrect
        }]);
        if (error) console.error('Failed to save:', error);
      } catch (err) {
        console.error('Network error:', err);
      }
    }

    setTables(prev => prev.map(t => t.id === tableId ? { ...t, playerAction: action, showFeedback: true, evDiff } : t));
    const nextTable = createTableState(tableId, activePositions, activeDrill);
    setTimeout(() => {
      setTables(prev => prev.map(t => t.id === tableId ? nextTable : t));
    }, 2000);
  }, [tables, activePositions, activeDrill]);

  const NAV = [
    { v: 'trainer', icon: Play, label: 'Train' },
    { v: 'drills', icon: Target, label: 'Drills' },
    { v: 'analytics', icon: BarChart3, label: 'Stats' },
    { v: 'history', icon: History, label: 'History' },
    { v: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen flex flex-col select-none" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>

      {/* ── HEADER ── */}
      <header className="flex items-center justify-between px-5 py-3 z-50" style={{ background: 'rgba(13,17,23,0.9)', borderBottom: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-dim)', border: '1px solid rgba(0,229,160,0.25)' }}>
            <Layers className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>PLO6 <span style={{ color: 'var(--accent)' }}>Trainer</span></h1>
            <p className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>GTO-Calibrated · 5-Max</p>
          </div>
        </div>

        {/* Streak badge */}
        {streak >= 3 && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)', color: '#fbbf24' }}>
            <Award className="w-3 h-3" /> {streak} Streak
          </div>
        )}

        <nav className="flex items-center gap-0.5">
          {NAV.map(({ v, icon: Icon, label }) => (
            <button
              key={v} onClick={() => setView(v as View)}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all active:scale-95"
              style={{
                background: view === v ? 'var(--accent-dim)' : 'transparent',
                color: view === v ? 'var(--accent)' : 'var(--text-muted)',
                border: view === v ? '1px solid rgba(0,229,160,0.2)' : '1px solid transparent',
              }}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] font-semibold uppercase tracking-widest hidden sm:block">{label}</span>
            </button>
          ))}
        </nav>
      </header>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col overflow-y-auto">
        {view === 'trainer' && (
          <div className="flex flex-col items-center justify-start sm:justify-center w-full h-full max-w-5xl mx-auto py-4 sm:py-6 px-4 sm:px-8" style={{ minHeight: 'calc(100vh - 64px)' }}>
            {isPaused ? (
              <div className="flex flex-col items-center gap-8 text-center">
                <div>
                  <h2 className="text-3xl sm:text-5xl font-black mb-3 tracking-tight" style={{ color: 'var(--text-primary)' }}>
                    Take Your Seat
                  </h2>
                  <p className="text-sm sm:text-base max-w-md" style={{ color: 'var(--text-secondary)' }}>
                    Train RFI decision-making across all 5-Max positions. GTO-calibrated grades, instant feedback, and EV tracking.
                  </p>
                </div>
                <button
                  onClick={() => startSession(null)}
                  className="px-10 py-4 rounded-2xl font-bold text-lg tracking-tight transition-all hover:scale-105 active:scale-95"
                  style={{ background: 'var(--accent)', color: '#000', boxShadow: '0 0 30px var(--accent-glow)' }}
                >
                  Start Session
                </button>
                {stats.total > 0 && (
                  <div className="flex gap-6 text-center">
                    <div>
                      <p className="text-2xl font-black" style={{ color: 'var(--accent)' }}>{Math.round((stats.correct / stats.total) * 100)}%</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Accuracy</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{stats.total}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Hands</p>
                    </div>
                    <div>
                      <p className="text-2xl font-black" style={{ color: '#f87171' }}>{stats.mistakes.length}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Mistakes</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              tables.map(table => (
                <PokerTable key={table.id} table={table} isActive={true} isPaused={isPaused} onDecision={(act: Action) => makeDecision(table.id, act)} />
              ))
            )}
            
            {/* PRO UPGRADE MODAL */}
            {proModalOpen && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in" style={{ backdropFilter: 'blur(10px)', background: 'rgba(8,11,16,0.85)' }}>
                <div className="flex flex-col items-center gap-6 p-8 rounded-3xl max-w-sm w-full text-center shadow-[0_0_80px_rgba(168,85,247,0.15)] border border-purple-500/30" style={{ background: 'rgba(13,17,23,0.95)' }}>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600 mb-2 shadow-lg">
                    <span className="text-3xl">👑</span>
                  </div>
                  <div>
                    <h3 className="text-2xl font-black mb-2 text-white">Unlock PRO Mastery</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">
                      Upgrade to unlock advanced 3-Bet defense, custom positional drills, detailed EV leak reports, and cloud sync.
                    </p>
                  </div>
                  <div className="flex flex-col w-full gap-3 mt-2">
                    <button className="w-full py-4 rounded-xl font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)]">
                      Start 7-Day Free Trial
                    </button>
                    <button onClick={() => setProModalOpen(false)} className="w-full py-3 rounded-xl font-semibold text-slate-400 hover:text-white transition-colors">
                      Maybe Later
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {view === 'drills' && <DrillsView onSelectDrill={(drill) => {
          if (drill.isPro) setProModalOpen(true);
          else startSession(drill.name);
        }} />}
        {view === 'analytics' && <AnalyticsView stats={stats} />}
        {view === 'history' && <HistoryView history={stats.history} />}
        {view === 'settings' && <SettingsView activePositions={activePositions} setActivePositions={setActivePositions} />}
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// POKER TABLE
// ────────────────────────────────────────────────────────────────────────────
function PokerTable({ table, isActive, isPaused, onDecision }: { table: TableState, isActive: boolean, isPaused: boolean, onDecision: (act: Action) => void }) {
  const ACTION_ORDER = ['UTG', 'CO', 'BTN', 'SB', 'BB'];
  const heroActionIdx = ACTION_ORDER.indexOf(table.position);
  const canAct = isActive && !isPaused && !table.showFeedback && !table.playerAction;

  const CLOCKWISE = ['SB', 'BB', 'UTG', 'CO', 'BTN'];
  const heroIdx = CLOCKWISE.indexOf(table.position);

  const seats = [
    { pos: CLOCKWISE[(heroIdx + 1) % 5], style: 'bottom-[10%] sm:bottom-[18%] left-[3%]' },
    { pos: CLOCKWISE[(heroIdx + 2) % 5], style: 'top-[6%] sm:top-[12%] left-[10%] sm:left-[18%]' },
    { pos: CLOCKWISE[(heroIdx + 3) % 5], style: 'top-[6%] sm:top-[12%] right-[10%] sm:right-[18%]' },
    { pos: CLOCKWISE[(heroIdx + 4) % 5], style: 'bottom-[10%] sm:bottom-[18%] right-[3%]' },
  ];

  const isFolded = (pos: string) => ACTION_ORDER.indexOf(pos) < heroActionIdx;

  const renderDealerButton = () => {
    const btnPos = 'BTN';
    const isHeroBtn = table.position === btnPos;

    if (isHeroBtn) {
      return (
        <div className="absolute bottom-[28%] right-[38%] z-40 w-6 h-6 rounded-full flex items-center justify-center shadow-lg font-black text-[10px] text-black bg-white border-2 border-slate-200 animate-in fade-in zoom-in duration-500">
          D
        </div>
      );
    }

    const btnSeat = seats.find(s => s.pos === btnPos);
    if (!btnSeat) return null;

    // Relative offsets based on seat position to keep it inside the table but near the seat
    const isLeft = btnSeat.style.includes('left-');
    const isTop = btnSeat.style.includes('top-');
    
    const transform = `translate(${isLeft ? '40px' : '-40px'}, ${isTop ? '30px' : '-30px'})`;

    return (
      <div 
        className={`absolute z-40 w-6 h-6 rounded-full flex items-center justify-center shadow-lg font-black text-[10px] text-black bg-white border-2 border-slate-200 transition-all duration-700 ${btnSeat.style}`}
        style={{ transform }}
      >
        D
      </div>
    );
  };

  const isCorrect = table.playerAction === table.correctAction;
  const percentileTier = (p?: number) => {
    if (!p) return { label: '--', color: '#8892a4' };
    if (p <= 10) return { label: 'Elite', color: '#00e5a0' };
    if (p <= 25) return { label: 'Strong', color: '#34d399' };
    if (p <= 45) return { label: 'Solid', color: '#fbbf24' };
    if (p <= 65) return { label: 'Marginal', color: '#f97316' };
    return { label: 'Weak', color: '#f87171' };
  };
  const tier = percentileTier(table.percentile);

  return (
      <div className="flex flex-col items-center w-full max-w-[1100px] gap-2 sm:gap-4 relative pb-4 sm:pb-0">

      {/* ── TABLE FELT ── */}
      <div className="relative w-full shadow-2xl overflow-hidden min-h-[160px] sm:min-h-[260px]" style={{ aspectRatio: '2 / 1', borderRadius: '50%', background: '#1d2a1e', border: '14px solid #1a1008', boxShadow: '0 0 0 3px #3d2808, 0 40px 100px rgba(0,0,0,0.9), inset 0 2px 0 rgba(255,255,255,0.04)' }}>
        {/* Green felt surface */}
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 40%, #2d6e3a 0%, #1b5228 55%, #0e3519 100%)' }} />
        {/* Inner rim highlight ring */}
        <div className="absolute" style={{ inset: '8px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.07)', pointerEvents: 'none' }} />
        <div className="absolute inset-0 rounded-[50%]" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div className="absolute inset-3">

          {/* Center logo */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-10" style={{ color: 'var(--accent)' }}>PLO6</div>
          </div>

          {renderDealerButton()}

          {/* Opponent seats */}
          {seats.map((seat, i) => {
            const folded = isFolded(seat.pos);
            const isSB = seat.pos === 'SB';
            const isBB = seat.pos === 'BB';

            return (
              <div key={i} className={`absolute ${seat.style} z-10 flex flex-col items-center gap-1`}>
                {/* Cards */}
                <div className="flex relative" style={{ opacity: folded ? 0.3 : 1 }}>
                  {[1,2,3,4,5,6].map(n => (
                    <div key={n} className="rounded-[4px]" style={{ width: '11px', height: '17px', marginLeft: n === 1 ? 0 : '-5px', background: 'linear-gradient(145deg, #8b1a2a 0%, #5a0e1a 100%)', border: '1.5px solid #c43050', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }} />
                  ))}
                </div>
                  
                {/* Name tag and Chip */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="px-2 py-0.5 rounded text-[9px] font-bold" style={{
                    background: folded ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: folded ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)',
                  }}>
                    {seat.pos}{folded ? ' ×' : ''}
                  </div>
                  
                  {(isSB || isBB) && (
                    <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold text-[7px] border-[1px] shadow-sm animate-in zoom-in" 
                         style={{ 
                           background: isSB ? 'radial-gradient(circle, #3b82f6 0%, #1e40af 100%)' : 'radial-gradient(circle, #ef4444 0%, #991b1b 100%)',
                           borderColor: isSB ? '#93c5fd' : '#fca5a5',
                           color: 'white',
                           borderStyle: 'dashed'
                         }}>
                      {isSB ? '.5' : '1'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Feedback overlay */}
          {table.showFeedback && (
            <div className="absolute inset-0 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'blur(4px)', background: 'rgba(8,11,16,0.5)' }}>
              <div className="flex flex-col items-center gap-2 sm:gap-4 px-5 py-4 sm:px-8 sm:py-6 rounded-2xl shadow-2xl text-center animate-in zoom-in duration-200" style={{ background: 'rgba(13,17,23,0.95)', border: `1px solid ${isCorrect ? 'rgba(0,229,160,0.3)' : 'rgba(248,113,113,0.3)'}`, boxShadow: `0 0 30px ${isCorrect ? 'rgba(0,229,160,0.1)' : 'rgba(248,113,113,0.1)'}` }}>
                <div className="text-xl sm:text-3xl font-black uppercase tracking-widest" style={{ color: isCorrect ? 'var(--accent)' : '#f87171' }}>
                  {isCorrect ? 'Correct' : 'Mistake'}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>Percentile</span>
                    <span className="text-2xl sm:text-3xl font-black font-mono leading-none" style={{ color: tier.color }}>{table.percentile?.toFixed(0)}%</span>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase" style={{ background: `${tier.color}15`, color: tier.color }}>{tier.label}</span>
                      {!isCorrect && (
                        <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
                          {table.evDiff!} EV
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {table.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}>{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── HERO HAND ── */}
      <div className="flex flex-col items-center gap-2 sm:gap-3 w-full -mt-4 sm:-mt-8">
        <div className="flex justify-center items-end h-[100px] sm:h-[140px] w-full px-2 sm:px-4 overflow-visible">
          {table.hand.map((c: CardType, i: number) => {
            const offset = i - 2.5; 
            const rotation = offset * 5; 
            const translateY = Math.abs(offset) * 6; 
            
            return (
              <div 
                key={i} 
                className={`relative transition-all duration-300 hover:-translate-y-4 hover:z-50 ${i === 0 ? '' : '-ml-4 sm:-ml-8'}`} 
                style={{ 
                  transform: `rotate(${rotation}deg) translateY(${translateY}px)`, 
                  zIndex: i,
                }}
              >
                <div className="shadow-[0_8px_25px_rgba(0,0,0,0.5)] rounded-lg sm:rounded-xl overflow-hidden border border-white/5">
                  <PlayingCard card={c} revealed={true} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Hero label & Blinds Chip */}
        <div className="flex items-center gap-2">
          {table.position === 'SB' && (
            <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] border-[1.5px] shadow-[0_4px_10px_rgba(35,35,35,0.7)] animate-in slide-in-from-bottom-2" style={{ background: 'radial-gradient(circle, #3b82f6 0%, #1e40af 100%)', borderColor: '#93c5fd', color: 'white', borderStyle: 'dashed' }}>0.5</div>
          )}
          {table.position === 'BB' && (
            <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] border-[1.5px] shadow-[0_4px_10px_rgba(35,35,35,0.7)] animate-in slide-in-from-bottom-2" style={{ background: 'radial-gradient(circle, #ef4444 0%, #991b1b 100%)', borderColor: '#fca5a5', color: 'white', borderStyle: 'dashed' }}>1</div>
          )}
          <div className="flex items-center gap-2 px-4 sm:px-5 py-1 sm:py-1.5 rounded-full" style={{ background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)' }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
            <span className="text-[10px] sm:text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--accent)' }}>{table.position} — Your Turn</span>
          </div>
        </div>
      </div>

      {/* ── ACTION BUTTONS ── */}
      <div className="flex gap-3 w-full max-w-md">
        <button
          onClick={() => onDecision('fold')}
          disabled={!canAct}
          className="flex-1 py-4 rounded-2xl font-bold text-base sm:text-lg tracking-tight transition-all active:scale-95"
          style={{
            background: canAct ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.03)',
            border: canAct ? '1px solid rgba(248,113,113,0.35)' : '1px solid rgba(255,255,255,0.05)',
            color: canAct ? '#f87171' : 'var(--text-muted)',
            boxShadow: canAct ? '0 0 20px rgba(248,113,113,0.1)' : 'none',
          }}
        >
          Fold
        </button>
        <button
          onClick={() => onDecision('raise')}
          disabled={!canAct}
          className="flex-1 py-4 rounded-2xl font-bold text-base sm:text-lg tracking-tight transition-all active:scale-95"
          style={{
            background: canAct ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
            border: canAct ? '1px solid rgba(0,229,160,0.5)' : '1px solid rgba(255,255,255,0.05)',
            color: canAct ? '#000' : 'var(--text-muted)',
            boxShadow: canAct ? '0 0 24px var(--accent-glow)' : 'none',
          }}
        >
          Raise
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// DRILLS VIEW
// ────────────────────────────────────────────────────────────────────────────
function DrillsView({ onSelectDrill }: { onSelectDrill: (drill: any) => void }) {
  const drills = [
    {
      name: 'The Premiums',
      desc: 'Train recognition of top-tier hands: AA DS, KK DS, high rundowns. Develop the instinct to raise instantly.',
      tier: 'Top 8%',
      accent: '#00e5a0',
      bg: 'rgba(0,229,160,0.05)',
      border: 'rgba(0,229,160,0.2)',
    },
    {
      name: 'The Traps',
      desc: 'Learn to fold dangerous hands: bare rainbow Aces, Kings without suitedness, 6th-card danglers.',
      tier: 'Danger Zone',
      accent: '#f87171',
      bg: 'rgba(248,113,113,0.05)',
      border: 'rgba(248,113,113,0.2)',
    },
    {
      name: 'Connectors',
      desc: 'Master double-suited rundowns and wrap-potential hands — the bread and butter of PLO6.',
      tier: 'Mid-High',
      accent: '#60a5fa',
      bg: 'rgba(96,165,250,0.05)',
      border: 'rgba(96,165,250,0.2)',
    },
    {
      name: 'Facing 3-Bet',
      desc: 'Learn vital GTO defense ranges when facing an aggressive 3-bet. Master fold vs flat vs 4-bet.',
      tier: 'Advanced',
      accent: '#a855f7',
      bg: 'rgba(168,85,247,0.05)',
      border: 'rgba(168,85,247,0.2)',
      isPro: true,
    },
    {
      name: 'Blind vs Blind',
      desc: 'Specialized drill for wide range clashes in the blinds. High EV-loss potential scenarios.',
      tier: 'Advanced',
      accent: '#ec4899',
      bg: 'rgba(236,72,153,0.05)',
      border: 'rgba(236,72,153,0.2)',
      isPro: true,
    },
  ];

  return (
    <div className="p-4 sm:p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-black mb-1 tracking-tight" style={{ color: 'var(--text-primary)' }}>Drill Library</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Target specific hand archetypes to close your leaks faster.</p>
      </div>
      <div className="flex flex-col gap-3">
        {drills.map(drill => (
          <button
            key={drill.name}
            onClick={() => onSelectDrill(drill)}
            className="w-full text-left p-5 rounded-2xl transition-all active:scale-95 hover:brightness-110 relative overflow-hidden"
            style={{ background: drill.bg, border: `1px solid ${drill.border}` }}
          >
            {drill.isPro && (
              <div className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-bl-xl font-bold text-[9px] uppercase tracking-widest text-white shadow-lg">
                👑 PRO
              </div>
            )}
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-base font-black" style={{ color: drill.accent }}>{drill.name}</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{ background: `${drill.accent}20`, color: drill.accent }}>{drill.tier}</span>
            </div>
            <p className="text-xs leading-relaxed max-w-[90%]" style={{ color: 'var(--text-secondary)' }}>{drill.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ANALYTICS VIEW
// ────────────────────────────────────────────────────────────────────────────
function AnalyticsView({ stats }: { stats: SessionStats }) {
  const winRate = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
  const rateColor = winRate >= 80 ? '#00e5a0' : winRate >= 60 ? '#fbbf24' : '#f87171';

  // Breakdown by position
  const byPosition = ['UTG', 'CO', 'BTN', 'SB'].map(pos => {
    const posHands = stats.history.filter(h => h.position === pos);
    const posCorrect = posHands.filter(h => h.isCorrect).length;
    return { pos, total: posHands.length, correct: posCorrect, rate: posHands.length > 0 ? Math.round((posCorrect / posHands.length) * 100) : null };
  });

  // Tag-based mistake analysis
  const tagMistakes: Record<string, number> = {};
  stats.mistakes.forEach(m => {
    m.tags?.forEach(tag => { tagMistakes[tag] = (tagMistakes[tag] || 0) + 1; });
  });
  const topLeaks = Object.entries(tagMistakes).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-5">
      <div className="mb-6">
        <h2 className="text-2xl font-black mb-1 tracking-tight" style={{ color: 'var(--text-primary)' }}>Session Analytics</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Data-driven breakdown of your decision quality.</p>
      </div>

      {/* Overall accuracy */}
      <div className="p-6 sm:p-8 rounded-3xl text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>Overall Accuracy</p>
        <p className="text-7xl font-black font-mono leading-none mb-2" style={{ color: rateColor }}>{winRate}%</p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{stats.correct} correct · {stats.total - stats.correct} errors · {stats.total} total</p>
        <div className="mt-4 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${winRate}%`, background: rateColor }} />
        </div>
      </div>

      {/* Position breakdown */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Accuracy by Position</h3>
        </div>
        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {byPosition.map(({ pos, total, rate }) => (
            <div key={pos} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-black uppercase px-2.5 py-1 rounded" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)' }}>{pos}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{total} hands</span>
              </div>
              {rate !== null ? (
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full" style={{ width: `${rate}%`, background: rate >= 75 ? '#00e5a0' : rate >= 50 ? '#fbbf24' : '#f87171' }} />
                  </div>
                  <span className="text-sm font-bold w-10 text-right" style={{ color: rate >= 75 ? '#00e5a0' : rate >= 50 ? '#fbbf24' : '#f87171' }}>{rate}%</span>
                </div>
              ) : (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>No data</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Top leaks */}
      {topLeaks.length > 0 && (
        <div className="p-5 rounded-2xl" style={{ background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4" style={{ color: '#f87171' }} />
            <h3 className="text-sm font-bold" style={{ color: '#f87171' }}>Leak Analysis</h3>
          </div>
          <div className="space-y-2">
            {topLeaks.map(([tag, count]) => (
              <div key={tag} className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{tag}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>{count} errors</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] mt-4 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Use the Drills tab to target these specific hand types.
          </p>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// HISTORY VIEW
// ────────────────────────────────────────────────────────────────────────────
function HistoryView({ history }: { history: HandResult[] }) {
  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black tracking-tight" style={{ color: 'var(--text-primary)' }}>Hand History</h2>
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{history.length} Hands</span>
      </div>

      {history.length === 0 && (
        <div className="text-center py-20" style={{ color: 'var(--text-muted)' }}>
          <p className="text-sm">No hands played yet. Start a session to build your history.</p>
        </div>
      )}

      <div className="space-y-2">
        {history.map((hand, i) => {
          const tier = hand.percentile <= 10 ? '#00e5a0' : hand.percentile <= 30 ? '#34d399' : hand.percentile <= 55 ? '#fbbf24' : '#f87171';
          return (
            <div key={i}
              className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-4 sm:px-5 py-4 rounded-2xl transition-colors"
              style={{ background: 'var(--bg-card)', border: `1px solid ${hand.isCorrect ? 'rgba(255,255,255,0.05)' : 'rgba(248,113,113,0.12)'}` }}
            >
              {/* Left: position + cards */}
              <div className="flex items-center gap-3 min-w-0">
                <PositionBadge position={hand.position} />
                <div className="flex gap-1 flex-wrap">
                  {(Array.isArray(hand.hand) ? hand.hand : []).map((c, idx) => (
                    <InlineCard key={idx} card={c} />
                  ))}
                </div>
              </div>

              {/* Right: grade + decision + tags */}
              <div className="flex items-center gap-5 lg:gap-6 justify-between lg:justify-end w-full lg:w-auto flex-wrap">
                {/* Grade */}
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>Grade</span>
                  <span className="text-sm font-black font-mono" style={{ color: tier }}>
                    {hand.percentile !== undefined ? `${hand.percentile.toFixed(0)}%` : '--'}
                  </span>
                </div>

                {/* Decision */}
                <div className="flex flex-col">
                  <span className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: 'var(--text-muted)' }}>Decision</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black uppercase" style={{ color: hand.isCorrect ? '#00e5a0' : '#f87171' }}>{hand.playerAction}</span>
                    {!hand.isCorrect && hand.correctAction && (
                      <>
                        <span style={{ color: 'var(--text-muted)' }}>→</span>
                        <span className="text-sm font-black uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>{hand.correctAction}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div className="hidden md:flex flex-wrap gap-1.5 max-w-[180px] justify-end">
                  {hand.tags?.map(tag => (
                    <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// SETTINGS VIEW
// ────────────────────────────────────────────────────────────────────────────
function SettingsView({ activePositions, setActivePositions }: { activePositions: Position[], setActivePositions: (p: Position[]) => void }) {
  const POS_INFO: Record<string, { threshold: string; desc: string }> = {
    UTG: { threshold: 'Top 15%', desc: 'Tightest range — only premiums' },
    CO:  { threshold: 'Top 28%', desc: 'Widen with position advantage' },
    BTN: { threshold: 'Top 55%', desc: 'Widest open range in PLO6' },
    SB:  { threshold: 'Top 42%', desc: 'Balanced vs BB 3-bet pressure' },
  };

  const togglePosition = (pos: Position) => {
    if (activePositions.includes(pos) && activePositions.length > 1) {
      setActivePositions(activePositions.filter(p => p !== pos));
    } else if (!activePositions.includes(pos)) {
      setActivePositions([...activePositions, pos]);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-black mb-1 tracking-tight" style={{ color: 'var(--text-primary)' }}>Settings</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Configure which positions to drill.</p>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Active Positions</h3>
        </div>
        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
          {(['UTG', 'CO', 'BTN', 'SB'] as Position[]).map(pos => {
            const active = activePositions.includes(pos);
            const info = POS_INFO[pos];
            return (
              <button key={pos} onClick={() => togglePosition(pos)} className="w-full flex items-center justify-between px-5 py-4 transition-colors hover:brightness-110 text-left">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-black" style={{ color: active ? 'var(--accent)' : 'var(--text-primary)' }}>{pos}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-bold" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>{info.threshold}</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{info.desc}</p>
                </div>
                <div className="w-10 h-6 rounded-full relative flex-shrink-0 transition-colors" style={{ background: active ? 'var(--accent-dim)' : 'rgba(255,255,255,0.06)', border: `1px solid ${active ? 'rgba(0,229,160,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                  <div className="absolute top-0.5 h-5 w-5 rounded-full transition-all" style={{ left: active ? 'calc(100% - 22px)' : '2px', background: active ? 'var(--accent)' : 'rgba(255,255,255,0.2)' }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}