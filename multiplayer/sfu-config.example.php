<?php
// OЯOЯO - Cloudflare Realtime SFU credentials (TEMPLATE).
// 1. Copy this file to `sfu-config.php` (same folder) OR, preferably, to
//    `ororo-sfu.php` one level ABOVE your public web root.
// 2. Fill in the values from the Cloudflare dashboard (see README, "Cloudflare Realtime setup").
// 3. Never commit the real file. `sfu-config.php` and `ororo-sfu.php` are git-ignored.
return [
    'name'       => 'ororo',
    'app_id'     => 'REPLACE_WITH_32_CHAR_APP_ID',
    'app_secret' => 'REPLACE_WITH_64_CHAR_APP_SECRET',
];
