/**
 * admin.js — Chicken Curry Messina Admin Panel
 * ─────────────────────────────────────────────
 * Single-page admin frontend: Dashboard, Orders (KDS), Menu CRUD,
 * Kebab Builder, Offers, and Settings management.
 */

// ═══════════════════════════════════════════════════════════════════════════
// GLOBALS & UTILS
// ═══════════════════════════════════════════════════════════════════════════

let currentSection = 'dashboard';
let currentKebabTab = 'ingredients';
let ordersInterval = null;

function esc(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    sb.classList.toggle('-translate-x-full');
    ov.classList.toggle('hidden');
}

// ═══════════════════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════

function showSection(name) {
    currentSection = name;
    // Hide all sections
    document.querySelectorAll('[id^="section-"]').forEach(s => s.classList.add('hidden'));
    document.getElementById('section-' + name)?.classList.remove('hidden');

    // Update nav highlight
    document.querySelectorAll('.nav-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.nav === name);
    });

    // Close mobile sidebar
    const sb = document.getElementById('sidebar');
    if (sb && !sb.classList.contains('-translate-x-full') && window.innerWidth < 1024) {
        toggleSidebar();
    }

    // Load data for the section
    if (name === 'dashboard') loadDashboard();
    else if (name === 'orders') { fetchOrders(); startOrderPolling(); }
    else if (name === 'menu') loadMenuItems();
    else if (name === 'kebab') loadKebabData();
    else if (name === 'offers') loadOffers();
    else if (name === 'settings') loadSettings();

    // Stop order polling when not on orders page
    if (name !== 'orders') stopOrderPolling();

    lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const colors = {
        success: 'border-green-500 text-green-400',
        error: 'border-red-500 text-red-400',
        info: 'border-blue-500 text-blue-400'
    };
    const icons = { success: 'check-circle', error: 'alert-circle', info: 'info' };
    const el = document.createElement('div');
    el.className = `bg-gray-900 border ${colors[type] || colors.info} rounded-lg px-4 py-3 shadow-xl flex items-center gap-3 animate-slide-in min-w-[280px]`;
    el.innerHTML = `<i data-lucide="${icons[type] || 'info'}" class="w-5 h-5 flex-shrink-0"></i><span class="text-sm text-white">${esc(message)}</span>`;
    container.appendChild(el);
    lucide.createIcons();
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ═══════════════════════════════════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════════════════════════════════

function openModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    const modal = document.getElementById('modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lucide.createIcons();
}

function closeModal() {
    const modal = document.getElementById('modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

// Close modal on overlay click
document.getElementById('modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
});

// ═══════════════════════════════════════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function apiGet(endpoint) {
    const res = await fetch(`admin.php?api=${endpoint}`);
    if (res.status === 401) { window.location.reload(); return null; }
    return res.json();
}

