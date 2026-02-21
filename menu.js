/**
 * menu.js — Chicken Curry Messina
 * ─────────────────────────────────────────────────────────────────────────────
 * Handles the interactive menu page:
 *  - Kebab Builder (ingredients, sauces, sizes, live price, add to cart)
 *  - Biryani & Curry grid (loaded from database via get_menu.php)
 *  - Cart Drawer (display, quantity control, upsell, checkout navigation)
 *  - Toast notification system
 *
 * Dependencies:
 *  - styles.css     (custom Tailwind tokens, .glass-card, .image-tile, etc.)
 *  - get_kebab_data.php  (ingredients / sauces / sizes API)
 *  - get_menu.php        (biryani & curry items API)
 *  - create_order.php    (order placement — used from checkout.html)
 * ─────────────────────────────────────────────────────────────────────────────
 */


// =============================================================================
// §1  GLOBAL STATE
//     Server data (ingredients, sauces, sizes) and the user's current kebab
//     selections. Also loads the cart from localStorage on startup.
// =============================================================================

/** @type {Array<Object>} All available kebab ingredients from DB */
let ingredients = [];

/** @type {Array<Object>} All available sauces from DB */
let sauces = [];

/** @type {Array<Object>} All available kebab sizes from DB */
let sizes = [];

/** @type {Array<Object>} Ingredients the user has selected for the current kebab */
let selectedIngredients = [];

/** @type {Array<Object>} Sauces the user has selected for the current kebab */
let selectedSauces = [];

/** @type {Object|null} Currently selected kebab size (full size object from DB) */
let selectedSize = null;

/** @type {number} Base price of the selected size in euros */
let kebabBasePrice = 0;

// ─── Cart Initialisation & Legacy Migration ───────────────────────────────────
// Older sessions stored Italian item names. This one-time remap converts them to
// the current English database names used by create_order.php validation.

/** @type {Array<Object>} Items persisted in localStorage */
let parsedCart = [];
try {
  parsedCart = JSON.parse(localStorage.getItem("cart"));
} catch (e) { /* Silently ignore corrupted cart data */ }

let cart = Array.isArray(parsedCart) ? parsedCart : [];

cart = cart
  .filter(item => item !== null && typeof item === "object") // remove null/corrupt entries
  .map(item => {
    // Rename old Italian sauce names to current English DB names
    if (item.name === "Piccante Sauce" || item.name === "Piccante") item.name = "Spicy";
    if (item.name === "Yoghurt Sauce" || item.name === "Yoghurt") item.name = "Yogurt";

    // Rename old Italian size names to current English DB names
    if (item.size === "Medio") item.size = "Medium";
    if (item.size === "Grande") item.size = "Large";

    // Also fix sauces stored inside kebab items
    if (item.sauces && Array.isArray(item.sauces)) {
      item.sauces = item.sauces.map(s =>
        s === "Piccante" ? "Spicy" : (s === "Yoghurt" ? "Yogurt" : s)
      );
    }
    return item;
  });

localStorage.setItem("cart", JSON.stringify(cart));


// =============================================================================
// §2  DOM ELEMENT REFERENCES
//     Cached once at startup. Guard (if !el) checks exist wherever an element
//     might be absent (e.g., when this script loads on a page without a cart).
// =============================================================================

// Kebab Builder
const ingredientList = document.getElementById("ingredientList");
const sauceList = document.getElementById("sauceList");
const sizeList = document.getElementById("sizeList");
const kebabSummary = document.getElementById("kebabSummary");
const kebabPriceEl = document.getElementById("kebabPrice");
const addKebabBtn = document.getElementById("addKebabToCart");
const toast = document.getElementById("toast");

// Menu Grids
const biryaniGrid = document.getElementById("biryaniGrid");
const curryGrid = document.getElementById("curryGrid");

// Cart Drawer
const cartDrawer = document.getElementById("cartDrawer");
const cartBtn = document.getElementById("cartBtn");
const overlay = document.getElementById("overlay");
const cartItemsEl = document.getElementById("cartItems");
const cartTotalEl = document.getElementById("cartTotal");
const cartCountEl = document.getElementById("cartCount");
const cartProgress = document.getElementById("cartProgress");
const checkoutBtn = document.getElementById("checkoutBtn");


// =============================================================================
// §3  INITIALISATION
//     Runs once the DOM is fully ready. Loads data, renders cart, wires events.
// =============================================================================

