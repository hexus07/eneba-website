<?php

namespace Tests\Unit;

use App\Services\Search\SearchNormalizer;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class SearchNormalizerTest extends TestCase
{
    #[DataProvider('cases')]
    public function test_normalizes(string $input, string $expected): void
    {
        $this->assertSame($expected, SearchNormalizer::normalize($input));
    }

    public static function cases(): array
    {
        return [
            'lowercases' => ['Cyberpunk 2077', 'cyberpunk 2077'],
            'joins hyphenated words' => ['Spider-Man: Miles Morales', 'spiderman miles morales'],
            'strips accents' => ['Pokémon Légendes', 'pokemon legendes'],
            'drops apostrophes' => ["Assassin's Creed", 'assassins creed'],
            'punctuation becomes space' => ['FIFA 24 (PC) | Steam', 'fifa 24 pc steam'],
            'collapses whitespace' => ["  elden   ring \t", 'elden ring'],
            'strips LIKE wildcards' => ['100%_done', '100 done'],
            'empty' => ['', ''],
        ];
    }
}
