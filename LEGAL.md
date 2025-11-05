# Legal & Compliance Guide

> **IMPORTANT**: This document provides guidance on legal considerations. It is NOT legal advice. Consult a Dutch privacy lawyer before launching.

---

## ⚖️ Overview

This project uses Dutch government data sources that contain varying levels of personal information. Understanding the legal landscape is critical for compliance.

---

## 🏛️ Kadaster Data & Personal Information

### What is Kadaster?

The Kadaster (Dutch Land Registry) maintains public registers of real estate ownership and transactions.

**Wat vindt u in eigendomsinformatie?** (What's in ownership information?)

According to Kadaster, an ownership report contains:
- ✅ **Property address & boundaries** (cadastral data)
- ✅ **Cadastral size** (oppervlakte - not for apartments)
- ✅ **Sale price from last deed** (verkoopprijs - if known)
- ✅ **Erfpacht status** (ground lease check)
- ✅ **Usage restrictions** (e.g., monument status)
- ⚠️ **Who is the owner** (owner name)
- ⚠️ **Who may use the property** (usage rights)

**Source**: Kadaster - Eigendomsinformatie

### Legal Status

**Public Access**: Kadaster data is legally public information under Dutch law.

**Commercial Use**: ✅ **YES, you CAN purchase and resell Kadaster data**, including incorporation into commercial services.

**BUT**: Different data elements have different privacy protections:

| Data Element | Can Store? | Can Display Publicly? | Requires |
|--------------|------------|----------------------|----------|
| **Property address** | ✅ Yes | ✅ Yes | Nothing |
| **Cadastral boundaries** | ✅ Yes | ✅ Yes | Nothing |
| **Cadastral size** | ✅ Yes | ✅ Yes | Nothing |
| **Sale price (last transaction)** | ✅ Yes | ✅ Yes | Nothing |
| **Erfpacht status** | ✅ Yes | ✅ Yes | Nothing |
| **Usage restrictions** | ✅ Yes | ✅ Yes | Nothing |
| **Monument status** | ✅ Yes | ✅ Yes | Nothing |
| **Owner name** | ⚠️ Yes (with restrictions) | ❌ No* | Legitimate interest OR user consent |
| **Owner date of birth** | ⚠️ Yes (with restrictions) | ❌ No* | Legitimate interest OR user consent |
| **Marital status** | ⚠️ Yes (with restrictions) | ❌ No* | Legitimate interest OR user consent |

**\*Redaction Required**: Personal data (owner names, birthdates) can be stored but **must be redacted** in public displays unless:
1. The user has **legitimate interest** (e.g., they're considering buying the property)
2. The user has **explicit consent** from the data subject
3. The user is the property owner themselves

**Source**: [Kadaster - For Commercial Companies](https://www.kadaster.nl/zakelijk/producten/eigendom/kadaster-voor-commerciele-bedrijven)

---

## 🚨 Critical Legal Issues

### 1. Dutch Data Protection Authority (AP) Position

The AP (Autoriteit Persoonsgegevens) has explicitly warned against commercial reuse of personal data from public registers:

> "The reuse of personal data from public registers can facilitate data profiling, stalking, and doxing."

**Source**: [AP - Personal Data from Public Registers](https://autoriteitpersoonsgegevens.nl/nl/nieuws/ap-persoonsgegevens-uit-openbare-registers-niet-hergebruiken-voor-commerciele-doeleinden)

### 2. Government Policy Direction

The Dutch government is implementing restrictions on reusing personal data from public registers:

- ❌ Reuse will be **forbidden by default**
- ✅ Only permitted with specific legal authorization
- 📜 New legislation in development

**Source**: [DMCC - Government Response to AP Advice](https://dmcc-online.nl/wetgeving/regering-neemt-advies-ap-over)

### 3. Your Application's Risk Profile

#### ❌ HIGH RISK Model: Bulk Storage Database

**If you build**:
- Users purchase Kadaster extracts (uittreksel)
- Data uploaded to your database
- Multiple users access stored data

**Legal Problems**:

1. **Data Controller Obligations**
   - You become GDPR data controller for personal information
   - Full compliance burden (security, rights requests, breach notification)
   - Need legal basis beyond "user paid for it"

2. **Purpose Limitation Violation**
   - Kadaster processes data for statutory purposes
   - Your database creates new purpose (data aggregation/access)
   - Conflicts with AP's anti-profiling stance

3. **Facilitating Bulk Access**
   - Database model enables mass data access
   - Exactly what AP wants to prevent
   - Risk of regulatory action

4. **Individual Rights Issues**
   - Data subjects have limited rights in public registers
   - Your database: full GDPR rights apply (erasure, portability, etc.)
   - Conflict between register law and GDPR

5. **Direct Marketing Restrictions**
   - Cannot use Kadaster personal data for direct marketing
   - If users access data for commercial purposes, you may be liable

**Regulatory Risk**: **VERY HIGH** 🔴

---

## ✅ COMPLIANT Alternatives

### Model A: Transaction Data Only (Recommended for MVP)

**What you store**:
- ✅ Property addresses (from BAG - public, non-personal)
- ✅ Transaction prices (anonymized, aggregated)
- ✅ Historical price trends (statistical)
- ✅ Property characteristics (size, year, type)
- ❌ **NO** owner names, birthdates, or identifiable personal data

**Legal basis**: Public open data (BAG is CC0)

**GDPR impact**: Minimal (no personal data stored)

**Implementation**:
```python
# Store only property metadata, not owner info
{
  "address": "Keizersgracht 1, Amsterdam",
  "last_sale_price": 850000,
  "last_sale_date": "2023-01-15",
  "woz_value": 820000,
  "price_trend": "+5.2% vs 2022",
  # NO owner_name, owner_dob, etc.
}
```

**Risk**: **LOW** 🟢

---

### Model B: Real-Time API Proxy (No Storage)

**How it works**:
1. User requests property information
2. Your app queries Kadaster API in real-time
3. Display data to user immediately
4. **Don't store personal data**
5. Cache only aggregated/anonymized statistics

**Legal advantages**:
- Not a data controller (just processor)
- No purpose limitation issues
- No bulk access facilitation
- Users get fresh data directly from source

**Technical implementation**:
```typescript
// API route: /api/kadaster/lookup
async function lookupProperty(address: string) {
  // Query Kadaster API (user pays per query)
  const data = await kadaster.query(address);

  // Return to user, don't persist
  return data;
}

// Optional: Cache only aggregated stats
async function cacheAggregatedData(data: KadasterData) {
  await db.statistics.upsert({
    postal_code: data.postalCode.slice(0, 4), // Only 4 digits (area)
    avg_price: calculateAverage(),
    // No personal data
  });
}
```

**Risk**: **LOW-MEDIUM** 🟡

---

### Model C: User-Uploaded Data (Community Model)

**How it works**:
1. Users voluntarily submit their own WOZ values
2. You verify authenticity (check WOZ screenshot)
3. Store only verified, user-consented data
4. Display aggregated statistics to all users

**Legal basis**: Consent (GDPR Article 6(1)(a))

**Advantages**:
- Clear consent from data subjects
- Purpose is transparent
- Community benefit

**Requirements**:
- Explicit consent checkbox
- Clear privacy notice
- Right to withdraw consent
- Data minimization (only WOZ value, not full extract)

**Risk**: **LOW** 🟢

---

## 📋 Data Classification

### Kadaster Data Classification

#### ✅ Non-Personal Cadastral Data (Safe to Display Publicly)

| Data Element | Can Store & Display? | GDPR Impact | Example |
|--------------|---------------------|-------------|---------|
| **Address** | ✅ Yes | None | "Keizersgracht 1, 1015 CJ Amsterdam" |
| **Cadastral size** | ✅ Yes | None | "150 m²" |
| **Sale price (last)** | ✅ Yes | None | "€850,000 (2023)" |
| **Erfpacht status** | ✅ Yes | None | "Afgekocht tot 2050" |
| **Monument status** | ✅ Yes | None | "Rijksmonument" |
| **Usage restrictions** | ✅ Yes | None | "Woonbestemming" |
| **Cadastral boundaries** | ✅ Yes | None | GeoJSON polygon |

**Risk**: 🟢 **LOW** - Store and display freely

#### ⚠️ Personal Data (Can Store, Must Redact in Public View)

| Data Element | Can Store? | Public Display? | When Can Show? | Risk |
|--------------|------------|-----------------|----------------|------|
| **Owner name** | ✅ Yes | ❌ Redacted | User has legitimate interest | 🟡 MEDIUM |
| **Owner birthdate** | ✅ Yes | ❌ Redacted | User has legitimate interest | 🟡 MEDIUM |
| **Marital status** | ✅ Yes | ❌ Redacted | User has legitimate interest | 🟡 MEDIUM |
| **Usage rights holder** | ✅ Yes | ❌ Redacted | User has legitimate interest | 🟡 MEDIUM |

**Risk**: 🟡 **MEDIUM** - Can store, but implement access controls

**Legitimate Interest Examples**:
- ✅ User is considering purchasing the property
- ✅ User is a notary/lawyer handling transaction
- ✅ User is the property owner themselves
- ❌ User is browsing for curiosity
- ❌ User wants to contact owner for marketing

#### ❌ Bulk Marketing/Profiling (Forbidden)

| Use Case | Allowed? | Why Not? |
|----------|----------|----------|
| Create owner database for targeted ads | ❌ No | Conflicts with AP guidance |
| Mass contact owners for sales | ❌ No | Direct marketing restriction |
| Profile owners by wealth/property | ❌ No | Data profiling concern |
| Sell owner contact lists | ❌ No | AP warned against this |

**Risk**: 🔴 **VERY HIGH** - Don't implement

### Other Data Sources

| Source | Data Type | License | Personal Data? | Risk |
|--------|-----------|---------|----------------|------|
| **BAG** | Addresses, coordinates | CC0 | ❌ No | 🟢 LOW |
| **BAG** | Building year, type, size | CC0 | ❌ No | 🟢 LOW |
| **CBS** | Demographics (aggregated) | CC-BY | ❌ No | 🟢 LOW |
| **Leefbaarometer** | Livability scores | Open Data | ❌ No | 🟢 LOW |
| **Crime Stats** | Crime by neighborhood | Open Data | ❌ No | 🟢 LOW |
| **PDOK** | Maps, boundaries | CC0 | ❌ No | 🟢 LOW |
| **WOZ** | Property valuation | Public | ⚠️ Pseudo | 🟡 MEDIUM |

**WOZ Note**: WOZ values are tied to addresses, not directly to persons, but can be indirectly identifying.

---

## 🛡️ Recommended Architecture

### For This Project (Where-to-Live-NL)

**Phase 1: MVP (Public Data Only)**
```
✅ Store & Display Publicly:
  - BAG addresses, building data
  - CBS demographics (aggregated)
  - Leefbaarometer scores
  - Crime statistics
  - WOZ values (address-level)
  - Kadaster sale prices (last transaction)
  - Kadaster cadastral size
  - Erfpacht status
  - Monument status
```

**Phase 2: Premium Features (Kadaster Integration)**
```
✅ Store (with access controls):
  - Owner names (REDACTED in public view)
  - Owner birthdates (REDACTED in public view)
  - Usage rights (REDACTED in public view)

Display Rules:
  - Public view: "Owner information available on request"
  - Authenticated users with legitimate interest: Full data
  - Property owner themselves: Full data
  - Random browsers: Redacted
```

**Implementation Example**:
```typescript
// Database: Store full Kadaster data
{
  address: "Keizersgracht 1",
  cadastral_size: 150,
  sale_price_last: 850000,
  erfpacht: "Afgekocht tot 2050",
  monument_status: "Rijksmonument",
  owner_name: "J. de Vries",        // ⚠️ Stored
  owner_birthdate: "1980-05-15",    // ⚠️ Stored
}

// Public API: Return redacted data
{
  address: "Keizersgracht 1",
  cadastral_size: 150,
  sale_price_last: 850000,
  erfpacht: "Afgekocht tot 2050",
  monument_status: "Rijksmonument",
  owner_name: "[REDACTED]",         // ✅ Hidden
  owner_info_available: true,       // ℹ️ Flag
  owner_access_requires: "legitimate_interest"
}

// Premium API: Return full data (with auth)
// Only if user has legitimate interest
```

---

## 📜 GDPR Compliance Checklist

If you store any personal data:

### Before Launch
- [ ] **Legal basis identified** for each processing activity
- [ ] **Privacy notice** drafted and reviewed by lawyer
- [ ] **Data Protection Impact Assessment (DPIA)** completed
- [ ] **Data Processing Agreement** with any processors (hosting providers)
- [ ] **Security measures** documented and implemented
- [ ] **Breach notification procedure** established
- [ ] **Data retention policy** defined
- [ ] **Cookie consent** (if using analytics/tracking)

### During Operation
- [ ] **Data subject rights** process (access, erasure, portability)
- [ ] **Register of processing activities** maintained
- [ ] **Regular security audits**
- [ ] **Staff training** on data protection
- [ ] **Vendor compliance** verification

### For Kadaster Data Specifically
- [ ] **Purpose limitation** enforced (no repurposing)
- [ ] **No direct marketing** use
- [ ] **Access controls** (who can see personal data?)
- [ ] **Audit logs** (track access to sensitive data)
- [ ] **User consent** if beyond original purpose

---

## 🚫 What NOT to Do

### ❌ Absolutely Forbidden

1. **Scraping Kadaster website at scale**
   - Use official API only
   - Respect rate limits
   - Don't circumvent access controls

2. **Creating owner database for marketing**
   - AP has explicitly warned against this
   - High risk of enforcement action

3. **Selling bulk Kadaster extracts**
   - Reselling requires proper licensing
   - Cannot be used for profiling/targeting

4. **Ignoring data subject rights**
   - Must respond to GDPR requests within 30 days
   - Fines up to €20M or 4% of turnover

---

## 🎯 Recommended Approach for This Project

### What We Actually Need

For the "Where to Live NL" use case, you **don't need** personal owner information. You need:

✅ **Property characteristics**:
- Address (BAG - public)
- Building year (BAG - public)
- Size (BAG - public)
- WOZ value (public, address-tied)

✅ **Market intelligence**:
- Average prices by neighborhood (aggregated)
- Price trends over time (statistical)
- Days on market (from user-submitted data)

✅ **Livability factors**:
- Crime statistics (aggregated)
- School quality (public)
- Environmental factors (public)

❌ **NOT needed**:
- Owner names
- Owner dates of birth
- Individual transaction details (beyond price)

### Implementation Strategy

**Phase 1: Public Non-Personal Data (Launch)**
```python
# Safe to store in database
data = {
  "address": bag_address,
  "woz_value": woz_scraper.get_value(address),
  "building_year": bag_building_year,
  "livability_score": leefbaarometer_score,
  "crime_index": crime_stats_aggregated,
  # No owner info!
}
```

**Phase 2: Premium Kadaster Features (Optional)**
```python
# Real-time API proxy (don't store)
@app.route('/api/kadaster-lookup')
async def kadaster_lookup(address: str, user_id: str):
    # Check if user paid for this query
    if not user.has_credits():
        raise Unauthorized

    # Query Kadaster API in real-time
    data = await kadaster_api.query(address)

    # Log access (audit trail)
    log_access(user_id, address, timestamp)

    # Return immediately, DON'T STORE
    return data
```

---

## 📞 Resources & Next Steps

### Before Launching

1. **Consult Dutch Privacy Lawyer**
   - Specializing in GDPR & public data
   - Review your specific data model
   - Estimated cost: €1,000-3,000

2. **Contact Kadaster Directly**
   - Email: klantcontact@kadaster.nl
   - Phone: 088 183 2000
   - Ask about your specific business model

3. **Review with Data Protection Officer**
   - If you process large-scale personal data
   - May be legally required

### Helpful Links

- **Kadaster Commercial Terms**: https://www.kadaster.nl/zakelijk/producten/eigendom/kadaster-voor-commerciele-bedrijven
- **Dutch DPA (AP)**: https://autoriteitpersoonsgegevens.nl/
- **GDPR Text**: https://gdpr-info.eu/
- **EU Open Data Directive**: https://eur-lex.europa.eu/eli/dir/2019/1024/oj

---

## 🎓 Key Takeaways

1. **BAG data (addresses, building info)**: ✅ Safe to store and use (CC0 license)

2. **WOZ values (property valuations)**: 🟡 Mostly safe if no owner info attached

3. **Kadaster ownership data**: 🔴 HIGH RISK to store in bulk
   - Use real-time API instead
   - Don't create owner database
   - Follow AP guidance

4. **Your original idea (users upload extracts → database access)**: 🔴 **NOT RECOMMENDED**
   - High regulatory risk
   - GDPR compliance burden
   - Conflicts with AP policy

5. **Alternative: Real-time lookup or user consent model**: 🟢 **RECOMMENDED**
   - Lower risk
   - Better user experience
   - Compliant with evolving regulations

---

## 📋 Decision Matrix

| Feature | Model A: No Personal Data | Model B: Real-Time API | Model C: Bulk Storage |
|---------|----------------------------|------------------------|---------------------|
| **Stores owner info** | ❌ No | ❌ No | ✅ Yes |
| **GDPR controller** | ❌ No | ⚠️ Processor only | ✅ Yes (full burden) |
| **Legal risk** | 🟢 LOW | 🟡 MEDIUM | 🔴 HIGH |
| **Development complexity** | 🟢 Easy | 🟡 Medium | 🔴 Complex |
| **Running costs** | 🟢 Low | 🟡 Medium (API fees) | 🟢 Low |
| **Regulatory approval** | ✅ Likely | 🟡 Possible | ❌ Unlikely |
| **User experience** | 🟢 Fast | 🟡 Slight delay | 🟢 Fast |

**Recommendation for Where-to-Live-NL**: **Model A** (No Personal Data)

You can build a great housing intelligence platform using only public non-personal data (BAG, WOZ values without owner info, demographics, livability scores).

---

## ⚠️ Disclaimer

This document is for informational purposes only and does not constitute legal advice. Laws and regulations change over time. Always consult a qualified Dutch privacy lawyer before processing personal data or launching a commercial service using government data.

**Last Updated**: November 3, 2025
**Next Review**: February 3, 2026
**Author**: Project documentation team

---

**Questions about legal compliance?**
- Consult a lawyer specializing in Dutch data protection law
- Contact Kadaster for clarification on commercial use
- Review AP guidance on public register data reuse

**Ready to build compliantly?**
- Focus on BAG + aggregated data (safest path)
- Implement real-time Kadaster API if personal data needed
- Always prioritize user privacy and data minimization