document.addEventListener("DOMContentLoaded", () => {
  loadKebabData();    // Fetch ingredients / sauces / sizes from server
  loadMenuFromDB();   // Fetch biryanis & curries from server
  renderCart();       // Display any items already in localStorage cart
  updateCartCount();  // Refresh the cart badge number in the nav
  initEventListeners(); // Wire up cart, checkout, and mobile menu buttons
});

/**
 * Wires all interactive event listeners that aren't defined inline in HTML.
 */
function initEventListeners() {
  if (cartBtn) cartBtn.addEventListener("click", openCart);
  if (overlay) overlay.addEventListener("click", closeCart);
  if (addKebabBtn) addKebabBtn.addEventListener("click", handleAddKebabToCart);

  // Prevent checkout if cart is empty
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      if (cart.length === 0) {
        showToast("Your cart is empty!");
        return;
      }
      window.location.href = "checkout.html";
    });
  }

  // Mobile hamburger menu toggle
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const mobileMenu = document.getElementById("mobileMenu");
  const mobileLinks = document.querySelectorAll(".mobile-link");

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener("click", () => {
      mobileMenu.classList.toggle("hidden");
    });

    // Close the mobile menu when any nav link is tapped
    mobileLinks.forEach(link => {
      link.addEventListener("click", () => mobileMenu.classList.add("hidden"));
    });
  }
}


// =============================================================================
// §4  KEBAB BUILDER — DATA LOADING
//     Fetches ingredients, sauces, and sizes from get_kebab_data.php, then
//     kicks off the initial render.
// =============================================================================

/**
 * Loads kebab builder data (ingredients, sauces, sizes) from the server.
 * On success, renders all three picker sections and sets the default size.
 */
async function loadKebabData() {
  try {
    const res = await fetch("get_kebab_data.php");
    const data = await res.json();

    if (!data.success) {
      showToast("Failed to load kebab options");
      return;
    }

    ingredients = data.data.ingredients || [];
    sauces = data.data.sauces || [];
    sizes = data.data.sizes || [];

    // Automatically select the first size as the default
    if (sizes.length > 0) {
      selectedSize = sizes[0];
      kebabBasePrice = parseFloat(selectedSize.price);
    }

    renderIngredients();
    renderSauces();
    renderSizes();
    updateSummary();
    updatePrice();

  } catch (err) {
    console.error("[loadKebabData]", err);
    showToast("Server error loading kebab data");
  }
}


// =============================================================================
// §5  KEBAB BUILDER — RENDERING
//     Each render function clears its container and re-builds it from the
//     current arrays. Buttons are rendered as image-tiles when an image_url
//     is present, or as pill buttons otherwise.
// =============================================================================

/**
 * Renders the ingredient picker buttons inside #ingredientList.
 */
function renderIngredients() {
  if (!ingredientList) return;
  ingredientList.innerHTML = "";

  ingredients.forEach(ing => {
    const btn = document.createElement("button");
    const priceDisplay = parseFloat(ing.price) > 0
      ? `+€${parseFloat(ing.price).toFixed(2)}`
      : "Free";

    if (ing.image_url) {
      // Rich image tile layout
      btn.className = "image-tile flex flex-col items-center justify-center p-2 rounded-2xl border-2 border-transparent hover:border-spice-gold/50 transition-all duration-300 w-24 h-28 bg-gray-800/50 text-white";
      btn.innerHTML = `
        <div class="w-12 h-12 rounded-full overflow-hidden mb-2 border border-spice-gold/30">
          <img src="${ing.image_url}" alt="${ing.name}" class="w-full h-full object-cover">
        </div>
        <span class="text-xs font-semibold text-center leading-tight w-full truncate">${ing.name}</span>
        <span class="text-[10px] text-spice-gold mt-1 bg-black/50 px-2 py-0.5 rounded-full">${priceDisplay}</span>
      `;
    } else {
      // Simple pill button layout
      btn.className = "px-4 py-2 rounded-full border border-spice-gold/30 text-sm hover:bg-spice-gold hover:text-black flex items-center gap-2 text-white transition";
      btn.innerHTML = `${ing.icon || ""} ${ing.name} <span class="text-xs opacity-75">(${priceDisplay})</span>`;
    }

    btn.onclick = () => toggleIngredient(ing, btn);
    ingredientList.appendChild(btn);
  });
}

