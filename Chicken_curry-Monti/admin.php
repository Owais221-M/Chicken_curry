<?php
session_start();
require_once 'db.php';

// ─── AUTO-MIGRATION ──────────────────────────────────────────────────────
// Creates new tables & columns if they don't exist. Safe to run on every load.

$conn->query("CREATE TABLE IF NOT EXISTS `offers` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(150) NOT NULL,
  `description` text DEFAULT NULL,
  `discount_type` enum('percentage','fixed','freebie') DEFAULT 'percentage',
  `discount_value` decimal(10,2) NOT NULL DEFAULT 0.00,
  `min_order_amount` decimal(10,2) DEFAULT 0.00,
  `coupon_code` varchar(30) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

$conn->query("CREATE TABLE IF NOT EXISTS `settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(50) NOT NULL,
  `setting_value` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

// Add description column to menu_items if missing
$descCheck = $conn->query("SHOW COLUMNS FROM `menu_items` LIKE 'description'");
if ($descCheck && $descCheck->num_rows === 0) {
    $conn->query("ALTER TABLE `menu_items` ADD COLUMN `description` TEXT DEFAULT NULL AFTER `category`");
}

// Add customer_email and order_type columns to orders if missing
$emailCheck = $conn->query("SHOW COLUMNS FROM `orders` LIKE 'customer_email'");
if ($emailCheck && $emailCheck->num_rows === 0) {
    $conn->query("ALTER TABLE `orders` ADD COLUMN `customer_email` VARCHAR(200) DEFAULT NULL AFTER `customer_phone`");
}
$otCheck = $conn->query("SHOW COLUMNS FROM `orders` LIKE 'order_type'");
if ($otCheck && $otCheck->num_rows === 0) {
    $conn->query("ALTER TABLE `orders` ADD COLUMN `order_type` ENUM('pickup','delivery') DEFAULT 'pickup' AFTER `total_amount`");
}

// Seed default settings if table is empty
$sCount = $conn->query("SELECT COUNT(*) as c FROM settings");
if ($sCount && $sCount->fetch_assoc()['c'] == 0) {
    $defaults = [
        ['restaurant_name', 'Chicken Curry Messina'],
        ['phone', '+39 371 577 7402'],
        ['email', 'info@chickencurrymessina.it'],
        ['address', 'Via G. Garibaldi, 114f, 98122 Messina ME, Italy'],
        ['opening_hours', 'Mon-Sun: 11:00 - 23:00'],
        ['delivery_fee', '2.00'],
        ['min_delivery_order', '15.00'],
        ['instagram_url', 'https://www.instagram.com/chicken_curry/profilecard/?igsh=MTY0NzI3bzY5b2d1MA%3D%3D'],
    ];
    $ins = $conn->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)");
    foreach ($defaults as $d) {
        $ins->bind_param("ss", $d[0], $d[1]);
        $ins->execute();
    }
}

// ─── IMAGE UPLOAD HELPER ─────────────────────────────────────────────────
function handleImageUpload($fieldName) {
    if (!isset($_FILES[$fieldName]) || $_FILES[$fieldName]['error'] !== UPLOAD_ERR_OK) {
        return null; // No file uploaded
    }
    $file = $_FILES[$fieldName];
    $allowed = ['image/jpeg','image/png','image/webp','image/gif'];
    if (!in_array($file['type'], $allowed)) return false;
    if ($file['size'] > 5 * 1024 * 1024) return false; // 5MB max

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $safeName = preg_replace('/[^a-z0-9_-]/', '', strtolower(pathinfo($file['name'], PATHINFO_FILENAME)));
    if (empty($safeName)) $safeName = 'upload';
    $filename = $safeName . '_' . time() . '.' . $ext;
    $dest = __DIR__ . '/images/' . $filename;

    if (!is_dir(__DIR__ . '/images')) mkdir(__DIR__ . '/images', 0755, true);
    if (move_uploaded_file($file['tmp_name'], $dest)) {
        return 'images/' . $filename;
    }
    return false;
}

// ─── API ROUTER ──────────────────────────────────────────────────────────
if (isset($_GET['api'])) {
    header('Content-Type: application/json');

    if (!isset($_SESSION['admin_logged_in'])) {
        http_response_code(401);
        exit(json_encode(['success' => false, 'message' => 'Unauthorized']));
    }

    $api = $_GET['api'];

    // — Dashboard —
    if ($api === 'get_dashboard_stats') {
        $todayOrders  = $conn->query("SELECT COUNT(*) as c FROM orders WHERE DATE(created_at) = CURDATE()")->fetch_assoc()['c'];
        $todayRevenue = $conn->query("SELECT COALESCE(SUM(total_amount),0) as t FROM orders WHERE DATE(created_at) = CURDATE() AND status != 'cancelled'")->fetch_assoc()['t'];
        $pending      = $conn->query("SELECT COUNT(*) as c FROM orders WHERE status = 'pending'")->fetch_assoc()['c'];
        $activeItems  = $conn->query("SELECT COUNT(*) as c FROM menu_items WHERE is_active = 1")->fetch_assoc()['c'];
        $weekRevenue  = $conn->query("SELECT COALESCE(SUM(total_amount),0) as t FROM orders WHERE YEARWEEK(created_at,1) = YEARWEEK(CURDATE(),1) AND status != 'cancelled'")->fetch_assoc()['t'];

        $recent = [];
        $r = $conn->query("SELECT id, customer_name, total_amount, status, created_at FROM orders ORDER BY created_at DESC LIMIT 10");
        while ($row = $r->fetch_assoc()) $recent[] = $row;

        $popular = [];
        $r = $conn->query("SELECT item_name, SUM(quantity) as total_qty FROM order_items GROUP BY item_name ORDER BY total_qty DESC LIMIT 5");
        while ($row = $r->fetch_assoc()) $popular[] = $row;

        exit(json_encode(['success' => true, 'data' => [
            'today_orders' => (int)$todayOrders, 'today_revenue' => (float)$todayRevenue,
            'pending_orders' => (int)$pending, 'active_items' => (int)$activeItems,
            'week_revenue' => (float)$weekRevenue, 'recent_orders' => $recent, 'popular_items' => $popular
        ]]));
    }

    // — Orders —
    if ($api === 'get_orders') {
        $stmt = $conn->query("SELECT *, (UNIX_TIMESTAMP(created_at) * 1000) AS created_ts_ms FROM orders ORDER BY created_at DESC LIMIT 50");
        $orders = [];
        while ($order = $stmt->fetch_assoc()) {
            $items = [];
            $is = $conn->prepare("SELECT * FROM order_items WHERE order_id = ?");
            $is->bind_param("i", $order['id']);
            $is->execute();
            $ir = $is->get_result();
            while ($item = $ir->fetch_assoc()) $items[] = $item;
            $order['items'] = $items;
            $orders[] = $order;
        }
        exit(json_encode(['success' => true, 'data' => $orders]));
    }

    if ($api === 'update_status') {
        $input = json_decode(file_get_contents('php://input'), true);
        $oid = intval($input['order_id'] ?? 0);
        $status = $input['status'] ?? '';
        $valid = ['pending','preparing','ready','completed','cancelled'];
        if (!$oid || !in_array($status, $valid)) exit(json_encode(['success' => false, 'message' => 'Invalid input']));
        $stmt = $conn->prepare("UPDATE orders SET status = ? WHERE id = ?");
        $stmt->bind_param("si", $status, $oid);
        exit(json_encode(['success' => $stmt->execute()]));
    }

    // — Menu Items —
    if ($api === 'get_menu_items') {
        $rows = [];
        $r = $conn->query("SELECT * FROM menu_items ORDER BY category, name");
        while ($row = $r->fetch_assoc()) $rows[] = $row;
        exit(json_encode(['success' => true, 'data' => $rows]));
    }

    if ($api === 'save_menu_item') {
        $id = intval($_POST['id'] ?? 0);
        $name = trim($_POST['name'] ?? '');
        $category = in_array($_POST['category'] ?? '', ['biryani','curry']) ? $_POST['category'] : 'curry';
        $description = trim($_POST['description'] ?? '');
        $base_price = floatval($_POST['base_price'] ?? 0);
        $prep_time = trim($_POST['prep_time'] ?? '');
        $spice_level = max(0, min(5, intval($_POST['spice_level'] ?? 0)));
        $is_popular = !empty($_POST['is_popular']) ? 1 : 0;
        $is_active = !empty($_POST['is_active']) ? 1 : 0;
        $is_halal = !empty($_POST['is_halal']) ? 1 : 0;
        $is_gluten_free = !empty($_POST['is_gluten_free']) ? 1 : 0;
        $allergens = trim($_POST['allergens'] ?? '');

        if ($name === '' || $base_price <= 0) exit(json_encode(['success' => false, 'message' => 'Name and valid price required']));

        $image_url = $_POST['existing_image'] ?? '';
        $uploaded = handleImageUpload('image');
        if ($uploaded === false) exit(json_encode(['success' => false, 'message' => 'Invalid image (jpg/png/webp/gif, max 5MB)']));
        if ($uploaded !== null) $image_url = $uploaded;

        if ($id > 0) {
            $stmt = $conn->prepare("UPDATE menu_items SET name=?, category=?, description=?, base_price=?, image_url=?, prep_time=?, spice_level=?, is_popular=?, is_active=?, is_halal=?, is_gluten_free=?, allergens=? WHERE id=?");
            $stmt->bind_param("sssdssiiiissi", $name, $category, $description, $base_price, $image_url, $prep_time, $spice_level, $is_popular, $is_active, $is_halal, $is_gluten_free, $allergens, $id);
        } else {
            $stmt = $conn->prepare("INSERT INTO menu_items (name,category,description,base_price,image_url,prep_time,spice_level,is_popular,is_active,is_halal,is_gluten_free,allergens) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
            $stmt->bind_param("sssdssiiiiss", $name, $category, $description, $base_price, $image_url, $prep_time, $spice_level, $is_popular, $is_active, $is_halal, $is_gluten_free, $allergens);
        }
        $ok = $stmt->execute();
        exit(json_encode(['success' => $ok, 'message' => $ok ? ($id > 0 ? 'Item updated' : 'Item added') : 'Database error']));
    }

    if ($api === 'delete_menu_item') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = intval($input['id'] ?? 0);
        if ($id <= 0) exit(json_encode(['success' => false, 'message' => 'Invalid ID']));
        $stmt = $conn->prepare("DELETE FROM menu_items WHERE id = ?");
        $stmt->bind_param("i", $id);
        exit(json_encode(['success' => $stmt->execute()]));
    }

    if ($api === 'toggle_menu_item') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = intval($input['id'] ?? 0);
        $active = !empty($input['is_active']) ? 1 : 0;
        $stmt = $conn->prepare("UPDATE menu_items SET is_active = ? WHERE id = ?");
        $stmt->bind_param("ii", $active, $id);
        exit(json_encode(['success' => $stmt->execute()]));
    }

    // — Ingredients —
    if ($api === 'get_ingredients') {
        $rows = [];
        $r = $conn->query("SELECT * FROM ingredients ORDER BY name");
        while ($row = $r->fetch_assoc()) $rows[] = $row;
        exit(json_encode(['success' => true, 'data' => $rows]));
    }

    if ($api === 'save_ingredient') {
        $id = intval($_POST['id'] ?? 0);
        $name = trim($_POST['name'] ?? '');
        $price = floatval($_POST['price'] ?? 0);
        $icon = trim($_POST['icon'] ?? '');
        $is_active = !empty($_POST['is_active']) ? 1 : 0;

        if ($name === '') exit(json_encode(['success' => false, 'message' => 'Name is required']));

        $image_url = $_POST['existing_image'] ?? '';
        $uploaded = handleImageUpload('image');
        if ($uploaded === false) exit(json_encode(['success' => false, 'message' => 'Invalid image']));
        if ($uploaded !== null) $image_url = $uploaded;

        if ($id > 0) {
            $stmt = $conn->prepare("UPDATE ingredients SET name=?, price=?, icon=?, image_url=?, is_active=? WHERE id=?");
            $stmt->bind_param("sdssii", $name, $price, $icon, $image_url, $is_active, $id);
        } else {
            $stmt = $conn->prepare("INSERT INTO ingredients (name,price,icon,image_url,is_active) VALUES (?,?,?,?,?)");
            $stmt->bind_param("sdssi", $name, $price, $icon, $image_url, $is_active);
        }
        $ok = $stmt->execute();
        exit(json_encode(['success' => $ok, 'message' => $ok ? 'Saved' : 'Error']));
    }

    if ($api === 'delete_ingredient') {
        $input = json_decode(file_get_contents('php://input'), true);
        $stmt = $conn->prepare("DELETE FROM ingredients WHERE id = ?");
        $id = intval($input['id'] ?? 0);
        $stmt->bind_param("i", $id);
        exit(json_encode(['success' => $stmt->execute()]));
    }

    // — Sauces —
    if ($api === 'get_sauces') {
        $rows = [];
        $r = $conn->query("SELECT * FROM sauces ORDER BY name");
        while ($row = $r->fetch_assoc()) $rows[] = $row;
        exit(json_encode(['success' => true, 'data' => $rows]));
    }

    if ($api === 'save_sauce') {
        $id = intval($_POST['id'] ?? 0);
        $name = trim($_POST['name'] ?? '');
        $price = floatval($_POST['price'] ?? 0);
        $icon = trim($_POST['icon'] ?? '');
        $is_active = !empty($_POST['is_active']) ? 1 : 0;

        if ($name === '') exit(json_encode(['success' => false, 'message' => 'Name is required']));

        $image_url = $_POST['existing_image'] ?? '';
        $uploaded = handleImageUpload('image');
        if ($uploaded === false) exit(json_encode(['success' => false, 'message' => 'Invalid image']));
        if ($uploaded !== null) $image_url = $uploaded;

        if ($id > 0) {
            $stmt = $conn->prepare("UPDATE sauces SET name=?, price=?, icon=?, image_url=?, is_active=? WHERE id=?");
            $stmt->bind_param("sdssii", $name, $price, $icon, $image_url, $is_active, $id);
        } else {
            $stmt = $conn->prepare("INSERT INTO sauces (name,price,icon,image_url,is_active) VALUES (?,?,?,?,?)");
            $stmt->bind_param("sdssi", $name, $price, $icon, $image_url, $is_active);
        }
        $ok = $stmt->execute();
        exit(json_encode(['success' => $ok, 'message' => $ok ? 'Saved' : 'Error']));
    }

    if ($api === 'delete_sauce') {
        $input = json_decode(file_get_contents('php://input'), true);
        $stmt = $conn->prepare("DELETE FROM sauces WHERE id = ?");
        $id = intval($input['id'] ?? 0);
        $stmt->bind_param("i", $id);
        exit(json_encode(['success' => $stmt->execute()]));
    }

    // — Sizes —
    if ($api === 'get_sizes') {
        $rows = [];
        $r = $conn->query("SELECT * FROM sizes ORDER BY price");
        while ($row = $r->fetch_assoc()) $rows[] = $row;
        exit(json_encode(['success' => true, 'data' => $rows]));
    }

    if ($api === 'save_size') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = intval($input['id'] ?? 0);
        $name = trim($input['name'] ?? '');
        $price = floatval($input['price'] ?? 0);
        $is_active = !empty($input['is_active']) ? 1 : 0;

        if ($name === '' || $price <= 0) exit(json_encode(['success' => false, 'message' => 'Name and price required']));

        if ($id > 0) {
            $stmt = $conn->prepare("UPDATE sizes SET name=?, price=?, is_active=? WHERE id=?");
            $stmt->bind_param("sdii", $name, $price, $is_active, $id);
        } else {
            $stmt = $conn->prepare("INSERT INTO sizes (name,price,is_active) VALUES (?,?,?)");
            $stmt->bind_param("sdi", $name, $price, $is_active);
        }
        $ok = $stmt->execute();
        exit(json_encode(['success' => $ok, 'message' => $ok ? 'Saved' : 'Error']));
    }

    if ($api === 'delete_size') {
        $input = json_decode(file_get_contents('php://input'), true);
        $stmt = $conn->prepare("DELETE FROM sizes WHERE id = ?");
        $id = intval($input['id'] ?? 0);
        $stmt->bind_param("i", $id);
        exit(json_encode(['success' => $stmt->execute()]));
    }

    // — Offers —
    if ($api === 'get_offers') {
        $rows = [];
        $r = $conn->query("SELECT * FROM offers ORDER BY created_at DESC");
        while ($row = $r->fetch_assoc()) $rows[] = $row;
        exit(json_encode(['success' => true, 'data' => $rows]));
    }

    if ($api === 'save_offer') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = intval($input['id'] ?? 0);
        $title = trim($input['title'] ?? '');
        $description = trim($input['description'] ?? '');
        $discount_type = in_array($input['discount_type'] ?? '', ['percentage','fixed','freebie']) ? $input['discount_type'] : 'percentage';
        $discount_value = floatval($input['discount_value'] ?? 0);
        $min_order = floatval($input['min_order_amount'] ?? 0);
        $coupon_code = trim($input['coupon_code'] ?? '') ?: null;
        $is_active = !empty($input['is_active']) ? 1 : 0;
        $start_date = !empty($input['start_date']) ? $input['start_date'] : null;
        $end_date = !empty($input['end_date']) ? $input['end_date'] : null;

        if ($title === '') exit(json_encode(['success' => false, 'message' => 'Title is required']));

        if ($id > 0) {
            $stmt = $conn->prepare("UPDATE offers SET title=?, description=?, discount_type=?, discount_value=?, min_order_amount=?, coupon_code=?, is_active=?, start_date=?, end_date=? WHERE id=?");
            $stmt->bind_param("sssddsissi", $title, $description, $discount_type, $discount_value, $min_order, $coupon_code, $is_active, $start_date, $end_date, $id);
        } else {
            $stmt = $conn->prepare("INSERT INTO offers (title,description,discount_type,discount_value,min_order_amount,coupon_code,is_active,start_date,end_date) VALUES (?,?,?,?,?,?,?,?,?)");
            $stmt->bind_param("sssddsiss", $title, $description, $discount_type, $discount_value, $min_order, $coupon_code, $is_active, $start_date, $end_date);
        }
        $ok = $stmt->execute();
        exit(json_encode(['success' => $ok, 'message' => $ok ? 'Saved' : 'Error']));
    }

    if ($api === 'delete_offer') {
        $input = json_decode(file_get_contents('php://input'), true);
        $stmt = $conn->prepare("DELETE FROM offers WHERE id = ?");
        $id = intval($input['id'] ?? 0);
        $stmt->bind_param("i", $id);
        exit(json_encode(['success' => $stmt->execute()]));
    }

    if ($api === 'toggle_offer') {
        $input = json_decode(file_get_contents('php://input'), true);
        $id = intval($input['id'] ?? 0);
        $active = !empty($input['is_active']) ? 1 : 0;
        $stmt = $conn->prepare("UPDATE offers SET is_active = ? WHERE id = ?");
        $stmt->bind_param("ii", $active, $id);
        exit(json_encode(['success' => $stmt->execute()]));
    }

    // — Settings —
    if ($api === 'get_settings') {
        $rows = [];
        $r = $conn->query("SELECT setting_key, setting_value FROM settings");
        while ($row = $r->fetch_assoc()) $rows[$row['setting_key']] = $row['setting_value'];
        exit(json_encode(['success' => true, 'data' => $rows]));
    }

    if ($api === 'save_settings') {
        $input = json_decode(file_get_contents('php://input'), true);
        $settings = $input['settings'] ?? [];
        $stmt = $conn->prepare("INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
        foreach ($settings as $key => $value) {
            $k = substr(trim($key), 0, 50);
            $v = trim($value);
            $stmt->bind_param("ss", $k, $v);
            $stmt->execute();
        }
        exit(json_encode(['success' => true, 'message' => 'Settings saved']));
    }

    // — Password —
    if ($api === 'change_password') {
        $input = json_decode(file_get_contents('php://input'), true);
        $current = $input['current_password'] ?? '';
        $newPass = $input['new_password'] ?? '';
        $confirm = $input['confirm_password'] ?? '';

        if (strlen($newPass) < 6) exit(json_encode(['success' => false, 'message' => 'New password must be at least 6 characters']));
        if ($newPass !== $confirm) exit(json_encode(['success' => false, 'message' => 'Passwords do not match']));

        $stmt = $conn->prepare("SELECT password_hash FROM admins WHERE id = ?");
        $stmt->bind_param("i", $_SESSION['admin_id']);
        $stmt->execute();
        $admin = $stmt->get_result()->fetch_assoc();

        if (!$admin || !password_verify($current, $admin['password_hash'])) {
            exit(json_encode(['success' => false, 'message' => 'Current password is incorrect']));
        }

        $hash = password_hash($newPass, PASSWORD_DEFAULT);
        $stmt = $conn->prepare("UPDATE admins SET password_hash = ? WHERE id = ?");
        $stmt->bind_param("si", $hash, $_SESSION['admin_id']);
        $ok = $stmt->execute();
        exit(json_encode(['success' => $ok, 'message' => $ok ? 'Password changed' : 'Error']));
    }

    // Unknown endpoint
    http_response_code(404);
    exit(json_encode(['success' => false, 'message' => 'Unknown endpoint']));
}

