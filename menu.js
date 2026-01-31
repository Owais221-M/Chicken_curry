 
// GLOBAL STATE

let ingredients = [];
let sauces = [];
let sizes = [];

let selectedIngredients = [];
let selectedSauces = [];
let selectedSize = null;
let kebabBasePrice = 0;

let cart = JSON.parse(localStorage.getItem("cart")) || [];

 
// DOM ELEMENT REFERENCES
 

const ingredientList = document.getElementById("ingredientList");
const sauceList = document.getElementById("sauceList");
const sizeList = document.getElementById("sizeList");
const kebabSummary = document.getElementById("kebabSummary");
const kebabPriceEl = document.getElementById("kebabPrice");
const addKebabBtn = document.getElementById("addKebabToCart");
const toast = document.getElementById("toast");

const biryaniGrid = document.getElementById("biryaniGrid");
const curryGrid = document.getElementById("curryGrid");

const cartDrawer = document.getElementById("cartDrawer");
const cartBtn = document.getElementById("cartBtn");
const overlay = document.getElementById("overlay");
const cartItemsEl = document.getElementById("cartItems");
const cartTotalEl = document.getElementById("cartTotal");
const cartCountEl = document.getElementById("cartCount");
const cartProgress = document.getElementById("cartProgress");

const checkoutModal = document.getElementById("checkoutModal");
const successModal = document.getElementById("successModal");
const checkoutForm = document.getElementById("checkoutForm");
const customerName = document.getElementById("customerName");
const customerPhone = document.getElementById("customerPhone");
const customerNotes = document.getElementById("customerNotes");
const nameError = document.getElementById("nameError");
const phoneError = document.getElementById("phoneError");
const checkoutBtn = document.getElementById("checkoutBtn");

 
// INITIALIZATION
 

document.addEventListener("DOMContentLoaded", () => {
  loadKebabData();
  loadMenuFromDB();
  renderCart();
  updateCartCount();
  initEventListeners();
});

function initEventListeners() {
  cartBtn.addEventListener("click", openCart);
  overlay.addEventListener("click", closeCart);

  checkoutBtn.addEventListener("click", () => {
    if (cart.length === 0) {
      showToast("Your cart is empty!");
      return;
    }
    checkoutModal.classList.remove("opacity-0", "pointer-events-none");
  });

  checkoutForm.addEventListener("submit", (e) => {
    e.preventDefault();

    let valid = true;

    if (!customerName.value.trim()) {
      nameError.classList.remove("hidden");
      valid = false;
    } else {
      nameError.classList.add("hidden");
    }

    if (!customerPhone.value.trim()) {
      phoneError.classList.remove("hidden");
      valid = false;
    } else {
      phoneError.classList.add("hidden");
    }

    if (!valid) return;

    completeOrder();
  });

  addKebabBtn.addEventListener("click", handleAddKebabToCart);
}

 
// KEBAB BUILDER - DATA LOADING
 

async function loadKebabData() {
  try {
    const res = await fetch("api/get_kebab_data.php");
    const data = await res.json();

    if (!data.success) {
      showToast("Failed to load kebab options");
      return;
    }

    ingredients = data.data.ingredients || [];
    sauces = data.data.sauces || [];
    sizes = data.data.sizes || [];

    // Set default size only if sizes exist
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
    console.error(err);
    showToast("Server error loading kebab data");
  }
}

 
// KEBAB BUILDER - RENDERING
 

function renderIngredients() {
  if (!ingredientList) return;
  
  ingredientList.innerHTML = "";
  ingredients.forEach(ing => {
    const btn = document.createElement("button");
    btn.className = "px-4 py-2 rounded-full border border-spice-gold/30 text-sm hover:bg-spice-gold hover:text-black flex items-center gap-2";
    btn.innerHTML = `${ing.icon || ""} ${ing.name}`;
    btn.onclick = () => toggleIngredient(ing, btn);
    ingredientList.appendChild(btn);
  });
}

function renderSauces() {
  if (!sauceList) return;
  
  sauceList.innerHTML = "";
  sauces.forEach(sauce => {
    const btn = document.createElement("button");
    btn.className = "px-4 py-2 rounded-full border border-spice-gold/30 text-sm hover:bg-spice-gold hover:text-black flex items-center gap-2";
    btn.innerHTML = `${sauce.icon || ""} ${sauce.name}`;
    btn.onclick = () => toggleSauce(sauce, btn);
    sauceList.appendChild(btn);
  });
}

