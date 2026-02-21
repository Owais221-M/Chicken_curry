<?php
session_start();
require_once 'db.php';

// API Endpoints
if (isset($_GET['api'])) {
    header('Content-Type: application/json');
    
    // Protect endpoints
    if (!isset($_SESSION['admin_logged_in'])) {
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        exit;
    }

    $action = $_GET['api'];

    if ($action === 'get_orders') {
        $stmt = $conn->prepare("SELECT *, (UNIX_TIMESTAMP(created_at) * 1000) AS created_ts_ms FROM orders ORDER BY created_at DESC LIMIT 50");
        $stmt->execute();
        $orders_result = $stmt->get_result();
        
        $orders = [];
        while ($order = $orders_result->fetch_assoc()) {
            // Get order items
            $item_stmt = $conn->prepare("SELECT * FROM order_items WHERE order_id = ?");
            $item_stmt->bind_param("i", $order['id']);
            $item_stmt->execute();
            $items_result = $item_stmt->get_result();
            
            $items = [];
            while ($item = $items_result->fetch_assoc()) {
                $items[] = $item;
            }
            
            $order['items'] = $items;
            $orders[] = $order;
        }
        
        echo json_encode(['success' => true, 'data' => $orders]);
        exit;
    }

    if ($action === 'update_status') {
        $input = json_decode(file_get_contents('php://input'), true);
        $order_id = $input['order_id'] ?? null;
        $status = $input['status'] ?? null;
        
        $valid_statuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
        
        if (!$order_id || !in_array($status, $valid_statuses)) {
            echo json_encode(['success' => false, 'message' => 'Invalid input']);
            exit;
        }
        
        $stmt = $conn->prepare("UPDATE orders SET status = ? WHERE id = ?");
        $stmt->bind_param("si", $status, $order_id);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Database error']);
        }
        exit;
    }
}

// Handle login POST
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'login') {
    header('Content-Type: application/json');
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    $stmt = $conn->prepare("SELECT id, password_hash FROM admins WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($admin = $result->fetch_assoc()) {
        if (password_verify($password, $admin['password_hash'])) {
            session_regenerate_id(true); // Prevent session fixation
            $_SESSION['admin_logged_in'] = true;
            $_SESSION['admin_id'] = $admin['id'];
            $_SESSION['admin_username'] = $username;
            echo json_encode(['success' => true]);
            exit;
        }
    }
    
    echo json_encode(['success' => false, 'message' => 'Invalid username or password']);
    exit;
}

// Handle logout
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    session_destroy();
    header("Location: admin.php");
    exit;
}

// If API call and fell through, 404
if (isset($_GET['api'])) {
    http_response_code(404);
    exit;
}

$is_logged_in = isset($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kitchen Display System | Chicken Curry</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600;700&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: { 'spice-gold': '#D4AF37', 'warm-amber': '#FF8C00' },
                    fontFamily: { sans: ['Outfit', 'sans-serif'], serif: ['Playfair Display', 'serif'] }
                }
            }
        }
    </script>
</head>
<body class="bg-gray-900 text-white font-sans min-h-screen">

<?php if (!$is_logged_in): ?>
    <!-- Login Screen -->
    <div class="flex items-center justify-center min-h-screen bg-black">
        <div class="bg-gray-800 p-8 rounded-2xl shadow-2xl w-full max-w-md border border-spice-gold/20">
            <h1 class="text-3xl font-serif font-bold text-spice-gold mb-6 text-center">Admin Login</h1>
            <form id="loginForm" class="space-y-4">
                <input type="hidden" name="action" value="login">
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Username</label>
                    <input type="text" name="username" required class="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-spice-gold">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-300 mb-1">Password</label>
                    <input type="password" name="password" required class="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-spice-gold">
                </div>
                <div id="loginError" class="text-red-500 text-sm hidden"></div>
                <button type="submit" class="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold py-3 rounded-lg hover:scale-105 transition-transform mt-4">
                    Enter Kitchen
                </button>
            </form>
        </div>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            try {
                const res = await fetch('admin.php', { method: 'POST', body: formData });
                const data = await res.json();
                if (data.success) {
                    window.location.reload();
                } else {
                    const err = document.getElementById('loginError');
                    err.textContent = data.message;
                    err.classList.remove('hidden');
                }
            } catch (err) {
                console.error(err);
            }
        });
    </script>