async function apiPost(endpoint, body) {
    const res = await fetch(`admin.php?api=${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (res.status === 401) { window.location.reload(); return null; }
    return res.json();
}

async function apiPostForm(endpoint, formData) {
    const res = await fetch(`admin.php?api=${endpoint}`, {
        method: 'POST',
        body: formData
    });
    if (res.status === 401) { window.location.reload(); return null; }
    return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

async function loadDashboard() {
    const data = await apiGet('get_dashboard_stats');
    if (!data?.success) return;
    const d = data.data;

    // Stat cards
    document.getElementById('dashboard-stats').innerHTML = `
        <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-gray-400 uppercase tracking-wider">Today's Orders</span>
                <i data-lucide="shopping-bag" class="w-5 h-5 text-amber-500"></i>
            </div>
            <div class="text-3xl font-bold text-white">${d.today_orders}</div>
        </div>
        <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-gray-400 uppercase tracking-wider">Today's Revenue</span>
                <i data-lucide="euro" class="w-5 h-5 text-green-500"></i>
            </div>
            <div class="text-3xl font-bold text-white">€${parseFloat(d.today_revenue).toFixed(2)}</div>
        </div>
        <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-gray-400 uppercase tracking-wider">Pending Orders</span>
                <i data-lucide="clock" class="w-5 h-5 text-red-500"></i>
            </div>
            <div class="text-3xl font-bold ${d.pending_orders > 0 ? 'text-red-400' : 'text-white'}">${d.pending_orders}</div>
        </div>
        <div class="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-gray-400 uppercase tracking-wider">Week Revenue</span>
                <i data-lucide="trending-up" class="w-5 h-5 text-spice-gold"></i>
            </div>
            <div class="text-3xl font-bold text-white">€${parseFloat(d.week_revenue).toFixed(2)}</div>
        </div>
    `;

    // Recent orders
    const recentEl = document.getElementById('dashboard-recent');
    if (d.recent_orders.length === 0) {
        recentEl.innerHTML = '<p class="text-gray-500 text-sm">No orders yet</p>';
    } else {
        recentEl.innerHTML = d.recent_orders.map(o => {
            const statusColors = { pending:'bg-red-500/20 text-red-400', preparing:'bg-amber-500/20 text-amber-400', ready:'bg-green-500/20 text-green-400', completed:'bg-gray-500/20 text-gray-400', cancelled:'bg-gray-700/20 text-gray-500' };
            return `<div class="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div><span class="font-semibold text-sm text-white">#${o.id}</span> <span class="text-gray-400 text-sm ml-2">${esc(o.customer_name)}</span></div>
                <div class="flex items-center gap-3">
                    <span class="text-xs px-2 py-0.5 rounded-full ${statusColors[o.status] || ''}">${o.status}</span>
                    <span class="text-sm font-medium text-spice-gold">€${parseFloat(o.total_amount).toFixed(2)}</span>
                </div>
            </div>`;
        }).join('');
    }

    // Popular items
    const popularEl = document.getElementById('dashboard-popular');
    if (d.popular_items.length === 0) {
        popularEl.innerHTML = '<p class="text-gray-500 text-sm">No data yet</p>';
    } else {
        popularEl.innerHTML = d.popular_items.map((item, i) => `
            <div class="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div class="flex items-center gap-3">
                    <span class="text-xs w-6 h-6 rounded-full bg-spice-gold/20 text-spice-gold flex items-center justify-center font-bold">${i + 1}</span>
                    <span class="text-sm text-white">${esc(item.item_name)}</span>
                </div>
                <span class="text-sm text-gray-400">${item.total_qty} sold</span>
            </div>
        `).join('');
    }

    lucide.createIcons();

    // Update nav badge
    const badge = document.getElementById('nav-pending-badge');
    if (d.pending_orders > 0) { badge.textContent = d.pending_orders; badge.classList.remove('hidden'); }
    else { badge.classList.add('hidden'); }
}

// ═══════════════════════════════════════════════════════════════════════════
// ORDERS (Kitchen Display System)
// ═══════════════════════════════════════════════════════════════════════════

function startOrderPolling() {
    stopOrderPolling();
    ordersInterval = setInterval(fetchOrders, 15000);
}
function stopOrderPolling() {
    if (ordersInterval) { clearInterval(ordersInterval); ordersInterval = null; }
}

async function fetchOrders() {
    const data = await apiGet('get_orders');
    if (!data?.success) return;
    renderOrders(data.data);
}

async function updateOrderStatus(orderId, newStatus) {
    const data = await apiPost('update_status', { order_id: orderId, status: newStatus });
    if (data?.success) { fetchOrders(); showToast('Order updated'); }
    else showToast(data?.message || 'Failed', 'error');
}

function formatTimeAgo(tsMs) {
    const diff = Math.max(0, Date.now() - tsMs);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
}

function createOrderCard(order) {
    const itemsHtml = order.items.map(item => {
        let detail = '';
        if (item.category === 'kebab' && (item.ingredients || item.sauces)) {
            detail = `<div class="text-[11px] text-gray-500 mt-0.5 pl-2 border-l border-gray-700">${item.ingredients || ''} ${item.sauces ? '<br/>' + item.sauces : ''}</div>`;
        }
        return `<div class="py-1 border-b border-gray-800 last:border-0 text-sm">
            <span class="font-bold text-spice-gold">${item.quantity}x</span> ${esc(item.item_name)} ${item.size ? `<span class="text-gray-500">(${esc(item.size)})</span>` : ''}
            ${detail}
        </div>`;
    }).join('');

    let btn = '';
    if (order.status === 'pending') btn = `<button onclick="updateOrderStatus(${order.id},'preparing')" class="w-full mt-2 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded text-sm transition">Start Preparing</button>`;
    else if (order.status === 'preparing') btn = `<button onclick="updateOrderStatus(${order.id},'ready')" class="w-full mt-2 bg-warm-amber hover:bg-amber-400 text-black font-bold py-2 rounded text-sm transition">Mark Ready</button>`;
    else if (order.status === 'ready') btn = `<button onclick="updateOrderStatus(${order.id},'completed')" class="w-full mt-2 bg-green-600 hover:bg-green-500 text-white font-bold py-2 rounded text-sm transition">Complete</button>`;

    const timeColor = order.status === 'pending' ? 'text-red-400 animate-pulse font-bold' : 'text-gray-500';

    return `<div class="bg-gray-950 border border-gray-800 rounded-lg p-3 shadow ${order.status === 'pending' ? 'border-l-4 border-l-red-500' : ''}">
        <div class="flex justify-between items-start mb-2">
            <span class="font-bold text-white">#${order.id}</span>
            <span class="text-[11px] ${timeColor}">${formatTimeAgo(Number(order.created_ts_ms))}</span>
        </div>
        <div class="text-xs text-gray-400 space-y-0.5 mb-2">
            <div class="flex items-center gap-1"><i data-lucide="user" class="w-3 h-3"></i> ${esc(order.customer_name)}</div>
            <div class="flex items-center gap-1"><i data-lucide="phone" class="w-3 h-3"></i> ${esc(order.customer_phone)}</div>
        </div>
        ${order.notes ? `<div class="text-[11px] bg-gray-900 p-2 rounded text-amber-200 mb-2 border border-amber-900/30">${esc(order.notes)}</div>` : ''}
        <div class="bg-black/40 p-2 rounded">${itemsHtml}</div>
        <div class="mt-2 flex justify-between items-center pt-2 border-t border-gray-800">
            <span class="text-[11px] text-gray-500">Total</span>
            <span class="font-bold text-spice-gold text-sm">€${parseFloat(order.total_amount).toFixed(2)}</span>
        </div>
        ${btn}
    </div>`;
}

function renderOrders(orders) {
    const cols = { pending:'col-pending', preparing:'col-preparing', ready:'col-ready', completed:'col-completed' };
    const counts = { pending:0, preparing:0, ready:0, completed:0 };

    for (const key in cols) document.getElementById(cols[key]).innerHTML = '';

    orders.forEach(order => {
        const s = order.status;
        if (cols[s]) {
            document.getElementById(cols[s]).insertAdjacentHTML('beforeend', createOrderCard(order));
            counts[s]++;
        }
    });

    for (const s in counts) document.getElementById('count-' + s).textContent = counts[s];

    // Update nav badge
    const badge = document.getElementById('nav-pending-badge');
    if (counts.pending > 0) { badge.textContent = counts.pending; badge.classList.remove('hidden'); }
    else { badge.classList.add('hidden'); }

    lucide.createIcons();
}

// ═══════════════════════════════════════════════════════════════════════════
// MENU ITEMS
// ═══════════════════════════════════════════════════════════════════════════

let menuItemsData = [];

async function loadMenuItems() {
    const data = await apiGet('get_menu_items');
    if (!data?.success) return;
    menuItemsData = data.data;
    renderMenuItems();
}

function renderMenuItems() {
    const grid = document.getElementById('menu-grid');
    if (menuItemsData.length === 0) {
        grid.innerHTML = '<p class="text-gray-500 col-span-full text-center py-12">No menu items yet. Click "Add Item" to create one.</p>';
        return;
    }

    grid.innerHTML = menuItemsData.map(item => {
        const spiceDots = Array.from({length: 5}, (_, i) => `<span class="w-2 h-2 rounded-full ${i < item.spice_level ? 'bg-red-500' : 'bg-gray-700'}"></span>`).join('');
        const badges = [
            item.is_popular == 1 ? '<span class="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">Popular</span>' : '',
            item.is_halal == 1 ? '<span class="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Halal</span>' : '',
            item.is_gluten_free == 1 ? '<span class="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">GF</span>' : '',
        ].filter(Boolean).join(' ');

        return `<div class="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden ${item.is_active != 1 ? 'opacity-50' : ''}">
            <div class="h-40 bg-gray-800 overflow-hidden">
                ${item.image_url ? `<img src="${esc(item.image_url)}" alt="${esc(item.name)}" class="w-full h-full object-cover">` : '<div class="w-full h-full flex items-center justify-center text-gray-600"><i data-lucide="image" class="w-12 h-12"></i></div>'}
            </div>
            <div class="p-4">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h3 class="font-bold text-white text-base">${esc(item.name)}</h3>
                        <span class="text-[10px] uppercase tracking-wider text-gray-400">${esc(item.category)}</span>
                    </div>
                    <span class="text-lg font-bold text-spice-gold">€${parseFloat(item.base_price).toFixed(2)}</span>
                </div>
                ${item.description ? `<p class="text-xs text-gray-400 mb-2 line-clamp-2">${esc(item.description)}</p>` : ''}
                <div class="flex items-center gap-1 mb-2">${spiceDots}<span class="text-[10px] text-gray-500 ml-1">Spice</span></div>
                <div class="flex items-center gap-1 mb-3 flex-wrap">${badges}</div>
                <div class="flex items-center justify-between pt-3 border-t border-gray-800">
                    <div class="flex items-center gap-2">
                        <div class="toggle ${item.is_active == 1 ? 'active' : ''}" onclick="toggleMenuItem(${item.id}, ${item.is_active == 1 ? 0 : 1})" title="${item.is_active == 1 ? 'Active' : 'Inactive'}"></div>
                        <span class="text-[10px] text-gray-500">${item.is_active == 1 ? 'Active' : 'Hidden'}</span>
                    </div>
                    <div class="flex items-center gap-1">
                        <button onclick='openMenuForm(${JSON.stringify(item).replace(/'/g, "&#39;")})' class="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition" title="Edit">
                            <i data-lucide="pencil" class="w-4 h-4"></i>
                        </button>
                        <button onclick="deleteMenuItem(${item.id}, '${esc(item.name)}')" class="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition" title="Delete">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }).join('');

    lucide.createIcons();
}

