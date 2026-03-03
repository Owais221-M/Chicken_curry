<?php
/**
 * validate_coupon.php — Coupon Code Validation API
 * ─────────────────────────────────────────────────
 * POST /validate_coupon.php  (Content-Type: application/json)
 *
 * Checks a coupon code against the offers table and returns the discount
 * details if the code is valid, active, and meets the minimum order amount.
 *
 * Expected JSON body:
 *  { "code": "SAVE10", "subtotal": 25.00 }
 *
 * Response on success:
 *  { "success": true, "data": { "title": "10% Off", "discount_type": "percentage", "discount_value": 10, "discount_amount": 2.50 } }
 *
 * Response on failure:
 *  { "success": false, "message": "Invalid or expired coupon code" }
 */

header('Content-Type: application/json');
require_once 'db.php';
require_once 'helpers.php';

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['code'])) {
    jsonResponse(false, 'Coupon code is required');
}

$code     = strtoupper(trim($input['code']));
$subtotal = floatval($input['subtotal'] ?? 0);
$today    = date('Y-m-d');

// Look up the coupon code in the offers table
$stmt = $conn->prepare("
    SELECT id, title, discount_type, discount_value, min_order_amount
    FROM offers
    WHERE UPPER(coupon_code) = ?
      AND is_active = 1
      AND (start_date IS NULL OR start_date <= ?)
      AND (end_date   IS NULL OR end_date   >= ?)
    LIMIT 1
");
$stmt->bind_param('sss', $code, $today, $today);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    jsonResponse(false, 'Invalid or expired coupon code');
}

$offer = $result->fetch_assoc();

// Check minimum order amount
if ($subtotal < floatval($offer['min_order_amount'])) {
    jsonResponse(false, 'Minimum order of €' . number_format($offer['min_order_amount'], 2) . ' required for this coupon');
}

// Calculate the discount
$discount_amount = 0;

switch ($offer['discount_type']) {
    case 'percentage':
        $discount_amount = round($subtotal * ($offer['discount_value'] / 100), 2);
        break;
    case 'fixed':
        $discount_amount = min(floatval($offer['discount_value']), $subtotal); // Can't exceed subtotal
        break;
    case 'freebie':
        $discount_amount = 0; // Freebie doesn't reduce price — handled differently
        break;
}

jsonResponse(true, 'Coupon applied', [
    'offer_id'        => (int)$offer['id'],
    'title'           => $offer['title'],
    'discount_type'   => $offer['discount_type'],
    'discount_value'  => floatval($offer['discount_value']),
    'discount_amount' => $discount_amount,
]);
