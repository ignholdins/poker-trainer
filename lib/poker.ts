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

// Generates a deck and deals 6 unique cards
export function dealHand(): Card[] {
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
  
  return deck.slice(0, 6);
}

// Hand Evaluator mapping percentiles to educational tags
export function evaluatePLO6Hand(hand: Card[]): { percentile: number; tags: string[] } {
  const percentile = Math.random() * 100;
  
  let tags: string[] = [];
  if (percentile <= 5) tags = ['Premium Aces', 'Double Suited'];
  else if (percentile <= 15) tags = ['High Rundown', 'Connected'];
  else if (percentile <= 30) tags = ['Mid Rundown', 'Single Suited'];
  else if (percentile <= 60) tags = ['Marginal', 'Dangler'];
  else tags = ['Trash', 'Disconnected'];

  return { percentile, tags };
}

// Generates the table scenario for the user to play
export function createTableState(id: number, activePositions: Position[] = RFI_POSITIONS, activeDrill: string | null = null): TableState {
  const position = activePositions[Math.floor(Math.random() * activePositions.length)];
  const hand = dealHand();
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