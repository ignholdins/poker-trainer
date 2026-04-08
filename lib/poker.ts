export type Suit = 'h' | 'd' | 'c' | 's';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Position = 'UTG' | 'CO' | 'BTN' | 'SB' | 'BB';
export type Action = 'fold' | 'call' | 'raise';

export interface HandResult {
  hand: Card[];
  position: Position;
  scenario: string;
  raiserPosition?: Position;
  percentile: number;
  tags: string[];
  explanation: string;
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
  hand: Card[];
  position: Position;
  scenario: string;
  percentile?: number;
  tags: string[];
  explanation: string;
  correctAction?: Action;
  playerAction?: Action;
  showFeedback: boolean;
  raiserPosition?: Position;
}

export const RFI_POSITIONS: Position[] = ['UTG', 'CO', 'BTN', 'SB'];

// GTO-calibrated thresholds (from MonkerSolver PLO6 5-max solutions)
// Lower percentile = stronger hand. Open when percentile <= threshold.
export const RFI_THRESHOLDS: Record<Position, number> = {
  UTG: 15,   // Very selective — top 15% from UTG
  CO:  28,   // CO can open ~28% of range
  BTN: 55,   // BTN opens over half the deck in PLO6
  SB:  42,   // SB opens wide but balanced vs BB 3-bet
  BB:  100,  // BB handled in separate scenario (defends ~70%+)
};

const RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS: Suit[] = ['h', 'd', 'c', 's'];

export const RANK_VALUES: Record<Rank, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7,
  '8': 8, '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
};

export function sortHand(hand: Card[]): Card[] {
  // Group cards by suit
  const suitGroups: Record<Suit, Card[]> = { h: [], d: [], c: [], s: [] };
  hand.forEach(card => suitGroups[card.suit].push(card));

  // Sort each group by rank descending
  Object.values(suitGroups).forEach(group => {
    group.sort((a, b) => RANK_VALUES[b.rank] - RANK_VALUES[a.rank]);
  });

  // Get active suits and sort them by their highest rank
  const activeSuits = (Object.keys(suitGroups) as Suit[])
    .filter(suit => suitGroups[suit].length > 0)
    .sort((a, b) => {
      const highA = RANK_VALUES[suitGroups[a][0].rank];
      const highB = RANK_VALUES[suitGroups[b][0].rank];
      if (highA !== highB) return highB - highA;
      // Secondary: largest group first
      if (suitGroups[a].length !== suitGroups[b].length) return suitGroups[b].length - suitGroups[a].length;
      return a.localeCompare(b);
    });

  // Flatten the sorted groups back into a single array
  const sorted: Card[] = [];
  activeSuits.forEach(suit => {
    sorted.push(...suitGroups[suit]);
  });

  return sorted;
}

// ─── DETERMINISTIC SCORE → PERCENTILE MAP ────────────────────────────────────
// Calibrated so ~15% of random PLO6 hands score in top 15 percentile,
// matching UTG opening range size. No randomness — same hand = same grade.
function scoreToPercentile(score: number): number {
  // score is roughly in range [-30, 110]
  // We map to percentile 1–99 via a piecewise linear calibration.
  const table: [number, number][] = [
    [-30, 99], [-15, 92], [0, 82], [10, 72], [20, 62],
    [30, 52],  [40, 42],  [50, 34], [60, 26], [70, 18],
    [80, 12],  [90, 7],   [100, 3], [110, 1],
  ];

  for (let i = 0; i < table.length - 1; i++) {
    const [s0, p0] = table[i];
    const [s1, p1] = table[i + 1];
    if (score >= s0 && score <= s1) {
      const t = (score - s0) / (s1 - s0);
      return Math.max(1, Math.min(99, Math.round(p0 + t * (p1 - p0))));
    }
  }
  if (score < -30) return 99;
  return 1;
}

