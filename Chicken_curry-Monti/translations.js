/**
 * translations.js — Internationalisation (i18n) Stub
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides multi-language support for the website. Elements with a data-i18n
 * attribute will have their text content replaced based on the active language.
 *
 * Currently ships with English (en) and Italian (it).
 * To add a new language, add a key to the `translations` object below and
 * include all the same translation keys.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const translations = {
  en: {
    // Navigation
    nav_menu: "Menu",
    nav_about: "About",
    nav_dishes: "Signature Dishes",
    nav_visit: "Visit Us",
    nav_contact: "Contact",

    // Hero
    hero_banner: "Experience the Authentic Taste of Indian & Pakistani Cuisine right here in Messina.",
    hero_title_1: "Spice Up",
    hero_subtitle: "Authentic chicken curry, kebabs, biryani, and more — freshly cooked, beautifully served, unforgettable.",
    hero_cta_order: "View Menu",
    hero_cta_menu: "Visit Us Today",

    // Stats
    stat_spices: "Types of Spices",
    stat_curries: "Curries & Kebabs",
    stat_love: "Made with Love",

    // Dishes
    dish_curry_title: "Butter Chicken",
    dish_curry_desc: "Our signature dish that put us on the map. Tender chicken simmered in a rich, aromatic curry sauce with traditional spices.",
    dish_biryani_title: "Chicken Biryani",
    dish_biryani_desc: "Fragrant basmati rice layered with succulent chicken, slow-cooked with saffron and aromatic spices.",
    dish_kebab_title: "Mixed Kebab",
    dish_kebab_desc: "Perfectly marinated chicken grilled to smoky perfection. Each kebab is bursting with authentic spices and herbs.",

    // Checkout
    checkout_complete_title: "Complete Your Order",
    checkout_complete_sub: "Just a few more details and your delicious meal will be ready for pickup!",
    checkout_order_type: "Order Type",
    checkout_pickup: "Pickup",
    checkout_delivery: "Delivery (€3.00)",
    checkout_time_pickup: "Ready in 15-20 mins",
    checkout_time_delivery: "30-45 mins",
    checkout_contact: "Contact Information",
    checkout_fname: "First Name *",
    checkout_lname: "Last Name *",
    checkout_email: "Email Address *",
    checkout_phone: "Phone Number *",
    checkout_delivery_addr: "Delivery Address",
    checkout_street: "Street Address *",
    checkout_city: "City *",
    checkout_postal: "Postal Code *",
    checkout_notes: "Delivery Notes",
    checkout_payment: "Payment Method",
    checkout_card: "Card Payment",
    checkout_apple: "Express Checkout",
    checkout_special: "Special Instructions",
    checkout_summary: "Order Summary",
    checkout_subtotal: "Subtotal",
    checkout_service: "Service Fee",
    checkout_place: "Place Order",
  },

  it: {
    // Navigation
    nav_menu: "Menu",
    nav_about: "Chi Siamo",
    nav_dishes: "Piatti Speciali",
    nav_visit: "Visitaci",
    nav_contact: "Contatti",

    // Hero
    hero_banner: "Scopri il gusto autentico della cucina indiana e pakistana qui a Messina.",
    hero_title_1: "Sapori Unici",
    hero_subtitle: "Curry di pollo autentici, kebab, biryani e altro ancora — cucinati freschi, serviti con cura, indimenticabili.",
    hero_cta_order: "Vedi il Menu",
    hero_cta_menu: "Vieni a Trovarci",

    // Stats
    stat_spices: "Tipi di Spezie",
    stat_curries: "Curry e Kebab",
    stat_love: "Fatto con Amore",

    // Dishes
    dish_curry_title: "Butter Chicken",
    dish_curry_desc: "Il nostro piatto forte. Pollo tenero cotto in una salsa ricca e aromatica con spezie tradizionali.",
    dish_biryani_title: "Chicken Biryani",
    dish_biryani_desc: "Riso basmati profumato con pollo succulento, cotto lentamente con zafferano e spezie aromatiche.",
    dish_kebab_title: "Kebab Misto",
    dish_kebab_desc: "Pollo perfettamente marinato e grigliato alla perfezione. Ogni kebab è ricco di spezie ed erbe autentiche.",

    // Checkout
    checkout_complete_title: "Completa il Tuo Ordine",
    checkout_complete_sub: "Ancora pochi dettagli e il tuo delizioso pasto sarà pronto!",
    checkout_order_type: "Tipo di Ordine",
    checkout_pickup: "Ritiro",
    checkout_delivery: "Consegna (€3,00)",
    checkout_time_pickup: "Pronto in 15-20 min",
    checkout_time_delivery: "30-45 min",
    checkout_contact: "Informazioni di Contatto",
    checkout_fname: "Nome *",
    checkout_lname: "Cognome *",
    checkout_email: "Indirizzo Email *",
    checkout_phone: "Numero di Telefono *",
    checkout_delivery_addr: "Indirizzo di Consegna",
    checkout_street: "Via *",
    checkout_city: "Città *",
    checkout_postal: "CAP *",
    checkout_notes: "Note per la Consegna",
    checkout_payment: "Metodo di Pagamento",
    checkout_card: "Pagamento con Carta",
    checkout_apple: "Pagamento Rapido",
    checkout_special: "Istruzioni Speciali",
    checkout_summary: "Riepilogo Ordine",
    checkout_subtotal: "Subtotale",
    checkout_service: "Costo del Servizio",
    checkout_place: "Conferma Ordine",
  }
};

// ─── Language Detection & Application ─────────────────────────────────────────

/**
 * Detects the user's preferred language from:
 *  1. localStorage (if they've chosen previously)
 *  2. Browser navigator.language
 * Falls back to English if not supported.
 */
function getPreferredLanguage() {
  const saved = localStorage.getItem('lang');
  if (saved && translations[saved]) return saved;

  const browserLang = (navigator.language || 'en').split('-')[0].toLowerCase();
  return translations[browserLang] ? browserLang : 'en';
}

/**
 * Applies translations to all elements with a data-i18n attribute.
 * @param {string} lang - Language code (e.g. 'en', 'it')
 */
function applyTranslations(lang) {
  const dict = translations[lang];
  if (!dict) return;

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      // For input elements, update placeholder; for others, update text
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = dict[key];
      } else {
        el.textContent = dict[key];
      }
    }
  });

  localStorage.setItem('lang', lang);
  document.documentElement.lang = lang;
}

/**
 * Switches to a specific language and re-applies all translations.
 * @param {string} lang - Language code
 */
function switchLanguage(lang) {
  applyTranslations(lang);
}

// Auto-apply on page load
document.addEventListener('DOMContentLoaded', () => {
  const lang = getPreferredLanguage();
  applyTranslations(lang);
});
