<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Each test opts into external delivery features explicitly.
        config([
            'services.order_updates.email_enabled' => false,
            'services.order_updates.live_enabled' => false,
        ]);
    }
}
