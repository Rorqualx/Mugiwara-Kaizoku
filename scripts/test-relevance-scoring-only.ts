/**
 * Test only the relevance scoring logic
 */

// Copy the relevance scoring logic from FandomProvider
function calculateRelevanceScore(title: string, query: string): number {
  const normalizedTitle = title.toLowerCase().trim();
  const normalizedQuery = query.toLowerCase().trim();

  // Main manga page patterns get highest priority (e.g., "Fire Force (manga)")
  if (
    normalizedTitle === `${normalizedQuery} (manga)` ||
    normalizedTitle === `${normalizedQuery} (series)`
  ) {
    return 1.0;
  }

  // Exact match
  if (normalizedTitle === normalizedQuery) {
    return 0.95;
  }

  // Title starts with query
  if (normalizedTitle.startsWith(normalizedQuery)) {
    return 0.9;
  }

  // Query starts with title (e.g., query="Fire Force", title="Fire Force")
  if (normalizedQuery.startsWith(normalizedTitle)) {
    return 0.85;
  }

  // Title contains query as a word boundary
  const queryWords = normalizedQuery.split(/\s+/);
  const titleWords = normalizedTitle.split(/\s+/);

  // Check if all query words appear in title
  const allWordsMatch = queryWords.every(qw =>
    titleWords.some(tw => tw.includes(qw) || qw.includes(tw))
  );

  if (allWordsMatch) {
    // Score based on word overlap ratio
    const matchingWords = queryWords.filter(qw =>
      titleWords.some(tw => tw === qw)
    ).length;
    const baseScore = 0.5 + (matchingWords / queryWords.length) * 0.4;
    // Boost for (manga) or (series) suffix
    if (normalizedTitle.includes('(manga)') || normalizedTitle.includes('(series)')) {
      return Math.min(baseScore + 0.1, 0.95);
    }
    return baseScore;
  }

  // Partial match - title contains query substring
  if (normalizedTitle.includes(normalizedQuery)) {
    return 0.6;
  }

  // Query contains title substring
  if (normalizedQuery.includes(normalizedTitle)) {
    return 0.55;
  }

  // Check for any word overlap
  const anyWordMatch = queryWords.some(qw =>
    titleWords.some(tw => tw.includes(qw) || qw.includes(tw))
  );

  if (anyWordMatch) {
    return 0.3;
  }

  return 0.0;
}

function testRelevanceScoring() {
  console.log('=== Testing Relevance Scoring Logic ===\n');

  const testCases = [
    { title: 'Fire Force (manga)', query: 'Fire Force' },
    { title: 'Fire Force', query: 'Fire Force' },
    { title: 'Fire Force Wiki', query: 'Fire Force' },
    { title: 'Special Fire Force Company 8', query: 'Fire Force' },
    { title: 'Special Fire Force', query: 'Fire Force' },
    { title: 'Fire force: Enbu no Shō', query: 'Fire Force' },
    { title: 'One Piece - Defeat Him! The Pirate Ganzack', query: 'Fire Force' },
  ];

  testCases.forEach(({ title, query }) => {
    const score = calculateRelevanceScore(title, query);
    console.log(`"${title}" vs "${query}": ${score.toFixed(2)}`);
  });

  console.log('\n=== Analysis ===');
  console.log('MINIMUM_SCORE threshold: 0.10');
  console.log('Results above 0.10 will be included, below will be filtered out');
}

testRelevanceScoring();