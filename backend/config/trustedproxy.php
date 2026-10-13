<?php

return [
    'proxies' => array_values(array_filter(
        array_map('trim', explode(',', (string) env('TRUSTED_PROXIES', ''))),
        static fn (string $proxy): bool => $proxy !== '' && ! in_array($proxy, ['*', '**', 'REMOTE_ADDR'], true),
    )),
];