// ─── LOGIN HANDLER ───────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['action'] ?? '') === 'login') {
    header('Content-Type: application/json');
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    $stmt = $conn->prepare("SELECT id, password_hash FROM admins WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($admin = $result->fetch_assoc()) {
        if (password_verify($password, $admin['password_hash'])) {
            session_regenerate_id(true);
            $_SESSION['admin_logged_in'] = true;
            $_SESSION['admin_id'] = $admin['id'];
            $_SESSION['admin_username'] = $username;
            exit(json_encode(['success' => true]));
        }
    }
    exit(json_encode(['success' => false, 'message' => 'Invalid username or password']));
}

// ─── LOGOUT ──────────────────────────────────────────────────────────────
if (($_GET['action'] ?? '') === 'logout') {
    session_destroy();
    header("Location: admin.php");
    exit;
}

$is_logged_in = isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Panel | Chicken Curry Messina</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: { 'spice-gold': '#D4AF37', 'warm-amber': '#FF8C00' },
                    fontFamily: { sans: ['Outfit','sans-serif'], serif: ['Playfair Display','serif'] }
                }
            }
        }
    </script>
</head>
<body class="bg-gray-950 text-white font-sans min-h-screen">

<?php if (!$is_logged_in): ?>
<!-- ═══════════════════ LOGIN SCREEN ═══════════════════ -->
<div class="flex items-center justify-center min-h-screen bg-black">
    <div class="bg-gray-900 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-spice-gold/20">
        <div class="text-center mb-8">
            <h1 class="text-3xl font-serif font-bold text-spice-gold mb-2">Chicken Curry</h1>
            <p class="text-gray-400 text-sm">Messina — Admin Panel</p>
        </div>
        <form id="loginForm" class="space-y-4">
            <input type="hidden" name="action" value="login">
            <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">Username</label>
                <input type="text" name="username" required class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-spice-gold transition">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">Password</label>
                <input type="password" name="password" required class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-spice-gold transition">
            </div>
            <div id="loginError" class="text-red-400 text-sm hidden"></div>
            <button type="submit" class="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold py-3 rounded-lg hover:scale-[1.02] transition-transform mt-2">
                Sign In
            </button>
        </form>
    </div>
