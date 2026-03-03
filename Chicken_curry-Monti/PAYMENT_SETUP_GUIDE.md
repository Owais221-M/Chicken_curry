# Payment Integration Setup Guide
## Chicken Curry Messina - Checkout System

This guide will help you set up **Stripe**, **Apple Pay**, and **Google Pay** for your restaurant checkout page.

---

## 📋 Table of Contents
1. [Stripe Setup](#stripe-setup)
2. [Apple Pay Setup](#apple-pay-setup)
3. [Google Pay Setup](#google-pay-setup)
4. [Backend Integration](#backend-integration)
5. [Testing](#testing)
6. [Going Live](#going-live)

---

## 💳 Stripe Setup

### Step 1: Create a Stripe Account
1. Go to [https://stripe.com](https://stripe.com)
2. Click "Start now" and create an account
3. Complete the registration process
4. Verify your email address

### Step 2: Get Your API Keys
1. Log in to your Stripe Dashboard
2. Go to **Developers** → **API keys**
3. You'll see two keys:
   - **Publishable key** (starts with `pk_test_...` for test mode)
   - **Secret key** (starts with `sk_test_...` for test mode)

### Step 3: Add Publishable Key to Your Website
In `checkout.html`, find this line (around line 557):
```javascript
const STRIPE_PUBLISHABLE_KEY = 'pk_test_YOUR_PUBLISHABLE_KEY_HERE';
```

Replace `pk_test_YOUR_PUBLISHABLE_KEY_HERE` with your actual publishable key from Stripe.

### Step 4: Test Cards
For testing, use these Stripe test card numbers:
- **Successful payment**: `4242 4242 4242 4242`
- **Requires authentication**: `4000 0025 0000 3155`
- **Declined card**: `4000 0000 0000 9995`
- Use any future expiry date (e.g., `12/25`)
- Use any 3-digit CVV (e.g., `123`)

---

## 🍎 Apple Pay Setup

### Step 1: Stripe Apple Pay Configuration
1. Log in to your Stripe Dashboard
2. Go to **Settings** → **Payment methods**
3. Enable **Apple Pay**
4. Add your domain (e.g., `chickencurrymessina.com`)

### Step 2: Domain Verification
1. Stripe will provide a verification file
2. Download the file
3. Upload it to: `https://yourdomain.com/.well-known/apple-developer-merchantid-domain-association`
4. Verify the domain in Stripe Dashboard

### Step 3: Apple Developer Account (Required for Production)
1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
2. Create a Merchant ID:
   - Go to **Certificates, Identifiers & Profiles**
   - Select **Merchant IDs**
   - Create a new Merchant ID (e.g., `merchant.com.chickencurrymessina`)
3. Create a Payment Processing Certificate
4. Upload to Stripe Dashboard

### Step 4: Requirements
- Apple Pay only works on:
  - Safari browser
  - iOS devices (iPhone, iPad)
  - macOS with Safari
  - Devices with Apple Pay enabled

### Step 5: Testing
- Use Safari on Mac/iPhone
- Add a test card to Apple Wallet
- The Apple Pay button will appear automatically if available

---

## 💰 Google Pay Setup

### Step 1: Google Pay Business Console
1. Go to [Google Pay Business Console](https://pay.google.com/business/console)
2. Sign in with your Google account
3. Register your business

### Step 2: Integration Type
1. Choose **Gateway** integration
2. Select **Stripe** as your payment gateway
3. Google Pay will use your existing Stripe account

### Step 3: Production Access
1. Request production access in Google Pay Console
2. Fill out the integration checklist
3. Submit for review (usually takes 2-3 days)

### Step 4: Update Google Pay Configuration
The code is already set to TEST mode. When ready for production:

In `checkout.html`, find this line (around line 697):
```javascript
environment: 'TEST', // Change to 'PRODUCTION' for live
```

Change it to:
```javascript
environment: 'PRODUCTION',
```

### Step 5: Testing
- Works on Chrome, Edge, and Android devices
- Use Chrome with a test card in your Google account
- The Google Pay button will appear if available

---

## 🔧 Backend Integration

You'll need a backend server to process payments. Here's a simple example using **Node.js**:

### Option 1: Node.js + Express Backend

#### Install Dependencies
```bash
npm install express stripe body-parser cors
```

#### Create `server.js`
```javascript
const express = require('express');
const stripe = require('stripe')('sk_test_YOUR_SECRET_KEY_HERE');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Process Stripe Card Payment
app.post('/api/process-payment', async (req, res) => {
  try {
    const { paymentMethodId, amount, orderDetails } = req.body;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // in cents (€44.00 = 4400)
      currency: 'eur',
      payment_method: paymentMethodId,
      confirm: true,
      description: `Order from Chicken Curry Messina`,
      metadata: {
        orderNumber: orderDetails.orderNumber,
        customerName: orderDetails.customerName,
        customerEmail: orderDetails.customerEmail,
      }
    });

    // Save order to database here
    // ...

    res.json({ 
      success: true, 
      paymentIntent: paymentIntent 
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Apple Pay Merchant Validation
app.post('/api/apple-pay/validate', async (req, res) => {
  try {
    const { validationURL } = req.body;
    
    // Call Apple's validation endpoint
    // This requires your Apple Pay certificate
    const response = await fetch(validationURL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        merchantIdentifier: 'merchant.com.chickencurrymessina',
        domainName: 'chickencurrymessina.com',
        displayName: 'Chicken Curry Messina'
      })
    });

    const merchantSession = await response.json();
    res.json(merchantSession);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Process Apple Pay Payment
app.post('/api/apple-pay/process', async (req, res) => {
  try {
    const { token } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: 4400,
      currency: 'eur',
      payment_method_data: {
        type: 'card',
        card: {
          token: token.paymentData
        }
      },
      confirm: true
    });

    res.json({ success: true, paymentIntent });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

#### Run the Server
```bash
node server.js
```

### Option 2: Use Serverless Functions

You can also use:
- **Vercel Functions** (free tier available)
- **Netlify Functions** (free tier available)
- **AWS Lambda** with API Gateway
- **Google Cloud Functions**

---

## 🧪 Testing

### Test Mode Cards (Stripe)
```
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/30)
CVV: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)
```

### Test Apple Pay
1. Open Safari on Mac/iPhone
2. Make sure you have a card in Apple Wallet
3. Use Stripe test cards in Apple Wallet for testing

### Test Google Pay
1. Open Chrome on desktop/Android
2. Add a test card to your Google account
3. Google Pay will use test mode automatically

### Testing Checklist
- [ ] Cash payment works
- [ ] Card payment (Stripe) processes correctly
- [ ] Apple Pay button appears in Safari
- [ ] Apple Pay payment completes
- [ ] Google Pay button appears in Chrome
- [ ] Google Pay payment completes
- [ ] Order confirmation modal shows
- [ ] Email notifications sent (if configured)

---

## 🚀 Going Live

### Step 1: Switch to Live Mode in Stripe
1. Go to Stripe Dashboard
2. Toggle from **Test mode** to **Live mode** (top right)
3. Get your **live** API keys
4. Replace `pk_test_...` with `pk_live_...` in your code

### Step 2: Update Google Pay
Change environment from `TEST` to `PRODUCTION` in the code.

### Step 3: SSL Certificate (Required!)
All payment methods require HTTPS:
- Use Let's Encrypt (free)
- Or use your hosting provider's SSL

### Step 4: Domain Verification
- Verify your domain with Stripe
- Verify your domain with Apple Pay
- Verify your domain with Google Pay

### Step 5: Compliance
- Add Privacy Policy
- Add Terms of Service
- Add Cookie Policy
- Ensure GDPR compliance (for EU customers)
- Add PCI compliance badge

---

## 📱 Mobile Optimization

### Test on Real Devices
- iPhone with Safari (Apple Pay)
- Android with Chrome (Google Pay)
- Various screen sizes

### Performance Tips
- Optimize images
- Minify JavaScript
- Use CDN for faster loading
- Test on 3G/4G networks

---

## 🔐 Security Best Practices

1. **Never expose Secret Keys**
   - Keep `sk_...` keys on the server only
   - Never commit keys to GitHub

2. **Use Environment Variables**
   ```javascript
   const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
   ```

3. **Implement Rate Limiting**
   - Prevent abuse of payment endpoints

4. **Log All Transactions**
   - Keep records for disputes

5. **Handle Errors Gracefully**
   - Don't expose system errors to users

---

## 📞 Support & Documentation

### Stripe Documentation
- [Stripe Docs](https://stripe.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Testing](https://stripe.com/docs/testing)

### Apple Pay Documentation
- [Apple Pay Web](https://developer.apple.com/apple-pay/web/)
- [Apple Pay Setup](https://stripe.com/docs/apple-pay)

### Google Pay Documentation
- [Google Pay Web](https://developers.google.com/pay/api/web)
- [Google Pay with Stripe](https://stripe.com/docs/google-pay)

### Need Help?
- Stripe Support: [support.stripe.com](https://support.stripe.com)
- Stack Overflow: Search for Stripe/Apple Pay/Google Pay issues
- Stripe Community: [community.stripe.com](https://community.stripe.com)

---

## ✅ Pre-Launch Checklist

- [ ] Stripe account activated
- [ ] Live API keys obtained
- [ ] Domain verified with Stripe
- [ ] Apple Pay domain verified
- [ ] Google Pay production access approved
- [ ] Backend server deployed
- [ ] SSL certificate installed
- [ ] Payment webhooks configured
- [ ] Email notifications working
- [ ] Error handling tested
- [ ] Mobile devices tested
- [ ] Privacy policy added
- [ ] Terms of service added
- [ ] Test transactions completed
- [ ] Refund process tested
- [ ] Customer support ready

---

## 💡 Tips

1. **Start with Stripe Card Payments** - It's the easiest to implement
2. **Test Thoroughly** - Use Stripe's test mode extensively
3. **Mobile First** - Most customers will order on mobile
4. **Clear Error Messages** - Help users fix payment issues
5. **Save Customer Data** - Store emails for order confirmation
6. **Monitor Transactions** - Check Stripe Dashboard regularly
7. **Handle Failures** - Have a plan for failed payments

---

## 🎉 You're Ready!

Once you've completed these steps, your payment system will be fully functional with:
✅ Cash on Delivery/Pickup
✅ Credit/Debit Card (Stripe)
✅ Apple Pay
✅ Google Pay

Good luck with your restaurant! 🍛🔥
