<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\HomeBlock;
use App\Services\Home\BlockRegistry;
use Illuminate\Http\JsonResponse;

class HomeController extends Controller
{
    public function __construct(private readonly BlockRegistry $blocks) {}

    /** Layout only: the frontend renders one component per `type` and fetches each block on its own. */
    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->blocks->layout()->map(fn (HomeBlock $b) => [
            'key' => $b->key,
            'type' => $b->type,
            'title' => $b->title,
            'endpoint' => "/api/v1/home/blocks/{$b->key}",
        ])->all()]);
    }

    public function show(string $key): JsonResponse
    {
        $block = $this->blocks->find($key) ?? abort(404);

        return response()->json(['data' => [
            'key' => $block->key,
            'type' => $block->type,
            'title' => $block->title,
            ...$this->blocks->for($block->type)->provide($block),
        ]]);
    }
}
