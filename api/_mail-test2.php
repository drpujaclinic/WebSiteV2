<?php
// TEMPORARY — delete after verifying. Tests all 3 Mailer paths directly,
// no DB/session dependency, isolated from the real endpoints.
require_once dirname($_SERVER['DOCUMENT_ROOT']) . '/backend/api/_bootstrap.php';
header('Content-Type: text/plain');

$patient = ['id' => 999999, 'name' => 'Test Patient', 'email' => 'dr.mani.shankar@gmail.com', 'phone' => '9899416040'];
$appointment = [
    'booking_ref' => 'DPCREGRESS1',
    'appointment_date' => date('Y-m-d', strtotime('+3 days')),
    'appointment_time' => '13:30:00',
    'consult_type' => 'in_person',
    'fee_paise' => 80000,
    'reason' => 'Routine Check-up',
];
$location = [
    'name' => "Dr. Puja's Clinic, Madhu Vihar",
    'address' => 'A 128, Gali No 8, Sai Chowk, Madhu Vihar, IP Extension, Patparganj, New Delhi 110092',
];

echo "1. Confirmation: " . (Mailer::bookingConfirmation($patient, $appointment, $location) ? "OK\n" : "FAILED\n");
echo "2. Reschedule (seq 1): " . (Mailer::rescheduleConfirmation($patient, $appointment, $location, 1) ? "OK\n" : "FAILED\n");
echo "3. Cancellation (seq 2): " . (Mailer::cancellationNotice($patient, $appointment, $location, 2) ? "OK\n" : "FAILED\n");
echo "\nCheck inbox for 3 emails (green/gold/red badges) and email_log table for 3 new rows.\n";