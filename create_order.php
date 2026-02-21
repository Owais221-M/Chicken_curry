<?php
/**
 * create_order.php — Order Placement API Endpoint
 * ─────────────────────────────────────────────────────────────────────────────
 * POST  /create_order.php   (Content-Type: application/json)
 *
 * Receives a cart + customer details from checkout.html, validates and
 * reprices every item from the database (so the frontend price is never
 * trusted), optionally charges via Stripe, saves the order to the DB,
 * and sends confirmation emails.
 *
 * Expected JSON body:
 *  {
 *    "name":              string,          // Customer full name
 *    "phone":             string,          // Customer phone number
 *    "email":             string,          // Customer email (optional)
 *    "notes":             string,          // Delivery address + special instructions
 *    "cart":              CartItem[],      // Array of cart items (see below)
 *    "order_type":        "pickup"|"delivery",
 *    "payment_method_id": string|null      // Stripe payment method ID, or null for cash
 *  }
 *
 *  CartItem shape:
 *  { id, name, price, qty, category, size?, ingredients[]?, sauces[]? }
 *
 * Security measures applied:
 *  - All prices are re-fetched from the DB; frontend prices are ignored.
 *  - All DB queries use prepared statements (no SQL injection possible).
 *  - Input fields have maximum length limits.
 *  - Cart is capped at 50 items to prevent DoS via large payloads.
 *  - Delivery minimum is enforced server-side (€15 cart subtotal).
 *  - $name is HTML-escaped before being inserted into the email body.
 *
 * Used by: checkout.html → placeOrderBtn click handler
 * ─────────────────────────────────────────────────────────────────────────────
 */

header('Content-Type: application/json');
require_once 'db.php';
require_once 'helpers.php';


// =============================================================================
// §1  PARSE & VALIDATE INPUT
// =============================================================================

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    jsonResponse(false, 'Invalid JSON input');
}

// Extract fields with safe defaults
$name       = trim($input['name']       ?? '');
$phone      = trim($input['phone']      ?? '');
$email      = trim($input['email']      ?? '');
$notes      = trim($input['notes']      ?? '');
$cart       = $input['cart']            ?? [];
$order_type = $input['order_type']      ?? 'pickup';

// Guard against oversized inputs (prevents abuse / DB truncation issues)
if (strlen($name) > 120 || strlen($phone) > 30 || strlen($email) > 200 || strlen($notes) > 1000) {
    jsonResponse(false, 'Input too long');
}

if ($name === '' || $phone === '') {
    jsonResponse(false, 'Name and phone are required');
}

if (count($cart) === 0) {
    jsonResponse(false, 'Cart is empty');
}

// Limit cart size to prevent server-side DoS via extremely large payloads
if (count($cart) > 50) {
    jsonResponse(false, 'Cart exceeds maximum allowed item count');
}


// =============================================================================
// §2  SERVER-SIDE PRICE CALCULATION
//     Re-fetch every item's price from the DB. The frontend price value is
//     NEVER used in the total — this prevents price manipulation attacks.
// =============================================================================

$total = 0;

