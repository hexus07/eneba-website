<?php

namespace Tests\Feature;

use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class CorsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'cors.allowed_origins' => ['https://gamekeys.vercel.app'],
            'cors.allowed_origins_patterns' => ['#^https://gamekeys-[a-z0-9-]+-hexus07\.vercel\.app$#'],
        ]);
    }

    private function preflight(string $origin): TestResponse
    {
        return $this->call('OPTIONS', '/api/v1/checkout', [], [], [], [
            'HTTP_ORIGIN' => $origin,
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'authorization,content-type,idempotency-key',
        ]);
    }

    public function test_the_frontend_origin_may_call_the_api_with_bearer_and_idempotency_headers(): void
    {
        $response = $this->preflight('https://gamekeys.vercel.app')->assertNoContent();

        $response->assertHeader('Access-Control-Allow-Origin', 'https://gamekeys.vercel.app');
        $allowed = strtolower((string) $response->headers->get('Access-Control-Allow-Headers'));
        foreach (['authorization', 'content-type', 'idempotency-key'] as $header) {
            $this->assertStringContainsString($header, $allowed);
        }
        $this->assertNull($response->headers->get('Access-Control-Allow-Credentials'), 'bearer tokens, no cookies');
    }

    public function test_vercel_preview_deployments_match_the_pattern(): void
    {
        $this->preflight('https://gamekeys-git-feature-x-hexus07.vercel.app')
            ->assertHeader('Access-Control-Allow-Origin', 'https://gamekeys-git-feature-x-hexus07.vercel.app');
    }

    public function test_other_origins_get_no_cors_grant(): void
    {
        foreach (['https://evil.example', 'https://gamekeys.vercel.app.evil.example', 'http://gamekeys.vercel.app'] as $origin) {
            $this->assertNull($this->preflight($origin)->headers->get('Access-Control-Allow-Origin'), $origin);
            $this->assertNull(
                $this->withHeader('Origin', $origin)->getJson('/api/v1/products')->headers->get('Access-Control-Allow-Origin'),
                "simple GET from $origin",
            );
        }
    }

    public function test_actual_requests_from_the_frontend_carry_the_grant(): void
    {
        $this->withHeader('Origin', 'https://gamekeys.vercel.app')->getJson('/up')->assertOk();
        $this->withHeader('Origin', 'https://gamekeys.vercel.app')->getJson('/api/v1/products')
            ->assertHeader('Access-Control-Allow-Origin', 'https://gamekeys.vercel.app');
    }

    public function test_with_a_single_allowed_origin_the_header_never_matches_another_origin(): void
    {
        // php-cors short-cut: with exactly one origin and no patterns it always sends that origin.
        // A browser on another origin compares and blocks the response, so this is still safe.
        config(['cors.allowed_origins' => ['https://gamekeys.vercel.app'], 'cors.allowed_origins_patterns' => []]);

        $header = $this->withHeader('Origin', 'https://evil.example')->getJson('/api/v1/products')->headers->get('Access-Control-Allow-Origin');

        $this->assertNotSame('https://evil.example', $header);
        $this->assertNotSame('*', $header);
    }
}
