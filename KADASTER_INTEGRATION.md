# Kadaster Integration Guide

> **How to legally store and display Kadaster data with proper access controls**

---

## ✅ What You CAN Do

**YES, you can**:
1. ✅ Purchase Kadaster data (eigendomsinformatie/ownership reports)
2. ✅ Store this data in your database (including owner names)
3. ✅ Resell or incorporate into commercial services
4. ✅ Display non-personal cadastral data publicly

**BUT**: You must implement **access controls** for personal data (owner names, birthdates).

---

## 📊 Data Access Tiers

### Tier 1: Public Data (No Authentication Required)

**Can display to anyone**:
- ✅ Property address
- ✅ Cadastral size (oppervlakte)
- ✅ Last sale price
- ✅ Erfpacht status
- ✅ Monument status (rijksmonument/gemeentelijk monument)
- ✅ Usage restrictions (bestemming)
- ✅ Cadastral boundaries (GeoJSON)

**Example public display**:
```
Keizersgracht 1, 1015 CJ Amsterdam

Oppervlakte:         150 m²
Laatste verkoopprijs: €850,000 (2023)
Erfpacht:            Afgekocht tot 2050
Status:              Rijksmonument
Bestemming:          Woonbestemming

Eigenaar:            [Beschikbaar op aanvraag] 🔒
```

---

### Tier 2: Personal Data (Authentication + Legitimate Interest)

**Requires**:
- ✅ User account (verified email)
- ✅ Legitimate interest declaration
- ✅ Audit log of access

**Can display**:
- ✅ Owner name (eigenaar)
- ✅ Owner birthdate (if relevant)
- ✅ Marital status (if relevant)
- ✅ Usage rights holders

**Example authenticated display**:
```
Keizersgracht 1, 1015 CJ Amsterdam

Eigenaar:            J. de Vries
Geboortedatum:       15-05-1980
Burgerlijke staat:   Gehuwd

[User declared legitimate interest: "Considering purchase"]
[Access logged: 2025-11-03 14:30 UTC]
```

---

## 🏗️ Implementation Architecture

### Database Schema

```sql
-- Property cadastral data (public)
CREATE TABLE properties (
  id UUID PRIMARY KEY,
  address TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  cadastral_size DECIMAL(10,2),
  sale_price_last INTEGER,
  sale_date_last DATE,
  erfpacht_status TEXT,
  erfpacht_until DATE,
  monument_status TEXT,
  usage_restriction TEXT,
  boundaries GEOMETRY(Polygon, 4326),

  -- Flags
  has_owner_data BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Owner information (restricted access)
CREATE TABLE property_owners (
  id UUID PRIMARY KEY,
  property_id UUID REFERENCES properties(id),

  -- Personal data (RESTRICTED)
  owner_name TEXT NOT NULL,
  owner_birthdate DATE,
  marital_status TEXT,
  usage_rights_holder TEXT,

  -- Metadata
  data_source TEXT DEFAULT 'kadaster',
  valid_from DATE NOT NULL,
  valid_until DATE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Access audit log (GDPR requirement)
CREATE TABLE owner_data_access_log (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  property_id UUID REFERENCES properties(id),

  -- Legitimate interest
  declared_reason TEXT NOT NULL,
  reason_category TEXT NOT NULL, -- 'purchase_consideration', 'legal_work', etc.

  -- What was accessed
  accessed_fields JSONB,

  -- Tracking
  ip_address INET,
  user_agent TEXT,
  accessed_at TIMESTAMPTZ DEFAULT NOW()
);

-- User legitimate interest declarations
CREATE TABLE user_legitimate_interest (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  property_id UUID REFERENCES properties(id),

  reason TEXT NOT NULL,
  reason_category TEXT NOT NULL,
  supporting_evidence TEXT, -- Optional: upload proof

  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,

  expires_at TIMESTAMPTZ, -- Legitimate interest has time limit

  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔐 Access Control Implementation

### Backend API (Node.js/TypeScript)

```typescript
// types/kadaster.ts
export interface PropertyPublicData {
  id: string;
  address: string;
  postalCode: string;
  cadastralSize: number;
  salePriceLast: number;
  saleDateLast: string;
  erfpachtStatus: string;
  monumentStatus: string;
  hasOwnerData: boolean; // Flag: owner info available
}

