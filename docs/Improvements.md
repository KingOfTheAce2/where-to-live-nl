# Where-to-Live-NL: Improvements Backlog

> **Version**: 1.0
> **Last Updated**: December 29, 2025
> **Project Status**: MVP ~95% Complete

This document catalogs all identified improvements, technical debt, and enhancements for the Where-to-Live-NL platform, organized by priority and category.

---

## Priority Legend

| Priority | Icon | Description |
|----------|------|-------------|
| **Critical** | :red_circle: | Must fix before launch - blockers or security issues |
| **High** | :orange_circle: | Should fix before beta - significant impact on quality |
| **Medium** | :yellow_circle: | Important but can wait - improves maintainability |
| **Low** | :white_circle: | Nice to have - future enhancements |

---

## 1. Security Improvements

### :red_circle: Critical

- [ ] **API Rate Limiting** - No rate limiting on any endpoint; vulnerable to DoS attacks
  - Implement rate limiting middleware (e.g., `slowapi` for FastAPI)
  - Configure limits per endpoint: 100 req/min for data, 10 req/min for expensive operations
  - Add IP-based and user-based rate limiting for authenticated users

- [ ] **Input Validation** - Query parameters lack proper validation
  - Validate all geographic coordinates (lat/lng bounds)
  - Sanitize postal codes, house numbers, area codes
  - Add Pydantic models for all API request schemas
  - Prevent injection through column name parameters

- [ ] **CORS Configuration** - Hardcoded to localhost
  - Move CORS origins to environment variables
  - Configure separate origins for development/staging/production
  - Remove localhost references in production builds

- [ ] **Remove Console Statements** - 182 console.log/error statements in production code
  - Replace with proper logging framework (pino for frontend, structlog for backend)
  - Configure log levels per environment
  - Ensure no sensitive data logged

### :orange_circle: High

- [ ] **Authentication on Sensitive Endpoints** - Some endpoints expose aggregated data without auth
  - Review all `/api/*` endpoints for authentication requirements
  - Implement middleware for protected routes
  - Add API key support for programmatic access

- [ ] **Request Logging & Audit Trail** - No logging infrastructure
  - Implement request logging with correlation IDs
  - Log authentication events
  - Track rate limit violations

- [ ] **Environment Variable Audit** - Some keys visible in examples
  - Audit `.env.local.example` for sensitive defaults
  - Ensure all secrets use placeholder values
  - Document required vs optional environment variables

### :yellow_circle: Medium

- [ ] **CSRF Protection** - Relies solely on CORS
  - Add CSRF tokens for state-changing operations
  - Implement SameSite cookie policy
  - Add Origin/Referer validation

- [ ] **Security Headers** - Missing security headers
  - Add `X-Content-Type-Options: nosniff`
  - Add `X-Frame-Options: DENY`
  - Configure Content Security Policy
  - Add `Strict-Transport-Security` header

- [ ] **Dependency Audit** - No automated security scanning
  - Set up `npm audit` in CI pipeline
  - Configure `safety` for Python dependencies
  - Enable Dependabot or Snyk integration

---

## 2. Testing Improvements

### :red_circle: Critical

- [ ] **Frontend Test Suite** - Zero test coverage
  - Set up Jest + React Testing Library
  - Add unit tests for utility functions
  - Add component tests for critical UI elements
  - Target: 60% coverage minimum before launch

- [ ] **Backend Test Suite** - Zero test coverage
  - Set up Pytest with fixtures
  - Add unit tests for data processing functions
  - Add API endpoint integration tests
  - Test coordinate transformations thoroughly

- [ ] **End-to-End Tests** - No E2E testing
  - Set up Playwright or Cypress
  - Create smoke tests for critical user journeys:
    - Address search flow
    - Map layer toggling
    - Travel time calculation
    - PDF export
  - Run E2E tests in CI before deployment

### :orange_circle: High

- [ ] **API Contract Tests** - No contract validation
  - Document API schemas using OpenAPI/Swagger
  - Add contract tests for external API dependencies
  - Test response structure stability

- [ ] **Performance Tests** - No load testing
  - Set up k6 or Artillery for load testing
  - Establish baseline performance metrics
  - Test concurrent user scenarios

### :yellow_circle: Medium

- [ ] **Visual Regression Tests** - Map rendering not validated
  - Set up Percy or Chromatic for visual testing
  - Capture baseline screenshots of map states
  - Detect unintended visual changes

