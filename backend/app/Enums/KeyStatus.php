<?php

namespace App\Enums;

enum KeyStatus: string
{
    case Available = 'available';
    case Reserved = 'reserved';
    case Sold = 'sold';
}