function openMenuForm(item = null) {
    const title = item ? 'Edit Menu Item' : 'Add Menu Item';
    const html = `
        <form id="menu-form" class="space-y-4">
            <input type="hidden" name="id" value="${item?.id || ''}">
            <input type="hidden" name="existing_image" value="${item?.image_url || ''}">
            <div><label class="lbl">Name *</label><input type="text" name="name" value="${esc(item?.name || '')}" required class="inp"></div>
            <div><label class="lbl">Category *</label>
                <select name="category" class="inp">
                    <option value="curry" ${item?.category === 'curry' ? 'selected' : ''}>Curry</option>
                    <option value="biryani" ${item?.category === 'biryani' ? 'selected' : ''}>Biryani</option>
                </select>
            </div>
            <div><label class="lbl">Description</label><textarea name="description" rows="2" class="inp">${esc(item?.description || '')}</textarea></div>
            <div class="grid grid-cols-2 gap-4">
                <div><label class="lbl">Price (€) *</label><input type="number" name="base_price" step="0.50" min="0.01" value="${item?.base_price || ''}" required class="inp"></div>
                <div><label class="lbl">Prep Time</label><input type="text" name="prep_time" value="${esc(item?.prep_time || '')}" placeholder="e.g. 20 min" class="inp"></div>
            </div>
            <div><label class="lbl">Spice Level (0-5)</label><input type="number" name="spice_level" min="0" max="5" value="${item?.spice_level || 0}" class="inp"></div>
            <div><label class="lbl">Image</label>
                <input type="file" name="image" accept="image/*" class="inp text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-gray-700 file:text-gray-300 file:text-sm file:cursor-pointer" onchange="previewImage(this, 'menu-img-preview')">
                ${item?.image_url ? `<img id="menu-img-preview" src="${esc(item.image_url)}" class="mt-2 w-24 h-24 object-cover rounded-lg border border-gray-700">` : `<img id="menu-img-preview" class="mt-2 w-24 h-24 object-cover rounded-lg border border-gray-700 hidden">`}
            </div>
            <div><label class="lbl">Allergens</label><input type="text" name="allergens" value="${esc(item?.allergens || '')}" placeholder="e.g. Gluten, Dairy" class="inp"></div>
            <div class="flex flex-wrap gap-4">
                <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" name="is_popular" value="1" ${item?.is_popular == 1 ? 'checked' : ''} class="accent-spice-gold w-4 h-4"> Popular
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" name="is_active" value="1" ${!item || item.is_active == 1 ? 'checked' : ''} class="accent-spice-gold w-4 h-4"> Active
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" name="is_halal" value="1" ${!item || item.is_halal == 1 ? 'checked' : ''} class="accent-spice-gold w-4 h-4"> Halal
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                    <input type="checkbox" name="is_gluten_free" value="1" ${item?.is_gluten_free == 1 ? 'checked' : ''} class="accent-spice-gold w-4 h-4"> Gluten Free
                </label>
            </div>
            <div class="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition">Cancel</button>
                <button type="submit" class="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-6 py-2 rounded-lg text-sm hover:scale-[1.02] transition-transform">Save</button>
            </div>
        </form>
    `;
    openModal(title, html);

    document.getElementById('menu-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        // Ensure checkbox values are sent correctly
        ['is_popular','is_active','is_halal','is_gluten_free'].forEach(key => {
            fd.set(key, e.target.querySelector(`[name="${key}"]`)?.checked ? '1' : '0');
        });
        const data = await apiPostForm('save_menu_item', fd);
        if (data?.success) { closeModal(); showToast(data.message); loadMenuItems(); }
        else showToast(data?.message || 'Error', 'error');
    });
}