- [ ] **Data Quality Tests** - No validation of ingested data
  - Add Great Expectations or dbt tests
  - Validate row counts, null percentages, value ranges
  - Alert on data anomalies during ETL

---

## 3. Performance Improvements

### :red_circle: Critical

- [ ] **MapView Component Refactor** - File too large, impacts maintainability and bundle
  - Split into smaller components (LayerControls, MapControls, PopupContent)
  - Extract map initialization logic
  - Use React.lazy for layer-specific code
  - Target: Each component < 300 lines

### :orange_circle: High

- [ ] **Map Layer Lazy Loading** - All 30+ layers load at initialization
  - Implement lazy loading for layer data
  - Load layer definitions on-demand
  - Preload only initially visible layers
  - Add loading states for layer activation

- [ ] **Database Migration** - Parquet files limit scalability
  - Migrate hot data to PostgreSQL (via Supabase)
  - Keep Parquet for archival/analytical queries
  - Implement proper indexing for spatial queries
  - Add connection pooling

- [ ] **Caching Layer** - No caching infrastructure
  - Implement Redis for frequently accessed data
  - Cache travel time results (already partially done)
  - Cache geocoding results
  - Add cache invalidation strategy

- [ ] **Bundle Size Optimization** - Unoptimized frontend bundle
  - Run bundle analyzer (webpack-bundle-analyzer)
  - Identify and remove unused dependencies
  - Implement code splitting for routes
  - Lazy load CesiumJS (large library)

### :yellow_circle: Medium

- [ ] **API Response Optimization**
  - Implement pagination for large datasets
  - Add field selection (GraphQL-style)
  - Compress responses (gzip/brotli)
  - Return only necessary fields

- [ ] **Image & Asset Optimization**
  - Audit and optimize all images
  - Implement WebP format where supported
  - Add proper caching headers for static assets
  - Use next/image for all images

- [ ] **Service Worker** - No offline support
  - Implement service worker for caching
  - Cache static assets and map tiles
  - Add offline fallback pages
  - Enable background sync for saved searches

- [ ] **Distance Calculations** - Computed per request
  - Pre-compute distances for common amenity types
  - Use spatial indexing (R-tree) for faster lookups
  - Cache distance matrices for popular locations

---

## 4. Code Quality Improvements

### :orange_circle: High

- [ ] **Error Handling Standardization**
  - Create consistent error response format
  - Implement global error handler in FastAPI
  - Add error boundaries in React components
  - Remove bare `except:` blocks

- [ ] **TypeScript Strictness**
  - Enable `noImplicitAny` fully
  - Fix all TypeScript errors (not just warnings)
  - Add proper types for external API responses
  - Create type definitions for all data structures

- [ ] **Code Documentation**
  - Add JSDoc comments to all exported functions
  - Add docstrings to all Python functions
  - Document complex algorithms
  - Create inline comments for non-obvious logic

### :yellow_circle: Medium

- [ ] **Magic Numbers Elimination**
  - Extract all hardcoded values to constants
  - Radius defaults (2km, 5km, etc.)
  - API limits (100, 1000, etc.)
  - Timeout values
  - Create configuration file for runtime settings

- [ ] **Duplicate Code Removal**
  - Identify and consolidate duplicate utilities
  - Create shared validation functions
  - Unify coordinate transformation logic
  - Consolidate error handling patterns

- [ ] **Consistent Naming Conventions**
  - Standardize column names (lat vs latitude, lng vs longitude)
  - Use consistent naming for API parameters
  - Align frontend and backend naming conventions

- [ ] **Code Linting Enhancement**
  - Add Prettier for consistent formatting
  - Configure ESLint with stricter rules
  - Add pre-commit hooks for linting
  - Set up lint-staged for efficient checks

### :white_circle: Low

- [ ] **Dead Code Removal**
  - Audit and remove unused ETL scripts
  - Remove commented-out code
  - Delete unused components and utilities
  - Clean up obsolete configuration

---

## 5. Feature Improvements

### :red_circle: Critical

- [ ] **Premium Feature Gating** - PDF export and other premium features not enforced
  - Implement authentication check before premium actions
  - Add subscription status verification
  - Create clear upgrade prompts
  - Handle expired subscriptions gracefully

### :orange_circle: High

- [ ] **Saved Searches Completion** - UI exists, backend incomplete
  - Implement `/api/user/saved-searches` endpoint
  - Add database schema for saved locations
  - Enable sync across devices
  - Add search history

