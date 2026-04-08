export type Suit = 'h' | 'd' | 'c' | 's';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Position = 'UTG' | 'CO' | 'BTN' | 'SB' | 'BB';
export type Action = 'fold' | 'call' | 'raise';

// --- VERCEL FIX: 'scenario' added to HandResult ---
export interface HandResult {
  hand: Card[];
  position: Position;
  scenario: string; 
  raiserPosition?: Position;
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

// --- VERCEL FIX: 'scenario' added to TableState ---
export interface TableState {
  id: number;
  hand: Card[];
  position: Position;
  scenario: string; 
  percentile?: number;
  tags: string[];
  correctAction?: Action;
  playerAction?: Action;
  showFeedback: boolean;
  raiserPosition?: Position;
}

export const RFI_POSITIONS: Position[] = ['UTG', 'CO', 'BTN', 'SB'];

export const RFI_THRESHOLDS: Record<Position, number> = {
  UTG: 20,
  CO: 30,
  BTN: 50,
  SB: 45,
  BB: 100, // BB thresholds handled dynamically in future phases
};

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS: Suit[] = ['h', 'd', 'c', 's'];

const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    if (RANK_VALUES[a.rank] !== RANK_VALUES[b.rank]) {
      return RANK_VALUES[b.rank] - RANK_VALUES[a.rank]; // Descending
    }
    return a.suit.localeCompare(b.suit);
  });
}

// Generates a deck and deals 6 unique cards, matching activeDrill if provided
export function dealHand(activeDrill: string | null = null): Card[] {
  let attempts = 0;
  while (attempts < 500) {
    attempts++;
    const deck: Card[] = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        deck.push({ rank, suit });
      }
    }
    
    // Fisher-Yates Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    const hand = deck.slice(0, 6);

    // If no drill, just return the sorted hand
    if (!activeDrill || attempts === 499) return sortHand(hand);

    const { tags, percentile } = evaluatePLO6Hand(hand);

    if (activeDrill === "The Premiums") {
      if (percentile <= 6 || tags.includes('Aces') || tags.includes('Kings')) return sortHand(hand);
    } else if (activeDrill === "The Traps") {
      if (tags.includes('Dangler') || (tags.includes('Kings') && percentile > 25)) return sortHand(hand);
    } else if (activeDrill === "Connectors") {
      if (tags.includes('Rundown') || tags.includes('High Rundown') || tags.includes('Connected')) return sortHand(hand);
    } else {
      return sortHand(hand);
    }
  }
  return []; // Should never really reach here optimally
}

// Hand Evaluator mapping percentiles to educational tags using heuristics
export function evaluatePLO6Hand(hand: Card[]): { percentile: number; tags: string[] } {
  const sorted = sortHand(hand);
  let score = 0;
  const tags: string[] = [];

  const rankCounts: Record<string, number> = {};
  const suits: Record<string, Card[]> = { h: [], d: [], c: [], s: [] };
  
  sorted.forEach(c => {
    rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    suits[c.suit].push(c);
  });

  const pairs = Object.entries(rankCounts).filter(([, count]) => count >= 2).map(([rank]) => rank);
  let hasAces = false;
  let hasKings = false;

  if (pairs.includes('A')) { score += 40; tags.push('Aces'); hasAces = true; }
  else if (pairs.includes('K')) { score += 25; tags.push('Kings'); hasKings = true; }
  else if (pairs.includes('Q')) { score += 15; }
  else if (pairs.includes('J')) { score += 10; }
  else if (pairs.length > 0) { score += pairs.length * 5; }

  if (pairs.length >= 2) { score += 10; } // Double pair

  let suitedCount = 0;
  Object.values(suits).forEach(suitCards => {
    if (suitCards.length >= 2) {
      suitedCount++;
      if (suitCards.some(c => c.rank === 'A')) score += 10; // Nut suited
      else if (suitCards.some(c => c.rank === 'K')) score += 5; // 2nd nut suited
      else score += 3;
    }
  });

  if (suitedCount >= 2) {
    score += 15;
    tags.push(tags.includes('Aces') || tags.includes('Kings') ? 'DS' : 'Double Suited'); 
  } else if (suitedCount === 1) {
    tags.push('Single Suited');
  } else {
    tags.push('Rainbow');
    score -= 10;
  }

  const uniqueRanks = [...new Set(sorted.map(c => RANK_VALUES[c.rank]))].sort((a,b) => b - a);
  let maxRun = 1;
  let currentRun = 1;
  for (let i = 0; i < uniqueRanks.length - 1; i++) {
    if (uniqueRanks[i] - uniqueRanks[i+1] <= 2) { 
      if (uniqueRanks[i] - uniqueRanks[i+1] === 1) currentRun++;
    } else {
      currentRun = 1;
    }
    if (currentRun > maxRun) maxRun = currentRun;
  }
  
  if (maxRun >= 4) {
    score += 30;
    tags.push(uniqueRanks[0] >= 10 ? 'High Rundown' : 'Rundown');
  } else if (maxRun === 3) {
    score += 15;
    tags.push('Connected');
  }

  if (maxRun < 3 && !hasAces && !hasKings) {
     score -= 15;
     tags.push('Disconnected');
  } else if (uniqueRanks.length >= 4 && (uniqueRanks[0] - uniqueRanks[uniqueRanks.length - 1] > 8)) {
     tags.push('Dangler');
     score -= 10;
  }

  const finalTags = tags.filter((t, i) => tags.indexOf(t) === i).slice(0, 3);
  
  let percentile = Math.max(1, 100 - score);
  if (score > 85) percentile = Math.random() * 5 + 1; // 1-6%
  else if (score > 60) percentile = Math.random() * 10 + 6; // 6-16%
  else if (score > 40) percentile = Math.random() * 20 + 16; // 16-36%
  
  return { percentile, tags: finalTags.length ? finalTags : ['Trash'] };
}

// Generates the table scenario for the user to play
export function createTableState(id: number, activePositions: Position[] = RFI_POSITIONS, activeDrill: string | null = null): TableState {
  const position = activePositions[Math.floor(Math.random() * activePositions.length)];
  const hand = dealHand(activeDrill);
  const { percentile, tags } = evaluatePLO6Hand(hand);
  
  const threshold = RFI_THRESHOLDS[position];
  const correctAction = percentile <= threshold ? 'raise' : 'fold';

  return {
    id,
    hand,
    position,
    scenario: 'RFI',
    percentile,
    tags,
    correctAction,
    showFeedback: false
  };
}