<?php
declare(strict_types=1);
require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/../helpers/SchedulingService.php';

header('Content-Type: application/json');
try {
    $result = SchedulingService::lockSlot('madhu-vihar', (new DateTime('+2 days'))->format('Y-m-d'), '12:00 PM', 'in_person');
    echo json_encode(['ok' => true, 'result' => $result]);
} catch (SchedulingException $e) {
    echo json_encode(['ok' => false, 'error' => $e->getMessage(), 'code' => $e->errorCode, 'http' => $e->httpStatus]);
}