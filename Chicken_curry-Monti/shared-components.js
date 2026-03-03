/**
 * shared-components.js — Cookie Consent + WhatsApp + Offers Banner
 * ─────────────────────────────────────────────────────────────────
 * Auto-injected components for every customer-facing page.
 * Include at the end of <body>: <script src="shared-components.js"></script>
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════
    // 1. COOKIE CONSENT BANNER (GDPR / EU ePrivacy Directive)
    // ═══════════════════════════════════════════════════════════════════════
    if (!localStorage.getItem('cc_consent')) {
        const banner = document.createElement('div');
        banner.id = 'cookie-consent';
        banner.innerHTML = `
            <div style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#111;border-top:1px solid #D4AF37;padding:16px 20px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px;font-family:'Outfit',sans-serif;font-size:13px;color:#ccc;">
                <span style="flex:1;min-width:200px;">
                    🍪 We use cookies and local storage to improve your experience. By continuing, you agree to our
                    <a href="privacy.html" style="color:#D4AF37;text-decoration:underline;">Privacy Policy</a>.
                </span>
                <div style="display:flex;gap:8px;flex-shrink:0;">
                    <button id="cc-accept" style="background:linear-gradient(to right,#F59E0B,#F97316);color:#000;font-weight:700;padding:8px 20px;border-radius:8px;border:none;cursor:pointer;font-size:13px;">Accept All</button>
                    <button id="cc-essential" style="background:transparent;border:1px solid #555;color:#ccc;padding:8px 16px;border-radius:8px;cursor:pointer;font-size:13px;">Essential Only</button>
                </div>
            </div>
        `;
        document.body.appendChild(banner);

        document.getElementById('cc-accept').addEventListener('click', function () {
            localStorage.setItem('cc_consent', 'all');
            banner.remove();
        });
        document.getElementById('cc-essential').addEventListener('click', function () {
            localStorage.setItem('cc_consent', 'essential');
            banner.remove();
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 2. WHATSAPP FLOATING BUTTON
    // ═══════════════════════════════════════════════════════════════════════
    // The phone number is loaded from the settings API if available,
    // otherwise falls back to the data attribute on the script tag.
    const scriptTag = document.querySelector('script[src*="shared-components"]');
    const waNumber = scriptTag?.getAttribute('data-whatsapp') || '39XXXXXXXXXX';

    if (waNumber && waNumber !== '39XXXXXXXXXX') {
        const waBtn = document.createElement('a');
        waBtn.href = `https://wa.me/${waNumber.replace(/\D/g, '')}?text=${encodeURIComponent('Hi! I\'d like to place an order 🍛')}`;
        waBtn.target = '_blank';
        waBtn.rel = 'noopener noreferrer';
        waBtn.setAttribute('aria-label', 'Chat on WhatsApp');
        waBtn.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9990;width:56px;height:56px;border-radius:50%;background:#25D366;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(37,211,102,0.4);transition:transform 0.2s;cursor:pointer;';
        waBtn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;
        waBtn.addEventListener('mouseenter', function () { this.style.transform = 'scale(1.1)'; });
        waBtn.addEventListener('mouseleave', function () { this.style.transform = 'scale(1)'; });
        document.body.appendChild(waBtn);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 3. OFFERS BANNER (fetches active offers from get_offers.php)
    // ═══════════════════════════════════════════════════════════════════════
    // Only show on home and menu pages
    const page = window.location.pathname.split('/').pop() || 'home.html';
    const showOfferPages = ['home.html', 'menu.html', ''];

    if (showOfferPages.includes(page)) {
        fetch('get_offers.php')
            .then(r => r.json())
            .then(data => {
                if (!data.success || !data.data || data.data.length === 0) return;

                const offers = data.data;
                const container = document.createElement('div');
                container.id = 'offers-ticker';
                container.style.cssText = 'background:linear-gradient(90deg,#D4AF37,#FF8C00);color:#000;overflow:hidden;white-space:nowrap;font-family:"Outfit",sans-serif;font-size:14px;font-weight:600;position:relative;z-index:40;';

                const track = document.createElement('div');
                track.style.cssText = 'display:inline-block;animation:ticker 20s linear infinite;padding:10px 0;';

                const text = offers.map(o => {
                    let label = '';
                    if (o.discount_type === 'percentage') label = `${o.title} — ${parseFloat(o.discount_value)}% OFF`;
                    else if (o.discount_type === 'fixed') label = `${o.title} — €${parseFloat(o.discount_value).toFixed(2)} OFF`;
                    else label = o.title;
                    if (o.coupon_code) label += ` (Code: ${o.coupon_code})`;
                    if (o.min_order_amount > 0) label += ` • Min order €${parseFloat(o.min_order_amount).toFixed(2)}`;
                    return '🔥 ' + label;
                }).join('     ✦     ');

                track.textContent = text + '     ✦     ' + text; // Duplicate for seamless loop
                container.appendChild(track);

                // Inject after nav or at top of body
                const nav = document.querySelector('nav') || document.querySelector('header');
                if (nav && nav.nextSibling) nav.parentNode.insertBefore(container, nav.nextSibling);
                else document.body.prepend(container);

                // Add animation
                const style = document.createElement('style');
                style.textContent = '@keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}';
                document.head.appendChild(style);
            })
            .catch(() => { /* silently fail — offers are non-essential */ });
    }
})();
