<?php

namespace App\Enums;

enum OrderStatus: string
{
    case Pending = 'pending';       // awaiting payment; keys reserved until expires_at
    case Completed = 'completed';   // paid and keys assigned
    case Failed = 'failed';         // payment declined / canceled (keys released)
    case Expired = 'expired';       // not paid within the reservation window (keys released)
    case Refunding = 'refunding';   // late payment: refund claimed but not yet confirmed by the provider
    case Refunded = 'refunded';     // paid after the reservation had expired: money returned
}
