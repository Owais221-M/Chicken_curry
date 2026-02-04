<?php
// db.php - Docker-compatible version
$host = getenv('DB_HOST') ?: "localhost";
$user = getenv('DB_USER') ?: "root";
$password = getenv('DB_PASSWORD') ?: "Ansari_221";
$dbname = getenv('DB_NAME') ?: "chicken_curry_db";

$conn = new mysqli($host, $user, $password, $dbname);

if ($conn->connect_error) {
  die(json_encode([
    "success" => false,
    "message" => "Database connection failed: " . $conn->connect_error
  ]));
}

$conn->set_charset("utf8mb4");
?>