function renderSizes() {
  if (!sizeList) return;
  
  sizeList.innerHTML = "";
  sizes.forEach(size => {
    const btn = document.createElement("button");
    btn.className = "px-5 py-2 rounded-full border border-spice-gold/30 text-sm hover:bg-spice-gold hover:text-black";
    btn.innerText = `${size.name} (€${parseFloat(size.price).toFixed(2)})`;
    btn.onclick = () => selectSize(size, btn);
    if (selectedSize && size.id === selectedSize.id) {
      activateButton(btn);
    }
    sizeList.appendChild(btn);
  });
}

 
// KEBAB BUILDER - INTERACTION
 

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

function selectSize(size, btn) {
  selectedSize = size;
  kebabBasePrice = parseFloat(size.price);

  if (sizeList) {
    [...sizeList.children].forEach(b => deactivateButton(b));
  }
  activateButton(btn);

  updatePrice();
  updateSummary();
}

function activateButton(btn) {
  btn.classList.add("bg-spice-gold", "text-black");
  btn.classList.remove("text-white");
}

function deactivateButton(btn) {
  btn.classList.remove("bg-spice-gold", "text-black");
  btn.classList.add("text-white");
}

 
// KEBAB BUILDER - SUMMARY & PRICE
 

function updateSummary() {
  if (!kebabSummary || !selectedSize) return;

  kebabSummary.innerHTML = "";

  const sizeEl = document.createElement("p");
  sizeEl.innerHTML = `<strong>Size:</strong> ${selectedSize.name}`;
  kebabSummary.appendChild(sizeEl);

  const ingEl = document.createElement("p");
  ingEl.innerHTML = `<strong>Ingredients:</strong> ${
    selectedIngredients.length ? selectedIngredients.map(i => i.name).join(", ") : "None"
  }`;
  kebabSummary.appendChild(ingEl);

  const sauceEl = document.createElement("p");
  sauceEl.innerHTML = `<strong>Sauces:</strong> ${
    selectedSauces.length ? selectedSauces.map(s => s.name).join(", ") : "None"
  }`;
  kebabSummary.appendChild(sauceEl);
}

function updatePrice() {
  if (!kebabPriceEl || !selectedSize) return;

  let total = parseFloat(kebabBasePrice);

  selectedIngredients.forEach(i => {
    total += parseFloat(i.price) || 0;
  });

  selectedSauces.forEach(s => {
    total += parseFloat(s.price) || 0;
  });

  kebabPriceEl.innerText = `€${total.toFixed(2)}`;
}

 
// KEBAB BUILDER - ADD TO CART
 