</div>
<script>
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
        const res = await fetch('admin.php', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) { window.location.reload(); }
        else { const err = document.getElementById('loginError'); err.textContent = data.message; err.classList.remove('hidden'); }
    } catch (err) { console.error(err); }
});
</script>

<?php else: ?>
<!-- ═══════════════════ ADMIN PANEL ═══════════════════ -->

<!-- Sidebar Overlay (mobile) -->
<div id="sidebar-overlay" class="fixed inset-0 bg-black/60 z-30 hidden lg:hidden" onclick="toggleSidebar()"></div>

<!-- Sidebar -->
<aside id="sidebar" class="fixed left-0 top-0 h-full w-64 bg-gray-900 border-r border-gray-800 z-40 flex flex-col transform -translate-x-full lg:translate-x-0 transition-transform duration-200">
    <div class="p-5 border-b border-gray-800">
        <h1 class="text-lg font-serif font-bold text-spice-gold">Chicken Curry</h1>
        <p class="text-[11px] text-gray-500 mt-0.5">Admin Panel — Messina</p>
    </div>
    <nav class="flex-1 p-3 space-y-1 overflow-y-auto">
        <button onclick="showSection('dashboard')" data-nav="dashboard" class="nav-btn w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition">
            <i data-lucide="layout-dashboard" class="w-[18px] h-[18px]"></i> Dashboard
        </button>
        <button onclick="showSection('orders')" data-nav="orders" class="nav-btn w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition">
            <i data-lucide="shopping-bag" class="w-[18px] h-[18px]"></i> Orders
            <span id="nav-pending-badge" class="ml-auto bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full hidden">0</span>
        </button>
        <button onclick="showSection('menu')" data-nav="menu" class="nav-btn w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition">
            <i data-lucide="book-open" class="w-[18px] h-[18px]"></i> Menu Items
        </button>
        <button onclick="showSection('kebab')" data-nav="kebab" class="nav-btn w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition">
            <i data-lucide="layers" class="w-[18px] h-[18px]"></i> Kebab Builder
        </button>
        <button onclick="showSection('offers')" data-nav="offers" class="nav-btn w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition">
            <i data-lucide="tag" class="w-[18px] h-[18px]"></i> Offers
        </button>
        <button onclick="showSection('settings')" data-nav="settings" class="nav-btn w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition">
            <i data-lucide="settings" class="w-[18px] h-[18px]"></i> Settings
        </button>
    </nav>
    <div class="p-4 border-t border-gray-800 flex items-center justify-between">
        <span class="text-xs text-gray-500"><?= htmlspecialchars($_SESSION['admin_username']) ?></span>
        <a href="admin.php?action=logout" class="text-red-400 hover:text-red-300 text-xs flex items-center gap-1">
            <i data-lucide="log-out" class="w-3.5 h-3.5"></i> Logout
        </a>
    </div>
