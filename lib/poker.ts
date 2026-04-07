export type Position = 'UTG' | 'CO' | 'BTN' | 'SB' | 'BB';
export type Action = 'raise' | 'fold';
export type Card = { rank: string; suit: 'c' | 'd' | 'h' | 's' };

export interface HandResult {
  hand: Card[];
  position: Position;
  percentile: number;
  tags: string[];
  correctAction: Action;
  playerAction: Action;
  isCorrect: boolean;
  timestamp: number;
}

export interface SessionStats {
  total: number;
  correct: number;
  mistakes: HandResult[];
  history: HandResult[];
}

export interface TableState {
  id: number;
  position: Position;
  hand: Card[];
  percentile: number | null;
  tags: string[];
  correctAction: Action | null;
  playerAction: Action | null;
  showFeedback: boolean;
}

export const RFI_POSITIONS: Position[] = ['UTG', 'CO', 'BTN', 'SB'];
// Adjusted thresholds: UTG opens top 20%, CO top 30%, BTN top 50%
export const RFI_THRESHOLDS: Record<Position, number> = { UTG: 20, CO: 30, BTN: 50, SB: 45, BB: 0 };

const RANK_VALUES: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export function dealHand(): Card[] {
  const suits: ('c' | 'd' | 'h' | 's')[] = ['c', 'd', 'h', 's'];
  const ranks = Object.keys(RANK_VALUES);
  const deck: Card[] = [];
  
  for (const s of suits) {
    for (const r of ranks) deck.push({ rank: r, suit: s });
  }
  
  // REAL POKER RNG: The Fisher-Yates Shuffle algorithm
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]; 
  }
  
  const hand = deck.slice(0, 6);

  // PLO STANDARD SORTING
  const suitGroups: Record<string, Card[]> = { c: [], d: [], h: [], s: [] };
  hand.forEach(card => suitGroups[card.suit].push(card));

  Object.values(suitGroups).forEach(group => {
    group.sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
  });

  const activeGroups = Object.values(suitGroups).filter(g => g.length > 0);

  activeGroups.sort((groupA, groupB) => {
    const maxLength = Math.max(groupA.length, groupB.length);
    for (let i = 0; i < maxLength; i++) {
      const rankA = groupA[i] ? RANK_VALUES[groupA[i].rank] : -1;
      const rankB = groupB[i] ? RANK_VALUES[groupB[i].rank] : -1;
      if (rankA !== rankB) {
        return rankB - rankA; 
      }
    }
    return 0;
  });

  return activeGroups.flat();
}

