# Where-to-Live-NL: Comprehensive Pricing Analysis

> **Last Updated**: November 3, 2025
> **Goal**: Run a production-ready housing intelligence platform for **$0-5/month**

---

## 🎯 Executive Summary

**Yes, you can run this for FREE (or near-free)!**

By strategically leveraging generous free tiers from modern cloud providers, the Where-to-Live-NL platform can serve **thousands of users monthly** with minimal to zero hosting costs.

### Cost Breakdown

| Traffic Level | Monthly Cost | Primary Costs |
|---------------|--------------|---------------|
| **0-5,000 users** | **$0** | Entirely free tiers |
| **5,000-25,000 users** | **$1-10** | Slight R2 overages, compute |
| **25,000-100,000 users** | **$20-50** | Bandwidth, compute scaling |
| **100,000+ users** | **$100-200** | Professional tier, support |

---

## 📊 Detailed Provider Breakdown

## 1. Cloudflare R2 (Data Storage)

### What We Use It For
- Static datasets (BAG, CBS, Leefbaarometer, etc.)
- Processed GeoJSON/Parquet files
- Vector tiles (PMTiles)
- Cached API responses

### Pricing Structure

| Resource | Free Tier | Paid Rate | Our Usage | Cost |
|----------|-----------|-----------|-----------|------|
| **Storage** | 10 GB/month | $0.015/GB | 5-7 GB | **$0** |
| **Class A Operations** (write) | 1M/month | $4.50/million | ~10K/month | **$0** |
| **Class B Operations** (read) | 10M/month | $0.36/million | ~2M/month | **$0** |
| **Egress** | ∞ UNLIMITED | **$0** | Any amount | **$0** |

### Key Advantages
✅ **Zero egress fees** (unlike AWS S3)
✅ **10 GB free storage** covers our entire dataset
✅ **10 million free reads/month** = ~333,000 users viewing data
✅ Updates (writes) happen weekly = minimal Class A operations

### Cost Estimate
```
Storage: 7 GB → FREE (within 10 GB limit)
Reads: 2M/month → FREE (within 10M limit)
Writes: 10K/month → FREE (within 1M limit)
Egress: 100 GB/month → FREE (always free)

Total R2 Cost: $0.00/month
```

### When You'd Pay
- **Storage >10 GB**: If you add high-res imagery, video tours, or expand to Belgium/Germany
  - Cost: $0.015 × 5 GB overage = **$0.08/month** (negligible)
- **Reads >10M/month**: At ~5M users/month
  - Cost: $0.36 per million reads × 5M overage = **$1.80/month**

---

## 2. Vercel (Frontend & Functions)

### What We Use It For
- Next.js frontend hosting
- Serverless API routes
- Image optimization
- Build & deployment pipeline

### Pricing Structure

#### Hobby Plan (FREE)
| Resource | Included | Our Usage | Sufficient? |
|----------|----------|-----------|-------------|
| **Edge Requests** | 1M/month | ~500K/month | ✅ Yes |
| **Data Transfer** | 100 GB/month | ~30 GB/month | ✅ Yes |
| **Serverless Functions** | 100 GB-hrs | ~20 GB-hrs | ✅ Yes |
| **Build Minutes** | Unlimited | ~50 min/month | ✅ Yes |
| **Projects** | 2 | 1 (this project) | ✅ Yes |
| **Team Members** | 1 | 1 | ✅ Yes |

#### Pro Plan ($20/month)
Only needed if:
- Edge requests >1M/month (~33K users/day)
- Bandwidth >100 GB/month
- Need team collaboration (multiple developers)
- Want deployment protection, password-protected previews

| Resource | Included | Overage Cost |
|----------|----------|--------------|
| **Edge Requests** | 10M/month | $2 per 1M |
| **Data Transfer** | 1 TB/month | $0.15/GB |
| **Serverless Active CPU** | 4 hours | $0.128/hour |
| **Image Optimizations** | 5,000/month | $0.05 per 1K |

### Cost Estimate