async function toggleMenuItem(id, active) {
    const data = await apiPost('toggle_menu_item', { id, is_active: active });
    if (data?.success) { showToast(active ? 'Item activated' : 'Item hidden'); loadMenuItems(); }
    else showToast('Error', 'error');
}

async function deleteMenuItem(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const data = await apiPost('delete_menu_item', { id });
    if (data?.success) { showToast('Item deleted'); loadMenuItems(); }
    else showToast('Error', 'error');
}

// Image preview helper
function previewImage(input, previewId) {
    const preview = document.getElementById(previewId);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => { preview.src = e.target.result; preview.classList.remove('hidden'); };
        reader.readAsDataURL(input.files[0]);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// KEBAB BUILDER
// ═══════════════════════════════════════════════════════════════════════════

let ingredientsData = [], saucesData = [], sizesData = [];

function showKebabTab(tab) {
    currentKebabTab = tab;
    document.querySelectorAll('.ktab-btn').forEach(b => b.classList.toggle('active', b.dataset.ktab === tab));
    renderKebabContent();
}

async function loadKebabData() {
    const [ing, sau, siz] = await Promise.all([
        apiGet('get_ingredients'), apiGet('get_sauces'), apiGet('get_sizes')
    ]);
    if (ing?.success) ingredientsData = ing.data;
    if (sau?.success) saucesData = sau.data;
    if (siz?.success) sizesData = siz.data;
    showKebabTab(currentKebabTab);
}

function renderKebabContent() {
    const container = document.getElementById('kebab-content');
    if (currentKebabTab === 'ingredients') renderIngredients(container);
    else if (currentKebabTab === 'sauces') renderSauces(container);
    else renderSizes(container);
    lucide.createIcons();
}

function renderIngredients(container) {
    container.innerHTML = `
        <div class="flex justify-end mb-4">
            <button onclick="openIngredientForm()" class="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:scale-[1.03] transition-transform">
                <i data-lucide="plus" class="w-4 h-4"></i> Add Ingredient
            </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            ${ingredientsData.map(i => `
                <div class="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center gap-4 ${i.is_active != 1 ? 'opacity-50' : ''}">
                    <div class="w-14 h-14 rounded-lg bg-gray-800 overflow-hidden flex-shrink-0">
                        ${i.image_url ? `<img src="${esc(i.image_url)}" class="w-full h-full object-cover">` : `<span class="text-2xl flex items-center justify-center h-full">${i.icon || '🥗'}</span>`}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-semibold text-white text-sm">${esc(i.icon || '')} ${esc(i.name)}</div>
                        <div class="text-xs text-gray-400">€${parseFloat(i.price).toFixed(2)}</div>
                    </div>
                    <div class="flex items-center gap-1">
                        <button onclick='openIngredientForm(${JSON.stringify(i).replace(/'/g, "&#39;")})' class="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        <button onclick="deleteIngredient(${i.id})" class="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderSauces(container) {
    container.innerHTML = `
        <div class="flex justify-end mb-4">
            <button onclick="openSauceForm()" class="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:scale-[1.03] transition-transform">
                <i data-lucide="plus" class="w-4 h-4"></i> Add Sauce
            </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            ${saucesData.map(s => `
                <div class="bg-gray-900 rounded-xl border border-gray-800 p-4 flex items-center gap-4 ${s.is_active != 1 ? 'opacity-50' : ''}">
                    <div class="w-14 h-14 rounded-lg bg-gray-800 overflow-hidden flex-shrink-0">
                        ${s.image_url ? `<img src="${esc(s.image_url)}" class="w-full h-full object-cover">` : `<span class="text-2xl flex items-center justify-center h-full">${s.icon || '🫙'}</span>`}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="font-semibold text-white text-sm">${esc(s.icon || '')} ${esc(s.name)}</div>
                        <div class="text-xs text-gray-400">€${parseFloat(s.price).toFixed(2)}</div>
                    </div>
                    <div class="flex items-center gap-1">
                        <button onclick='openSauceForm(${JSON.stringify(s).replace(/'/g, "&#39;")})' class="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                        <button onclick="deleteSauce(${s.id})" class="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderSizes(container) {
    container.innerHTML = `
        <div class="flex justify-end mb-4">
            <button onclick="openSizeForm()" class="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:scale-[1.03] transition-transform">
                <i data-lucide="plus" class="w-4 h-4"></i> Add Size
            </button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            ${sizesData.map(s => `
                <div class="bg-gray-900 rounded-xl border border-gray-800 p-5 ${s.is_active != 1 ? 'opacity-50' : ''}">
                    <div class="flex justify-between items-center">
                        <div>
                            <div class="font-semibold text-white">${esc(s.name)}</div>
                            <div class="text-lg font-bold text-spice-gold mt-1">€${parseFloat(s.price).toFixed(2)}</div>
                        </div>
                        <div class="flex items-center gap-1">
                            <button onclick='openSizeForm(${JSON.stringify(s).replace(/'/g, "&#39;")})' class="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition"><i data-lucide="pencil" class="w-3.5 h-3.5"></i></button>
                            <button onclick="deleteSize(${s.id})" class="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