- [ ] **User Account Features**
  - Complete profile management
  - Implement preferences storage
  - Add password reset flow
  - Enable social login (Google, GitHub)

- [ ] **Email Notifications**
  - Set up transactional email (SendGrid/Postmark)
  - Implement saved location alerts
  - Add price change notifications
  - Create digest email option

### :yellow_circle: Medium

- [ ] **Neighborhood Comparison** - UI exists, limited data
  - Expand comparison metrics
  - Add side-by-side visualization
  - Include historical trends
  - Export comparison as PDF

- [ ] **Search Improvements**
  - Add filters by property type
  - Implement price range filters
  - Add neighborhood search
  - Enable search by municipality

- [ ] **3D Viewer Enhancement**
  - Add building selection
  - Show property information on click
  - Improve camera controls
  - Add measurement tools

### :white_circle: Low

- [ ] **Collaborative Features**
  - Share searches with others
  - Create shared lists
  - Add comments/notes to locations
  - Enable team workspaces

---

## 6. Infrastructure Improvements

### :red_circle: Critical

- [ ] **CI/CD Pipeline** - No automated deployment
  - Set up GitHub Actions workflow
  - Add test stage to CI
  - Configure automatic deployment to staging
  - Implement production deploy with approval

- [ ] **Error Monitoring** - No error tracking in production
  - Integrate Sentry for frontend and backend
  - Configure source maps for meaningful stack traces
  - Set up alerting for error spikes
  - Create error categorization

### :orange_circle: High

- [ ] **Staging Environment**
  - Create staging deployment configuration
  - Use separate database for staging
  - Configure staging-specific environment
  - Enable feature flags for testing

- [ ] **Monitoring & Observability**
  - Set up application performance monitoring (APM)
  - Implement health check endpoints
  - Configure uptime monitoring
  - Create performance dashboards

- [ ] **Database Setup**
  - Migrate to PostgreSQL (Supabase)
  - Design proper schema for user data
  - Implement database migrations (Alembic/Prisma)
  - Set up backups and recovery

- [ ] **Logging Infrastructure**
  - Centralize logs (Logflare, Papertrail, or similar)
  - Implement structured logging
  - Add log retention policy
  - Enable log search and analysis

### :yellow_circle: Medium

- [ ] **CDN Configuration**
  - Configure Cloudflare for static assets
  - Set up proper cache headers
  - Implement edge caching for API responses
  - Add geographic load balancing

- [ ] **Secrets Management**
  - Use secrets manager (Vault, AWS Secrets Manager)
  - Rotate API keys regularly
  - Implement key versioning
  - Audit secret access

- [ ] **Backup Strategy**
  - Implement automated backups
  - Test restoration procedures
  - Define backup retention policy
  - Document disaster recovery plan

---

## 7. Documentation Improvements

### :orange_circle: High

- [ ] **API Documentation**
  - Generate OpenAPI specification
  - Create interactive API docs (Swagger UI)
  - Document all endpoints with examples
  - Add authentication documentation

- [ ] **Deployment Guide**
  - Document deployment steps for each environment
  - Create infrastructure as code (Terraform/Pulumi)
  - Add rollback procedures
  - Document environment variables

- [ ] **Architecture Decision Records (ADRs)**
  - Document key technical decisions
  - Explain rationale for technology choices
  - Record alternatives considered
  - Update as decisions evolve

### :yellow_circle: Medium

- [ ] **Troubleshooting Guide**
  - Document common issues and solutions
  - Add debugging tips
  - Create FAQ for developers
  - Include log interpretation guide

- [ ] **ETL Pipeline Documentation**
  - Consolidate ETL documentation
  - Document data refresh schedule
  - Create data lineage diagrams
  - Add script usage instructions

- [ ] **Component Documentation**
  - Add Storybook for component library
  - Document component props and usage
  - Create design system documentation
  - Add accessibility notes

### :white_circle: Low

- [ ] **Video Tutorials**
  - Create getting started video
  - Record feature walkthrough
  - Add developer setup tutorial
  - Create contribution guide video

---

## 8. Data Quality Improvements

### :orange_circle: High

- [ ] **Data Validation Pipeline**
  - Implement validation checks during ETL
  - Validate coordinate bounds
  - Check for missing required fields
  - Alert on data anomalies

- [ ] **Data Freshness Tracking**
  - Track when each dataset was last updated
  - Display data freshness to users
  - Automate data refresh where possible
  - Create data update dashboard

