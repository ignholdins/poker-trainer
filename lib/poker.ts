export type Position = 'UTG' | 'CO' | 'BTN' | 'SB' | 'BB';
export type Action = 'raise' | 'fold';
export type Card = { rank: string; suit: 'c' | 'd' | 'h' | 's' };

export interface HandResult {
  hand: Card[];
  position: Position;
  percentile: number;
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
  correctAction: Action | null;
  playerAction: Action | null;
  showFeedback: boolean;
}

// 5-Max RFI Positions (BB is not included because you don't Open Raise from the BB)
export const RFI_POSITIONS: Position[] = ['UTG', 'CO', 'BTN', 'SB'];
export const RFI_THRESHOLDS: Record<Position, number> = { UTG: 20, CO: 30, BTN: 50, SB: 45, BB: 0 };

export function dealHand(): Card[] {
  const suits: ('c' | 'd' | 'h' | 's')[] = ['c', 'd', 'h', 's'];
  const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
  const deck: Card[] = [];
  
  for (const s of suits) {
    for (const r of ranks) deck.push({ rank: r, suit: s });
  }
  
  const hand = deck.sort(() => 0.5 - Math.random()).slice(0, 6);

  const rankValues: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
  };

  return hand.sort((a, b) => {
    // 1. Sort by Suit First (groups colors together)
    if (a.suit !== b.suit) {
      return a.suit.localeCompare(b.suit);
    }
    // 2. If suits are the same, sort by Rank (High to Low)
    return rankValues[b.rank] - rankValues[a.rank];
  });
}

export function getRandomPosition(activePositions: Position[]): Position {
  return activePositions[Math.floor(Math.random() * activePositions.length)];
}

export function createTableState(id: number, activePositions: Position[], count: number): TableState {
  const position = getRandomPosition(activePositions);
  const hand = dealHand();
  // For MVP: Generates a random hand strength percentile (1-100)
  const percentile = Math.random() * 100;
  const correctAction: Action = percentile <= RFI_THRESHOLDS[position] ? 'raise' : 'fold';

  return { id, position, hand, percentile, correctAction, playerAction: null, showFeedback: false };
}