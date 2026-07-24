<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);
header('Content-Type: text/plain');

function step($label, callable $fn) {
    echo "→ {$label}... ";
    try {
        $fn();
        echo "OK\n";
    } catch (Throwable $e) {
        echo "FAILED: " . $e->getMessage() . "\n";
        echo "  in " . $e->getFile() . ":" . $e->getLine() . "\n";
        exit;
    }
}

$root = dirname($_SERVER['DOCUMENT_ROOT']) . '/backend';

step('_bootstrap.php (known-good baseline)', fn() => require_once "$root/api/_bootstrap.php");
step('Totp.php loads',                       fn() => require_once "$root/lib/Totp.php");
step('Totp class exists',                    function () {
    if (!class_exists('Totp')) throw new Exception('Totp class not found');
});
step('Totp::generateSecret() runs',          function () {
    $s = Totp::generateSecret();
    if (strlen($s) < 10) throw new Exception('Unexpected secret length: ' . strlen($s));
});
step('staff table exists & readable',        function () {
    $stmt = db()->query('SELECT id, email, role, totp_enabled, is_active, password_hash FROM staff LIMIT 1');
    $row = $stmt->fetch();
    if (!$row) throw new Exception('staff table is empty — seed insert may not have committed');
    echo "\n  found: {$row['email']} / role={$row['role']} / totp_enabled={$row['totp_enabled']} / active={$row['is_active']} ";
});
step('password_hash format looks valid',     function () {
    $stmt = db()->query('SELECT password_hash FROM staff LIMIT 1');
    $hash = $stmt->fetchColumn();
    // bcrypt/argon hashes always start with $
    if (strpos($hash, '$') !== 0) throw new Exception('password_hash does not look like a real hash — was password_hash() actually run, or was the raw password/placeholder text inserted instead?');
});
step('staff_login_log table exists & writable', function () {
    db()->prepare('INSERT INTO staff_login_log (staff_id, email_attempted, ip_hash, success) VALUES (NULL, ?, ?, 0)')
        ->execute(['diag-test@example.com', hash('sha256', '0.0.0.0')]);
});
step('Auth::requireFetchHeader exists',      function () {
    if (!method_exists('Auth', 'requireFetchHeader')) throw new Exception('Method not found on Auth class');
});
step('Validator::jsonBody exists',           function () {
    if (!method_exists('Validator', 'jsonBody')) throw new Exception('Method not found on Validator class');
});

echo "\nAll checks passed — the bootstrap/table chain is clean.\nIf login.php still fails, the bug is likely in its own request-handling logic, not its dependencies.\n";