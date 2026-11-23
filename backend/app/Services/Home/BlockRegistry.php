<?php

namespace App\Services\Home;

use App\Models\HomeBlock;
use Illuminate\Contracts\Container\Container;
use Illuminate\Support\Collection;

/** Maps home_blocks.type to its provider (config/home.php). */
class BlockRegistry
{
    /** @param array<string, class-string<BlockProvider>> $providers */
    public function __construct(
        private readonly Container $container,
        private readonly array $providers,
    ) {}

    public function supports(string $type): bool
    {
        return isset($this->providers[$type]);
    }

    public function for(string $type): BlockProvider
    {
        return $this->container->make($this->providers[$type]);
    }

    /**
     * Active blocks in display order. Blocks whose type has no provider are skipped, so a row
     * added for a not-yet-deployed block type never breaks the homepage.
     *
     * @return Collection<int, HomeBlock>
     */
    public function layout(): Collection
    {
        return HomeBlock::query()->where('is_active', true)->orderBy('position')->orderBy('id')->get()
            ->filter(fn (HomeBlock $b) => $this->supports($b->type))
            ->values();
    }

    public function find(string $key): ?HomeBlock
    {
        $block = HomeBlock::query()->where('key', $key)->where('is_active', true)->first();

        return $block && $this->supports($block->type) ? $block : null;
    }
}
