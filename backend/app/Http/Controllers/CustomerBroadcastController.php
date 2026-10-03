<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Broadcast;

class CustomerBroadcastController extends Controller
{
    public function __invoke(Request $request): mixed
    {
        $data = $request->validate(['channel_name' => ['required', 'string'], 'socket_id' => ['required', 'regex:/^\d+\.\d+$/']]);
        abort_unless($request->user()->role === 'customer' && $data['channel_name'] === 'private-customers.'.$request->user()->id, 403);

        return Broadcast::auth($request);
    }
}
