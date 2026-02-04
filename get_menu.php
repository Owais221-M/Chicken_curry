<?php
header("Content-Type: application/json");
require_once "db.php";
require_once "helpers.php";

$result = $conn->query("SELECT * FROM products");

$menu = [];

while ($row = $result->fetch_assoc()) {
  $menu[] = $row;
}

jsonResponse(true, "Menu loaded", $menu);
