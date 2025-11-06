# Contributing to Where-to-Live-NL

First off, thank you for considering contributing to Where-to-Live-NL! This project aims to help expats and internationals navigate the complex Dutch housing market by consolidating fragmented government data into actionable insights.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)

---

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of experience level, background, or identity.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what's best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- Harassment, trolling, or discriminatory comments
- Publishing others' private information without permission
- Unprofessional conduct

### Enforcement

Instances of unacceptable behavior may be reported to the project maintainers. All complaints will be reviewed and investigated promptly and fairly.

---

## How Can I Contribute?

### 🐛 Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

**When submitting a bug report, include:**
- Clear, descriptive title
- Steps to reproduce the issue
- Expected vs. actual behavior
- Screenshots (if applicable)
- Environment details (OS, Python version, browser)
- Relevant log output

**Bug report template:**
```markdown
**Description:**
[Clear description of the bug]

**Steps to Reproduce:**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior:**
[What you expected to happen]

**Actual Behavior:**
[What actually happened]

**Environment:**
- OS: [e.g., macOS 13.0, Ubuntu 22.04]
- Python version: [e.g., 3.11.5]
- Browser: [e.g., Chrome 119]

**Additional Context:**
[Any other relevant information]
```

### 💡 Suggesting Features

We welcome feature suggestions! Before submitting:

1. Check if the feature is already in the [ROADMAP.md](ROADMAP.md)
2. Search existing issues to avoid duplicates
3. Consider if it aligns with the project's goals

**Feature request template:**
```markdown
**Problem Statement:**
[What problem does this solve?]

**Proposed Solution:**
[Your suggested implementation]

**Alternatives Considered:**
[Other approaches you've thought about]

**Impact:**
[Who benefits? How many users?]

**Implementation Complexity:**
- [ ] Low (1-2 days)
- [ ] Medium (1 week)
- [ ] High (2+ weeks)
```

### 📊 Contributing Data Quality Improvements

Help us improve data accuracy:

- **Report data errors**: Incorrect addresses, missing information
- **Submit foundation problem data**: Known areas with wooden pile issues
- **Verify WOZ values**: Cross-check scraped data for accuracy
- **Update school information**: New schools, closures, rating changes

### 🌍 Contributing Translations

We aim to support multiple languages (EN, NL, ES, FR, DE).

**Translation workflow:**
1. Check `translations/` directory for existing translations
2. Copy `en.json` to your language code (e.g., `nl.json`)
3. Translate all values (keep keys unchanged)
4. Test translations in the UI
5. Submit a pull request

### 📝 Improving Documentation

Documentation contributions are highly valued!

**Areas needing help:**
- Fixing typos and grammar
- Adding code examples
- Improving clarity of technical explanations
- Creating tutorials and guides
- Translating docs to other languages

### 💻 Contributing Code