<?php else: ?>
    <!-- Dashboard Screen -->
    <header class="bg-black/95 border-b border-spice-gold/20 px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div class="flex items-center space-x-4">
            <h1 class="text-2xl font-serif font-bold text-spice-gold">Kitchen Display</h1>
            <span class="text-sm text-gray-400 bg-gray-800 px-3 py-1 rounded-full flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Live
            </span>
        </div>
        <div class="flex items-center space-x-4">
            <span class="text-gray-300">Welcome, <?= htmlspecialchars($_SESSION['admin_username']) ?></span>
            <a href="admin.php?action=logout" class="text-red-400 hover:text-red-300 flex items-center gap-1">
                <i data-lucide="log-out" class="w-4 h-4"></i> Logout
            </a>
        </div>
    </header>

    <main class="p-6">
        <div class="flex gap-6 overflow-x-auto h-[calc(100vh-100px)] pb-4">
            
            <!-- Pending Column -->
            <div id="col-wrapper-pending" class="kds-col flex-shrink-0 w-80 bg-gray-800/50 rounded-xl border border-gray-700 flex flex-col hidden-scrollbar transition-all duration-300">
                <div class="p-4 border-b border-gray-700 bg-gray-800 rounded-t-xl sticky top-0">
                    <div class="flex justify-between items-center">
                        <h2 class="font-bold text-lg text-white flex items-center gap-2">
                            <i data-lucide="bell-ring" class="w-5 h-5 text-red-500"></i> New Orders
                        </h2>
                        <div class="flex items-center gap-3">
                            <span id="count-pending" class="bg-red-500 text-xs px-2 py-1 rounded-full text-white">0</span>
                            <button onclick="toggleColumn('col-wrapper-pending')" class="text-gray-400 hover:text-white transition" title="Expand Column">
                                <i data-lucide="maximize-2" class="w-4 h-4 expand-icon"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div id="col-pending" class="p-4 flex-1 overflow-y-auto space-y-4"></div>
            </div>

            <!-- Preparing Column -->
            <div id="col-wrapper-preparing" class="kds-col flex-shrink-0 w-80 bg-gray-800/50 rounded-xl border border-gray-700 flex flex-col hidden-scrollbar transition-all duration-300">
                <div class="p-4 border-b border-gray-700 bg-gray-800 rounded-t-xl sticky top-0">
                    <div class="flex justify-between items-center">
                        <h2 class="font-bold text-lg text-white flex items-center gap-2">
                            <i data-lucide="chef-hat" class="w-5 h-5 text-amber-500"></i> Preparing
                        </h2>
                        <div class="flex items-center gap-3">
                            <span id="count-preparing" class="bg-warm-amber text-xs px-2 py-1 rounded-full text-black">0</span>
                            <button onclick="toggleColumn('col-wrapper-preparing')" class="text-gray-400 hover:text-white transition" title="Expand Column">
                                <i data-lucide="maximize-2" class="w-4 h-4 expand-icon"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div id="col-preparing" class="p-4 flex-1 overflow-y-auto space-y-4"></div>
            </div>

            <!-- Ready Column -->
            <div id="col-wrapper-ready" class="kds-col flex-shrink-0 w-80 bg-gray-800/50 rounded-xl border border-gray-700 flex flex-col hidden-scrollbar transition-all duration-300">
                <div class="p-4 border-b border-gray-700 bg-gray-800 rounded-t-xl sticky top-0">
                    <div class="flex justify-between items-center">
                        <h2 class="font-bold text-lg text-white flex items-center gap-2">
                            <i data-lucide="shopping-bag" class="w-5 h-5 text-green-500"></i> Ready
                        </h2>
                        <div class="flex items-center gap-3">
                            <span id="count-ready" class="bg-green-500 text-xs px-2 py-1 rounded-full text-black">0</span>
                            <button onclick="toggleColumn('col-wrapper-ready')" class="text-gray-400 hover:text-white transition" title="Expand Column">
                                <i data-lucide="maximize-2" class="w-4 h-4 expand-icon"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div id="col-ready" class="p-4 flex-1 overflow-y-auto space-y-4"></div>
            </div>

            <!-- Completed Column -->
            <div id="col-wrapper-completed" class="kds-col flex-shrink-0 w-80 bg-gray-800/50 rounded-xl border border-gray-700 flex flex-col hidden-scrollbar opacity-75 transition-all duration-300">
                <div class="p-4 border-b border-gray-700 bg-gray-800 rounded-t-xl sticky top-0">
                    <div class="flex justify-between items-center">
                        <h2 class="font-bold text-lg text-white flex items-center gap-2">
                            <i data-lucide="check-circle" class="w-5 h-5 text-gray-400"></i> Completed
                        </h2>
                        <div class="flex items-center gap-3">
                            <span id="count-completed" class="bg-gray-600 text-xs px-2 py-1 rounded-full text-white">0</span>
                            <button onclick="toggleColumn('col-wrapper-completed')" class="text-gray-400 hover:text-white transition" title="Expand Column">
                                <i data-lucide="maximize-2" class="w-4 h-4 expand-icon"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div id="col-completed" class="p-4 flex-1 overflow-y-auto space-y-4"></div>
            </div>

        </div>
    </main>

    <style>
        .hidden-scrollbar::-webkit-scrollbar { width: 4px; }
        .hidden-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 4px; }
    </style>

    <script>
        lucide.createIcons();

        let currentOrders = [];
        let pollingInterval;
        let expandedColumnId = null;

        function toggleColumn(colId) {
            const cols = document.querySelectorAll('.kds-col');
            const targetCol = document.getElementById(colId);
            const icon = targetCol.querySelector('.expand-icon');
            
            // To ensure grid structure doesn't break, when expanded we use w-full instead of w-80.
            if (expandedColumnId === colId) {
                // Collapse all back to normal
                cols.forEach(c => {
                    c.classList.remove('hidden', 'w-full');
                    c.classList.add('w-80');
                    if(c.id === 'col-wrapper-completed') c.classList.add('opacity-75');
                    
                    const cIcon = c.querySelector('.expand-icon');
                    if(cIcon) {
                        const svgElem = c.querySelector('svg.expand-icon');
                        // Use native outerHTML replacement or just set attribute and call createIcons again
                        if(svgElem) svgElem.outerHTML = '<i data-lucide="maximize-2" class="w-4 h-4 expand-icon"></i>';
                    }
                });
                expandedColumnId = null;
            } else {
                // Expand the selected one, hide others
                cols.forEach(c => {
                    if (c.id === colId) {
                        c.classList.remove('w-80', 'opacity-75', 'hidden');
                        c.classList.add('w-full');
                        const svgElem = c.querySelector('svg.expand-icon');
                        if(svgElem) svgElem.outerHTML = '<i data-lucide="minimize-2" class="w-4 h-4 expand-icon"></i>';
                    } else {
                        c.classList.add('hidden');
                        c.classList.remove('w-full');
                    }
                });
                expandedColumnId = colId;
            }
            lucide.createIcons();
            
            // If creating an order card layout, making them grid when expanded looks better
            cols.forEach(c => {
                 const innerList = c.querySelector('[id^="col-"]');
                 if(expandedColumnId === c.id) {
                     innerList.classList.add('grid', 'md:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4', 'gap-4');
                     innerList.classList.remove('space-y-4');
                 } else {
                     innerList.classList.remove('grid', 'md:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4', 'gap-4');
                     innerList.classList.add('space-y-4');
                 }
            });
        }

        async function fetchOrders() {
            try {
                const res = await fetch('admin.php?api=get_orders');
                const data = await res.json();
                if (data.success) {
                    renderOrders(data.data);
                } else if (data.message === 'Unauthorized') {
                    window.location.reload();
                }
            } catch (err) {
                console.error("Failed to fetch orders:", err);
            }
        }

        async function updateOrderStatus(orderId, newStatus) {
            try {
                const res = await fetch('admin.php?api=update_status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ order_id: orderId, status: newStatus })
                });
                const data = await res.json();
                if (data.success) {
                    fetchOrders(); // Immediately refresh dashboard
                } else {
                    alert(data.message || "Failed to update status");
                }
            } catch (err) {
                console.error(err);
                alert("Network error. Could not update status.");
            }
        }

        function formatTimeAgo(timestampMs) {
            const now = Date.now();
            const diffMs = Math.max(0, now - timestampMs);
            const diffMins = Math.floor(diffMs / 60000);
            
            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            const diffHours = Math.floor(diffMins / 60);
            return `${diffHours}h ago`;
        }
        
        function escapeHTML(str) {
            if (!str) return '';
            return str.replace(/[&<>'"]/g, 
                tag => ({
                    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
                }[tag])
            );
        }

        function createOrderCard(order) {
            let itemsHtml = order.items.map(item => {
                let details = '';
                if (item.category === 'kebab') {
                    details = `<div class="text-xs text-gray-400 mt-1 pl-2 border-l border-gray-600">
                        ${item.ingredients ? item.ingredients : ''} 
                        <br/> ${item.sauces ? item.sauces : ''}
                    </div>`;
                }
                return `<div class="flex justify-between text-sm py-1 border-b border-gray-700 last:border-0">
                    <div>
                        <span class="font-bold text-spice-gold">${item.quantity}x</span> ${item.item_name} ${item.size ? `(${item.size})` : ''}
                        ${details}
                    </div>
                </div>`;
            }).join('');

            let actionButtons = '';
            if (order.status === 'pending') {
                actionButtons = `<button onclick="updateOrderStatus(${order.id}, 'preparing')" class="w-full mt-3 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded transition">Start Preparing</button>`;
            } else if (order.status === 'preparing') {
                actionButtons = `<button onclick="updateOrderStatus(${order.id}, 'ready')" class="w-full mt-3 bg-warm-amber hover:bg-amber-500 text-black font-bold py-2 rounded transition">Mark Ready</button>`;
            } else if (order.status === 'ready') {
                actionButtons = `<button onclick="updateOrderStatus(${order.id}, 'completed')" class="w-full mt-3 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded transition">Complete Order</button>`;
            } else if (order.status === 'completed') {
                actionButtons = ''; // No action needed
            }

            const timeColor = order.status === 'pending' ? 'text-red-400 font-bold animate-pulse' : 'text-gray-400';

            return `
                <div class="bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-lg flex flex-col transform transition-all duration-300 ${order.status === 'pending' ? 'border-l-4 border-l-red-500' : ''}">
                    <div class="flex justify-between items-start mb-2">
                        <h3 class="font-bold text-lg text-white">#${order.id}</h3>
                        <span class="text-xs ${timeColor}">${formatTimeAgo(Number(order.created_ts_ms))}</span>
                    </div>
                    <div class="text-sm text-gray-300 mb-3 space-y-1">
                        <div class="flex items-center gap-2"><i data-lucide="user" class="w-4 h-4"></i> ${escapeHTML(order.customer_name)}</div>
                        <div class="flex items-center gap-2"><i data-lucide="phone" class="w-4 h-4"></i> ${escapeHTML(order.customer_phone)}</div>
                    </div>
                    
                    ${order.notes ? `<div class="text-xs bg-gray-800 p-2 rounded text-amber-200 mb-3 border border-amber-900/50 whitespace-pre-wrap"><i data-lucide="info" class="inline w-3 h-3 mr-1 align-text-top"></i>${escapeHTML(order.notes)}</div>` : ''}
                    
                    <div class="bg-black/50 p-2 rounded flex-1">
                        ${itemsHtml}
                    </div>
                    
                    <div class="mt-3 flex justify-between items-center pt-2 border-t border-gray-700">
                        <span class="text-xs text-gray-400">Total</span>
                        <span class="font-bold text-spice-gold">€${parseFloat(order.total_amount).toFixed(2)}</span>
                    </div>

                    ${actionButtons}
                </div>
            `;
        }

        function renderOrders(orders) {
            const cols = {
                pending: document.getElementById('col-pending'),
                preparing: document.getElementById('col-preparing'),
                ready: document.getElementById('col-ready'),
                completed: document.getElementById('col-completed')
            };
            const counts = { pending: 0, preparing: 0, ready: 0, completed: 0 };

            // Clear columns
            for (let status in cols) { cols[status].innerHTML = ''; }

            orders.forEach(order => {
                const status = order.status;
                if (cols[status]) {
                    cols[status].insertAdjacentHTML('beforeend', createOrderCard(order));
                    counts[status]++;
                }
            });

            // Re-bind icons
            lucide.createIcons();

            // Update counts
            for (let status in counts) {
                document.getElementById(`count-${status}`).textContent = counts[status];
            }
        }

        // Initial fetch
        fetchOrders();
        
        // Auto-refresh every 15 seconds
        pollingInterval = setInterval(fetchOrders, 15000);

    </script>
<?php endif; ?>

</body>
</html>