**Hobby Plan (Target for MVP):**
```
Hosting: FREE
Edge Requests: 1M included → FREE
Bandwidth: 100 GB included → FREE
Functions: 100 GB-hrs included → FREE
Builds: Unlimited → FREE

Total Vercel Cost: $0.00/month
```

**Pro Plan (If we scale):**
```
Base: $20/month
10M edge requests: FREE (included)
1 TB bandwidth: FREE (included)
Additional compute: ~$5/month (for heavy API usage)

Total Vercel Cost: $20-25/month
```

### When You'd Upgrade to Pro ($20/month)
- **Traffic**: >30,000 daily active users
- **Team**: Need multiple developers with preview deployments
- **Features**: Advanced spend management, faster builds
- **Support**: Need email support vs. community only

### Cost Optimization Strategies
1. **Static-first architecture**: Pre-generate as much as possible
   - Reduces serverless function invocations
   - More cacheable = less bandwidth
2. **Serve data from R2**: Bypass Vercel bandwidth limits
   - Client fetches directly from R2 (free egress)
3. **Incremental Static Regeneration (ISR)**: Cache pages for 24 hours
4. **Image optimization**: Use next/image with proper sizing

---

## 3. Supabase (User Data & Auth)

### What We Use It For
- User authentication (email, social OAuth)
- User profiles & saved searches
- Saved locations/favorites
- User-submitted data (reviews, price reports)

### Pricing Structure

#### Free Plan
| Resource | Included | Our Usage | Sufficient? |
|----------|----------|-----------|-------------|
| **Database Size** | 500 MB | ~50 MB | ✅ Yes |
| **Monthly Active Users** | 50,000 MAU | ~1,000 MAU | ✅ Yes |
| **Egress** | 5 GB/month | ~2 GB/month | ✅ Yes |
| **File Storage** | 1 GB | ~100 MB | ✅ Yes |
| **Edge Functions** | 500K invocations | ~50K/month | ✅ Yes |

**Limitation**: Projects pause after 1 week of inactivity
- **Workaround**: Set up a cron job to ping the database daily (prevents pausing)

#### Pro Plan ($25/month)
| Resource | Included | Overage Cost |
|----------|----------|--------------|
| **Database Size** | 8 GB | $0.125/GB |
| **MAU** | 100,000 | $0.00325 per MAU |
| **Egress** | 250 GB | $0.09/GB |
| **File Storage** | 100 GB | $0.021/GB |
| **No pausing** | ✅ Always on | - |
| **Daily backups** | 7 days retained | - |
| **Compute Credits** | $10 included | - |

### Cost Estimate

**Free Plan (Target for MVP):**
```
Database: 500 MB included → FREE
Auth (MAU): 50,000 included → FREE
Egress: 5 GB included → FREE
Storage: 1 GB included → FREE

Keep-alive workaround: $0 (simple cron ping)

Total Supabase Cost: $0.00/month
```

**Pro Plan (When scaling):**
```
Base: $25/month
Database: 8 GB included → FREE
MAU: 100K included → FREE
No pausing: ✅ Included

Total Supabase Cost: $25/month
```

### When You'd Upgrade to Pro ($25/month)
- **Always-on requirement**: Can't tolerate cold starts
- **Backups**: Need point-in-time recovery
- **Scale**: >50,000 authenticated users
- **Team features**: Need read-only dashboard access
- **Support**: Email support vs. community only

### Alternative: Self-hosted Postgres (FREE)
If you want to avoid Supabase limits:
- **Railway.app**: Free tier with 512 MB Postgres
- **Neon.tech**: Serverless Postgres, 512 MB free
- **Fly.io**: Free tier with 256 MB Postgres
- **Self-host on VPS**: DigitalOcean $6/month droplet

---

## 4. Additional Services

### Domain Name
| Provider | Cost | Notes |
|----------|------|-------|
| **Namecheap** | $9/year (.com) | Cheapest option |
| **Cloudflare** | $10/year | Includes proxy, DDoS protection |
| **Porkbun** | $8/year | Often has deals |

**Recommendation**: Cloudflare Registrar ($10/year) for integrated DNS

