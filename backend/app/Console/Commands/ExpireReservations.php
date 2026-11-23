<?php

namespace App\Console\Commands;

use App\Services\Checkout\KeyReservations;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('orders:expire-reservations')]
#[Description('Expire unpaid orders past their reservation window and put their keys back on sale')]
class ExpireReservations extends Command
{
    public function handle(KeyReservations $keys): int
    {
        $this->info($keys->expireStale().' order(s) expired.');

        return self::SUCCESS;
    }
}
