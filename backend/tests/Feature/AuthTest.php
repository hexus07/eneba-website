<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    private function register(array $overrides = []): TestResponse
    {
        return $this->postJson('/api/v1/auth/register', array_merge([
            'name' => 'Ada', 'email' => 'Ada@Example.com', 'password' => 'secret123', 'password_confirmation' => 'secret123',
        ], $overrides));
    }

    public function test_register_returns_user_and_a_working_token(): void
    {
        $response = $this->register()->assertCreated()
            ->assertJsonPath('data.email', 'ada@example.com') // normalized
            ->assertJsonMissingPath('data.password');

        $this->assertTrue(Hash::check('secret123', User::firstOrFail()->password));

        $this->withToken($response->json('token'))->getJson('/api/v1/auth/me')
            ->assertOk()->assertJsonPath('data.email', 'ada@example.com');
    }

    public function test_register_validation(): void
    {
        User::factory()->create(['email' => 'taken@example.com']);

        $this->register(['email' => 'TAKEN@example.com'])->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->register(['password' => 'short1', 'password_confirmation' => 'short1'])->assertJsonValidationErrors('password');
        $this->register(['password' => 'onlyletters', 'password_confirmation' => 'onlyletters'])->assertJsonValidationErrors('password');
        $this->register(['password_confirmation' => 'different1'])->assertJsonValidationErrors('password');
        $this->register(['name' => ''])->assertJsonValidationErrors('name');
    }

    public function test_login_with_valid_credentials_returns_token(): void
    {
        User::factory()->create(['email' => 'ada@example.com', 'password' => 'secret123']);

        $token = $this->postJson('/api/v1/auth/login', ['email' => ' ADA@example.com ', 'password' => 'secret123'])
            ->assertOk()->assertJsonStructure(['data' => ['id', 'name', 'email'], 'token'])->json('token');

        $this->withToken($token)->getJson('/api/v1/auth/me')->assertOk();
    }

    public function test_login_failure_does_not_reveal_whether_email_exists(): void
    {
        User::factory()->create(['email' => 'ada@example.com', 'password' => 'secret123']);

        $wrongPassword = $this->postJson('/api/v1/auth/login', ['email' => 'ada@example.com', 'password' => 'nope'])
            ->assertUnprocessable()->json('errors.email');
        $unknownEmail = $this->postJson('/api/v1/auth/login', ['email' => 'nobody@example.com', 'password' => 'nope'])
            ->assertUnprocessable()->json('errors.email');

        $this->assertSame($wrongPassword, $unknownEmail);
    }

    public function test_login_is_rate_limited(): void
    {
        foreach (range(1, 5) as $_) {
            $this->postJson('/api/v1/auth/login', ['email' => 'ada@example.com', 'password' => 'guess'])->assertUnprocessable();
        }

        $this->postJson('/api/v1/auth/login', ['email' => 'ada@example.com', 'password' => 'guess'])->assertTooManyRequests();
    }

    public function test_logout_revokes_only_the_current_token(): void
    {
        $user = User::factory()->create();
        $tokenA = $user->createToken('a')->plainTextToken;
        $tokenB = $user->createToken('b')->plainTextToken;

        $this->withToken($tokenA)->postJson('/api/v1/auth/logout')->assertNoContent();
        $this->app['auth']->forgetGuards(); // the test app caches the resolved user between requests

        $this->withToken($tokenA)->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->app['auth']->forgetGuards();
        $this->withToken($tokenB)->getJson('/api/v1/auth/me')->assertOk();
    }

    public function test_expired_token_is_rejected(): void
    {
        $token = User::factory()->create()->createToken('spa')->plainTextToken;

        $this->travel(config('sanctum.expiration') + 1)->minutes();

        $this->withToken($token)->getJson('/api/v1/auth/me')->assertUnauthorized();
    }
}
