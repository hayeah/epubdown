import type { Command } from "./types";

// Fuzzy match scoring function
export function fuzzyMatch(query: string, text: string): number {
  if (!query) return 1;
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();

  // Exact match gets highest score
  if (lowerText === lowerQuery) return 100;

  // Starting with query gets high score
  if (lowerText.startsWith(lowerQuery)) return 90;

  // Contains as a whole word
  if (
    lowerText.includes(` ${lowerQuery}`) ||
    lowerText.includes(`${lowerQuery} `)
  )
    return 80;

  // Contains query
  if (lowerText.includes(lowerQuery)) return 70;

  // Character-by-character fuzzy match
  let queryIndex = 0;
  let score = 0;
  let consecutiveMatches = 0;

  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      score += 10 + consecutiveMatches * 5;
      consecutiveMatches++;
      queryIndex++;
    } else {
      consecutiveMatches = 0;
    }
  }

  // If all query characters were found
  if (queryIndex === lowerQuery.length) {
    return Math.min(60, score / lowerQuery.length);
  }

  return 0;
}

// Command ranking function
export function rankCommands(commands: Command[], query: string): Command[] {
  // If no query, return all commands sorted by popularity/recency
  if (!query || query.trim() === "") {
    return commands.slice().sort((a, b) => {
      // Sort by recency first
      if (a.lastUsed && b.lastUsed) {
        return b.lastUsed - a.lastUsed;
      }
      if (a.lastUsed) return -1;
      if (b.lastUsed) return 1;

      // Then by popularity
      const popA = a.popularity || 0;
      const popB = b.popularity || 0;
      return popB - popA;
    });
  }

  const scored = commands.map((cmd) => {
    // Text matching score
    const labelScore = fuzzyMatch(query, cmd.label);
    const keywordScore = Math.max(
      0,
      ...(cmd.keywords?.map((k) => fuzzyMatch(query, k) * 0.8) || []),
    );
    const categoryScore = cmd.category
      ? fuzzyMatch(query, cmd.category) * 0.5
      : 0;

    const textScore = Math.max(labelScore, keywordScore, categoryScore);

    // If there's no text match at all, don't include this command
    if (textScore === 0) {
      return { cmd, score: 0 };
    }

    let score = textScore;

    // Boost for recent usage (up to +20 points)
    if (cmd.lastUsed) {
      const hoursSinceUse = (Date.now() - cmd.lastUsed) / (1000 * 60 * 60);
      const recencyBoost = Math.max(0, 20 - hoursSinceUse);
      score += recencyBoost;
    }

    // Boost for popularity (up to +10 points)
    if (cmd.popularity) {
      score += cmd.popularity * 10;
    }

    // Context-scoped commands get priority
    if (cmd.scope === "context") {
      score += 30;
    }

    return { cmd, score };
  });

  // Filter out zero scores and sort
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.cmd);
}