/**
 * Renders the sauce picker buttons inside #sauceList.
 */
function renderSauces() {
  if (!sauceList) return;
  sauceList.innerHTML = "";

  sauces.forEach(sauce => {
    const btn = document.createElement("button");
    const priceDisplay = parseFloat(sauce.price) > 0
      ? `+€${parseFloat(sauce.price).toFixed(2)}`
      : "Free";

    if (sauce.image_url) {
      btn.className = "image-tile flex flex-col items-center justify-center p-2 rounded-2xl border-2 border-transparent hover:border-spice-gold/50 transition-all duration-300 w-24 h-28 bg-gray-800/50 text-white";
      btn.innerHTML = `
        <div class="w-12 h-12 rounded-full overflow-hidden mb-2 border border-spice-gold/30">
          <img src="${sauce.image_url}" alt="${sauce.name}" class="w-full h-full object-cover">
        </div>
        <span class="text-xs font-semibold text-center leading-tight w-full truncate">${sauce.name}</span>
        <span class="text-[10px] text-spice-gold mt-1 bg-black/50 px-2 py-0.5 rounded-full">${priceDisplay}</span>
      `;
    } else {
      btn.className = "px-4 py-2 rounded-full border border-spice-gold/30 text-sm hover:bg-spice-gold hover:text-black flex items-center gap-2 text-white transition";
      btn.innerHTML = `${sauce.icon || ""} ${sauce.name} <span class="text-xs opacity-75">(${priceDisplay})</span>`;
    }

    btn.onclick = () => toggleSauce(sauce, btn);
    sauceList.appendChild(btn);
  });
}

/**
 * Renders the size selector buttons inside #sizeList.
 */
function renderSizes() {
  if (!sizeList) return;
  sizeList.innerHTML = "";

  sizes.forEach(size => {
    const btn = document.createElement("button");
    btn.className = "px-5 py-2 rounded-full border border-spice-gold/30 text-sm hover:bg-spice-gold hover:text-black";
    btn.innerText = `${size.name} (€${parseFloat(size.price).toFixed(2)})`;
    btn.onclick = () => selectSize(size, btn);

    // Highlight the currently selected size
    if (selectedSize && size.id === selectedSize.id) {
      activateButton(btn);
    }

    sizeList.appendChild(btn);
  });
}


// =============================================================================
// §6  KEBAB BUILDER — INTERACTION
//     Toggle / select handlers for ingredients, sauces, and sizes.
//     All handlers call updateSummary() and updatePrice() after state changes.
// =============================================================================

/**
 * Toggles an ingredient on/off from the selection.
 * @param {Object} ingredient - The ingredient object from DB.
 * @param {HTMLButtonElement} btn - The button that was clicked.
 */
function toggleIngredient(ingredient, btn) {
  const index = selectedIngredients.findIndex(i => i.id === ingredient.id);

  if (index > -1) {
    selectedIngredients.splice(index, 1);
    deactivateButton(btn);
  } else {
    selectedIngredients.push(ingredient);
    activateButton(btn);
  }

  updateSummary();
  updatePrice();
}

/**
 * Toggles a sauce on/off from the selection.
 * @param {Object} sauce - The sauce object from DB.
 * @param {HTMLButtonElement} btn - The button that was clicked.
 */
function toggleSauce(sauce, btn) {
  const index = selectedSauces.findIndex(s => s.id === sauce.id);

  if (index > -1) {
    selectedSauces.splice(index, 1);
    deactivateButton(btn);
  } else {
    selectedSauces.push(sauce);
    activateButton(btn);
  }

  updateSummary();
  updatePrice();
}

/**
 * Selects a kebab size, deselects all others, and refreshes the price.
 * @param {Object} size - The size object from DB.
 * @param {HTMLButtonElement} btn - The button that was clicked.
 */
function selectSize(size, btn) {
  selectedSize = size;
  kebabBasePrice = parseFloat(size.price);

  // Deactivate all size buttons first, then activate the chosen one
  if (sizeList) {
    [...sizeList.children].forEach(b => deactivateButton(b));
  }
  activateButton(btn);

  updatePrice();
  updateSummary();
}

/**
 * Visually activates a builder button (highlights it as selected).
 * Handles both image-tile and pill-button styles.
 * @param {HTMLButtonElement} btn
 */
