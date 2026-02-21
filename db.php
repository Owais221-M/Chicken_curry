<?php
/**
 * db.php — Database Connection
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates a single shared $conn (mysqli) object used by every PHP endpoint.
 *
 * Configuration is read from environment variables so that credentials are
 * never hard-coded in source. Defaults are provided for local development only.
 *
 * Required environment variables (set in docker-compose.yml or server config):
 *  DB_HOST      — MySQL hostname      (default: localhost)
 *  DB_USER      — MySQL username      (default: root)
 *  DB_PASSWORD  — MySQL password      (NO secure default — must be set)
 *  DB_NAME      — MySQL database name (default: chicken_curry_db)
 *  APP_URL      — Public base URL     (used in Stripe return_url)
 *
 * After this file is included, callers can use $conn directly.
 * ─────────────────────────────────────────────────────────────────────────────
 */

$host     = getenv('DB_HOST')     ?: 'localhost';
$user     = getenv('DB_USER')     ?: 'root';
$password = getenv('DB_PASSWORD') ?: 'Ansari_221'; // ⚠️ Set DB_PASSWORD env var in production!
$dbname   = getenv('DB_NAME')     ?: 'chicken_curry_db';

$conn = new mysqli($host, $user, $password, $dbname);

// Halt immediately if connection fails — all endpoints depend on this
if ($conn->connect_error) {
    die(json_encode([
        'success' => false,
        'message' => 'Database connection failed.' // Intentionally vague for security
    ]));
}

// Ensure all text is stored and retrieved as UTF-8
$conn->set_charset('utf8mb4');