- [ ] **Data Versioning**
  - Implement schema versioning
  - Track data source versions
  - Enable rollback to previous data versions
  - Document breaking changes

### :yellow_circle: Medium

- [ ] **Data Completeness**
  - Expand property coverage beyond current ~400K
  - Fill gaps in energy label data
  - Improve foundation risk coverage
  - Add missing school coordinates

- [ ] **Data Enrichment**
  - Add neighborhood summaries
  - Calculate aggregate statistics
  - Generate derived metrics
  - Pre-compute popular queries

---

## 9. Accessibility Improvements

### :orange_circle: High

- [ ] **Accessibility Audit**
  - Conduct WCAG 2.1 AA compliance audit
  - Fix critical accessibility issues
  - Test with screen readers
  - Verify keyboard navigation

- [ ] **Color Contrast**
  - Verify all text meets contrast requirements
  - Add high-contrast mode option
  - Ensure map overlays are distinguishable
  - Test for color blindness compatibility

### :yellow_circle: Medium

- [ ] **Keyboard Navigation**
  - Ensure all interactive elements are focusable
  - Add skip navigation links
  - Implement focus trapping for modals
  - Add keyboard shortcuts documentation

- [ ] **ARIA Labels**
  - Add descriptive labels to all controls
  - Implement proper landmark regions
  - Add live regions for dynamic updates
  - Document screen reader experience

- [ ] **Alternative Text**
  - Add alt text to all images
  - Create text descriptions for map visualizations
  - Provide data tables as alternative to charts
  - Add transcripts for any audio/video

---

## 10. Compliance Improvements

### :red_circle: Critical

- [ ] **Privacy Policy**
  - Draft comprehensive privacy policy
  - Document data collection practices
  - Explain data retention
  - Add contact information

- [ ] **Cookie Consent**
  - Implement cookie consent banner
  - Document cookie usage
  - Allow granular consent
  - Remember user preferences

- [ ] **Terms of Service**
  - Create user terms of service
  - Define acceptable use policy
  - Document subscription terms
  - Add dispute resolution process

### :orange_circle: High

- [ ] **GDPR Compliance**
  - Implement data export feature (portability)
  - Add account deletion feature (right to erasure)
  - Document lawful basis for processing
  - Create data processing agreement

- [ ] **Data Attribution**
  - Review and complete ATTRIBUTION.md
  - Add in-app attribution
  - Verify license compliance for all data sources
  - Create data source credits page

---

## 11. Internationalization Improvements

### :yellow_circle: Medium

- [ ] **Translation Quality**
  - Review machine translations with native speakers
  - Fix grammatical errors in non-English versions
  - Localize date/number formats
  - Add Dutch terminology explanations in all languages

- [ ] **RTL Support**
  - Add support for right-to-left languages
  - Consider Arabic/Hebrew translations
  - Test layout with RTL content

- [ ] **Currency & Units**
  - Display prices in user's preferred currency
  - Allow distance unit preferences (km/miles)
  - Add area unit preferences (m²/ft²)

---

## 12. Mobile Experience Improvements

### :yellow_circle: Medium

- [ ] **Mobile Responsiveness Audit**
  - Test all screens on various devices
  - Fix touch target sizes
  - Optimize map controls for mobile
  - Improve bottom sheet interactions

- [ ] **Mobile Performance**
  - Reduce initial payload for mobile
  - Optimize map for touch gestures
  - Add pull-to-refresh
  - Implement mobile-specific loading states

### :white_circle: Low

- [ ] **Progressive Web App (PWA)**
  - Add manifest.json
  - Implement install prompt
  - Enable home screen addition
  - Add splash screens

---

## Summary

### Quick Wins (Low Effort, High Impact)
1. Remove console.log statements
2. Add basic rate limiting
3. Fix CORS configuration
4. Add input validation
5. Set up Sentry error tracking

### Major Improvements Needed
1. Test suite implementation
2. Database migration
3. CI/CD pipeline
4. Premium feature gating
5. API documentation

### Technical Debt Priorities
1. MapView component refactoring
2. Error handling standardization
3. Caching layer implementation
4. Code documentation
5. Dependency audit

---

## Tracking

This document should be reviewed weekly and updated as:
- Issues are resolved (mark with [x] and date)
- New issues are discovered (add with date)
- Priorities shift based on feedback

**Review Schedule**: Every Monday
**Owner**: Development Team
**Next Review**: January 6, 2026

---

*Generated: December 29, 2025*
