<?php
header("Content-Type: application/json");
require_once "db.php";
require_once "helpers.php";

$data = [];

$ingredients = [];
$res = $conn->query("SELECT * FROM ingredients");
while ($row = $res->fetch_assoc()) {
  $ingredients[] = $row;
}

$sauces = [];
$res = $conn->query("SELECT * FROM sauces");
while ($row = $res->fetch_assoc()) {
  $sauces[] = $row;
}

$sizes = [];
$res = $conn->query("SELECT * FROM sizes");
while ($row = $res->fetch_assoc()) {
  $sizes[] = $row;
}

jsonResponse(true, "Kebab data loaded", [
  "ingredients" => $ingredients,
  "sauces" => $sauces,
  "sizes" => $sizes
]);