// — Ingredient Form —
function openIngredientForm(item = null) {
    openModal(item ? 'Edit Ingredient' : 'Add Ingredient', `
        <form id="ingredient-form" class="space-y-4">
            <input type="hidden" name="id" value="${item?.id || ''}">
            <input type="hidden" name="existing_image" value="${item?.image_url || ''}">
            <div><label class="lbl">Name *</label><input type="text" name="name" value="${esc(item?.name || '')}" required class="inp"></div>
            <div class="grid grid-cols-2 gap-4">
                <div><label class="lbl">Price (€)</label><input type="number" name="price" step="0.10" min="0" value="${item?.price || '0.00'}" class="inp"></div>
                <div><label class="lbl">Icon (emoji)</label><input type="text" name="icon" value="${item?.icon || ''}" maxlength="4" class="inp" placeholder="🍅"></div>
            </div>
            <div><label class="lbl">Image</label>
                <input type="file" name="image" accept="image/*" class="inp text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-gray-700 file:text-gray-300 file:text-sm" onchange="previewImage(this,'ing-preview')">
                <img id="ing-preview" src="${item?.image_url || ''}" class="${item?.image_url ? '' : 'hidden'} mt-2 w-16 h-16 object-cover rounded-lg border border-gray-700">
            </div>
            <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" name="is_active" value="1" ${!item || item.is_active == 1 ? 'checked' : ''} class="accent-spice-gold w-4 h-4"> Active
            </label>
            <div class="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white">Cancel</button>
                <button type="submit" class="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-6 py-2 rounded-lg text-sm">Save</button>
            </div>
        </form>
    `);
    document.getElementById('ingredient-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        fd.set('is_active', e.target.querySelector('[name="is_active"]')?.checked ? '1' : '0');
        const data = await apiPostForm('save_ingredient', fd);
        if (data?.success) { closeModal(); showToast('Ingredient saved'); loadKebabData(); }
        else showToast(data?.message || 'Error', 'error');
    });
}

