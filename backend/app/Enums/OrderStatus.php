<?php

namespace App\Enums;

enum OrderStatus: string
{
    case Pending = 'pending';       // awaiting payment
    case Completed = 'completed';   // paid and keys assigned
    case Failed = 'failed';         // payment declined / canceled
    case Refunding = 'refunding';   // paid, out of stock, refund claimed but not yet confirmed by the provider
    case Refunded = 'refunded';     // paid, but stock ran out before keys could be assigned
}