function activateButton(btn) {
  if (btn.classList.contains("image-tile")) {
    btn.classList.add("border-spice-gold", "bg-spice-gold/10", "shadow-[0_0_15px_rgba(212,175,55,0.3)]");
    btn.classList.remove("border-transparent", "bg-gray-800/50");
  } else {
    btn.classList.add("bg-spice-gold", "text-black");
    btn.classList.remove("text-white", "border-spice-gold/30");
  }
}

/**
 * Visually deactivates a builder button (removes selected highlight).
 * @param {HTMLButtonElement} btn
 */
function deactivateButton(btn) {
  if (btn.classList.contains("image-tile")) {
    btn.classList.remove("border-spice-gold", "bg-spice-gold/10", "shadow-[0_0_15px_rgba(212,175,55,0.3)]");
    btn.classList.add("border-transparent", "bg-gray-800/50");
  } else {
    btn.classList.remove("bg-spice-gold", "text-black");
    btn.classList.add("text-white", "border-spice-gold/30");
  }
}


// =============================================================================
// §7  KEBAB BUILDER — SUMMARY & PRICE
//     Updates the live summary panel and price shown in the builder sidebar.
// =============================================================================

/**
 * Re-renders the kebab summary panel (#kebabSummary) based on current selections.
 */
function updateSummary() {
  if (!kebabSummary || !selectedSize) return;
  kebabSummary.innerHTML = "";

  const sizeEl = document.createElement("p");
  sizeEl.innerHTML = `<strong>Size:</strong> ${selectedSize.name}`;
  kebabSummary.appendChild(sizeEl);

  const ingEl = document.createElement("p");
  ingEl.innerHTML = `<strong>Ingredients:</strong> ${selectedIngredients.length
      ? selectedIngredients.map(i => i.name).join(", ")
      : "None"
    }`;
  kebabSummary.appendChild(ingEl);

  const sauceEl = document.createElement("p");
  sauceEl.innerHTML = `<strong>Sauces:</strong> ${selectedSauces.length
      ? selectedSauces.map(s => s.name).join(", ")
      : "None"
    }`;
  kebabSummary.appendChild(sauceEl);
}

/**
 * Recalculates and displays the current kebab total price.
 * Price = base size price + sum of selected ingredient prices + sum of selected sauce prices.
 */
function updatePrice() {
  if (!kebabPriceEl || !selectedSize) return;

  let total = parseFloat(kebabBasePrice);
  selectedIngredients.forEach(i => { total += parseFloat(i.price) || 0; });
  selectedSauces.forEach(s => { total += parseFloat(s.price) || 0; });

  kebabPriceEl.innerText = `€${total.toFixed(2)}`;
}


// =============================================================================
// §8  KEBAB BUILDER — ADD TO CART
//     Packages the current kebab configuration into a cart item object and
//     adds it to the cart.
// =============================================================================

/**
 * Handles the "Add to Cart" button click for custom kebabs.
 * Shows a spinner while processing, then pushes the item to the cart array.
 */
function handleAddKebabToCart() {
  if (!selectedSize) {
    showToast("Please wait for kebab options to load");
    return;
  }

  // Show loading state on the button
  addKebabBtn.classList.add("btn-loading");
  addKebabBtn.disabled = true;
  const original = addKebabBtn.innerHTML;
  addKebabBtn.innerHTML = `<span class="spinner"></span>`;

  // Small delay to let the spinner render visually
  setTimeout(() => {
    const kebabItem = {
      id: "custom-kebab-" + Date.now(), // unique ID per build
      name: "Custom Kebab",
      price: parseFloat(kebabPriceEl.innerText.replace("€", "")),
      qty: 1,
      category: "kebab",
      ingredients: selectedIngredients.map(i => i.name),
      sauces: selectedSauces.map(s => s.name),
      size: selectedSize.name
    };

    cart.push(kebabItem);
    saveCart();
    renderCart();
    showToast("Custom Kebab added!");

    // Restore button
    addKebabBtn.classList.remove("btn-loading");
    addKebabBtn.disabled = false;
    addKebabBtn.innerHTML = original;
  }, 600);
}


// =============================================================================
// §9  MENU — LOAD FROM DATABASE
//     Fetches biryani and curry items from get_menu.php and renders them
//     into their respective grid containers.
// =============================================================================

