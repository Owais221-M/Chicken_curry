# Chicken Curry Messina

A full-featured **online ordering website** for Chicken Curry Messina, an authentic Indian & Bangladeshi restaurant based in Messina, Sicily. Customers can build custom kebabs, order biryanis and curries, and pay online — all from a sleek, mobile-friendly interface.

---

## Features

- **Interactive Kebab Builder** — choose ingredients, sauces, and size with live price updates
- **Biryani & Curry Menu** — dynamically loaded from the database with dietary badges (Halal, Gluten-Free) and spice level indicators
- **Shopping Cart** — persistent across page refreshes via `localStorage`, with quantity controls and sauce upsells
- **Checkout** — pickup or delivery with address fields, Stripe card payments, and Apple/Google Pay support
- **Admin Dashboard** — real-time kitchen display with Kanban-style order status management
- **Opening Hours Banner** — automatically shows a "we're closed" banner outside 12:00–22:00
- **Responsive Design** — works on all screen sizes, from mobile to desktop

---

## 🗂 Project Structure

```
chicken-curry-messina/
│
├── home.html           # Landing page (hero, about, location, contact)
├── menu.html           # Menu page (kebab builder + biryani/curry grids)
├── checkout.html       # Order checkout (cart review, form, Stripe payment)
├── admin.php           # Password-protected admin/kitchen dashboard
├── 404.html            # Custom 404 error page
├── privacy.html        # Privacy policy
├── terms.html          # Terms & conditions
│
├── menu.js             # All menu page JavaScript (kebab builder, cart, rendering)
├── styles.css          # Custom CSS on top of Tailwind (animations, glass cards)
│
├── db.php              # MySQL database connection (reads env vars)
├── helpers.php         # Shared jsonResponse() utility
├── get_menu.php        # API: returns active menu items (biryanis & curries)
├── get_kebab_data.php  # API: returns active ingredients, sauces, sizes
├── create_order.php    # API: validates cart, charges Stripe, saves order
│
├── chicken_curry_db.sql # Database schema & seed data
├── Dockerfile
├── docker-compose.yml
└── images/             # Food & ingredient photos (.webp)
```

---

## Quick Start (Docker — Recommended)

