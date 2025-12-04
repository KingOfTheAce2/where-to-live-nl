# Hosting Costs & Infrastructure Pricing

> Cost analysis and free hosting guide for Where-to-Live-NL

---

## Current Architecture (Near-Free)

| Service | Tier | Cost |
|---------|------|------|
| Vercel (Frontend) | Free | $0 |
| Cloudflare Workers | Free (100k req/day) | $0 |
| Cloudflare R2 | 7 GB storage | ~$0.10/month |
| PlanetScale | Free (5 GB) | $0 |
| Domain | Annual | ~$10/year |
| **Total** | | **~$1-2/month** |

---

## Scaling Thresholds

| User Range | Monthly Cost | Notes |
|------------|--------------|-------|
| 0-10k users/month | $0 | Completely free |
| 10k-100k users/month | ~$1-5 | Minimal costs |
| 100k+ users/month | ~$20-50 | Upgrade to professional tiers |

---

## Service Details

### Frontend (Vercel)

- **Free tier limits**: 100 GB bandwidth, unlimited static sites
- **Upgrade trigger**: >100 GB bandwidth or team features needed
- **Pro tier**: $20/month per member

### API Layer (Cloudflare Workers)

- **Free tier limits**: 100,000 requests/day, 10ms CPU time
- **Upgrade trigger**: >100k requests/day or complex computations
- **Paid tier**: $5/month for 10 million requests

### Storage (Cloudflare R2)

- **Free tier limits**: 10 GB storage, 1 million Class A ops, 10 million Class B ops
- **Current usage**: ~5-7 GB for all datasets
- **Cost calculation**:
  - Storage: $0.015/GB/month after free tier
  - Class A ops (writes): $4.50/million after free tier
  - Class B ops (reads): $0.36/million after free tier

### Database (PlanetScale/Supabase)

- **Free tier limits**: 5 GB storage, 1 billion row reads/month
- **Use case**: User preferences, saved searches only
- **Upgrade trigger**: >5 GB or team collaboration features

---

## Cost Optimization Tips

1. **Use CDN caching aggressively** - Most data updates infrequently
2. **Serve static files from R2** - Cheaper than dynamic API calls
3. **Compress everything** - Parquet files are 80%+ smaller than JSON
4. **Lazy load map tiles** - Only fetch what's visible
5. **Client-side filtering** - Reduce API calls where possible

---

## Budget Monitoring

Set up billing alerts at these thresholds:
- $5/month - Early warning
- $10/month - Review usage patterns
- $25/month - Consider architecture optimization

---

*Last updated: December 2025*