/**
 * Fetches active menu items from the server and populates the biryani and
 * curry grid sections. Items are categorised by their `category` DB field.
 */
async function loadMenuFromDB() {
  try {
    const res = await fetch("get_menu.php");
    const data = await res.json();

    if (!data.success) {
      showToast("Failed to load menu");
      return;
    }

    const items = data.data || [];

    // Clear grids before re-populating
    if (biryaniGrid) biryaniGrid.innerHTML = "";
    if (curryGrid) curryGrid.innerHTML = "";

    items.forEach(item => {
      const card = createFoodCardFromDB(item);

      if (item.category === "biryani" && biryaniGrid) biryaniGrid.appendChild(card);
      else if (item.category === "curry" && curryGrid) curryGrid.appendChild(card);
    });

  } catch (err) {
    console.error("[loadMenuFromDB]", err);
    showToast("Server error loading menu");
  }
}

/**
 * Creates a food card DOM element for a single DB menu item.
 * @param {Object} item - A row from the menu_items table.
 * @returns {HTMLDivElement} The fully built card element.
 */
function createFoodCardFromDB(item) {
  const card = document.createElement("div");
  card.className = "bg-gradient-to-br from-gray-900/70 to-black border border-spice-gold/20 rounded-3xl overflow-hidden group hover:scale-[1.02] transition";

  const imageUrl = item.image_url || "";
  const isPopular = item.is_popular == 1;
  const prepTime = item.prep_time || "N/A";
  const spiceLevel = parseInt(item.spice_level) || 0;
  const price = parseFloat(item.base_price) || 0;

  // Build dietary badge pills
  let badges = "";
  if (item.is_halal == 1) badges += `<span class="text-xs bg-green-900/70 border border-green-600/40 text-green-300 px-2 py-0.5 rounded-full">🌿 Halal</span>`;
  if (item.is_gluten_free == 1) badges += `<span class="text-xs bg-blue-900/70 border border-blue-600/40 text-blue-300 px-2 py-0.5 rounded-full">🌾 Gluten-Free</span>`;

  const allergenHtml = item.allergens
    ? `<p class="text-[11px] text-gray-500 mt-2"><strong>Contains:</strong> ${item.allergens}</p>`
    : "";

  card.innerHTML = `
    <div class="relative overflow-hidden">
      <img src="${imageUrl}" class="w-full h-48 object-cover hover-zoom"/>
      ${isPopular ? `<span class="absolute top-3 left-3 bg-spice-gold text-black text-xs px-3 py-1 rounded-full">Most Popular</span>` : ""}
    </div>

    <div class="p-6 space-y-3">
      <h3 class="text-xl font-bold">${item.name}</h3>

      <div class="flex items-center justify-between text-sm text-gray-300">
        <span>Prep: ${prepTime}</span>
        <span>${"🌶️".repeat(spiceLevel)}</span>
      </div>

      ${badges ? `<div class="flex flex-wrap gap-2">${badges}</div>` : ""}
      ${allergenHtml}

      <div class="flex justify-between items-center mt-4">
        <span class="text-spice-gold text-lg font-bold">€${price.toFixed(2)}</span>
        <button onclick="handleAddToCart(this, '${item.id}', '${item.name}', ${price}, '${item.category}')"
          class="bg-gradient-to-r from-amber-500 to-orange-500 text-black px-4 py-2 rounded-full text-sm hover:scale-105">
          Add to Cart
        </button>
      </div>
    </div>
  `;

  return card;
}


// =============================================================================
// §10 CART — ADD ITEM
//     Functions that handle adding individual food items (not kebabs) to cart.
// =============================================================================

/**
 * Wraps addFoodToCart with a visual loading state on the "Add to Cart" button.
 * @param {HTMLButtonElement} btn - The button that triggered the add.
 * @param {string} id - The menu item's DB ID.
 * @param {string} name - Display name of the item.
 * @param {number} price - Base price in euros.
 * @param {string} category - Item category (e.g. "biryani", "curry").
 */
function handleAddToCart(btn, id, name, price, category) {
  btn.classList.add("btn-loading");
  btn.disabled = true;
  const original = btn.innerHTML;
  btn.innerHTML = `<span class="spinner"></span>`;

  setTimeout(() => {
    addFoodToCart(id, name, price, category);
    btn.classList.remove("btn-loading");
    btn.disabled = false;
    btn.innerHTML = original;
  }, 600);
}