foreach ($cart as &$item) {

    // ── 2a. Get the item's base price from the appropriate table ──────────────
    if ($item['category'] === 'kebab') {
        // For kebabs, the base price is the chosen size
        $stmt = $conn->prepare('SELECT price FROM sizes WHERE name = ?');
        $stmt->bind_param('s', $item['size']);
    } elseif ($item['category'] === 'sauce') {
        // Standalone sauce add-on (e.g. from the cart upsell)
        $stmt = $conn->prepare('SELECT price FROM sauces WHERE name = ?');
        $stmt->bind_param('s', $item['name']);
    } else {
        // Biryani or curry — look up by name in menu_items
        $stmt = $conn->prepare('SELECT base_price AS price FROM menu_items WHERE name = ?');
        $stmt->bind_param('s', $item['name']);
    }

    $stmt->execute();
    $res = $stmt->get_result();

    if ($res->num_rows === 0) {
        jsonResponse(false, 'Invalid item in cart: ' . $item['name']);
    }

    $real_price = (float) $res->fetch_assoc()['price'];

    // ── 2b. Add ingredient extras for kebabs ──────────────────────────────────
    if ($item['category'] === 'kebab' && !empty($item['ingredients'])) {
        foreach ($item['ingredients'] as $ing_name) {
            $stmt_ing = $conn->prepare('SELECT price FROM ingredients WHERE name = ?');
            $stmt_ing->bind_param('s', $ing_name);
            $stmt_ing->execute();
            $res_ing = $stmt_ing->get_result();

            if ($res_ing->num_rows > 0) {
                $real_price += (float) $res_ing->fetch_assoc()['price'];
            }
        }
    }

    // ── 2c. Add sauce extras (for kebabs that have sauces) ───────────────────
    if (!empty($item['sauces'])) {
        foreach ($item['sauces'] as $sauce_name) {
            $stmt_sauce = $conn->prepare('SELECT price FROM sauces WHERE name = ?');
            $stmt_sauce->bind_param('s', $sauce_name);
            $stmt_sauce->execute();
            $res_sauce = $stmt_sauce->get_result();

            if ($res_sauce->num_rows > 0) {
                $real_price += (float) $res_sauce->fetch_assoc()['price'];
            }
        }
    }

    // Overwrite the price in the item array with the verified DB value
    // so that the email and DB insert steps always use the trusted amount
    $item['price'] = $real_price;
    $total        += $real_price * $item['qty'];
}
unset($item); // Release the reference after foreach


// =============================================================================
// §3  APPLY PLATFORM FEES & ENFORCE DELIVERY MINIMUM
// =============================================================================

$SERVICE_FEE  = 2.00;   // Applied to every order
$DELIVERY_FEE = 3.00;   // Applied only for delivery orders
$DELIVERY_MIN = 15.00;  // Minimum cart subtotal required for delivery

$total += $SERVICE_FEE;

if ($order_type === 'delivery') {
    // Enforce the delivery minimum server-side (cannot be bypassed by the client)
    $cart_subtotal = $total - $SERVICE_FEE;
    if ($cart_subtotal < $DELIVERY_MIN) {
        jsonResponse(false, 'Delivery requires a minimum cart subtotal of €' . number_format($DELIVERY_MIN, 2));
    }
    $total += $DELIVERY_FEE;
}


// =============================================================================
// §4  STRIPE PAYMENT CAPTURE (optional — only when a payment_method_id is sent)
//     Cash orders skip this section entirely.
//     ⚠️  Replace sk_test_... with getenv('STRIPE_SECRET_KEY') before going live!
// =============================================================================

$payment_method_id = $input['payment_method_id'] ?? null;
$stripe_secret_key = 'sk_test_YOUR_SECRET_KEY_HERE'; // ⚠️ TODO: use getenv('STRIPE_SECRET_KEY')

if ($payment_method_id) {
    $return_url = getenv('APP_URL') ?: 'https://chickencurrymessina.com/success.html';

    $ch = curl_init('https://api.stripe.com/v1/payment_intents');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERPWD, $stripe_secret_key . ':'); // Stripe uses HTTP Basic Auth

    // Stripe API expects application/x-www-form-urlencoded
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'amount'         => round($total * 100), // Stripe amounts are in cents
        'currency'       => 'eur',
        'payment_method' => $payment_method_id,
        'description'    => 'Chicken Curry Messina Order',
        'confirm'        => 'true',
        'return_url'     => $return_url,
    ]));

    $response  = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $stripe_result = json_decode($response, true);

    // Halt the order if Stripe rejects the payment
    $allowed_statuses = ['succeeded', 'requires_capture', 'processing'];
    if ($http_code !== 200 || !in_array($stripe_result['status'] ?? '', $allowed_statuses)) {
        $error_msg = $stripe_result['error']['message'] ?? 'Payment was declined by the bank.';
        jsonResponse(false, 'Payment error: ' . $error_msg);
    }
}


