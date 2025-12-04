# Kadaster API & Stripe Payment Setup Guide

## Overview

This guide covers:
1. How to get Kadaster API access
2. Revised pricing model (including VAT)
3. Updated GDPR architecture (users keep their data)
4. Stripe integration for payments
5. Complete implementation

---

## Part 1: Kadaster API Access

### Option 1: Direct Kadaster Access (Cheapest - €0.45/query)

#### Step 1: Create Mijn Kadaster Account
1. Go to [mijn.kadaster.nl](https://mijn.kadaster.nl)
2. Sign up for business account
3. Verify with KVK number (Chamber of Commerce)
4. You'll need:
   - Business name
   - KVK number
   - Address
   - Contact person

#### Step 2: Request API Access
1. Log in to Mijn Kadaster
2. Go to "Kadata Internet" section
3. Request API access for:
   - **Objectinformatie API** (property information)
   - **Koopsom API** (purchase price data)
4. Wait 1-3 business days for approval

#### Step 3: Get API Credentials
1. Once approved, go to API Management
2. Generate API key
3. Save credentials:
   - API Key
   - Client ID (if required)
   - Endpoint URLs

#### Pricing (Direct Kadaster - Official from Mijn Kadaster)

**Per Address Query:**
- **Algemeen** (address, cadastral map, designation, surface area, use, energy label from RVO.nl): **FREE**
- **Rechten** (ownership, special conditions): €2.96
- **Koopsom** (last transaction from Kadaster registry): €0.45
- **WOZ-object** (WOZ object description): €1.86 (incl. VAT)
- **WOZ-deelobjecten** (ground, buildings): €1.86 (incl. VAT)
- **Gemeentelijke lasten** (municipal taxes, waste collection, sewage): **FREE**
- **Buurtstatistieken** (neighborhood statistics: population, age, households): **FREE**
- **Omgeving** (public law restrictions): €0.37

**Inzicht via de kaart API** (property map insights):
- **Verkorte informatie** (owner names only): €0.24 per parcel
- **Uitgebreide informatie** (full owner details + addresses): €2.96 per parcel

**Key Insight**: Energy labels are included **FREE** in the general data!

### Option 2: Webservices.nl (Easier - €0.75/query)

#### Step 1: Sign Up
1. Go to [webservices.nl](https://www.webservices.nl/)
2. Click "Aanmelden" (Sign up)
3. Choose "KadasterV2" service

#### Step 2: Get API Key
1. Complete registration
2. Verify email
3. Go to Dashboard → API Keys
4. Copy your API key

#### Pricing (Webservices.nl)
- **KadasterV2 query**: €0.75 per call
- **Monthly minimum**: €25
- **Prepaid credits**: Buy in bulk for discount

**Recommendation**: Start with **Webservices.nl** for ease of setup, switch to direct Kadaster if volume justifies it.

---

## Part 2: Revised Pricing Model (with VAT)

### Cost Breakdown

#### User pays via Funda, etc.
- **Direct Kadaster extract**: €3.70 (incl. 21% VAT)
- **Webservices.nl**: ~€4.50 (incl. VAT)

#### Our costs
- **Webservices.nl API**: €0.75 per query
- **Add 21% VAT**: €0.75 × 1.21 = **€0.91 total cost**
- **Stripe fee**: 1.4% + €0.25 = ~€0.28 per €2 transaction

#### Pricing to Users
```
Cost to us: €0.91 (API + VAT)
Stripe fee: €0.28 (on €2 charge)
Total cost: €1.19

We charge: €2.00 per query
Profit: €0.81 per query (40% margin)

OR

We charge: €1.50 per query
Profit: €0.31 per query (20% margin)
```

**Recommendation**: **€2.00 per query**
- Fair price (cheaper than €3.70 direct from Kadaster)
- Healthy margin for sustainability
- Users get better value than buying direct

### Credit Packages

```
┌─────────────────────────────────────────────────┐
│           Starter Pack - €10                    │
├─────────────────────────────────────────────────┤
│ 5 Kadaster queries                              │
│ €2.00 per query                                 │
│ No discount                                     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│           Plus Pack - €35 (Save 12%)            │
├─────────────────────────────────────────────────┤
│ 20 Kadaster queries                             │
│ €1.75 per query                                 │
│ Save €5.00                                      │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│          Professional - €75 (Save 25%)          │
├─────────────────────────────────────────────────┤
│ 50 Kadaster queries                             │
│ €1.50 per query                                 │
│ Save €25.00                                     │
└─────────────────────────────────────────────────┘
```

---

## Part 3: Updated GDPR Architecture

### Revised Data Model: Users Keep Their Purchased Data

```
┌─────────────────────────────────────────────────────────────────┐
│                PUBLIC DATA (Cached, All Users)                   │
├─────────────────────────────────────────────────────────────────┤
│ - Purchase price (koopsom)                                       │
│ - Transaction year/month                                         │
│ - Property boundaries (GeoJSON)                                  │
│ - Surface area (m²)                                              │
│ - Cadastral designation                                          │
│ - Property type                                                  │
│                                                                  │
│ Storage: PostgreSQL public table                                │
│ Retention: Indefinite (public record)                           │
│ Access: All users can see once ANY user queries                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│            PRIVATE DATA (User-Specific, Stored)                  │
├─────────────────────────────────────────────────────────────────┤
│ - Owner name(s)                                                  │
│ - Owner address                                                  │
│ - Mortgage details                                               │
│ - Rights and restrictions (erfpacht, etc.)                      │
│ - Legal notations                                                │
│ - Transaction history (last 5 years)                            │
│                                                                  │
│ Storage: PostgreSQL user_kadaster_queries table                 │
│ Retention: Belongs to user who purchased                        │
│ Access: ONLY the user who paid can see this data                │
│ Privacy: Encrypted at rest, FK to user_id                       │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- Public cadastral data (visible to all)
CREATE TABLE kadaster_public_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  postal_code VARCHAR(6) NOT NULL,
  house_number INT NOT NULL,
  house_number_suffix VARCHAR(10),

  cadastral_designation VARCHAR(50),
  surface_area_m2 DECIMAL(10, 2),
  property_type VARCHAR(50),

  purchase_price_eur INT,
  transaction_year INT,
  transaction_month INT,

  boundary_geojson JSONB,

  first_queried_at TIMESTAMP DEFAULT NOW(),
  last_updated TIMESTAMP DEFAULT NOW(),

  UNIQUE(postal_code, house_number, house_number_suffix)
);

-- Private data purchased by specific users
CREATE TABLE user_kadaster_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  postal_code VARCHAR(6) NOT NULL,
  house_number INT NOT NULL,
  house_number_suffix VARCHAR(10),

  -- Private data (encrypted at rest)
  owner_names TEXT[],  -- Array of owner names
  owner_address TEXT,
  mortgages JSONB,
  rights JSONB,  -- erfpacht, etc.
  legal_restrictions JSONB,
  transaction_history JSONB,  -- Last 5 years

  -- Metadata
  queried_at TIMESTAMP DEFAULT NOW(),
  cost_paid_eur DECIMAL(5, 2),  -- How much user paid

  -- Only this user can access this record
  CONSTRAINT unique_user_query UNIQUE(user_id, postal_code, house_number, house_number_suffix)
);

CREATE INDEX idx_user_queries ON user_kadaster_queries(user_id, queried_at);
CREATE INDEX idx_property_lookup ON user_kadaster_queries(postal_code, house_number);

-- User credits/wallet
CREATE TABLE user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  credits_remaining INT DEFAULT 0,
  credits_purchased_total INT DEFAULT 0,
  credits_spent_total INT DEFAULT 0,

  last_purchase_at TIMESTAMP,

  UNIQUE(user_id)
);

-- Credit purchase history (for Stripe webhooks)
CREATE TABLE credit_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES users(id),

  stripe_payment_intent_id VARCHAR(255) UNIQUE,
  stripe_session_id VARCHAR(255),

  amount_eur DECIMAL(10, 2),
  credits_added INT,

  status VARCHAR(50),  -- 'pending', 'completed', 'failed'

  purchased_at TIMESTAMP DEFAULT NOW()
);
```

### GDPR Compliance

#### Legal Basis
- **Public data**: Legitimate interest (Article 6(1)(f) GDPR)
  - Purchase prices are public records
  - Cadastral info is publicly available
  - We're aggregating public data for public benefit

- **Private data**: Consent + Contract (Article 6(1)(a) & (b))
  - User explicitly pays to access data
  - User owns the data they purchase
  - Data is for user's personal use (finding a home)

#### Data Retention
- **Public data**: Retained indefinitely (public record)
- **Private data**: Retained until user deletes account
- **User right to deletion**:
  - User can delete their purchased queries anytime
  - Account deletion removes all private data
  - Public cache remains (it's public anyway)

#### Access Control
```python
# Only owner can access private data
def get_user_kadaster_query(user_id: str, property_id: str):
    query = db.query(UserKadasterQuery).filter(
        UserKadasterQuery.user_id == user_id,
        UserKadasterQuery.id == property_id
    ).first()

    if not query:
        raise HTTPException(403, "You don't own this query")

    return query
```

---

## Part 4: Stripe Integration

### Step 1: Create Stripe Account

1. Go to [stripe.com](https://stripe.com)
2. Sign up for account
3. Complete business verification
4. Get API keys (Dashboard → Developers → API keys)

```
Publishable key: pk_test_... (public, frontend)
Secret key: sk_test_... (private, backend)
```

### Step 2: Install Stripe SDK

**Backend**:
```bash
pip install stripe
```

**Frontend**:
```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### Step 3: Backend Implementation

```python
# backend/stripe_service.py
import stripe
import os

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

def create_checkout_session(
    user_id: str,
    email: str,
    package: str  # 'starter', 'plus', 'professional'
):
    """Create Stripe checkout session for credit purchase"""

    packages = {
        "starter": {
            "price_eur": 10,
            "credits": 5,
            "name": "Starter Pack - 5 Queries"
        },
        "plus": {
            "price_eur": 35,
            "credits": 20,
            "name": "Plus Pack - 20 Queries"
        },
        "professional": {
            "price_eur": 75,
            "credits": 50,
            "name": "Professional Pack - 50 Queries"
        }
    }

    if package not in packages:
        raise ValueError("Invalid package")

    pkg = packages[package]

    session = stripe.checkout.Session.create(
        payment_method_types=['card', 'ideal'],  # Card + iDEAL for Dutch users
        line_items=[{
            'price_data': {
                'currency': 'eur',
                'product_data': {
                    'name': pkg['name'],
                    'description': f"{pkg['credits']} Kadaster property queries",
                },
                'unit_amount': int(pkg['price_eur'] * 100),  # Convert to cents
            },
            'quantity': 1,
        }],
        mode='payment',
        success_url=f"{os.getenv('FRONTEND_URL')}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{os.getenv('FRONTEND_URL')}/payment/cancel",
        customer_email=email,
        metadata={
            'user_id': user_id,
            'package': package,
            'credits': pkg['credits']
        }
    )

    return session


def handle_webhook(payload, sig_header):
    """Handle Stripe webhook events"""

    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError:
        raise ValueError("Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise ValueError("Invalid signature")

    # Handle successful payment
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']

        # Add credits to user account
        user_id = session['metadata']['user_id']
        credits = int(session['metadata']['credits'])

        add_credits_to_user(user_id, credits, session['id'])

    return {"status": "success"}


def add_credits_to_user(user_id: str, credits: int, payment_id: str):
    """Add purchased credits to user account"""
    # Implementation depends on your database
    pass
```

```python
# backend/api_server.py
from stripe_service import create_checkout_session, handle_webhook

@app.post("/api/stripe/create-checkout")
async def create_stripe_checkout(
    package: str,
    user_id: str,
    email: str
):
    """Create Stripe checkout session"""
    try:
        session = create_checkout_session(user_id, email, package)
        return {
            "success": True,
            "checkout_url": session.url,
            "session_id": session.id
        }
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.post("/api/stripe/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')

    try:
        result = handle_webhook(payload, sig_header)
        return result
    except ValueError as e:
        raise HTTPException(400, detail=str(e))
```

### Step 4: Frontend Implementation

```typescript
// frontend/src/components/PurchaseCredits.tsx
'use client'

import { loadStripe } from '@stripe/stripe-js';
import { useState } from 'react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function PurchaseCredits({ userId, userEmail }: { userId: string, userEmail: string }) {
  const [loading, setLoading] = useState(false);

  const handlePurchase = async (packageType: string) => {
    setLoading(true);

    try {
      // Create checkout session
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package: packageType,
          user_id: userId,
          email: userEmail
        })
      });

      const { checkout_url } = await response.json();

      // Redirect to Stripe Checkout
      window.location.href = checkout_url;

    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Starter Pack */}
      <div className="border rounded-lg p-6">
        <h3 className="font-bold text-xl mb-2">Starter Pack</h3>
        <p className="text-3xl font-bold mb-4">€10</p>
        <ul className="text-sm text-gray-600 mb-4 space-y-1">
          <li>✓ 5 Kadaster queries</li>
          <li>✓ €2.00 per query</li>
          <li>✓ Valid for 1 year</li>
        </ul>
        <button
          onClick={() => handlePurchase('starter')}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          {loading ? 'Processing...' : 'Buy Now'}
        </button>
      </div>

      {/* Plus Pack */}
      <div className="border-2 border-blue-600 rounded-lg p-6 relative">
        <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs px-3 py-1 rounded-bl">
          SAVE 12%
        </div>
        <h3 className="font-bold text-xl mb-2">Plus Pack</h3>
        <p className="text-3xl font-bold mb-4">€35</p>
        <ul className="text-sm text-gray-600 mb-4 space-y-1">
          <li>✓ 20 Kadaster queries</li>
          <li>✓ €1.75 per query</li>
          <li>✓ Valid for 1 year</li>
          <li>✓ Save €5.00</li>
        </ul>
        <button
          onClick={() => handlePurchase('plus')}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          {loading ? 'Processing...' : 'Buy Now'}
        </button>
      </div>

      {/* Professional Pack */}
      <div className="border rounded-lg p-6 relative">
        <div className="absolute top-0 right-0 bg-green-600 text-white text-xs px-3 py-1 rounded-bl">
          SAVE 25%
        </div>
        <h3 className="font-bold text-xl mb-2">Professional</h3>
        <p className="text-3xl font-bold mb-4">€75</p>
        <ul className="text-sm text-gray-600 mb-4 space-y-1">
          <li>✓ 50 Kadaster queries</li>
          <li>✓ €1.50 per query</li>
          <li>✓ Valid for 1 year</li>
          <li>✓ Save €25.00</li>
        </ul>
        <button
          onClick={() => handlePurchase('professional')}
          disabled={loading}
          className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700"
        >
          {loading ? 'Processing...' : 'Buy Now'}
        </button>
      </div>
    </div>
  );
}
```

### Step 5: Configure Webhook

1. **Stripe Dashboard** → Developers → Webhooks
2. Add endpoint: `https://your-api.railway.app/api/stripe/webhook`
3. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
4. Copy webhook signing secret
5. Add to environment variables: `STRIPE_WEBHOOK_SECRET=whsec_...`

---

## Part 5: Complete Kadaster Flow

### User Journey

```
1. User searches for property
   ↓
2. Sees public data (free):
   - Purchase price: €450,000
   - Transaction year: 2023
   - Surface area: 120m²
   ↓
3. Clicks "View Full Ownership Report" (€2.00)
   ↓
4. If no credits:
   - Redirects to purchase page
   - Buys credit package via Stripe
   - Returns to property page
   ↓
5. If has credits:
   - Deducts 1 credit
   - Queries Kadaster API
   - Saves private data to user's account
   - Displays full report
   ↓
6. User can view their purchased reports anytime
   - "My Kadaster Queries" page
   - All purchased data accessible forever
   - Can export as PDF
```

### API Implementation

```python
@app.post("/api/kadaster/query")
async def query_kadaster_property(
    postal_code: str,
    house_number: int,
    house_number_suffix: str = "",
    user_id: str = None  # From auth token
):
    """
    Query Kadaster for property information.
    - Public data: Free for all (if already cached)
    - Private data: Costs 1 credit, stored for user
    """

    # Check if public data exists in cache
    public_data = get_cached_public_data(postal_code, house_number, house_number_suffix)

    # Check if user already purchased this property's private data
    existing_query = get_user_existing_query(user_id, postal_code, house_number, house_number_suffix)

    if existing_query:
        # User already bought this property's data
        return {
            "success": True,
            "public_data": public_data,
            "private_data": existing_query.private_data,
            "cached": True,
            "cost": 0,
            "message": "You already own this data"
        }

    # User wants to purchase new query
    # Check credits
    user_credits = get_user_credits(user_id)
    if user_credits < 1:
        raise HTTPException(
            status_code=402,
            detail="Insufficient credits. Please purchase more credits."
        )

    # Deduct credit
    deduct_credit(user_id, amount=1)

    # Query Kadaster API (via Webservices.nl)
    try:
        public, private = await query_webservices_kadaster(
            postal_code, house_number, house_number_suffix
        )
    except Exception as e:
        # Refund credit if API fails
        refund_credit(user_id, amount=1)
        raise HTTPException(500, detail=f"Kadaster API error: {e}")

    # Save public data (all users can see)
    save_public_data(public)

    # Save private data (only this user can see)
    save_user_private_data(user_id, postal_code, house_number, house_number_suffix, private, cost_paid=2.00)

    return {
        "success": True,
        "public_data": public,
        "private_data": private,
        "cached": False,
        "cost": 1,  # 1 credit spent
        "message": "Data saved to your account"
    }
```

---

## Part 6: Testing

### Test Mode (Stripe)

Use test cards:
- **Success**: `4242 4242 4242 4242`
- **Requires authentication**: `4000 0027 6000 3184`
- **Declined**: `4000 0000 0000 0002`

Any future date for expiry, any 3-digit CVC.

### Test Webservices.nl API

```python
import httpx

async def test_kadaster_query():
    api_key = "your_test_api_key"

    payload = {
        "jsonrpc": "2.0",
        "method": "kadasterV2GetObject",
        "params": {
            "apikey": api_key,
            "postcode": "1011AB",
            "huisnummer": 1
        },
        "id": 1
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://ws1.webservices.nl/rpc/json",
            json=payload
        )

        print(response.json())
```

---

## Summary

### Kadaster API Access
- **Option 1**: Direct Kadaster (€0.45/query) - requires KVK
- **Option 2**: Webservices.nl (€0.75/query) - easier signup
- **Recommendation**: Start with Webservices.nl

### Pricing
- **Cost to us**: €0.91 (€0.75 API + 21% VAT)
- **Stripe fee**: €0.28 per €2 transaction
- **Total cost**: €1.19
- **We charge**: €2.00 per query
- **Profit margin**: €0.81 per query (40%)

### User Benefits
- **Cheaper than Kadaster direct** (€3.70)
- **Users keep their purchased data** forever
- **Can view anytime** from their account
- **Fair pricing** with bulk discounts

### GDPR Compliant
- Public data: Cached for all (it's public)
- Private data: Stored per user who purchased
- Access control: Only owner can see their data
- Right to deletion: User can delete anytime

**Ready to implement when you want premium features!**