export interface PropertyOwnerData {
  ownerName: string;
  ownerBirthdate: string;
  maritalStatus: string;
}

export interface PropertyFullData extends PropertyPublicData {
  owner?: PropertyOwnerData; // Only if user has access
}

// api/properties/[id].ts
import { verifyLegitimateInterest } from '@/lib/auth';

export async function GET(req: Request) {
  const { id } = req.params;
  const userId = req.user?.id; // From auth middleware

  // 1. Fetch public data (always return)
  const property = await db.properties.findUnique({
    where: { id },
    select: {
      id: true,
      address: true,
      postalCode: true,
      cadastralSize: true,
      salePriceLast: true,
      saleDateLast: true,
      erfpachtStatus: true,
      monumentStatus: true,
      hasOwnerData: true,
    }
  });

  if (!property) {
    return Response.json({ error: 'Not found' }, { status: 404 });
  }

  // 2. Check if user has legitimate interest for owner data
  const hasAccess = userId
    ? await verifyLegitimateInterest(userId, id)
    : false;

  if (hasAccess) {
    // 3. Fetch owner data (restricted)
    const ownerData = await db.propertyOwners.findFirst({
      where: { propertyId: id },
      select: {
        ownerName: true,
        ownerBirthdate: true,
        maritalStatus: true,
      }
    });

    // 4. Log access (GDPR audit requirement)
    await db.ownerDataAccessLog.create({
      data: {
        userId,
        propertyId: id,
        accessedFields: ['ownerName', 'ownerBirthdate', 'maritalStatus'],
        ipAddress: req.ip,
        userAgent: req.headers.get('user-agent'),
      }
    });

    return Response.json({
      ...property,
      owner: ownerData,
      _accessGranted: true,
      _reason: 'legitimate_interest'
    });
  }

  // 5. Return public data only (redacted)
  return Response.json({
    ...property,
    owner: null,
    _ownerDataAvailable: property.hasOwnerData,
    _accessRequired: 'legitimate_interest',
    _message: 'Owner information available on request'
  });
}

// lib/auth/legitimate-interest.ts
export async function verifyLegitimateInterest(
  userId: string,
  propertyId: string
): Promise<boolean> {
  const declaration = await db.userLegitimateInterest.findFirst({
    where: {
      userId,
      propertyId,
      status: 'approved',
      expiresAt: { gt: new Date() } // Not expired
    }
  });

  return !!declaration;
}

export async function declareLegitimateInterest(
  userId: string,
  propertyId: string,
  reason: string,
  reasonCategory: 'purchase_consideration' | 'legal_work' | 'owner_self'
): Promise<void> {
  // Create declaration (pending approval)
  await db.userLegitimateInterest.create({
    data: {
      userId,
      propertyId,
      reason,
      reasonCategory,
      status: 'pending',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    }
  });

  // For certain categories, auto-approve
  if (reasonCategory === 'owner_self') {
    // TODO: Verify user actually owns this property
    await autoApproveIfOwner(userId, propertyId);
  } else {
    // Send for manual review
    await notifyModerators({ userId, propertyId, reason });
  }
}
```

---

## 🎨 Frontend Implementation

### Public View (No Auth Required)

```tsx
// components/PropertyCard.tsx
import { PropertyPublicData } from '@/types/kadaster';