// ═══════════════════════════════════════════════════════════
// PLO6 HEURISTIC & TAGGING ENGINE (TUNED FOR RUNDOWNS)
// ═══════════════════════════════════════════════════════════
export function evaluatePLO6Hand(hand: Card[]): { percentile: number, tags: string[] } {
  let score = 0;
  const tags: string[] = [];
  
  const rankCounts: Record<string, number> = {};
  hand.forEach(c => rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1);

  let hasAA = false, hasKK = false;

  for (const [rank, count] of Object.entries(rankCounts)) {
    const val = RANK_VALUES[rank];
    if (val >= 10) score += (val - 9) * 2; 

    if (count === 2) {
      if (val === 14) { score += 40; hasAA = true; }
      else if (val === 13) { score += 25; hasKK = true; }
      else if (val >= 9) score += 10;
      else score += 5;
    } else if (count === 3) {
      score -= 10; // Penalize Trips
    } else if (count >= 4) {
      score -= 25; // Heavily penalize Quads
    }
  }

  const suitCards: Record<string, Card[]> = { c: [], d: [], h: [], s: [] };
  hand.forEach(c => suitCards[c.suit].push(c));

  let flushDraws = 0;
  let hasNutSuit = false, hasNonNutSuit = false;

  for (const suit in suitCards) {
    const count = suitCards[suit].length;
    if (count >= 2) {
      const topRank = Math.max(...suitCards[suit].map(c => RANK_VALUES[c.rank]));
      if (count === 2) {
        flushDraws++;
        if (topRank === 14) { score += 20; hasNutSuit = true; }
        else { score += 8; hasNonNutSuit = true; }
      } else if (count === 3) {
        if (topRank === 14) { score += 10; hasNutSuit = true; }
        else score -= 5; 
      } else if (count >= 4) {
        score -= 15;
        tags.push("Monotone/Blocked");
      }
    }
  }

  // TWEAK 1: Massive boost to Double Suited hands
  if (flushDraws >= 2) {
    score += 18; 
    tags.push("Double Suited");
  }
  
  if (hasNutSuit) tags.push("Nut Suited");
  if (hasNonNutSuit && !hasNutSuit) tags.push("Non-Nut Suited");

  const uniqueRanks = Array.from(new Set(hand.map(c => RANK_VALUES[c.rank]))).sort((a, b) => b - a);
  
  let rundownScore = 0;
  let connectedCards = 1;
  let maxConnected = 1;
  
  for (let i = 0; i < uniqueRanks.length - 1; i++) {
    const gap = uniqueRanks[i] - uniqueRanks[i + 1];
    
    // TWEAK 2: Better points for connectivity and 1-gappers
    if (gap === 1) {
      rundownScore += (uniqueRanks[i] >= 9 ? 14 : 10);
      connectedCards++;
      if (connectedCards > maxConnected) maxConnected = connectedCards;
    } else if (gap === 2) {
      rundownScore += 6; // Boosted 1-gappers
      connectedCards = 1; // Reset consecutive streak
    } else {
      connectedCards = 1;
    }
  }

  // TWEAK 3: The Wrap Bonus (Synergy for 4 or 5 cards perfectly connected)
  if (maxConnected >= 4) rundownScore += 15;
  if (maxConnected >= 5) rundownScore += 10;

  score += rundownScore;

  if (hasAA) {
    if (flushDraws >= 1 && rundownScore >= 15) tags.push("Premium AA");
    else tags.push("Mediocre AA");
  } else if (hasKK) {
    if (flushDraws >= 1 && rundownScore >= 15) tags.push("Premium KK");
    else tags.push("Naked KK");
  }

  if (rundownScore > 35) tags.push("Premium High Rundown");
  else if (rundownScore > 18 && !hasAA && !hasKK) tags.push("Mid/Weak Rundown");

  if (uniqueRanks.length >= 2) {
    const bottomGap = uniqueRanks[uniqueRanks.length - 2] - uniqueRanks[uniqueRanks.length - 1];
    if (bottomGap >= 4 && uniqueRanks[uniqueRanks.length - 1] < 6) {
      score -= 8;
      tags.push("Dangler");
    }
  }

  if (tags.length === 0) tags.push("Trash/Disconnected");

  // Normalize score to 1-100 (1 is BEST, 100 is WORST)
  // Adjusted slightly so max scores don't break the percentage
  let percentile = 100 - ((score / 135) * 100);
  
  return { 
    percentile: Math.min(Math.max(percentile, 0.1), 99.9),
    tags
  };
}

export function getRandomPosition(activePositions: Position[]): Position {
  return activePositions[Math.floor(Math.random() * activePositions.length)];
}

export function createTableState(id: number, activePositions: Position[], drillTag: string | null = null): TableState {
  let position = getRandomPosition(activePositions);
  let hand = dealHand();
  let evalResult = evaluatePLO6Hand(hand);

  if (drillTag) {
    while (!evalResult.tags.includes(drillTag)) {
      hand = dealHand();
      evalResult = evaluatePLO6Hand(hand);
    }
  }
  
  const correctAction: Action = evalResult.percentile <= RFI_THRESHOLDS[position] ? 'raise' : 'fold';

  return { 
    id, position, hand, 
    percentile: evalResult.percentile, 
    tags: evalResult.tags,
    correctAction, playerAction: null, showFeedback: false 
  };
}