/**
 * Adds a food item to the cart. If the item already exists (same ID), increments
 * its quantity instead of creating a duplicate entry.
 * @param {string} id
 * @param {string} name
 * @param {number} price
 * @param {string} category
 */
function addFoodToCart(id, name, price, category) {
  const existing = cart.find(item => item.id === id);

  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id, name, price: parseFloat(price), qty: 1, category });
  }

  saveCart();
  renderCart();
  showToast(`${name} added to cart!`);
}


// =============================================================================
// §11 CART — DRAWER & RENDERING
//     Opens/closes the side cart drawer, persists cart to localStorage,
//     and renders every cart item along with cross-sell upsell blocks.
// =============================================================================

/** Opens the cart drawer and shows the overlay. */
function openCart() {
  if (cartDrawer && overlay) {
    cartDrawer.classList.remove("translate-x-full");
    overlay.classList.remove("pointer-events-none");
    overlay.classList.add("opacity-100");
  }
}

/** Closes the cart drawer and hides the overlay. */
function closeCart() {
  if (cartDrawer && overlay) {
    cartDrawer.classList.add("translate-x-full");
    overlay.classList.add("pointer-events-none");
    overlay.classList.remove("opacity-100");
  }
}

/**
 * Persists the current cart array to localStorage and refreshes the cart count badge.
 */
function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
}

/**
 * Fully re-renders the cart drawer contents.
 * Shows an empty state SVG when the cart is empty.
 * Shows cross-sell upsells at the bottom for sauces not yet in the cart.
 */
