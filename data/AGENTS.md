# Agent Context for Data Directory

This file provides guidance for AI agents working with the chat-web-garbot knowledge base.

## Directory Structure

The `data/` directory contains the knowledge base files that are searched by `KnowledgeService` to provide context-aware AI responses:

```
data/
├── diy/              # DIY guides and installation instructions
├── glossary/         # Moss-related terminology and definitions
├── images/           # Image assets with attribution
│   └── scraped/      # Downloaded images from web scraping
│       └── _attribution.yaml  # Image source attribution manifest
├── maintenance/      # Moss care and maintenance guides
├── models/           # Moss species/variety profiles (YAML)
├── scraped/          # Web-scraped content
│   └── {topic-name}/
│       ├── content.md           # Main article content
│       └── images/              # Topic-specific images (optional)
│           └── _attribution.yaml
└── tips/             # Quick tips and best practices
```

## Content Organization

### File Naming Conventions

- **Markdown files**: Use lowercase with hyphens (e.g., `moss-care-guide.md`, `watering-tips.md`)
- **YAML files**: Use lowercase with hyphens (e.g., `sheet-moss.yaml`, `carpet-moss.yaml`)
- **Directories**: Use lowercase with hyphens (e.g., `growing-moss-indoors/`)

### Content Format

All knowledge base content should follow these standards:

1. **Include source attribution**: Always cite the original source
2. **Add scrape date**: Include the date content was added/scraped
3. **Use proper markdown**: Follow consistent heading hierarchy (H1 for title, H2 for sections)
4. **Add metadata**: Include tags and last updated date at the bottom

**Example header format:**
```markdown
# Article Title

> Source: https://example.com/original-article
> Scraped: 2026-02-10

---

## Introduction

[Content here...]
```

**Example footer format:**
```markdown
---

Last updated: 2026-02-10
Tags: moss-care, indoor-growing, terrarium, humidity
```

## Web Scraping Guidelines

### IMPORTANT: Use the Web-Content-Scraper Skill

When scraping web content for the knowledge base, **ALWAYS use the web-content-scraper skill** located at `.github/skills/web-content-scraper/`.

This skill provides:
- ✅ Automatic content extraction with noise filtering
- ✅ Image downloading with lazy-load support
- ✅ Source attribution and licensing metadata
- ✅ Clean markdown formatting
- ✅ Playwright-based JavaScript rendering

### How to Use the Skill

The skill is documented in `.github/skills/web-content-scraper/SKILL.md`. Key points:

1. **For standard scraping** (no lazy-loaded images):
   - Use the `Skill` tool to invoke the web-content-scraper skill
   - Provide the URL to scrape
   - Skill will extract and format content automatically

2. **For complex scraping** (lazy-loaded images, JS-heavy sites):
   ```bash
   npx tsx .github/skills/web-content-scraper/scripts/scrape-lazy-images.ts <url> <output-dir>
   ```

3. **Output location**: Content goes to `data/scraped/{topic-name}/`
   - `content.md` - Main article content
   - `images/` - Downloaded images (if applicable)
   - `images/_attribution.yaml` - Image attribution manifest

### When to Scrape

Add scraped content when:
- User explicitly requests to scrape a URL
- Existing knowledge base lacks coverage on a topic
- Content complements existing maintenance/care guides
- Images would enhance understanding of techniques

### Attribution Requirements

All scraped content MUST include:
- Source URL
- Scrape date
- Original author (if available)
- License information (if available)

For images, maintain attribution in `_attribution.yaml`:
```yaml
images:
  - filename: "image-name.jpg"
    source_page: "https://example.com/article"
    source_page_title: "Article Title"
    original_url: "https://example.com/images/photo.jpg"
    alt_text: "Description of image"
    caption: "Optional caption"
    detected_license: null
    attribution_text: "Image from example.com"
    downloaded_at: "2026-02-10T12:00:00Z"
```

## Content Types

### Moss Care Guides (`maintenance/`)
- Watering schedules
- Light requirements
- Humidity management
- Seasonal care
- Troubleshooting

### DIY Guides (`diy/`)
- Installation instructions
- Moss wall construction
- Terrarium setup
- Tool usage

### Species Profiles (`models/`)
- YAML format
- Species characteristics
- Growing requirements
- Common uses

### Quick Tips (`tips/`)
- Short, actionable advice
- Best practices
- Common mistakes to avoid
- Quick reference guides

### Scraped Content (`scraped/`)
- Web articles
- Expert guides
- How-to tutorials
- Research-backed information

## Searchability

All files in the `data/` directory are indexed by `KnowledgeService`:

- **Keyword search**: Searches file paths and content
- **Semantic search**: Uses GitHub Copilot SDK for relevance ranking
- **Context injection**: Relevant content is included in AI prompts

To improve searchability:
- Use descriptive filenames
- Include relevant keywords in content
- Add tags at the bottom of markdown files
- Use clear section headings

## Maintenance

### Adding New Content

1. Determine the appropriate subdirectory
2. Create a descriptive filename
3. Follow the markdown format conventions
4. Include source attribution and dates
5. Add tags for discoverability

### Updating Existing Content

1. Update the "Last updated" date
2. Preserve source attribution
3. Add a note about what changed (if significant)
4. Keep original scraped content for reference

### Removing Content

- Generally avoid removing content
- If removal is necessary, document why
- Consider moving to an archive instead

## Examples

### Good Filename Examples
- ✅ `growing-moss-indoors/content.md`
- ✅ `moss-care-guide.md`
- ✅ `watering-schedule.md`
- ✅ `sheet-moss.yaml`

### Bad Filename Examples
- ❌ `article.md` (too generic)
- ❌ `Moss_Care_Guide.md` (wrong case/separator)
- ❌ `moss guide 2026.md` (spaces, no hyphens)

### Good Content Structure
```markdown
# How to Care for Indoor Moss

> Source: https://example.com/moss-care
> Scraped: 2026-02-10

---

## Introduction

Moss is an incredibly resilient plant...

## Watering Requirements

Indoor moss needs consistent moisture...

## Light Conditions

Most moss varieties prefer indirect light...

---

Last updated: 2026-02-10
Tags: indoor-moss, moss-care, watering, light-requirements
```

## Notes for Future Agents

- **Always check existing content** before adding new files
- **Use the web-content-scraper skill** for all web scraping tasks
- **Maintain attribution** for all external sources
- **Follow naming conventions** to keep the knowledge base organized
- **Test searchability** - ensure new content appears in search results

For questions or issues with the knowledge base structure, refer to the main `AGENTS.md` in the repository root or the `README.md`.
