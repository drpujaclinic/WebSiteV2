<?php
/**
 * Router stub — lives inside public_html/api/ so the URL
 * https://drpujaprasad.in/api/blog-categories.php (and, via .htaccess
 * rewrite, https://drpujaprasad.in/api/blog/categories) works, WITHOUT the
 * real backend code ever being inside the web root. This file does nothing
 * except hand off to the actual implementation one level above public_html.
 *
 * Requires no SSH, no symlinks — just upload this file via File Manager.
 */
require dirname($_SERVER['DOCUMENT_ROOT']) . '/backend/api/blog-categories.php';