function renderCart() {
  if (!cartItemsEl || !cartTotalEl) return;

  // ── Empty cart state ──────────────────────────────────────────────────────
  if (cart.length === 0) {
    cartItemsEl.innerHTML = `
      <div class="text-center py-10 mt-8">
        <svg class="w-20 h-20 mx-auto mb-4 opacity-30 text-spice-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p class="text-gray-300 font-semibold text-lg">Your cart is empty</p>
        <p class="text-sm text-gray-500 mt-1 mb-6">Add some delicious dishes!</p>
        <button onclick="closeCart()" class="bg-spice-gold text-black px-6 py-2 rounded-full font-bold hover:bg-warm-amber transition">Browse Menu</button>
      </div>`;
    cartTotalEl.innerText = "€0.00";
    updateProgressBar(0);
    return;
  }

  // ── Render each cart item ─────────────────────────────────────────────────
  cartItemsEl.innerHTML = "";
  let total = 0;

  cart.forEach((item, index) => {
    const itemPrice = parseFloat(item.price) || 0;
    const itemQty = parseInt(item.qty) || 0;
    total += itemPrice * itemQty;

    const div = document.createElement("div");
    div.className = "bg-gray-900/70 p-4 rounded-xl border border-spice-gold/20";

    div.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h4 class="font-semibold">${item.name}</h4>
          ${item.size ? `<p class="text-xs text-gray-400">Size: ${item.size}</p>` : ""}
          ${item.ingredients ? `<p class="text-xs text-gray-400">Ingredients: ${Array.isArray(item.ingredients) ? item.ingredients.join(", ") : item.ingredients}</p>` : ""}
          ${item.sauces ? `<p class="text-xs text-gray-400">Sauces: ${Array.isArray(item.sauces) ? item.sauces.join(", ") : item.sauces}</p>` : ""}
        </div>
        <button onclick="removeFromCart(${index})" class="text-red-400">✕</button>
      </div>

      <div class="flex justify-between items-center mt-3">
        <div class="flex items-center gap-3">
          <button onclick="changeQty(${index}, -1)" class="px-2 py-1 bg-gray-700 rounded">-</button>
          <span>${itemQty}</span>
          <button onclick="changeQty(${index}, 1)"  class="px-2 py-1 bg-gray-700 rounded">+</button>
        </div>
        <span class="text-spice-gold font-bold">€${(itemPrice * itemQty).toFixed(2)}</span>
      </div>
    `;

    cartItemsEl.appendChild(div);
  });

  // ── Cross-sell upsell blocks ──────────────────────────────────────────────
  // Show sauce upsells only if that sauce isn't already in the cart.

  const hasSpicy = cart.some(i => i.name === "Spicy");
  const hasYogurt = cart.some(i => i.name === "Yogurt");

  /**
   * Builds a sauce upsell block and appends it to the cart items container.
   * @param {string} imageSrc  - Path to the sauce image.
   * @param {string} heading   - Bold headline text.
   * @param {string} sub       - Subtext below the heading.
   * @param {string} callbackArgs - Arguments string for addFoodToCart onclick.
   */
  function appendUpsell(imageSrc, heading, sub, callbackArgs) {
    const upsellDiv = document.createElement("div");
    upsellDiv.className = "mt-6 p-4 bg-gradient-to-r from-amber-900/40 to-black border border-amber-500/30 rounded-2xl relative overflow-hidden group";
    upsellDiv.innerHTML = `
      <div class="flex items-center justify-between relative z-10">
        <div class="flex items-center gap-3">
          <img src="${imageSrc}" class="w-12 h-12 rounded-full border border-amber-500/50 object-cover" alt="${heading}" />
          <div>
            <h5 class="font-bold text-amber-500 text-sm">${heading}</h5>
            <p class="text-xs text-gray-400">${sub}</p>
          </div>
        </div>
        <button onclick="addFoodToCart(${callbackArgs})"
          class="bg-amber-500/20 hover:bg-amber-500/40 text-amber-500 border border-amber-500/50 px-4 py-2 rounded-full text-xs font-bold transition group-hover:scale-105">
          + Add
        </button>
      </div>
    `;
    cartItemsEl.appendChild(upsellDiv);
  }

  if (!hasSpicy) appendUpsell("images/piccante.webp", "Need extra heat?", "Add Spicy Sauce", `'cross-sell-s1', 'Spicy',  0.50, 'sauce'`);
  if (!hasYogurt) appendUpsell("images/yoghurt.webp", "Want it mild?", "Add Yogurt Sauce", `'cross-sell-s2', 'Yogurt', 0.50, 'sauce'`);

  // ── Totals & progress bar ─────────────────────────────────────────────────
  cartTotalEl.innerText = `€${total.toFixed(2)}`;
  updateProgressBar(total);
}

/**
 * Adjusts the quantity of a cart item by delta (+1 or -1).
 * If quantity reaches 0, the item is removed from the cart.
 * @param {number} index - Cart array index.
 * @param {number} delta - +1 to increase, -1 to decrease.
 */
function changeQty(index, delta) {
  if (!cart[index]) return;

  cart[index].qty += delta;

  if (cart[index].qty <= 0) {
    cart.splice(index, 1); // Remove item when quantity hits zero
  }

  saveCart();
  renderCart();
}

/**
 * Removes an item from the cart by its array index.
 * @param {number} index - Cart array index.
 */
function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart();
  renderCart();
}

/**
 * Updates the cart badge count shown in the navigation bar.
 */
function updateCartCount() {
  if (!cartCountEl) return;
  const count = cart.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
  cartCountEl.innerText = `(${count})`;
}

/**
 * Updates the progress bar that fills as the cart total approaches €50.
 * Gives customers a visual incentive to add more items.
 * @param {number} total - Current cart total in euros.
 */
function updateProgressBar(total) {
  if (!cartProgress) return;
  const MAX_FOR_FULL_BAR = 50; // Bar fills completely at €50
  const percent = Math.min((total / MAX_FOR_FULL_BAR) * 100, 100);
  cartProgress.style.width = percent + "%";
}


// =============================================================================
// §12 TOAST NOTIFICATIONS
//     A lightweight pop-up notification shown at the bottom of the screen.
// =============================================================================

/**
 * Displays the upsell toast suggesting a sauce add.
 * @param {string} itemName - The name of the item just added to the cart.
 */
function showCartUpsellToast(itemName) {
  showToast(`Wait! Want an extra kick? Try our Spicy Sauce with your ${itemName}!`);
}

/**
 * Shows a brief text toast notification at the bottom of the screen.
 * Automatically hides after 3 seconds.
 * @param {string} message - The text to display in the toast.
 */
function showToast(message) {
  if (!toast) return;
  toast.innerText = message;
  toast.classList.remove("translate-y-10", "opacity-0", "pointer-events-none");
  toast.classList.add("translate-y-0", "opacity-100");

  setTimeout(() => {
    toast.classList.remove("translate-y-0", "opacity-100");
    toast.classList.add("translate-y-10", "opacity-0", "pointer-events-none");
  }, 3000);
}