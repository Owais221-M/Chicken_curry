<?php
/**
 * get_menu.php — Menu Items API Endpoint
 * ─────────────────────────────────────────────────────────────────────────────
 * GET  /get_menu.php
 *
 * Returns all active menu items (biryanis and curries) as JSON.
 * Items are filtered to is_active = 1 so disabled items don't appear on the frontend.
 *
 * Response shape:
 *  { "success": true, "message": "Menu loaded", "data": [ ...menu_items ] }
 *
 * Used by: menu.js → loadMenuFromDB()
 * ─────────────────────────────────────────────────────────────────────────────
 */

header('Content-Type: application/json');
require_once 'db.php';
require_once 'helpers.php';

$result = $conn->query('SELECT * FROM menu_items WHERE is_active = 1');

$menu = [];
while ($row = $result->fetch_assoc()) {
    $menu[] = $row;
}

jsonResponse(true, 'Menu loaded', $menu);