</aside>

<!-- Main Content -->
<div class="lg:ml-64 min-h-screen flex flex-col">
    <!-- Mobile Header -->
    <header class="lg:hidden bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <button onclick="toggleSidebar()" class="text-gray-400 hover:text-white"><i data-lucide="menu" class="w-6 h-6"></i></button>
        <h1 class="text-base font-serif text-spice-gold">Admin Panel</h1>
        <a href="admin.php?action=logout" class="text-red-400 hover:text-red-300"><i data-lucide="log-out" class="w-5 h-5"></i></a>
    </header>

    <!-- ══════ DASHBOARD ══════ -->
    <section id="section-dashboard" class="p-4 md:p-6">
        <h2 class="text-2xl font-bold text-white mb-6">Dashboard</h2>
        <div id="dashboard-stats" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"></div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <h3 class="text-base font-semibold text-white mb-4">Recent Orders</h3>
                <div id="dashboard-recent" class="space-y-2 max-h-80 overflow-y-auto"></div>
            </div>
            <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <h3 class="text-base font-semibold text-white mb-4">Popular Items</h3>
                <div id="dashboard-popular" class="space-y-2"></div>
            </div>
        </div>
    </section>

    <!-- ══════ ORDERS (KDS) ══════ -->
    <section id="section-orders" class="p-4 md:p-6 hidden">
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-2xl font-bold text-white">Orders</h2>
            <span class="text-sm text-gray-400 bg-gray-800 px-3 py-1 rounded-full flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Live — refreshes every 15s
            </span>
        </div>
        <div class="flex gap-4 overflow-x-auto pb-4" style="min-height:calc(100vh - 180px)">
            <!-- Pending -->
            <div class="flex-shrink-0 w-72 bg-gray-900/60 rounded-xl border border-gray-800 flex flex-col">
                <div class="p-3 border-b border-gray-800 bg-gray-900 rounded-t-xl flex justify-between items-center">
                    <span class="font-semibold text-sm flex items-center gap-1.5"><i data-lucide="bell-ring" class="w-4 h-4 text-red-500"></i> New Orders</span>
                    <span id="count-pending" class="bg-red-500 text-[10px] px-1.5 py-0.5 rounded-full text-white">0</span>
                </div>
                <div id="col-pending" class="p-3 flex-1 overflow-y-auto space-y-3"></div>
            </div>
            <!-- Preparing -->
            <div class="flex-shrink-0 w-72 bg-gray-900/60 rounded-xl border border-gray-800 flex flex-col">
                <div class="p-3 border-b border-gray-800 bg-gray-900 rounded-t-xl flex justify-between items-center">
                    <span class="font-semibold text-sm flex items-center gap-1.5"><i data-lucide="chef-hat" class="w-4 h-4 text-amber-500"></i> Preparing</span>
                    <span id="count-preparing" class="bg-warm-amber text-[10px] px-1.5 py-0.5 rounded-full text-black">0</span>
                </div>
                <div id="col-preparing" class="p-3 flex-1 overflow-y-auto space-y-3"></div>
            </div>
            <!-- Ready -->
            <div class="flex-shrink-0 w-72 bg-gray-900/60 rounded-xl border border-gray-800 flex flex-col">
                <div class="p-3 border-b border-gray-800 bg-gray-900 rounded-t-xl flex justify-between items-center">
                    <span class="font-semibold text-sm flex items-center gap-1.5"><i data-lucide="package-check" class="w-4 h-4 text-green-500"></i> Ready</span>
                    <span id="count-ready" class="bg-green-500 text-[10px] px-1.5 py-0.5 rounded-full text-black">0</span>
                </div>
                <div id="col-ready" class="p-3 flex-1 overflow-y-auto space-y-3"></div>
            </div>
            <!-- Completed -->
            <div class="flex-shrink-0 w-72 bg-gray-900/60 rounded-xl border border-gray-800 flex flex-col opacity-60">
                <div class="p-3 border-b border-gray-800 bg-gray-900 rounded-t-xl flex justify-between items-center">
                    <span class="font-semibold text-sm flex items-center gap-1.5"><i data-lucide="check-circle" class="w-4 h-4 text-gray-500"></i> Completed</span>
                    <span id="count-completed" class="bg-gray-600 text-[10px] px-1.5 py-0.5 rounded-full text-white">0</span>
                </div>
                <div id="col-completed" class="p-3 flex-1 overflow-y-auto space-y-3"></div>
            </div>
        </div>
    </section>

    <!-- ══════ MENU ITEMS ══════ -->
    <section id="section-menu" class="p-4 md:p-6 hidden">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-white">Menu Items</h2>
            <button onclick="openMenuForm()" class="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-4 py-2 rounded-lg hover:scale-[1.03] transition-transform text-sm flex items-center gap-2">
                <i data-lucide="plus" class="w-4 h-4"></i> Add Item
            </button>
        </div>
        <div id="menu-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>
    </section>

    <!-- ══════ KEBAB BUILDER ══════ -->
    <section id="section-kebab" class="p-4 md:p-6 hidden">
        <h2 class="text-2xl font-bold text-white mb-4">Kebab Builder</h2>
        <div class="flex gap-2 mb-6 border-b border-gray-800 pb-3">
            <button onclick="showKebabTab('ingredients')" data-ktab="ingredients" class="ktab-btn px-4 py-2 rounded-lg text-sm font-medium transition">Ingredients</button>
            <button onclick="showKebabTab('sauces')" data-ktab="sauces" class="ktab-btn px-4 py-2 rounded-lg text-sm font-medium transition">Sauces</button>
            <button onclick="showKebabTab('sizes')" data-ktab="sizes" class="ktab-btn px-4 py-2 rounded-lg text-sm font-medium transition">Sizes</button>
        </div>
        <div id="kebab-content"></div>
    </section>

    <!-- ══════ OFFERS ══════ -->
    <section id="section-offers" class="p-4 md:p-6 hidden">
        <div class="flex items-center justify-between mb-6">
            <h2 class="text-2xl font-bold text-white">Offers & Promotions</h2>
            <button onclick="openOfferForm()" class="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-4 py-2 rounded-lg hover:scale-[1.03] transition-transform text-sm flex items-center gap-2">
                <i data-lucide="plus" class="w-4 h-4"></i> Create Offer
            </button>
        </div>
        <div id="offers-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>
    </section>

    <!-- ══════ SETTINGS ══════ -->
    <section id="section-settings" class="p-4 md:p-6 hidden">
        <h2 class="text-2xl font-bold text-white mb-6">Settings</h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Restaurant Info -->
            <div class="bg-gray-900 rounded-xl p-6 border border-gray-800">
                <h3 class="text-lg font-semibold text-white mb-5">Restaurant Information</h3>
                <form id="settings-form" class="space-y-4">
                    <div><label class="lbl">Restaurant Name</label><input type="text" name="restaurant_name" class="inp"></div>
                    <div><label class="lbl">Phone</label><input type="text" name="phone" class="inp"></div>
                    <div><label class="lbl">Email</label><input type="email" name="email" class="inp"></div>
                    <div><label class="lbl">Address</label><input type="text" name="address" class="inp"></div>
                    <div><label class="lbl">Opening Hours</label><input type="text" name="opening_hours" class="inp" placeholder="e.g. Mon-Sun: 11:00 - 23:00"></div>
                    <div class="grid grid-cols-2 gap-4">
                        <div><label class="lbl">Delivery Fee (€)</label><input type="number" step="0.50" name="delivery_fee" class="inp"></div>
                        <div><label class="lbl">Min Delivery Order (€)</label><input type="number" step="0.50" name="min_delivery_order" class="inp"></div>
                    </div>
                    <hr class="border-gray-700 my-2">
                    <div><label class="lbl">Facebook URL</label><input type="url" name="facebook_url" class="inp" placeholder="https://facebook.com/..."></div>
                    <div><label class="lbl">Instagram URL</label><input type="url" name="instagram_url" class="inp" placeholder="https://instagram.com/..."></div>
                    <div><label class="lbl">TikTok URL</label><input type="url" name="tiktok_url" class="inp" placeholder="https://tiktok.com/@..."></div>
                    <button type="submit" class="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-6 py-2.5 rounded-lg hover:scale-[1.02] transition-transform text-sm w-full mt-2">Save Settings</button>
                </form>
            </div>
            <!-- Password -->
            <div class="bg-gray-900 rounded-xl p-6 border border-gray-800 self-start">
                <h3 class="text-lg font-semibold text-white mb-5">Change Password</h3>
                <form id="password-form" class="space-y-4">
                    <div><label class="lbl">Current Password</label><input type="password" name="current_password" required class="inp"></div>
                    <div><label class="lbl">New Password</label><input type="password" name="new_password" required minlength="6" class="inp"></div>
                    <div><label class="lbl">Confirm New Password</label><input type="password" name="confirm_password" required class="inp"></div>
                    <button type="submit" class="bg-white/10 border border-gray-600 text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-white/20 transition text-sm w-full mt-2">Update Password</button>
                </form>
            </div>
        </div>
    </section>