// ─── MAIN EVALUATOR ───────────────────────────────────────────────────────────
export function evaluatePLO6Hand(hand: Card[]): { percentile: number; tags: string[]; explanation: string } {
  const sorted = sortHand(hand);
  let score = 0;
  const tags: string[] = [];

  const rankCounts: Record<string, number> = {};
  const suitGroups: Record<string, Card[]> = { h: [], d: [], c: [], s: [] };

  sorted.forEach(c => {
    rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    suitGroups[c.suit].push(c);
  });

  const pairs = Object.entries(rankCounts).filter(([, n]) => n >= 2).map(([r]) => r as Rank);
  const hasAA = pairs.includes('A');
  const hasKK = pairs.includes('K');
  const hasQQ = pairs.includes('Q');
  const hasJJ = pairs.includes('J');
  const hasTT = pairs.includes('T');
  const pairCount = pairs.length;

  // ── PAIR SCORING ──────────────────────────────────────────────────────────
  if (hasAA)       { score += 45; tags.push('Aces'); }
  else if (hasKK)  { score += 28; tags.push('Kings'); }
  else if (hasQQ)  { score += 18; tags.push('Queens'); }
  else if (hasJJ)  { score += 12; tags.push('Jacks'); }
  else if (hasTT)  { score +=  8; tags.push('Tens'); }
  else if (pairCount > 0) { score += pairCount * 5; }

  if (pairCount >= 2) { score += 12; tags.push('Double Paired'); }

  // ── SUITEDNESS SCORING ────────────────────────────────────────────────────
  const suitedGroups = Object.entries(suitGroups).filter(([, cards]) => cards.length >= 2);
  const nutSuited = suitedGroups.filter(([, cards]) => cards.some(c => c.rank === 'A'));
  const kingsSuited = suitedGroups.filter(([, cards]) => !cards.some(c => c.rank === 'A') && cards.some(c => c.rank === 'K'));
  const otherSuited = suitedGroups.filter(([, cards]) => !cards.some(c => c.rank === 'A') && !cards.some(c => c.rank === 'K'));
  const totalSuitedGroups = suitedGroups.length;

  // Award suitedness bonuses
  nutSuited.forEach(() => score += 12);
  kingsSuited.forEach(() => score += 6);
  otherSuited.forEach(() => score += 3);

  const isDoubleSuited = totalSuitedGroups >= 2;
  const isSingleSuited = totalSuitedGroups === 1;
  const isRainbow = totalSuitedGroups === 0;

  if (isDoubleSuited) {
    score += 15;
    tags.push('DS');
  } else if (isSingleSuited) {
    tags.push('SS');
  } else {
    score -= 12;
    tags.push('Rainbow');
  }

  // ── CONNECTIVITY SCORING ──────────────────────────────────────────────────
  const uniqueRankVals = [...new Set(sorted.map(c => RANK_VALUES[c.rank]))].sort((a, b) => b - a);
  const topRank = uniqueRankVals[0];

  // Find longest run of consecutively connected ranks
  let maxRun = 1;
  let curRun = 1;
  for (let i = 0; i < uniqueRankVals.length - 1; i++) {
    if (uniqueRankVals[i] - uniqueRankVals[i + 1] === 1) {
      curRun++;
      if (curRun > maxRun) maxRun = curRun;
    } else {
      curRun = 1;
    }
  }

  // Check for wrap potential: 4+ cards within 5 ranks of each other
  let wrapPotential = false;
  for (let i = 0; i <= uniqueRankVals.length - 4; i++) {
    if (uniqueRankVals[i] - uniqueRankVals[i + 3] <= 4) {
      wrapPotential = true;
      break;
    }
  }

  if (maxRun >= 5) {
    score += 40; tags.push('Broadway' );
  } else if (maxRun >= 4) {
    score += 30;
    tags.push(topRank >= 10 ? 'High Rundown' : 'Rundown');
  } else if (maxRun === 3) {
    score += 15;
    tags.push('Connected');
  } else if (wrapPotential) {
    score += 10;
    tags.push('Wrap Potential');
  }

  // ── DANGLER AND DISCONNECT PENALTY ────────────────────────────────────────
  const spread = uniqueRankVals[0] - uniqueRankVals[uniqueRankVals.length - 1];
  const hasDangler = uniqueRankVals.length >= 5 && spread > 10;
  const isDisconnected = maxRun < 3 && !wrapPotential && !hasAA && !hasKK;
  const isRagged = isDisconnected && isRainbow;

  if (hasDangler)      { score -= 14; tags.push('Dangler'); }
  if (isDisconnected)  { score -= 12; }
  if (isRagged)        { score -= 8;  }

  // ── BADUGI CHECK (all 4 suits present = less suited combos possible) ──────
  const suitsPresent = new Set(sorted.map(c => c.suit)).size;
  if (suitsPresent === 4) { score -= 5; tags.push('Badugi'); }

  // ── BROADWAY BONUS ───────────────────────────────────────────────────────
  const broadwayCards = sorted.filter(c => RANK_VALUES[c.rank] >= 10);
  if (broadwayCards.length >= 5 && !tags.includes('Broadway')) {
    tags.push('Heavy Broadway');
    score += 8;
  }

  // ── FINAL TAGS & PERCENTILE ───────────────────────────────────────────────
  const finalTags = tags.filter((t, i) => tags.indexOf(t) === i).slice(0, 4);
  const percentile = scoreToPercentile(score);

  // ── EXPLANATION ───────────────────────────────────────────────────────────
  const explanation = generateExplanation(finalTags, score, hasAA, hasKK, isDoubleSuited, maxRun, hasDangler, isRainbow, topRank);

  return { percentile, tags: finalTags.length ? finalTags : ['Trash'], explanation };
}