### Email Sending (User Notifications)
| Provider | Free Tier | Overage Cost |
|----------|-----------|--------------|
| **Resend** | 3,000/month | $1 per 1,000 |
| **Postmark** | 100/month | $1.25 per 1,000 |
| **SendGrid** | 100/day | $20/month for more |
| **AWS SES** | 62,000/month (if on EC2) | $0.10 per 1,000 |

**Recommendation**: Resend (3,000 free emails/month = 100/day)
- Enough for password resets, saved search alerts

### Monitoring & Analytics
| Service | Free Tier | Purpose |
|---------|-----------|---------|
| **Plausible** | €9/month (paid only) | Privacy-friendly analytics |
| **Umami** | Self-hosted FREE | Open-source analytics |
| **BetterStack** | 10 monitors free | Uptime monitoring |
| **Sentry** | 5K errors/month | Error tracking |

**Recommendation**: Self-host Umami on Vercel (free), BetterStack for uptime

### Map Tiles
| Provider | Free Tier | Cost |
|----------|-----------|------|
| **MapLibre + PDOK** | Unlimited | **FREE** |
| **Maptiler** | 100K loads/month | $0.60 per 1K |
| **Mapbox** | 50K loads/month | $0.60 per 1K |

**Recommendation**: Use Dutch government PDOK tiles (free, unlimited)
- MapLibre GL JS (open source, no API key needed)
- PDOK BRT Achtergrondkaart (official Dutch basemap)

---

## 💰 Total Cost Scenarios

### Scenario 1: MVP Launch (0-5,000 users/month)
```
✅ Cloudflare R2:        $0.00    (within free tier)
✅ Vercel Hobby:         $0.00    (within free tier)
✅ Supabase Free:        $0.00    (within free tier)
✅ Domain:               $0.83    ($10/year ÷ 12)
✅ Resend Email:         $0.00    (within free tier)
✅ Umami Analytics:      $0.00    (self-hosted)
✅ BetterStack:          $0.00    (within free tier)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Monthly Cost:      $0.83/month (~$10/year)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Scenario 2: Growing (5,000-25,000 users/month)
```
✅ Cloudflare R2:        $1.50    (slight overage on reads)
✅ Vercel Hobby:         $0.00    (still within limits)
✅ Supabase Free:        $0.00    (within 50K MAU)
✅ Domain:               $0.83
✅ Resend Email:         $2.00    (5K emails/month)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Monthly Cost:      $4.33/month
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Scenario 3: Established (25,000-100,000 users/month)
```
⚠️ Vercel Pro:           $20.00   (need team features, more bandwidth)
⚠️ Supabase Pro:         $25.00   (>50K MAU, always-on)
✅ Cloudflare R2:        $3.00    (higher read volume)
✅ Domain:               $0.83
✅ Resend:               $5.00    (8K emails/month)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Monthly Cost:      $53.83/month
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Scenario 4: Large Scale (100,000+ users/month)
```
⚠️ Vercel Pro:           $35.00   (base + overages)
⚠️ Supabase Pro:         $30.00   (overages on MAU)
✅ Cloudflare R2:        $8.00    (higher usage)
✅ Domain:               $0.83
✅ Resend:               $15.00   (20K emails/month)
🔵 CDN (BunnyCDN):       $10.00   (additional caching layer)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Monthly Cost:      $98.83/month
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🎯 Cost Optimization Strategies

### 1. Maximize Free Tiers
**Keep Supabase Free Plan Active**
- Set up daily cron job (via Vercel Cron or GitHub Actions) to ping database
- Prevents auto-pausing after 1 week of inactivity
- Cost: $0 (runs within Vercel free tier)

```yaml
# .github/workflows/keep-alive.yml
name: Keep Supabase Alive
on:
  schedule:
    - cron: '0 6 * * *' # Daily at 6 AM UTC
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -X GET ${{ secrets.SUPABASE_URL }}/rest/v1/health
```

### 2. Aggressive Caching
**Reduce API calls by 80-90%**
- Cache static data (Leefbaarometer, BAG) for 30 days
- Use Vercel Edge Caching (free, automatic)
- Set proper Cache-Control headers