async function deleteIngredient(id) {
    if (!confirm('Delete this ingredient?')) return;
    const data = await apiPost('delete_ingredient', { id });
    if (data?.success) { showToast('Deleted'); loadKebabData(); }
    else showToast('Error', 'error');
}

// — Sauce Form —
function openSauceForm(item = null) {
    openModal(item ? 'Edit Sauce' : 'Add Sauce', `
        <form id="sauce-form" class="space-y-4">
            <input type="hidden" name="id" value="${item?.id || ''}">
            <input type="hidden" name="existing_image" value="${item?.image_url || ''}">
            <div><label class="lbl">Name *</label><input type="text" name="name" value="${esc(item?.name || '')}" required class="inp"></div>
            <div class="grid grid-cols-2 gap-4">
                <div><label class="lbl">Price (€)</label><input type="number" name="price" step="0.10" min="0" value="${item?.price || '0.00'}" class="inp"></div>
                <div><label class="lbl">Icon (emoji)</label><input type="text" name="icon" value="${item?.icon || ''}" maxlength="4" class="inp" placeholder="🌶️"></div>
            </div>
            <div><label class="lbl">Image</label>
                <input type="file" name="image" accept="image/*" class="inp text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-gray-700 file:text-gray-300 file:text-sm" onchange="previewImage(this,'sauce-preview')">
                <img id="sauce-preview" src="${item?.image_url || ''}" class="${item?.image_url ? '' : 'hidden'} mt-2 w-16 h-16 object-cover rounded-lg border border-gray-700">
            </div>
            <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" name="is_active" value="1" ${!item || item.is_active == 1 ? 'checked' : ''} class="accent-spice-gold w-4 h-4"> Active
            </label>
            <div class="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white">Cancel</button>
                <button type="submit" class="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-6 py-2 rounded-lg text-sm">Save</button>
            </div>
        </form>
    `);
    document.getElementById('sauce-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        fd.set('is_active', e.target.querySelector('[name="is_active"]')?.checked ? '1' : '0');
        const data = await apiPostForm('save_sauce', fd);
        if (data?.success) { closeModal(); showToast('Sauce saved'); loadKebabData(); }
        else showToast(data?.message || 'Error', 'error');
    });
}

async function deleteSauce(id) {
    if (!confirm('Delete this sauce?')) return;
    const data = await apiPost('delete_sauce', { id });
    if (data?.success) { showToast('Deleted'); loadKebabData(); }
    else showToast('Error', 'error');
}