</div>

<!-- ═══════════════════ MODAL ═══════════════════ -->
<div id="modal" class="fixed inset-0 z-50 hidden items-center justify-center bg-black/70 p-4">
    <div class="bg-gray-900 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-800 shadow-2xl">
        <div class="p-5 border-b border-gray-800 flex justify-between items-center sticky top-0 bg-gray-900 rounded-t-2xl z-10">
            <h3 id="modal-title" class="text-lg font-bold text-white"></h3>
            <button onclick="closeModal()" class="text-gray-400 hover:text-white transition"><i data-lucide="x" class="w-5 h-5"></i></button>
        </div>
        <div id="modal-body" class="p-5"></div>
    </div>
</div>

<!-- ═══════════════════ TOAST ═══════════════════ -->
<div id="toast-container" class="fixed bottom-4 right-4 z-[70] space-y-2"></div>

<!-- ═══════════════════ STYLES ═══════════════════ -->
<style>
    .nav-btn.active { background: rgba(212,175,55,0.15); color: #D4AF37; }
    .ktab-btn { background: transparent; color: #9ca3af; }
    .ktab-btn.active { background: rgba(212,175,55,0.15); color: #D4AF37; }
    .lbl { display: block; font-size: 0.8rem; font-weight: 500; color: #9ca3af; margin-bottom: 0.25rem; }
    .inp { width: 100%; background: #111827; border: 1px solid #374151; border-radius: 0.5rem; padding: 0.625rem 0.875rem; color: white; font-size: 0.875rem; outline: none; transition: border-color 0.2s; }
    .inp:focus { border-color: #D4AF37; }
    .toggle { position: relative; width: 44px; height: 24px; background: #374151; border-radius: 9999px; cursor: pointer; transition: background 0.2s; }
    .toggle.active { background: #22c55e; }
    .toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; background: white; border-radius: 9999px; transition: transform 0.2s; }
    .toggle.active::after { transform: translateX(20px); }
    body::-webkit-scrollbar, *::-webkit-scrollbar { width: 4px; height: 4px; }
    body::-webkit-scrollbar-thumb, *::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 4px; }
    body::-webkit-scrollbar-track, *::-webkit-scrollbar-track { background: transparent; }
</style>

<script src="admin.js"></script>
<?php endif; ?>
</body>
</html>
