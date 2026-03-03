<?php
/**
 * helpers.php — Shared Utility Functions
 * ─────────────────────────────────────────────────────────────────────────────
 * Lightweight helper used by every API endpoint to send a consistent JSON
 * response and immediately terminate execution.
 *
 * Include with:  require_once 'helpers.php';
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Sends a standardised JSON response and exits.
 *
 * Every API endpoint MUST call this instead of raw echo to ensure a consistent
 * response shape that the frontend can reliably parse.
 *
 * Response shape:
 *  { "success": bool, "message": string, "data": mixed }
 *
 * @param bool   $success  Whether the operation succeeded.
 * @param string $message  Human-readable status message.
 * @param mixed  $data     Payload to return (array, object, or empty array).
 */
function jsonResponse(bool $success, string $message, $data = []): void {
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data'    => $data,
    ]);
    exit;
}
