<?php
// TEMPORARY DIAGNOSTIC — delete immediately after use.
declare(strict_types=1);
require dirname($_SERVER['DOCUMENT_ROOT']) . '/backend/config/config.php';
header('Content-Type: text/plain');

echo "DB_HOST    = " . json_encode(DB_HOST) . "\n";
echo "DB_NAME    = " . json_encode(DB_NAME) . "\n";
echo "DB_USER    = " . json_encode(DB_USER) . "\n";
echo "DB_CHARSET = " . json_encode(DB_CHARSET) . "\n";
echo "DB_PASS length            = " . strlen(DB_PASS) . "\n";
echo "DB_PASS first/last chars  = " . ord(DB_PASS[0]) . " / " . ord(DB_PASS[strlen(DB_PASS) - 1]) . "\n\n";

try {
    $dsn = sprintf('mysql:host=%s;dbname=%s', DB_HOST, DB_NAME);
    $pdo = new PDO($dsn, DB_USER, DB_PASS, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    echo "CONNECT: OK\n";
    $pdo->exec("SET NAMES utf8mb4");
    echo "SET NAMES: OK\n";
} catch (Throwable $e) {
    echo "FAILED: " . $e->getMessage() . "\n";
}