<?php

return [
    /*
     * Minimum pg_trgm word_similarity() for a fuzzy (typo) match. Applied per query with
     * set_config(..., is_local => true) so it is safe behind Neon's transaction-mode pooler.
     * 0.5 keeps "cyberpnk" → "Cyberpunk 2077" (≈0.78) while rejecting unrelated noise.
     */
    'word_similarity_threshold' => (float) env('SEARCH_WORD_SIMILARITY_THRESHOLD', 0.5),

    // Trigrams are meaningless for 1–2 char queries; below this length only prefix matching is used.
    'min_fuzzy_length' => 3,

    'max_query_length' => 100,
];
