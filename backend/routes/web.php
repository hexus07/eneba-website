<?php

use Illuminate\Support\Facades\Route;

// API-only backend: the SPA lives in ../frontend. The root just identifies the service.
Route::get('/', fn () => response()->json(['name' => config('app.name'), 'api' => url('/api/v1')]));
