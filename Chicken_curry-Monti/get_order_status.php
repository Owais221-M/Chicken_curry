<?php
/**
 * get_order_status.php — Public Order Status API
 * ────────────────────────────────────────────────
 * GET /get_order_status.php?id=123&phone=3901234567
 *
 * Returns the order status for customers to track their order.
 * Requires both order ID and phone number (for privacy).
 */

header('Content-Type: application/json');
require_once 'db.php';
require_once 'helpers.php';

$order_id = intval($_GET['id'] ?? 0);
$phone    = trim($_GET['phone'] ?? '');

if ($order_id <= 0 || $phone === '') {
    jsonResponse(false, 'Order ID and phone number are required');
}

// Look up order matching both ID and phone
$stmt = $conn->prepare("
    SELECT id, customer_name, status, order_type, total_amount, created_at
    FROM orders
    WHERE id = ? AND customer_phone = ?
    LIMIT 1
");
$stmt->bind_param('is', $order_id, $phone);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    jsonResponse(false, 'Order not found. Please check your order number and phone number.');
}

$order = $result->fetch_assoc();

// Fetch order items
$istmt = $conn->prepare("SELECT item_name, category, price, quantity, size FROM order_items WHERE order_id = ?");
$istmt->bind_param('i', $order_id);
$istmt->execute();
$items_result = $istmt->get_result();
$items = [];
while ($row = $items_result->fetch_assoc()) {
    $items[] = $row;
}

jsonResponse(true, 'Order found', [
    'order_id'    => (int)$order['id'],
    'name'        => $order['customer_name'],
    'status'      => $order['status'],
    'order_type'  => $order['order_type'] ?? 'pickup',
    'total'       => floatval($order['total_amount']),
    'created_at'  => $order['created_at'],
    'items'       => $items,
]);