```typescript
// pages/api/livability.ts
export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  const data = await fetchFromR2('leefbaarometer.json');

  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=2592000', // 30 days
    },
  });
}
```

### 3. Client-Side Processing
**Offload computation to user's browser**
- Calculate travel time isochrones locally (TurfJS)
- Filter/sort search results client-side
- Reduces serverless function invocations
- Cost savings: ~$10-20/month at scale

### 4. Lazy Loading
**Only load data when needed**
- Load map tiles on-demand (viewport-based)
- Fetch property details on click (not preload)
- Defer non-critical JavaScript

### 5. Image Optimization
**Reduce bandwidth costs**
- Use WebP format (30% smaller than JPEG)
- Serve responsive images (different sizes for mobile/desktop)
- Compress with sharp/next-image

### 6. Database Indexing
**Reduce query costs**
- Index frequently searched columns (postal_code, city)
- Use materialized views for complex aggregations
- Reduces compute time = lower costs

### 7. Data Compression
**Reduce R2 storage & transfer costs**
- Gzip all JSON files (70% size reduction)
- Use Parquet instead of JSON (40% smaller)
- Use PMTiles for vector maps (single file, range requests)

**Size comparison:**
```
BAG Addresses (raw JSON):     2.5 GB
BAG Addresses (gzipped JSON): 750 MB (-70%)
BAG Addresses (Parquet):      500 MB (-80%)
```

---

## 📊 Traffic vs. Cost Modeling

### Users Per Month → Infrastructure Costs

| Users/Month | Requests | Bandwidth | Vercel | Supabase | R2 | Total |
|-------------|----------|-----------|--------|----------|----|----|
| 1,000 | 50K | 10 GB | $0 | $0 | $0 | **$0** |
| 5,000 | 250K | 50 GB | $0 | $0 | $0 | **$0** |
| 10,000 | 500K | 100 GB | $0 | $0 | $0.50 | **$0.50** |
| 25,000 | 1.2M | 250 GB | $2 | $0 | $1 | **$3** |
| 50,000 | 2.5M | 500 GB | $20 | $25 | $2 | **$47** |
| 100,000 | 5M | 1 TB | $35 | $30 | $5 | **$70** |

**Assumptions:**
- Average user: 5 page views, 2 MB transferred
- 10% of users create accounts (MAU)
- 30-day cache hit rate: 60%

---

## 💡 Monetization Strategy to Cover Costs

### When to Introduce Premium Features

**Target**: Cover costs at 10,000 users (~$5-10/month)

#### Free Tier (Always Free)
- Basic map with livability scores
- Crime statistics
- Building characteristics (BAG data)
- Travel time calculator (3 destinations)
- Demographics overview

#### Premium Tier ($5-10/month)
- **WOZ value lookups** (cached/shared)
- **Kadaster transaction history** (last 5 sales)
- **Advanced travel time** (unlimited destinations)
- **Neighborhood comparison** (side-by-side, PDF export)
- **Email alerts** (price drops, new listings)
- **Saved searches** (unlimited)
- **Ad-free experience**

#### Revenue Projections
```
Scenario: 10,000 free users + 200 premium ($8/month)

Revenue:
  Premium subscriptions: 200 × $8 =  $1,600/month

Costs:
  Vercel Pro:                          $20
  Supabase Pro:                        $25
  R2:                                  $2
  Email (Resend):                      $3
  Domain:                              $1
  ──────────────────────────────────
  Total costs:                         $51/month

Profit: $1,600 - $51 = $1,549/month
```

**Break-even point**: 4 premium subscribers ($8 × 4 = $32 > $51 costs)

### Alternative: Donations/Sponsorships
- GitHub Sponsors: $1, $5, $10/month tiers
- Ko-fi: One-time donations
- Open Collective: Transparent finances
- Corporate sponsors (real estate agencies, relocation services)

---

## 🔄 Cost vs. Growth Timeline

### Phase 1: MVP (Months 1-3)
**Target**: 100-500 users
**Monthly Cost**: **$0.83** (just domain)
**Strategy**: 100% free tiers

