<?php

use App\Http\Controllers\RiderDeliveryController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::prefix('rider/runs/{deliveryRun}')->middleware('throttle:60,1')->group(function () {
    Route::get('/access', [RiderDeliveryController::class, 'access'])->middleware('signed')->name('rider.access');
    Route::post('/access', [RiderDeliveryController::class, 'claim'])->middleware('signed')->name('rider.claim');
    Route::get('/', [RiderDeliveryController::class, 'show'])->name('rider.run');
    Route::post('/orders/{order}/confirm', [RiderDeliveryController::class, 'confirm'])->name('rider.confirm');
});
