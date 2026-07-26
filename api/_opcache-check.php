<?php
// api/_opcache-check.php — TEMPORARY, delete after use.
header('Content-Type: text/plain');

if (!function_exists('opcache_reset')) {
    echo "OPcache extension not available — this isn't the cause. Look elsewhere.\n";
    exit;
}

$file = dirname($_SERVER['DOCUMENT_ROOT']) . '/backend/helpers/ReceiptTemplate.php';
$status = opcache_get_status(false);
echo "OPcache enabled: " . ($status['opcache_enabled'] ? 'yes' : 'no') . "\n";
echo "Disk file mtime: " . date('Y-m-d H:i:s', filemtime($file)) . "\n";

$cachedInfo = opcache_get_status(true)['scripts'][$file] ?? null;
if ($cachedInfo) {
    echo "OPcache's cached mtime for this file: " . date('Y-m-d H:i:s', $cachedInfo['timestamp']) . "\n";
    echo ($cachedInfo['timestamp'] < filemtime($file)) ? "MISMATCH — OPcache is serving a stale compiled version.\n" : "Matches — not the cause.\n";
} else {
    echo "File not currently in OPcache's cache (will compile fresh on next request).\n";
}

$reset = opcache_reset();
echo "\nopcache_reset() called: " . ($reset ? "success — all cached bytecode cleared.\n" : "failed.\n");