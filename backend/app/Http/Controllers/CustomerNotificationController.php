<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

class CustomerNotificationController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->role === 'customer', 403);
        $notifications = $request->user()->notifications()->latest()->orderByDesc('id')->paginate(20);

        return response()->json([
            'notifications' => $notifications->items(),
            'unread_count' => $request->user()->unreadNotifications()->count(),
            'current_page' => $notifications->currentPage(),
            'last_page' => $notifications->lastPage(),
        ]);
    }

    public function read(Request $request, string $notification)
    {
        abort_unless($request->user()->role === 'customer', 403);
        $notice = $request->user()->notifications()->findOrFail($notification);
        $notice->markAsRead();

        return response()->json(['message' => 'Notification marked as read.']);
    }
}