function generateExplanation(
  tags: string[], score: number, hasAA: boolean, hasKK: boolean,
  isDS: boolean, maxRun: number, hasDangler: boolean, isRainbow: boolean, topRank: number
): string {
  // Premium hands
  if (hasAA && isDS && maxRun >= 3) return 'Premium: AA double-suited with connectivity. A monster — raise any position.';
  if (hasAA && isDS) return 'Strong: AA double-suited. Excellent PLO6 hand due to nut flush potential in two suits.';
  if (hasAA && !isDS && !isRainbow) return 'Decent: AA single-suited. Playable everywhere but loses value without extra suitedness.';
  if (hasAA && isRainbow) return 'Trap: Bare rainbow Aces. Significantly weaker than it looks — fold UTG, open BTN only with connectivity.';
  if (hasKK && isDS && maxRun >= 3) return 'Premium: KK double-suited + rundown. Top 5% hand, raise any position.';
  if (hasKK && isDS) return 'Strong: KK double-suited. Excellent — open any position.';
  if (hasKK && !isDS) return 'Marginal Kings: KK without double suit loses much value. Play tight from early position.';
  if (tags.includes('Double Paired') && isDS) return 'Strong: Double pair + DS. Premium in PLO6 with two pair equity + flush draws.';

  // Rundowns
  if (tags.includes('Broadway') && isDS) return 'Elite: Double-suited broadway rundown. Nearly unbeatable preflop equity — raise any position.';
  if (tags.includes('High Rundown') && isDS) return 'Premium: High double-suited rundown. Generates massive straight + flush draws on most flops.';
  if (tags.includes('Rundown') && isDS) return 'Strong: Double-suited mid rundown. Very playable from BTN/CO.';
  if (tags.includes('High Rundown') && !isDS) return 'Good: High rundown single-suited. Open from CO/BTN/SB — needs position to realize equity.';
  if (tags.includes('Rundown') && !isDS) return 'Marginal: Mid rundown rainbow/SS. Playable in position, fold UTG.';

  // Bad hands
  if (hasDangler && isRainbow) return 'Trash: Dangler + rainbow = high fold frequency, minimal equity vs any range.';
  if (hasDangler) return 'Weak: Dangler present — the 6th card adds almost no value and dilutes your draw equity.';
  if (isRainbow && score < 20) return 'Fold: Rainbow disconnected — cannot make flushes, limited straight potential. A clear fold.';
  if (tags.includes('Badugi')) return 'Weak: All 4 suits present limits flush potential. Two-suited combos are impossible.';

  // Generic
  if (score >= 55) return 'Strong hand — raise all positions.';
  if (score >= 35) return 'Solid hand — open from CO, BTN, SB.';
  if (score >= 20) return 'Marginal — playable from BTN/SB only.';
  return 'Weak hand — fold preflop in most positions.';
}

// ─── DEAL HAND ────────────────────────────────────────────────────────────────
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
    // Fisher-Yates shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    const hand = deck.slice(0, 6);
    if (!activeDrill || attempts === 499) return sortHand(hand);

    const { tags, percentile } = evaluatePLO6Hand(hand);

    if (activeDrill === 'The Premiums') {
      if (percentile <= 8 || tags.includes('Aces') || tags.includes('Kings')) return sortHand(hand);
    } else if (activeDrill === 'The Traps') {
      if (tags.includes('Dangler') || tags.includes('Rainbow') || (tags.includes('Kings') && percentile > 30)) return sortHand(hand);
    } else if (activeDrill === 'Connectors') {
      if (tags.includes('Rundown') || tags.includes('High Rundown') || tags.includes('Connected') || tags.includes('Broadway')) return sortHand(hand);
    } else {
      return sortHand(hand);
    }
  }
  return [];
}

// ─── CREATE TABLE STATE ───────────────────────────────────────────────────────
export function createTableState(id: number, activePositions: Position[] = RFI_POSITIONS, activeDrill: string | null = null): TableState {
  const position = activePositions[Math.floor(Math.random() * activePositions.length)];
  const hand = dealHand(activeDrill);
  const { percentile, tags, explanation } = evaluatePLO6Hand(hand);
  const threshold = RFI_THRESHOLDS[position];
  const correctAction: Action = percentile <= threshold ? 'raise' : 'fold';

  return { id, hand, position, scenario: 'RFI', percentile, tags, explanation, correctAction, showFeedback: false };
}