function handleAddKebabToCart() {
  if (!selectedSize) {
    showToast("Please wait for kebab options to load");
    return;
  }

  addKebabBtn.classList.add("btn-loading");
  addKebabBtn.disabled = true;
  const original = addKebabBtn.innerHTML;
  addKebabBtn.innerHTML = `<span class="spinner"></span>`;

  setTimeout(() => {
    const kebabItem = {
      id: "custom-kebab-" + Date.now(),
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

    addKebabBtn.classList.remove("btn-loading");
    addKebabBtn.disabled = false;
    addKebabBtn.innerHTML = original;
  }, 600);
}

 
// MENU - LOAD FROM DATABASE
 

async function loadMenuFromDB() {
  try {
    const res = await fetch("api/get_menu.php");
    const data = await res.json();

    if (!data.success) {
      showToast("Failed to load menu");
      return;
    }

    const items = data.data || [];

    if (biryaniGrid) biryaniGrid.innerHTML = "";
    if (curryGrid) curryGrid.innerHTML = "";

    items.forEach(item => {
      const card = createFoodCardFromDB(item);

      if (item.category === "biryani" && biryaniGrid) {
        biryaniGrid.appendChild(card);
      } else if (item.category === "curry" && curryGrid) {
        curryGrid.appendChild(card);
      }
    });

  } catch (err) {
    console.error(err);
    showToast("Server error loading menu");
  }
}

function createFoodCardFromDB(item) {
  const card = document.createElement("div");
  card.className = "bg-gradient-to-br from-gray-900/70 to-black border border-spice-gold/20 rounded-3xl overflow-hidden group hover:scale-[1.02] transition";

  const imageUrl = item.image_url || "";
  const isPopular = item.is_popular == 1;
  const prepTime = item.prep_time || "N/A";
  const spiceLevel = parseInt(item.spice_level) || 0;
  const price = parseFloat(item.base_price) || 0;

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

 
// CART - ADD ITEM
 

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

function addFoodToCart(id, name, price, category) {
  const existing = cart.find(item => item.id === id);

  if (existing) {
    existing.qty++;
  } else {
    cart.push({
      id,
      name,
      price: parseFloat(price),
      qty: 1,
      category
    });
  }

  saveCart();
  renderCart();
  showToast(`${name} added to cart!`);
}

 
// CART - DRAWER & RENDERING
 

function openCart() {
  if (cartDrawer && overlay) {
    cartDrawer.classList.remove("translate-x-full");
    overlay.classList.remove("pointer-events-none");
    overlay.classList.add("opacity-100");
  }
}

function closeCart() {
  if (cartDrawer && overlay) {
    cartDrawer.classList.add("translate-x-full");
    overlay.classList.add("pointer-events-none");
    overlay.classList.remove("opacity-100");
  }
}

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartCount();
}

function renderCart() {
  if (!cartItemsEl || !cartTotalEl) return;

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
          ${item.ingredients && item.ingredients.length > 0 ? `<p class="text-xs text-gray-400">Ingredients: ${item.ingredients.join(", ")}</p>` : ""}
          ${item.sauces && item.sauces.length > 0 ? `<p class="text-xs text-gray-400">Sauces: ${item.sauces.join(", ")}</p>` : ""}
        </div>
        <button onclick="removeFromCart(${index})" class="text-red-400">✕</button>
      </div>

      <div class="flex justify-between items-center mt-3">
        <div class="flex items-center gap-3">
          <button onclick="changeQty(${index}, -1)" class="px-2 py-1 bg-gray-700 rounded">-</button>
          <span>${itemQty}</span>
          <button onclick="changeQty(${index}, 1)" class="px-2 py-1 bg-gray-700 rounded">+</button>
        </div>
        <span class="text-spice-gold font-bold">€${(itemPrice * itemQty).toFixed(2)}</span>
      </div>
    `;

    cartItemsEl.appendChild(div);
  });

  cartTotalEl.innerText = `€${total.toFixed(2)}`;
  updateProgressBar(total);
}

function changeQty(index, delta) {
  if (!cart[index]) return;

  cart[index].qty += delta;

  if (cart[index].qty <= 0) {
    cart.splice(index, 1);
  }

  saveCart();
  renderCart();
}

function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart();
  renderCart();
}

function updateCartCount() {
  if (!cartCountEl) return;
  const count = cart.reduce((sum, item) => sum + (parseInt(item.qty) || 0), 0);
  cartCountEl.innerText = `(${count})`;
}

function updateProgressBar(total) {
  if (!cartProgress) return;
  const max = 50;
  const percent = Math.min((total / max) * 100, 100);
  cartProgress.style.width = percent + "%";
}

// CHECKOUT
 

function closeCheckout() {
  if (checkoutModal) {
    checkoutModal.classList.add("opacity-0", "pointer-events-none");
  }
}

let isSubmittingOrder = false;

async function completeOrder() {
  if (isSubmittingOrder) return;
  isSubmittingOrder = true;

  const payload = {
    name: customerName.value.trim(),
    phone: customerPhone.value.trim(),
    notes: customerNotes.value.trim(),
    cart: cart
  };

  try {
    const res = await fetch("api/create_order.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!data.success) {
      showToast(data.message || "Something went wrong");
      isSubmittingOrder = false;
      return;
    }

    closeCheckout();

    cart = [];
    saveCart();
    renderCart();

    checkoutForm.reset();

    const successTitle = document.querySelector("#successModal h2");
    const successMessage = document.querySelector("#successModal p");
    
    if (successTitle) successTitle.innerText = "Order Confirmed!";
    if (successMessage) successMessage.innerText = `Your order ID is #${data.data.order_id}`;

    if (successModal) {
      successModal.classList.remove("opacity-0", "pointer-events-none");
    }

    isSubmittingOrder = false;

  } catch (err) {
    console.error(err);
    showToast("Server error. Try again.");
    isSubmittingOrder = false;
  }
}

function closeSuccess() {
  if (successModal) {
    successModal.classList.add("opacity-0", "pointer-events-none");
  }
}

 
// TOAST NOTIFICATIONS
 

function showToast(message) {
  if (!toast) return;
  
  toast.innerText = message;
  toast.classList.remove("toast-hide");
  toast.classList.add("toast-show");

  setTimeout(() => {
    toast.classList.remove("toast-show");
    toast.classList.add("toast-hide");
  }, 2000);
}