export function PropertyCard({ property }: { property: PropertyPublicData }) {
  return (
    <div className="border rounded-lg p-6">
      <h2 className="text-2xl font-bold">{property.address}</h2>

      <div className="mt-4 space-y-2">
        <DataRow label="Oppervlakte" value={`${property.cadastralSize} m²`} />
        <DataRow
          label="Laatste verkoopprijs"
          value={`€${property.salePriceLast.toLocaleString()} (${property.saleDateLast})`}
        />
        <DataRow label="Erfpacht" value={property.erfpachtStatus} />
        <DataRow label="Monument status" value={property.monumentStatus} />
      </div>

      {/* Owner data teaser */}
      {property.hasOwnerData && (
        <div className="mt-6 border-t pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Eigenaarsinformatie</p>
              <p className="text-sm text-gray-600">
                Beschikbaar voor gebruikers met gerechtvaardigd belang
              </p>
            </div>
            <button
              onClick={() => setShowAccessModal(true)}
              className="btn btn-primary"
            >
              🔒 Aanvragen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Authenticated View (With Legitimate Interest)

```tsx
// components/PropertyCardFull.tsx
import { PropertyFullData } from '@/types/kadaster';

export function PropertyCardFull({ property }: { property: PropertyFullData }) {
  return (
    <div className="border rounded-lg p-6">
      {/* Public data (same as above) */}
      <PublicDataSection property={property} />

      {/* Owner data (restricted) */}
      {property.owner && (
        <div className="mt-6 border-t pt-4 bg-yellow-50 p-4 rounded">
          <div className="flex items-center gap-2 mb-2">
            <LockOpenIcon className="w-5 h-5" />
            <p className="font-semibold">Eigenaarsinformatie (vertrouwelijk)</p>
          </div>

          <div className="space-y-2">
            <DataRow label="Eigenaar" value={property.owner.ownerName} />
            <DataRow
              label="Geboortedatum"
              value={property.owner.ownerBirthdate}
            />
            <DataRow
              label="Burgerlijke staat"
              value={property.owner.maritalStatus}
            />
          </div>

          <div className="mt-4 text-xs text-gray-600">
            ℹ️ Deze informatie is verstrekt op basis van uw gerechtvaardigd belang.
            Gebruik is onderworpen aan privacy wetgeving.
          </div>
        </div>
      )}
    </div>
  );
}
```

### Legitimate Interest Request Modal

```tsx
// components/LegitimateInterestModal.tsx
export function LegitimateInterestModal({
  propertyId,
  onClose
}: {
  propertyId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState<string>('');

  const handleSubmit = async () => {
    await fetch('/api/legitimate-interest', {
      method: 'POST',
      body: JSON.stringify({
        propertyId,
        reason,
        reasonCategory: category
      })
    });

    toast.success('Aanvraag ingediend. U ontvangt binnen 24 uur een beslissing.');
    onClose();
  };

  return (
    <Modal open onClose={onClose}>
      <h2>Eigenaarsinformatie aanvragen</h2>

      <p className="text-sm text-gray-600 mt-2">
        Conform de AVG (GDPR) mag eigenaarsinformatie alleen worden getoond
        aan personen met een gerechtvaardigd belang.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="block font-semibold mb-2">
            Wat is uw gerechtvaardigd belang?
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border rounded p-2"
          >
            <option value="">-- Selecteer --</option>
            <option value="purchase_consideration">
              Ik overweeg dit pand te kopen
            </option>
            <option value="legal_work">
              Ik ben notaris/advocaat en behandel een transactie
            </option>
            <option value="owner_self">
              Ik ben de eigenaar van dit pand
            </option>
            <option value="neighbor">
              Ik ben buurman/buurvrouw
            </option>
          </select>
        </div>

        <div>
          <label className="block font-semibold mb-2">
            Toelichting (optioneel)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border rounded p-2"
            rows={4}
            placeholder="Waarom heeft u deze informatie nodig?"
          />
        </div>

        <div className="bg-blue-50 p-3 rounded text-sm">
          <strong>Privacy waarborg:</strong>
          <ul className="mt-2 space-y-1">
            <li>✓ Uw toegang wordt gelogd (AVG audit trail)</li>
            <li>✓ Toegang is beperkt tot 30 dagen</li>
            <li>✓ Misbruik wordt gerapporteerd aan autoriteiten</li>
          </ul>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button onClick={onClose} className="btn btn-secondary">
          Annuleren
        </button>
        <button
          onClick={handleSubmit}
          disabled={!category}
          className="btn btn-primary"
        >
          Aanvraag indienen
        </button>
      </div>
    </Modal>
  );
}
```

---

## 📜 GDPR Compliance Requirements

### 1. Privacy Notice

**Must inform users**:
- What personal data is stored (owner names, birthdates)
- Legal basis for processing (public register + legitimate interest)
- Who can access this data (users with legitimate interest)
- How long data is retained
- Users' rights (access, rectification, erasure)

### 2. Audit Logging

**Must log every access** to personal data:
```typescript
// Every time owner data is accessed
await logAccess({
  userId: string,
  propertyId: string,
  accessedFields: ['ownerName', 'ownerBirthdate'],
  legitimateInterestReason: string,
  timestamp: Date,
  ipAddress: string,
  userAgent: string
});

// Retain logs for minimum 1 year (GDPR requirement)
```

### 3. User Rights

**Must implement**:
- **Right of access**: Users can request their access logs
- **Right to erasure**: Property owners can request removal (if legally possible)
- **Right to rectification**: Owners can correct inaccurate data

### 4. Data Retention

**Define policy**:
```
Cadastral data (public):     Indefinite (public register)
Owner names/birthdates:       Until property sells (or 10 years max)
Access logs:                  Minimum 1 year (for GDPR audit)
Legitimate interest declarations: 30 days after expiry
```

---

## ⚠️ Important Restrictions

### ❌ What You CANNOT Do (Even With Data Access)

1. **No bulk owner contact lists**
   - Cannot create "All owners in Amsterdam" list for marketing
   - Cannot sell owner email/phone contact information

2. **No profiling/targeting**
   - Cannot use owner data to profile wealth
   - Cannot target owners with ads based on property value

3. **No scraping for resale**
   - Must purchase from Kadaster (not scrape their website)
   - Can resell Kadaster data you purchased, but not scraped data

4. **No unauthorized purposes**
   - Data accessed for "considering purchase" cannot be used for marketing
   - Purpose limitation applies (GDPR Article 5)

### ✅ What You CAN Do

1. **Display to legitimate users**
   - Show owner info to users considering buying that specific property
   - Show to property owner themselves (with verification)
   - Show to legal professionals handling transaction

2. **Aggregate statistics**
   - "Average sale price in this neighborhood: €X"
   - "% of properties with erfpacht: Y%"
   - No individual owner identification

3. **Research/journalism**
   - Public interest journalism (with safeguards)
   - Academic research (anonymized/pseudonymized)

---

## 🚀 Implementation Checklist

### Phase 1: Public Data Only (Week 1-4)
- [ ] Ingest BAG data (addresses, building info)
- [ ] Ingest Kadaster cadastral data (size, erfpacht, sale price)
- [ ] Display publicly (no personal data)
- [ ] Test with sample data

### Phase 2: Database with Redaction (Week 5-8)
- [ ] Create database schema (properties + property_owners tables)
- [ ] Implement access control (check legitimate interest)
- [ ] Add audit logging
- [ ] Build public API (redacted owner data)

### Phase 3: Authenticated Access (Week 9-12)
- [ ] User authentication (email verification)
- [ ] Legitimate interest declaration form
- [ ] Manual approval workflow
- [ ] Premium API (full data with auth)

### Phase 4: GDPR Compliance (Week 13-16)
- [ ] Privacy notice (updated)
- [ ] User rights implementation (access, erasure)
- [ ] Data retention policy
- [ ] Security audit
- [ ] Consult lawyer (final review before launch)

---

## 📞 Support

**Questions about Kadaster data usage?**
- Kadaster: klantcontact@kadaster.nl / 088 183 2000
- Dutch DPA (AP): https://autoriteitpersoonsgegevens.nl/

**Technical questions?**
- See main [LEGAL.md](LEGAL.md)
- Open GitHub issue

---

**Last Updated**: November 3, 2025
**Status**: Implementation guide
**License**: MIT (code) / Kadaster terms (data)
