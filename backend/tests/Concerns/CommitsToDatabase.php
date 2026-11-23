<?php

namespace Tests\Concerns;

use Illuminate\Foundation\Testing\DatabaseTruncation;

/**
 * For tests that need really committed data (multiple connections/processes, top-level transactions).
 * Laravel's DatabaseTruncation only truncates BEFORE each test, so committed rows would leak into
 * whatever RefreshDatabase test runs next; this also truncates after.
 */
trait CommitsToDatabase
{
    use DatabaseTruncation;

    protected function setUpCommitsToDatabase(): void
    {
        $this->beforeApplicationDestroyed(fn () => $this->truncateTablesForAllConnections());
    }
}
