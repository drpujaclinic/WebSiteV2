<?php
/**
 * Router stub — lives inside public_html/api/ so the URL
 * https://drpujaprasad.in/api/me.php works, WITHOUT the real backend
 * code ever being inside the web root. This file does nothing except
 * hand off to the actual implementation one level above public_html.
 *
 * Requires no SSH, no symlinks — just upload this file via File Manager.
 */
require dirname($_SERVER['DOCUMENT_ROOT']) . '/backend/api/me.php';
