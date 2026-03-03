<?php
/**
 * get_kebab_data.php — Kebab Builder Data API Endpoint
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  /get_kebab_data.php
 *
 * Returns all active ingredients, sauces, and sizes needed to power the
 * interactive Kebab Builder on menu.html.
 * Items are filtered to is_active = 1 so disabled options don't appear.
 *
 * Response shape:
 *  {
 *    "success": true,
 *    "message": "Kebab data loaded",
 *    "data": {
 *      "ingredients": [ ...ingredient rows ],
 *      "sauces":      [ ...sauce rows ],
 *      "sizes":       [ ...size rows ]
 *    }
 *  }
 *
 * Used by: menu.js → loadKebabData()
 * ─────────────────────────────────────────────────────────────────────────────
 */

header('Content-Type: application/json');
require_once 'db.php';
require_once 'helpers.php';

// ─── Fetch active ingredients ─────────────────────────────────────────────────
$ingredients = [];
$res = $conn->query('SELECT * FROM ingredients WHERE is_active = 1');
while ($row = $res->fetch_assoc()) {
    $ingredients[] = $row;
}

// ─── Fetch active sauces ──────────────────────────────────────────────────────
$sauces = [];
$res = $conn->query('SELECT * FROM sauces WHERE is_active = 1');
while ($row = $res->fetch_assoc()) {
    $sauces[] = $row;
}

// ─── Fetch active sizes ───────────────────────────────────────────────────────
$sizes = [];
$res = $conn->query('SELECT * FROM sizes WHERE is_active = 1');
while ($row = $res->fetch_assoc()) {
    $sizes[] = $row;
}

jsonResponse(true, 'Kebab data loaded', [
    'ingredients' => $ingredients,
    'sauces'      => $sauces,
    'sizes'       => $sizes,
]);
