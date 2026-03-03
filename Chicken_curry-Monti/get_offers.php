<?php
/**
 * get_offers.php — Public API: Active Offers
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns only active, non-expired offers for display on the website.
 * No authentication required — this is a public read-only endpoint.
 * ─────────────────────────────────────────────────────────────────────────────
 */
require_once 'db.php';
require_once 'helpers.php';

header('Content-Type: application/json');

// Only return offers that are active and within their date range
$today = date('Y-m-d');

$stmt = $conn->prepare("
    SELECT id, title, description, discount_type, discount_value,
           min_order_amount, coupon_code, start_date, end_date
    FROM offers
    WHERE is_active = 1
      AND (start_date IS NULL OR start_date <= ?)
      AND (end_date IS NULL OR end_date >= ?)
    ORDER BY created_at DESC
");
$stmt->bind_param("ss", $today, $today);
$stmt->execute();
$result = $stmt->get_result();

$offers = [];
while ($row = $result->fetch_assoc()) {
    $offers[] = $row;
}

jsonResponse(true, 'OK', $offers);