### Prerequisites
- [Docker](https://www.docker.com/get-started) and Docker Compose installed

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-username/chicken-curry-messina.git
cd chicken-curry-messina

# 2. Copy and configure environment variables
cp .env.example .env
# Edit .env and fill in your DB password and Stripe keys

# 3. Start all services (PHP + MySQL)
docker-compose up -d

# 4. Import the database schema
docker exec -i <db_container_name> mysql -u root -p chicken_curry_db < chicken_curry_db.sql

# 5. Open in your browser
open http://localhost
```

---

## Manual Setup (XAMPP / Local PHP Server)

### Prerequisites
- PHP 8.0+
- MySQL 5.7+
- A web server (Apache, Nginx, or `php -S`)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-username/chicken-curry-messina.git
cd chicken-curry-messina

# 2. Import the database
mysql -u root -p < chicken_curry_db.sql

# 3. Set environment variables (or edit the fallbacks in db.php)
export DB_HOST=localhost
export DB_USER=root
export DB_PASSWORD=your_password
export DB_NAME=chicken_curry_db

# 4. Start the PHP dev server
php -S localhost:8000

# 5. Open in your browser
open http://localhost:8000/home.html
```

---

## 🔑 Environment Variables

| Variable         | Required | Description                                  | Example                              |
|------------------|----------|----------------------------------------------|--------------------------------------|
| `DB_HOST`        | Yes      | MySQL hostname                               | `localhost`                          |
| `DB_USER`        | Yes      | MySQL username                               | `root`                               |
| `DB_PASSWORD`    | **Yes**  | MySQL password — **never commit this!**      | `your_secure_password`               |
| `DB_NAME`        | Yes      | MySQL database name                          | `chicken_curry_db`                   |
| `STRIPE_SECRET_KEY` | Yes   | Stripe secret key (server-side)             | `sk_live_...`                        |
| `APP_URL`        | Yes      | Public URL of the site (for Stripe redirect) | `https://chickencurrymessina.com`    |

>  **Never commit real credentials to Git.** Use environment variables or a `.env` file excluded by `.gitignore`.

---

##  Stripe Payment Setup

1. Create a free account at [stripe.com](https://stripe.com)
2. Get your **Publishable Key** and **Secret Key** from the Stripe Dashboard
3. Replace the placeholder in `checkout.html`:
   ```js
   const stripe = Stripe('pk_live_YOUR_PUBLISHABLE_KEY');
   ```
4. Set your secret key as an environment variable:
   ```bash
   export STRIPE_SECRET_KEY=sk_live_YOUR_SECRET_KEY
   ```
5. Update `create_order.php` to read it:
   ```php
   $stripe_secret_key = getenv('STRIPE_SECRET_KEY');
   ```

---

## Admin Dashboard

The admin panel at `/admin.php` provides a real-time kitchen display for managing orders.

**Default login:** Set up an admin account by inserting a hashed password into the `admins` table:

```sql
INSERT INTO admins (username, password_hash)
VALUES ('admin', '$2y$10$...bcrypt_hash_here...');
```

To generate a bcrypt hash in PHP:
```php
echo password_hash('your_password', PASSWORD_BCRYPT);
```

---

## Database Schema

The main tables are:

| Table          | Purpose                                         |
|----------------|-------------------------------------------------|
| `menu_items`   | Biryanis, curries (name, price, image, badges)  |
| `ingredients`  | Kebab ingredient options with prices            |
| `sauces`       | Sauce options with prices                       |
| `sizes`        | Kebab size options with base prices             |
| `orders`       | Customer orders (name, phone, total, status)    |
| `order_items`  | Individual line items linked to an order        |
| `admins`       | Admin login credentials (bcrypt password hash)  |

Full schema in [`chicken_curry_db.sql`](chicken_curry_db.sql).

---

## Running Tests

There are currently no automated tests. Manual testing checklist:

- [ ] Kebab builder updates price live as you select ingredients/sauces/sizes
- [ ] "Add to Cart" increments the cart badge and shows a toast
- [ ] Cart persists on page refresh (localStorage)
- [ ] Checkout form validates required fields before submission
- [ ] Stripe card payment processes and returns an order ID
- [ ] Admin dashboard shows new orders and allows status updates
- [ ] Closed banner appears outside 12:00–22:00

---

## Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** — keep commits small and focused
4. **Test manually** using the checklist above
5. **Open a Pull Request** with a clear description of what you changed and why

### Code Style Guidelines
- PHP: use prepared statements for **all** queries — no raw SQL with user input
- JavaScript: add a JSDoc comment to every new function
- HTML: add an HTML comment before each major section block
- Keep section structure consistent with the existing numbered section banners in `menu.js` and `create_order.php`

---

## Technology Stack

| Layer       | Technology                            |
|-------------|---------------------------------------|
| Frontend    | HTML5, Vanilla CSS, Vanilla JavaScript |
| Styling     | Tailwind CSS (CDN), custom `styles.css` |
| Icons       | Lucide Icons                          |
| Fonts       | Google Fonts (Outfit, Playfair Display) |
| Backend     | PHP 8                                 |
| Database    | MySQL                                 |
| Payments    | Stripe (card + Apple/Google Pay)      |
| Deployment  | Docker + Docker Compose               |

---

## License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for full details.

---

## Contact

**Chicken Curry Messina**
-  Email: [orders@chickencurrymessina.com](mailto:orders@chickencurrymessina.com)
-  Address: Messina, Sicily, Italy
-  Website: [chickencurrymessina.com](https://chickencurrymessina.com)

For development questions, open an [issue on GitHub](https://github.com/your-username/chicken-curry-messina/issues).

---

*Made with ❤️ and 🌶️ in Messina*