### Phase 2: Beta (Months 4-6)
**Target**: 500-5,000 users
**Monthly Cost**: **$0-5**
**Strategy**: Still free tiers, optimize caching

### Phase 3: Public Launch (Months 7-9)
**Target**: 5,000-25,000 users
**Monthly Cost**: **$5-20**
**Strategy**: Introduce premium tier, donations

### Phase 4: Growth (Months 10-12)
**Target**: 25,000-50,000 users
**Monthly Cost**: **$50-70**
**Revenue Target**: **$200-500** (premium subs)
**Net Profit**: **$150-430/month**

---

## 🎁 Bonus: Completely Free Alternative Stack

If you want to stay **100% free forever** (no domain cost):

| Service | Provider | Limit | Workaround |
|---------|----------|-------|------------|
| **Hosting** | Vercel | 1M requests/month | Use Cloudflare Pages (unlimited) |
| **Database** | PlanetScale | 5 GB, sleeps | Railway (512 MB, always-on) |
| **Auth** | Clerk | 5K MAU | Auth.js (self-hosted, unlimited) |
| **Storage** | Cloudflare R2 | 10 GB | ✅ Sufficient |
| **Domain** | Vercel | yourproject.vercel.app | Free subdomain |
| **Email** | Resend | 3K/month | ✅ Sufficient |
| **Analytics** | Umami | Self-hosted | ✅ Free |

**Total Cost**: **$0.00/month** 🎉

**Trade-offs**:
- vercel.app subdomain (not custom domain)
- Community support only (no priority help)
- Limited to 1 developer
- Manual backups (no automatic)

---

## 📋 Cost Tracking Checklist

### Monthly Cost Monitoring
- [ ] Check Cloudflare R2 dashboard (storage, operations)
- [ ] Check Vercel usage (bandwidth, functions)
- [ ] Check Supabase metrics (MAU, database size)
- [ ] Review email sending (Resend usage)
- [ ] Monitor error tracking (Sentry quota)

### Set Up Alerts
- [ ] Vercel: Email alert at 80% of free tier usage
- [ ] Supabase: Alert at 40K MAU (before hitting 50K limit)
- [ ] R2: Alert at 8 GB storage (before hitting 10 GB)
- [ ] Budget alert: Notify if monthly cost >$10

### Quarterly Review
- [ ] Analyze traffic growth trends
- [ ] Forecast next quarter's costs
- [ ] Optimize underperforming areas (cache hit rates)
- [ ] Consider upgrading vs. optimizing

---

## 🏆 Key Takeaways

### ✅ Yes, You Can Run This for Free!

**Reality Check:**
1. **MVP to 5,000 users**: Completely **FREE** (only domain cost)
2. **5,000-25,000 users**: **$5-20/month** (still incredibly cheap)
3. **25,000+ users**: **$50-100/month** (time to monetize)

### 🎯 The Magic Formula

```
Free Tiers + Static-First Architecture + Aggressive Caching = $0-5/month
```

### 🚀 When to Upgrade

**Don't upgrade until you NEED to:**
- Vercel: Stay on Hobby until you hit 1M requests/month
- Supabase: Stay on Free until you hit 40K MAU (use keep-alive)
- R2: Will stay free until 50,000+ users

**Upgrade triggers:**
- Need team collaboration (multiple developers)
- Need guaranteed uptime (SLAs)
- Need priority support
- Revenue justifies costs (premium subscriptions)

### 💰 Cost as % of Revenue

**Healthy SaaS metrics:**
- Infrastructure costs should be <30% of revenue
- At $500 MRR → Max $150/month infrastructure
- Our platform: ~$50-70/month at 50K users
- **We're well within healthy margins!**

---

## 📞 Questions or Optimizations?

If you discover cheaper alternatives or optimization strategies, please open a GitHub Discussion or submit a PR to update this document!

**Document Version**: 1.0
**Last Updated**: November 3, 2025
**Next Review**: February 3, 2026
**Owner**: @yourusername

---

*Remember: The best cost optimization is not building features nobody uses. Start free, validate demand, then scale infrastructure as revenue grows.*
