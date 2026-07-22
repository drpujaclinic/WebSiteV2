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

step('config.php',           fn() => require_once "$root/config/config.php");
step('secrets.php exists',   function () use ($root) {
    if (!file_exists("$root/config/secrets.php")) throw new Exception('secrets.php not found on server');
});
step('secrets.php loads',    fn() => require_once "$root/config/secrets.php");
step('SMTP constants defined', function () {
    foreach (['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS'] as $c) {
        if (!defined($c)) throw new Exception("$c not defined");
    }
});
step('PHPMailer/Exception.php exists', function () use ($root) {
    if (!file_exists("$root/vendor-lite/PHPMailer/Exception.php")) throw new Exception('File missing at expected path');
});
step('PHPMailer/Exception.php loads',  fn() => require_once "$root/vendor-lite/PHPMailer/Exception.php");
step('PHPMailer/PHPMailer.php exists', function () use ($root) {
    if (!file_exists("$root/vendor-lite/PHPMailer/PHPMailer.php")) throw new Exception('File missing at expected path');
});
step('PHPMailer/PHPMailer.php loads',  fn() => require_once "$root/vendor-lite/PHPMailer/PHPMailer.php");
step('PHPMailer/SMTP.php exists',      function () use ($root) {
    if (!file_exists("$root/vendor-lite/PHPMailer/SMTP.php")) throw new Exception('File missing at expected path');
});
step('PHPMailer/SMTP.php loads',       fn() => require_once "$root/vendor-lite/PHPMailer/SMTP.php");
step('PHPMailer class exists',         function () {
    if (!class_exists('PHPMailer\PHPMailer\PHPMailer')) throw new Exception('Class not found after require — file may be corrupted/wrong content');
});
step('Mailer.php loads',               fn() => require_once "$root/lib/Mailer.php");
step('Mailer class exists',            function () {
    if (!class_exists('Mailer')) throw new Exception('Mailer class not found');
});
step('Can instantiate PHPMailer',      function () {
    new PHPMailer\PHPMailer\PHPMailer(true);
});

echo "\nAll checks passed.\n";