// — Size Form —
function openSizeForm(item = null) {
    openModal(item ? 'Edit Size' : 'Add Size', `
        <form id="size-form" class="space-y-4">
            <input type="hidden" name="id" value="${item?.id || ''}">
            <div><label class="lbl">Name *</label><input type="text" name="name" value="${esc(item?.name || '')}" required class="inp" placeholder="e.g. Grande"></div>
            <div><label class="lbl">Price (€) *</label><input type="number" name="price" step="0.50" min="0.01" value="${item?.price || ''}" required class="inp"></div>
            <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" name="is_active" value="1" ${!item || item.is_active == 1 ? 'checked' : ''} class="accent-spice-gold w-4 h-4"> Active
            </label>
            <div class="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white">Cancel</button>
                <button type="submit" class="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-6 py-2 rounded-lg text-sm">Save</button>
            </div>
        </form>
    `);
    document.getElementById('size-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formEl = e.target;
        const body = {
            id: formEl.querySelector('[name="id"]').value,
            name: formEl.querySelector('[name="name"]').value,
            price: formEl.querySelector('[name="price"]').value,
            is_active: formEl.querySelector('[name="is_active"]')?.checked ? 1 : 0
        };
        const data = await apiPost('save_size', body);
        if (data?.success) { closeModal(); showToast('Size saved'); loadKebabData(); }
        else showToast(data?.message || 'Error', 'error');
    });
}

async function deleteSize(id) {
    if (!confirm('Delete this size?')) return;
    const data = await apiPost('delete_size', { id });
    if (data?.success) { showToast('Deleted'); loadKebabData(); }
    else showToast('Error', 'error');
}

// ═══════════════════════════════════════════════════════════════════════════
// OFFERS
// ═══════════════════════════════════════════════════════════════════════════

let offersData = [];

async function loadOffers() {
    const data = await apiGet('get_offers');
    if (!data?.success) return;
    offersData = data.data;
    renderOffers();
}

function renderOffers() {
    const grid = document.getElementById('offers-grid');
    if (offersData.length === 0) {
        grid.innerHTML = '<p class="text-gray-500 col-span-full text-center py-12">No offers yet. Click "Create Offer" to add one.</p>';
        return;
    }

    grid.innerHTML = offersData.map(o => {
        const discountLabel = o.discount_type === 'percentage' ? `${o.discount_value}% OFF` :
                              o.discount_type === 'fixed' ? `€${parseFloat(o.discount_value).toFixed(2)} OFF` : 'FREEBIE';
        const now = new Date().toISOString().slice(0, 10);
        const isExpired = o.end_date && o.end_date < now;
        const isUpcoming = o.start_date && o.start_date > now;

        let statusBadge = '';
        if (!o.is_active || o.is_active == 0) statusBadge = '<span class="text-[10px] bg-gray-600/30 text-gray-400 px-1.5 py-0.5 rounded">Inactive</span>';
        else if (isExpired) statusBadge = '<span class="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Expired</span>';
        else if (isUpcoming) statusBadge = '<span class="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">Upcoming</span>';
        else statusBadge = '<span class="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">Active</span>';

        return `<div class="bg-gray-900 rounded-xl border border-gray-800 p-5 ${o.is_active != 1 ? 'opacity-50' : ''}">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <span class="text-xs font-bold text-spice-gold bg-spice-gold/10 px-2 py-1 rounded">${discountLabel}</span>
                    ${statusBadge}
                </div>
                <div class="flex items-center gap-1">
                    <div class="toggle ${o.is_active == 1 ? 'active' : ''}" onclick="toggleOffer(${o.id}, ${o.is_active == 1 ? 0 : 1})"></div>
                </div>
            </div>
            <h3 class="font-bold text-white text-base mb-1">${esc(o.title)}</h3>
            ${o.description ? `<p class="text-xs text-gray-400 mb-3">${esc(o.description)}</p>` : '<div class="mb-3"></div>'}
            <div class="text-[11px] text-gray-500 space-y-1 mb-3">
                ${o.coupon_code ? `<div>Code: <span class="font-mono text-spice-gold bg-gray-800 px-1.5 py-0.5 rounded">${esc(o.coupon_code)}</span></div>` : ''}
                ${o.min_order_amount > 0 ? `<div>Min order: €${parseFloat(o.min_order_amount).toFixed(2)}</div>` : ''}
                ${o.start_date || o.end_date ? `<div>${o.start_date || '...'} → ${o.end_date || '...'}</div>` : ''}
            </div>
            <div class="flex justify-end gap-1 pt-3 border-t border-gray-800">
                <button onclick='openOfferForm(${JSON.stringify(o).replace(/'/g, "&#39;")})' class="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition"><i data-lucide="pencil" class="w-4 h-4"></i></button>
                <button onclick="deleteOffer(${o.id})" class="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
            </div>
        </div>`;
    }).join('');

    lucide.createIcons();
}