// =============================================================================
// §5  PERSIST ORDER TO DATABASE
//     Two inserts: one row in `orders`, then one row per item in `order_items`.
//     All queries use prepared statements.
// =============================================================================

// ── Insert the parent order record ───────────────────────────────────────────
$stmt = $conn->prepare('INSERT INTO orders (customer_name, customer_phone, total_amount, notes) VALUES (?, ?, ?, ?)');
$stmt->bind_param('ssds', $name, $phone, $total, $notes);
$stmt->execute();
$order_id = $stmt->insert_id;

// ── Insert each cart item as an order_items row ───────────────────────────────
foreach ($cart as $item) {
    $stmt = $conn->prepare(
        'INSERT INTO order_items (order_id, item_name, category, price, quantity, size, ingredients, sauces)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );

    $size        = $item['size']        ?? null;
    $ingredients = !empty($item['ingredients']) ? implode(', ', $item['ingredients']) : null;
    $sauces      = !empty($item['sauces'])      ? implode(', ', $item['sauces'])      : null;

    $stmt->bind_param('issdisss',
        $order_id,
        $item['name'],
        $item['category'],
        $item['price'],
        $item['qty'],
        $size,
        $ingredients,
        $sauces
    );
    $stmt->execute();
}


// =============================================================================
// §6  EMAIL NOTIFICATIONS
//     Sends an HTML receipt to the customer and a copy to the restaurant.
//     Disabled on localhost (mail() requires a configured SMTP server).
//     Uncomment the @mail() lines once deployed on a real web host.
// =============================================================================

$restaurant_email = 'orders@chickencurrymessina.com'; // ← Update with real email

if (!empty($email)) {
    $subject = "Your Order is Confirmed! (Order #$order_id)";

    // Build the HTML email body
    // NOTE: $name is escaped to prevent XSS if this email is ever opened in a browser
    $safe_name = htmlspecialchars($name, ENT_QUOTES, 'UTF-8');
    $message   = "
    <html>
    <head><title>Chicken Curry Messina - Receipt</title></head>
    <body style='font-family: Arial, sans-serif; color: #333; line-height: 1.6;'>
        <div style='max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 8px;'>
            <h1 style='color: #D4AF37; text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 10px;'>Chicken Curry</h1>
            <p style='font-size: 16px;'>Hi <strong>{$safe_name}</strong>,</p>
            <p style='font-size: 16px;'>Thank you for your order! Your payment of <strong>€" . number_format($total, 2) . "</strong> was securely processed.</p>

            <h3 style='margin-top: 25px; border-bottom: 1px solid #eee; padding-bottom: 5px;'>Order Details (Order #$order_id):</h3>
            <ul style='list-style-type: none; padding-left: 0;'>";

    foreach ($cart as $item) {
        $item_total = number_format($item['price'] * $item['qty'], 2);
        $message   .= "<li style='padding: 8px 0; border-bottom: 1px solid #eee; display: flex; justify-content: space-between;'>
                        <span>{$item['qty']}x {$item['name']}</span>
                        <span style='font-weight: bold;'>€{$item_total}</span>
                      </li>";
    }

    $message .= "
            </ul>
            <p style='font-size: 16px; margin-top: 25px;'>Your order has been sent to our kitchen and we are preparing it fresh!</p>
            <br>
            <p style='font-style: italic; color: #666; text-align: center;'>Grazie mille,<br>Chicken Curry Messina Team</p>
        </div>
    </body>
    </html>
    ";

    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8\r\n";
    $headers .= "From: no-reply@chickencurrymessina.com\r\n";

    // Uncomment once deployed on a web host with SMTP configured:
    // @mail($email,             $subject,                                     $message, $headers);
    // @mail($restaurant_email,  "NEW ORDER #$order_id — $name",               $message, $headers);
}


// =============================================================================
// §7  RESPOND WITH SUCCESS
// =============================================================================

jsonResponse(true, 'Order placed successfully', [
    'order_id' => $order_id,
]);
