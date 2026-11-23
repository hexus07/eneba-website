<?php

namespace Tests\Feature;

use App\Models\CartItem;
use App\Models\Order;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\BuildsOrders;
use Tests\TestCase;

class UnauthenticatedAccessTest extends TestCase
{
    use BuildsOrders, RefreshDatabase;

    public static function protectedRoutes(): array
    {
        $uuid = '00000000-0000-4000-8000-000000000000';

        return [
            'me' => ['GET', '/api/v1/auth/me'],
            'me (alias)' => ['GET', '/api/v1/me'],
            'logout' => ['POST', '/api/v1/auth/logout'],
            'cart' => ['GET', '/api/v1/cart'],
            'add to cart' => ['POST', '/api/v1/cart/items'],
            'update cart item' => ['PATCH', '/api/v1/cart/items/1'],
            'remove cart item' => ['DELETE', '/api/v1/cart/items/1'],
            'merge cart' => ['POST', '/api/v1/cart/merge'],
            'checkout' => ['POST', '/api/v1/checkout'],
            'order history' => ['GET', '/api/v1/orders'],
            'order detail' => ['GET', "/api/v1/orders/$uuid"],
            'fake payment confirm' => ['POST', "/api/v1/payments/fake/$uuid/confirm"],
        ];
    }

    #[DataProvider('protectedRoutes')]
    public function test_requires_authentication(string $method, string $uri): void
    {
        $this->json($method, $uri)->assertUnauthorized()->assertJson(['message' => 'Unauthenticated.']);
    }

    #[DataProvider('protectedRoutes')]
    public function test_returns_json_401_even_without_accept_header(string $method, string $uri): void
    {
        // Must not try to redirect to a (non-existent) login route → 500.
        $this->call($method, $uri)->assertUnauthorized();
    }

    #[DataProvider('protectedRoutes')]
    public function test_rejects_invalid_token(string $method, string $uri): void
    {
        $this->withToken('1|not-a-real-token')->json($method, $uri)->assertUnauthorized();
    }

    public function test_cannot_see_or_pay_another_users_order(): void
    {
        $offer = $this->offerWithKeys(2);
        $this->actingAsBuyer();
        $order = $this->checkoutOffer($offer);

        $this->actingAsBuyer(User::factory()->create());
        $this->getJson("/api/v1/orders/{$order->id}")->assertNotFound();
        $this->confirmFake($order)->assertNotFound();
        $this->getJson('/api/v1/orders')->assertOk()->assertJsonCount(0, 'data');

        $this->assertTrue($order->fresh()->isPending());
    }

    public function test_cannot_modify_another_users_cart_item(): void
    {
        $offer = $this->offerWithKeys(5);
        $owner = $this->actingAsBuyer();
        $this->addToCart($offer);
        $item = CartItem::query()->where('user_id', $owner->id)->firstOrFail();

        $this->actingAsBuyer(User::factory()->create());
        $this->patchJson("/api/v1/cart/items/{$item->id}", ['quantity' => 3])->assertNotFound();
        $this->deleteJson("/api/v1/cart/items/{$item->id}")->assertNotFound();

        $this->assertSame(1, $item->fresh()->quantity);
    }

    public function test_malformed_order_id_is_404_not_500(): void
    {
        $this->actingAsBuyer();

        $this->getJson('/api/v1/orders/not-a-uuid')->assertNotFound();
        $this->assertSame(0, Order::count());
    }
}
