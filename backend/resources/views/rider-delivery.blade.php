<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>WashEase · Rider delivery</title>
    <style>
        *{box-sizing:border-box}body{margin:0;background:#f1f7fc;color:#172b42;font:16px/1.6 system-ui,sans-serif}main{max-width:700px;margin:auto;padding:24px 16px}header,article,.notice{background:white;border:1px solid #d5e3ef;border-radius:18px;padding:22px;margin-bottom:18px}h1{font-size:26px;margin:0}h2{font-size:20px;margin:0 0 8px}p{margin:8px 0}.muted{color:#526579}.badge{display:inline-block;background:#e5f4ed;color:#15563e;border-radius:8px;padding:4px 10px;font-weight:600}button{width:100%;min-height:48px;border:0;border-radius:12px;background:#175dcc;color:white;font:600 16px system-ui;padding:12px;cursor:pointer}button:disabled{background:#64748b;cursor:default}a{color:#174f9e;overflow-wrap:anywhere}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #9b4d00;outline-offset:4px}label{display:flex;gap:12px;padding:12px 0}input{width:22px;height:22px;flex-shrink:0}address{font-style:normal;white-space:pre-wrap}.notice{border-left:5px solid #175dcc}
    </style>
</head>
<body><main>
<header><h1>WashEase</h1><p class="muted">Rider delivery workspace</p></header>
@if ($mode === 'access')
    <article><h2>Open your assigned run</h2><p>This private link can be claimed once. Open it on the phone you will use for this trip.</p><p class="muted">Keep this browser session open. Do not forward the link. Ask staff for a replacement if access expires.</p><form method="post" action="{{ $claimUrl }}">@csrf<button type="submit">Open delivery run on this device</button></form></article>
@elseif ($mode === 'completed')
    <article><h2>All deliveries completed</h2><p>Return to the shop and report any collected payments to staff. Staff must confirm your physical return.</p><p class="muted">Customer details are no longer displayed.</p></article>
@else
    <article><h2>Run #{{ $run->id }}</h2><p><span class="badge">{{ $run->status === 'Started' ? 'Out on delivery' : 'Awaiting departure' }}</span></p><p class="muted">Access ends {{ $run->rider_link_expires_at->timezone('Asia/Manila')->format('M j, Y g:i A') }} PHT, or earlier if staff revokes it.</p><p><a href="{{ route('rider.run', ['deliveryRun' => $run->id]) }}">Refresh delivery status</a></p></article>
    @if (session('rider_message'))<p class="notice" role="status">{{ session('rider_message') }}</p>@endif
    @if ($run->status === 'Planned')<p class="notice">Wait for staff to mark the run as departed before confirming deliveries.</p>@endif
    @foreach ($orders as $order)
        <article><h2>{{ $order->order_number }}</h2>
        @if ($order->status === 'Delivered')
            <p class="badge">Delivery completed</p><p class="muted">{{ $order->delivered_at?->timezone('Asia/Manila')->format('M j, Y g:i A') }} PHT</p>
        @else
            <p><strong>{{ $order->user?->name }}</strong></p><address>{{ $order->address?->address }}</address>
            @if ($order->user?->phone)<p>Customer phone: {{ $order->user->phone }}</p>@endif
            @if ($run->status === 'Started' && $order->status === 'Ready for Delivery')
                <form method="post" action="{{ route('rider.confirm', ['deliveryRun' => $run->id, 'order' => $order->id]) }}">@csrf<label><input type="checkbox" required><span>I have handed this order to the customer or their representative.</span></label><button type="submit">Confirm delivery · {{ $order->order_number }}</button></form>
            @endif
        @endif
        </article>
    @endforeach
@endif
<p class="muted">Delivery confirmation does not record payment. Contact shop staff if something is incorrect.</p>
</main></body></html>
