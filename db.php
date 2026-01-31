<?php
$host = "localhost";
$user = "root";
$password = "Ansari_221";
$dbname = "chicken_curry_db";

$conn = new mysqli($host, $user, $password, $dbname);

if ($conn->connect_error) {
  die(json_encode([
    "success" => false,
    "message" => "Database connection failed"
  ]));
}

$conn->set_charset("utf8mb4");
?>