function openOfferForm(offer = null) {
    openModal(offer ? 'Edit Offer' : 'Create Offer', `
        <form id="offer-form" class="space-y-4">
            <div><label class="lbl">Title *</label><input type="text" name="title" value="${esc(offer?.title || '')}" required class="inp"></div>
            <div><label class="lbl">Description</label><textarea name="description" rows="2" class="inp">${esc(offer?.description || '')}</textarea></div>
            <div class="grid grid-cols-2 gap-4">
                <div><label class="lbl">Discount Type</label>
                    <select name="discount_type" class="inp">
                        <option value="percentage" ${offer?.discount_type === 'percentage' ? 'selected' : ''}>Percentage (%)</option>
                        <option value="fixed" ${offer?.discount_type === 'fixed' ? 'selected' : ''}>Fixed (€)</option>
                        <option value="freebie" ${offer?.discount_type === 'freebie' ? 'selected' : ''}>Freebie</option>
                    </select>
                </div>
                <div><label class="lbl">Discount Value</label><input type="number" name="discount_value" step="0.50" min="0" value="${offer?.discount_value || '0'}" class="inp"></div>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div><label class="lbl">Min Order (€)</label><input type="number" name="min_order_amount" step="0.50" min="0" value="${offer?.min_order_amount || '0'}" class="inp"></div>
                <div><label class="lbl">Coupon Code</label><input type="text" name="coupon_code" value="${esc(offer?.coupon_code || '')}" class="inp" placeholder="e.g. WELCOME10"></div>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div><label class="lbl">Start Date</label><input type="date" name="start_date" value="${offer?.start_date || ''}" class="inp"></div>
                <div><label class="lbl">End Date</label><input type="date" name="end_date" value="${offer?.end_date || ''}" class="inp"></div>
            </div>
            <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input type="checkbox" name="is_active" value="1" ${!offer || offer.is_active == 1 ? 'checked' : ''} class="accent-spice-gold w-4 h-4"> Active
            </label>
            <div class="flex justify-end gap-3 pt-3 border-t border-gray-800">
                <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white">Cancel</button>
                <button type="submit" class="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-6 py-2 rounded-lg text-sm">Save</button>
            </div>
        </form>
    `);
    document.getElementById('offer-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        const body = {
            id: offer?.id || 0,
            title: f.querySelector('[name="title"]').value,
            description: f.querySelector('[name="description"]').value,
            discount_type: f.querySelector('[name="discount_type"]').value,
            discount_value: f.querySelector('[name="discount_value"]').value,
            min_order_amount: f.querySelector('[name="min_order_amount"]').value,
            coupon_code: f.querySelector('[name="coupon_code"]').value,
            start_date: f.querySelector('[name="start_date"]').value,
            end_date: f.querySelector('[name="end_date"]').value,
            is_active: f.querySelector('[name="is_active"]')?.checked ? 1 : 0
        };
        const data = await apiPost('save_offer', body);
        if (data?.success) { closeModal(); showToast('Offer saved'); loadOffers(); }
        else showToast(data?.message || 'Error', 'error');
    });
}

async function toggleOffer(id, active) {
    const data = await apiPost('toggle_offer', { id, is_active: active });
    if (data?.success) { showToast(active ? 'Offer activated' : 'Offer deactivated'); loadOffers(); }
    else showToast('Error', 'error');
}

async function deleteOffer(id) {
    if (!confirm('Delete this offer?')) return;
    const data = await apiPost('delete_offer', { id });
    if (data?.success) { showToast('Offer deleted'); loadOffers(); }
    else showToast('Error', 'error');
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════════════════

async function loadSettings() {
    const data = await apiGet('get_settings');
    if (!data?.success) return;
    const s = data.data;
    const form = document.getElementById('settings-form');
    // Fill form fields
    for (const [key, val] of Object.entries(s)) {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) input.value = val || '';
    }
}

// Settings form submit
document.getElementById('settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const settings = {};
    fd.forEach((val, key) => { settings[key] = val; });
    const data = await apiPost('save_settings', { settings });
    if (data?.success) showToast('Settings saved');
    else showToast(data?.message || 'Error', 'error');
});

// Password form submit
document.getElementById('password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {
        current_password: f.querySelector('[name="current_password"]').value,
        new_password: f.querySelector('[name="new_password"]').value,
        confirm_password: f.querySelector('[name="confirm_password"]').value
    };
    const data = await apiPost('change_password', body);
    if (data?.success) { showToast('Password changed'); f.reset(); }
    else showToast(data?.message || 'Error', 'error');
});

// ═══════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════

// Initialize icons
lucide.createIcons();

// Show dashboard by default
showSection('dashboard');

// Add animation keyframes
const style = document.createElement('style');
style.textContent = `
    @keyframes slide-in { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    .animate-slide-in { animation: slide-in 0.3s ease-out; }
`;
document.head.appendChild(style);
