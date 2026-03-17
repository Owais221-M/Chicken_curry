<?php
$host     = getenv('DB_HOST')     ?: 'localhost';
$user     = getenv('DB_USER')     ?: 'root';
$password = getenv('DB_PASSWORD') ?: 'Ansari_221'; 
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
