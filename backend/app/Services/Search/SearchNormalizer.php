<?php

namespace App\Services\Search;

use Illuminate\Support\Str;

/**
 * Single normalization used for both the stored `products.search_title` and incoming queries,
 * so "Spider-Man: Miles Morales", "spiderman miles" and "Pokémon" all compare like-for-like.
 */
class SearchNormalizer
{
    public static function normalize(?string $value): string
    {
        $value = Str::lower(Str::ascii((string) $value));
        $value = preg_replace("/['\x{2019}\-]/u", '', $value);   // join hyphenated/apostrophe words: spider-man → spiderman
        $value = preg_replace('/[^a-z0-9]+/', ' ', $value);     // everything else becomes a word separator
        $value = preg_replace('/\s+/', ' ', $value);

        return trim($value);
    }
}