See [Development Setup](#development-setup) below.

---

## Development Setup

### Prerequisites

**Required:**
- Python 3.11+ (for ETL scripts)
- Node.js 18+ (for frontend, when available)
- Git
- Virtual environment tool (venv or conda)

**Optional:**
- Docker (for containerized development)
- PostgreSQL (for local database testing)

### Initial Setup

```bash
# 1. Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/where-to-live-nl.git
cd where-to-live-nl

# 2. Set up Python environment (for ETL scripts)
cd scripts/etl
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# 4. Test your setup
python -m ingest.bag --sample 10
```

### Running Tests

```bash
# Python tests (when available)
pytest tests/

# Linting
flake8 scripts/etl/
black scripts/etl/ --check

# Type checking
mypy scripts/etl/
```

### Local Development Workflow

```bash
# 1. Create a feature branch
git checkout -b feature/your-feature-name

# 2. Make your changes
# ... edit files ...

# 3. Test your changes
python -m ingest.bag --sample 100
pytest tests/

# 4. Commit (see commit guidelines below)
git add .
git commit -m "feat: add CBS demographics ingestion"

# 5. Push to your fork
git push origin feature/your-feature-name

# 6. Open a pull request
```

---

## Coding Standards

### Python Style Guide

We follow **PEP 8** with some modifications:

**Formatting:**
- Line length: 100 characters (not 79)
- Use `black` for automatic formatting
- Use `isort` for import sorting

**Type hints:**
```python
# ✅ Good - clear type hints
def fetch_addresses(
    municipality: str,
    limit: Optional[int] = None
) -> list[dict]:
    pass

# ❌ Bad - no type hints
def fetch_addresses(municipality, limit=None):
    pass
```

**Docstrings:**
```python
# ✅ Good - comprehensive docstring
def scrape_woz(postal_code: str, house_number: int) -> Optional[dict]:
    """
    Scrape WOZ value for a given address.

    Args:
        postal_code: Dutch postal code (e.g., "1012AB")
        house_number: House number

    Returns:
        Dictionary with WOZ data, or None if not found

    Raises:
        ValueError: If postal code format is invalid
    """
    pass
```

**Error handling:**
```python
# ✅ Good - specific exceptions, logging
try:
    data = fetch_api_data(url)
except httpx.HTTPStatusError as e:
    log.error(f"API error {e.response.status_code}: {url}")
    return None
except httpx.TimeoutException:
    log.warning(f"Timeout fetching {url}")
    return None

# ❌ Bad - bare except, no logging
try:
    data = fetch_api_data(url)
except:
    return None
```

### JavaScript/TypeScript Style Guide (Future)

When frontend is implemented:
- Use ESLint + Prettier
- Prefer functional components (React)
- Use TypeScript strict mode
- Follow Airbnb style guide

### File Naming Conventions

**Python:**
- Scripts: `snake_case.py` (e.g., `bag_to_parquet.py`)
- Classes: `PascalCase` (e.g., `WOZScraper`)
- Functions: `snake_case` (e.g., `fetch_addresses`)

**Documentation:**
- All caps with underscores: `ROADMAP.md`, `GETTING_STARTED.md`
- Lowercase for scripts: `quickstart.md`, `readme.md`

---

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `test`: Adding tests
- `chore`: Maintenance tasks

### Examples

```bash
# Feature
feat(etl): add CBS demographics ingestion
feat(scraper): implement resume functionality for WOZ

# Bug fix
fix(bag): handle missing postal codes gracefully
fix(parquet): prevent data loss during transformation

# Documentation
docs(readme): add installation instructions
docs(legal): clarify GDPR compliance requirements

# Refactoring
refactor(api-client): extract retry logic to decorator
refactor(woz): simplify rate limiting implementation
```

### Scope Guidelines

Common scopes:
- `etl`: ETL pipeline scripts
- `bag`: BAG data ingestion
- `woz`: WOZ scraper
- `transform`: Data transformation
- `docs`: Documentation
- `tests`: Test files
- `ci`: CI/CD configuration

---

## Pull Request Process

### Before Submitting

- [ ] Code follows style guidelines
- [ ] Comments added for complex logic
- [ ] Documentation updated (if applicable)
- [ ] Tests added/updated (if applicable)
- [ ] All tests pass locally
- [ ] No merge conflicts with `main`

### PR Description Template

```markdown
## Description
[Brief description of changes]

## Type of Change
- [ ] Bug fix (non-breaking change)
- [ ] New feature (non-breaking change)
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Fixes #123
Related to #456

## Testing
[Describe how you tested your changes]

## Screenshots (if applicable)
[Add screenshots for UI changes]

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass
```

### Review Process

1. **Automated checks**: CI/CD runs tests and linting
2. **Maintainer review**: At least one maintainer approval required
3. **Address feedback**: Make requested changes
4. **Merge**: Maintainer will merge once approved

### After Merge

- Your contribution will be credited in release notes
- Close related issues
- Celebrate! 🎉

---

## Project Structure

Understanding the codebase:

```
where-to-live-nl/
├── scripts/etl/           # Python ETL pipeline
│   ├── common/           # Shared utilities
│   │   ├── api_client.py # HTTP client with retry
│   │   └── logger.py     # Structured logging
│   ├── ingest/           # Data ingestion
│   │   ├── bag.py        # BAG addresses
│   │   ├── woz.py        # WOZ values
│   │   ├── cbs.py        # Demographics (TODO)
│   │   └── crime.py      # Crime stats (TODO)
│   └── transform/        # Data transformation
│       ├── bag_to_parquet.py
│       └── woz_to_parquet.py
├── data/                 # Data storage (gitignored)
│   ├── raw/             # JSON files
│   └── processed/       # Parquet files
├── docs/                # Documentation
│   └── images/          # Screenshots, diagrams
├── tests/               # Test files (TODO)
└── *.md                 # Project documentation
```

### Key Files

- **ROADMAP.md**: Development plan and timeline
- **LEGAL.md**: Legal compliance and GDPR guidance
- **PRICING.md**: Cost analysis and hosting strategy
- **DATA_STORAGE.md**: Data storage decisions
- **MAPPING.md**: Map implementation guide

---

## Data Sources & Legal Compliance

### Using Government Data

**Always:**
- Respect rate limits (default: 1 req/sec)
- Include proper attribution
- Strip personal data from bulk storage
- Review [LEGAL.md](LEGAL.md) before adding new sources

**Never:**
- Scrape websites that prohibit it (e.g., Funda)
- Store bulk personal data (names, birthdates, etc.)
- Use data for direct marketing
- Bypass rate limiting or access controls

### GDPR Compliance

When contributing data collection code:

1. **Privacy by design**: Strip personal data by default
2. **Data minimization**: Collect only necessary fields
3. **Purpose limitation**: Use data only for stated purpose
4. **Legal basis**: Ensure legitimate interest or consent
5. **Documentation**: Update LEGAL.md if needed

---

## Community

### Communication Channels

- **GitHub Issues**: Bug reports, feature requests
- **GitHub Discussions**: General questions, ideas
- **Pull Requests**: Code contributions
- **Email**: [your-email] (for security issues)

### Getting Help

**For development questions:**
1. Check documentation (README.md, GETTING_STARTED.md)
2. Search existing issues
3. Ask in GitHub Discussions
4. Open a new issue

**For legal/compliance questions:**
1. Read LEGAL.md
2. Consult a lawyer (we're not legal experts!)
3. Contact Kadaster directly if needed

---

## Recognition

Contributors will be recognized in:
- Release notes
- README.md (Contributors section)
- Project website (when launched)

Top contributors may be invited to become maintainers.

---

## License

By contributing, you agree that your contributions will be licensed under the same [MIT License](LICENSE.md) that covers this project.

---

## Questions?

Open a GitHub Discussion or issue. We're here to help!

**Thank you for contributing to Where-to-Live-NL!** 🏡🇳🇱

---

*Last updated: November 2025*
