<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Release keys held by unpaid orders. Checkout also does this inline, so stock is reclaimed even
// where no scheduler runs (Render free tier); this keeps it timely everywhere else.
Schedule::command('orders:expire-reservations')->everyMinute()->withoutOverlapping();
