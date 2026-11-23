<?php

return [
    // How long keys stay reserved for an unpaid order.
    'reservation_minutes' => (int) env('CHECKOUT_RESERVATION_MINUTES', 15),
];
