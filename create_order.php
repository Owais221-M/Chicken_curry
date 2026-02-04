<?php
header("Content-Type: application/json");
require_once "db.php";
require_once "helpers.php";

$input = json_decode(file_get_contents("php://input"), true);

if (!$input) {
  jsonResponse(false, "Invalid input");
}

$name = trim($input["name"] ?? "");
$phone = trim($input["phone"] ?? "");
$notes = trim($input["notes"] ?? "");
$cart = $input["cart"] ?? [];

if ($name === "" || $phone === "") {
  jsonResponse(false, "Name and phone required");
}

if (count($cart) === 0) {
  jsonResponse(false, "Cart is empty");
}

// Check if customer exists
$stmt = $conn->prepare("SELECT id FROM customers WHERE phone = ?");
$stmt->bind_param("s", $phone);
$stmt->execute();
$result = $stmt->get_result();

if ($row = $result->fetch_assoc()) {
  $customer_id = $row["id"];
} else {
  // Create customer
  $stmt = $conn->prepare("INSERT INTO customers (name, phone) VALUES (?, ?)");
  $stmt->bind_param("ss", $name, $phone);
  $stmt->execute();
  $customer_id = $stmt->insert_id;
}

// Calculate total
$total = 0;
foreach ($cart as $item) {
  $total += $item["price"] * $item["qty"];
}

// Create order
$stmt = $conn->prepare("INSERT INTO orders (customer_id, total, notes) VALUES (?, ?, ?)");
$stmt->bind_param("ids", $customer_id, $total, $notes);
$stmt->execute();
$order_id = $stmt->insert_id;

// Insert items
foreach ($cart as $item) {
  $stmt = $conn->prepare("INSERT INTO order_items (order_id, product_name, price, quantity, category, size) VALUES (?, ?, ?, ?, ?, ?)");
  $size = $item["size"] ?? null;
  $stmt->bind_param("isdisis", $order_id, $item["name"], $item["price"], $item["qty"], $item["category"], $size);
  $stmt->execute();
  $order_item_id = $stmt->insert_id;

  // Customizations
  if (!empty($item["ingredients"])) {
    foreach ($item["ingredients"] as $ing) {
      $stmt = $conn->prepare("INSERT INTO order_customizations (order_item_id, type, name) VALUES (?, 'ingredient', ?)");
      $stmt->bind_param("is", $order_item_id, $ing);
      $stmt->execute();
    }
  }

  if (!empty($item["sauces"])) {
    foreach ($item["sauces"] as $sauce) {
      $stmt = $conn->prepare("INSERT INTO order_customizations (order_item_id, type, name) VALUES (?, 'sauce', ?)");
      $stmt->bind_param("is", $order_item_id, $sauce);
      $stmt->execute();
    }
  }
}

jsonResponse(true, "Order placed successfully", [
  "order_id" => $order_id
]);
