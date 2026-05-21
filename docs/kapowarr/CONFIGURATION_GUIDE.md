# CONFIGURATION_GUIDE

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for CONFIGURATION_GUIDE

---
# Kapowarr Configuration Guide

This guide explains how to configure and customize Kapowarr sources for different manga websites.

## Table of Contents

1. [Using the UI](#using-the-ui)
2. [Understanding Selectors](#understanding-selectors)
3. [Basic Configuration](#basic-configuration)
4. [Advanced Selectors](#advanced-selectors)
5. [Transform Functions](#transform-functions)
6. [Authentication](#authentication)
7. [Rate Limiting](#rate-limiting)
8. [Examples](#examples)

## Using the UI

The Custom Website Sources settings page provides two ways to configure sources: **Quick Import** and **Manual Configuration**.

### Quick Import (Recommended for Beginners)

The Quick Import section shows pre-configured source templates that you can add with a single click.

**To import a default source:**

1. Navigate to **Settings > Custom Website Sources**
2. Scroll to the **Quick Import** section
3. Browse available source templates (e.g., "GetComics")
4. Click **Import** on the source you want to add
5. The source is automatically configured and ready to use

**Source template information:**
- **Name**: Display name of the source
- **Type Badge**: Shows if it's a "Manga" or "Comics" source
- **Description**: Brief explanation of what the source provides
- **Base URL**: The website URL
- **Installed Status**: Shows a green "Installed" badge if already added

**Editing imported sources:**

Once a source is imported, you can customize it:
1. Click the **Edit** button on an installed source in Quick Import
2. Or find it in the **Configured Sources** list below and click the **Edit** icon
3. Modify any fields (name, URLs, selectors, headers)
4. Click **Save Changes**

### Manual Configuration

For websites not available as default templates, use manual configuration.

**To add a custom source:**

1. Navigate to **Settings > Custom Website Sources**
2. Scroll to the **Manual Configuration** section
3. Fill in the required fields:
   - **Source Name**: Display name (e.g., "My Manga Site")
   - **Base URL**: Root URL of the website
   - **Search URL**: Search endpoint with `{query}` placeholder
4. (Optional) Add custom **Request Headers** in JSON format
5. Click **Validate Website** to auto-detect selectors
6. Configure **Selectors** manually if needed (see [Understanding Selectors](#understanding-selectors))
7. Click **Add Source**

**Validation feature:**

The validation feature helps auto-detect website structure:
- Enter the **Base URL**
- Click **Validate Website**
- The system analyzes the website and suggests selectors
- If successful, selectors are automatically populated
- Review and adjust as needed

**Common validation feedback:**
- **"Website validated - Structure detected successfully"**: Auto-detection worked
- **"Validation failed"**: Website structure couldn't be detected automatically
- **"Missing fields" alert**: Shows which required fields couldn't be auto-detected

### Managing Sources

**View configured sources:**

The **Configured Sources** table shows all added sources with:
- **Name**: Source display name
- **URL**: Base URL
- **Status**: ACTIVE, INACTIVE, or ERROR
- **Enabled**: Toggle switch to enable/disable
- **Actions**: Test, Edit, and Delete buttons

**Available actions:**

1. **Test** (🧪 icon): Validates the source is working correctly
2. **Edit** (✏️ icon): Opens edit modal to modify configuration
3. **Delete** (🗑️ icon): Removes the source (requires confirmation)
4. **Enable/Disable**: Toggle switch to activate or deactivate the source

**Editing existing sources:**

1. Click the **Edit** icon (✏️) in the Configured Sources table
2. Modify any fields in the edit modal:
   - Source name
   - Base URL
   - Search URL
   - Request headers
   - Selectors
3. Use **Validate Website** to re-detect selectors if URLs changed
4. Click **Save Changes** to update the source
5. Or click **Cancel** to discard changes

**Status indicators:**

- **Green (ACTIVE)**: Source is working normally
- **Gray (INACTIVE)**: Source is disabled
- **Red (ERROR)**: Source encountered errors

### Best Practices for UI Configuration

1. **Start with Quick Import**: Use default templates when available
2. **Test after adding**: Click the Test button to verify the source works
3. **Use validation**: Let auto-detection suggest selectors before manual config
4. **Keep sources enabled**: Disable only when troubleshooting
5. **Monitor status**: Check for ERROR status regularly
6. **Update selectors**: If a website changes structure, edit and re-validate

---

## Understanding Selectors

Kapowarr uses CSS selectors and XPath to extract data from websites. Each selector defines:
- **What to find**: CSS selector or XPath expression
- **What to extract**: Text, attribute, or HTML
- **How to transform**: Optional transformations

### Selector Structure

```typescript
{
  css: '.manga-title',           // CSS selector
  extract: 'text',               // What to extract: 'text' | 'attribute' | 'html'
  attribute: 'href',             // Required if extract is 'attribute'
  transform: [                   // Optional transformations
    { type: 'trim', params: {} },
    { type: 'replace', params: { search: 'Manga:', replace: '' } }
  ]
}
```

## Basic Configuration

### Minimal Source Configuration

```typescript
{
  id: 'my-manga-site',
  name: 'My Manga Site',
  baseUrl: 'https://example-manga.com',
  config: {
    searchUrl: 'https://example-manga.com/search',
    selectors: {
      searchResults: {
        container: '.search-results .manga',
        id: { css: '.manga-id', extract: 'text' },
        title: { css: '.title', extract: 'text' },
        coverUrl: { css: 'img', extract: 'attribute', attribute: 'src' },
        url: { css: 'a', extract: 'attribute', attribute: 'href' }
      },
      mangaDetails: {
        title: { css: 'h1', extract: 'text' },
        description: { css: '.synopsis', extract: 'text' },
        coverUrl: { css: '.cover img', extract: 'attribute', attribute: 'src' }
      },
      chapterList: {
        container: '.chapters li',
        chapterId: { css: '.id', extract: 'text' },
        chapterNumber: { css: '.number', extract: 'text' },
        chapterTitle: { css: '.title', extract: 'text' },
        chapterUrl: { css: 'a', extract: 'attribute', attribute: 'href' }
      },
      downloadLinks: {
        imageContainer: '.pages',
        imageUrl: { css: 'img', extract: 'attribute', attribute: 'src' }
      }
    }
  }
}
```

## Advanced Selectors

### Multiple Selectors

For complex sites, you might need multiple selectors:

```typescript
{
  // Try multiple selectors for title
  title: [
    { css: 'h1.manga-title', extract: 'text' },
    { css: '.header .title', extract: 'text' },
    { css: '[itemprop="name"]', extract: 'text' }
  ]
}
```

### Nested Selectors

Extract data from nested structures:

```typescript
{
  authors: {
    container: '.author-list',
    items: { css: 'a', extract: 'text' }
  }
}
```

### Conditional Selectors

Handle different page layouts:

```typescript
{
  status: {
    css: '.status',
    extract: 'text',
    fallback: 'Unknown',
    transform: [
      {
        type: 'map',
        params: {
          'Ongoing': 'ONGOING',
          'Complete': 'COMPLETED',
          'Hiatus': 'HIATUS'
        }
      }
    ]
  }
}
```

## Transform Functions

### Available Transforms

1. **trim**: Remove whitespace
   ```typescript
   { type: 'trim', params: {} }
   ```

2. **replace**: Replace text
   ```typescript
   { type: 'replace', params: { search: 'Chapter', replace: 'Ch.' } }
   ```

3. **regex**: Regular expression replace
   ```typescript
   { type: 'regex', params: { pattern: '\\d+', replace: 'Number: $&' } }
   ```

4. **prefix**: Add prefix
   ```typescript
   { type: 'prefix', params: { value: 'https://cdn.example.com' } }
   ```

5. **suffix**: Add suffix
   ```typescript
   { type: 'suffix', params: { value: '.jpg' } }
   ```

6. **split**: Split and select
   ```typescript
   { type: 'split', params: { delimiter: ' - ', index: 0 } }
   ```

7. **join**: Join array elements
   ```typescript
   { type: 'join', params: { delimiter: ', ' } }
   ```

### Transform Chains

Chain multiple transforms:

```typescript
{
  chapterNumber: {
    css: '.chapter-text',
    extract: 'text',
    transform: [
      { type: 'trim', params: {} },
      { type: 'regex', params: { pattern: 'Chapter (\\d+)', replace: '$1' } },
      { type: 'prefix', params: { value: 'Chapter ' } }
    ]
  }
}
```

## Authentication

### Basic Authentication

```typescript
{
  authentication: {
    type: 'basic',
    credentials: {
      username: 'your-username',
      password: 'your-password'
    }
  }
}
```

### Bearer Token

```typescript
{
  authentication: {
    type: 'bearer',
    credentials: {
      token: 'your-api-token'
    }
  }
}
```

### Cookie Authentication

```typescript
{
  authentication: {
    type: 'cookie',
    credentials: {
      cookies: 'session=abc123; user=john_doe'
    }
  }
}
```

### Custom Headers

```typescript
{
  headers: {
    'X-API-Key': 'your-api-key',
    'X-Custom-Header': 'custom-value'
  }
}
```

## Rate Limiting

Protect sources from being overwhelmed:

```typescript
{
  rateLimit: {
    requestsPerSecond: 2,      // Max 2 requests per second
    requestsPerMinute: 100,    // Max 100 requests per minute
    concurrentRequests: 3      // Max 3 concurrent requests
  }
}
```

## Examples

### Example 1: MangaDex-style Site

```typescript
{
  id: 'mangadex-clone',
  name: 'MangaDex Clone',
  baseUrl: 'https://mangadex-clone.com',
  config: {
    searchUrl: 'https://mangadex-clone.com/titles',
    headers: {
      'Accept': 'application/json'
    },
    selectors: {
      searchResults: {
        container: '.manga-card',
        id: { css: '[data-manga-id]', extract: 'attribute', attribute: 'data-manga-id' },
        title: { css: '.title', extract: 'text' },
        coverUrl: { 
          css: '.cover img', 
          extract: 'attribute', 
          attribute: 'data-src',
          transform: [
            { type: 'prefix', params: { value: 'https://uploads.mangadex-clone.com' } }
          ]
        },
        url: { css: 'a', extract: 'attribute', attribute: 'href' }
      },
      mangaDetails: {
        title: { css: 'h1', extract: 'text' },
        alternativeTitles: { css: '.alt-titles span', extract: 'text' },
        description: { css: '.description', extract: 'text' },
        coverUrl: { css: '.cover img', extract: 'attribute', attribute: 'src' },
        status: { 
          css: '.status', 
          extract: 'text',
          transform: [
            { type: 'trim', params: {} },
            { type: 'replace', params: { search: 'Status: ', replace: '' } }
          ]
        },
        authors: { css: '.author a', extract: 'text' },
        artists: { css: '.artist a', extract: 'text' },
        genres: { css: '.tags .tag', extract: 'text' },
        tags: { css: '.content-tags .tag', extract: 'text' }
      },
      chapterList: {
        container: '.chapter-row',
        chapterId: { css: '[data-chapter-id]', extract: 'attribute', attribute: 'data-chapter-id' },
        chapterNumber: { 
          css: '.chapter-num', 
          extract: 'text',
          transform: [
            { type: 'regex', params: { pattern: 'Ch\\. (\\d+(?:\\.\\d+)?)', replace: '$1' } }
          ]
        },
        chapterTitle: { css: '.chapter-title', extract: 'text' },
        chapterUrl: { css: 'a.chapter-link', extract: 'attribute', attribute: 'href' },
        uploadDate: { css: '.upload-date', extract: 'attribute', attribute: 'datetime' }
      },
      downloadLinks: {
        imageContainer: '.reader-images',
        imageUrl: { 
          css: 'img.page', 
          extract: 'attribute', 
          attribute: 'data-url',
          transform: [
            { type: 'prefix', params: { value: 'https://uploads.mangadex-clone.com/data/' } }
          ]
        }
      }
    },
    rateLimit: {
      requestsPerSecond: 5,
      requestsPerMinute: 250
    }
  }
}
```

### Example 2: Simple Blog-style Site

```typescript
{
  id: 'manga-blog',
  name: 'Manga Blog',
  baseUrl: 'https://manga-blog.com',
  config: {
    searchUrl: 'https://manga-blog.com/?s=',
    selectors: {
      searchResults: {
        container: 'article.post',
        id: { 
          css: 'article', 
          extract: 'attribute', 
          attribute: 'id',
          transform: [
            { type: 'replace', params: { search: 'post-', replace: '' } }
          ]
        },
        title: { css: 'h2 a', extract: 'text' },
        coverUrl: { css: '.thumbnail img', extract: 'attribute', attribute: 'src' },
        url: { css: 'h2 a', extract: 'attribute', attribute: 'href' }
      },
      mangaDetails: {
        title: { css: 'h1.entry-title', extract: 'text' },
        description: { css: '.entry-content p:first-child', extract: 'text' },
        coverUrl: { css: '.featured-image img', extract: 'attribute', attribute: 'src' }
      },
      chapterList: {
        container: '.chapter-list a',
        chapterId: { 
          css: 'a', 
          extract: 'attribute', 
          attribute: 'href',
          transform: [
            { type: 'regex', params: { pattern: '/chapter/(\\d+)', replace: '$1' } }
          ]
        },
        chapterNumber: { 
          css: 'a', 
          extract: 'text',
          transform: [
            { type: 'regex', params: { pattern: 'Chapter (\\d+)', replace: '$1' } }
          ]
        },
        chapterTitle: { css: 'a', extract: 'text' },
        chapterUrl: { css: 'a', extract: 'attribute', attribute: 'href' }
      },
      downloadLinks: {
        imageContainer: '.entry-content',
        imageUrl: { css: 'img', extract: 'attribute', attribute: 'src' }
      }
    }
  }
}
```

### Example 3: JavaScript-Heavy Site

For sites that load content dynamically, you may need to:

1. Use a headless browser (future feature)
2. Find API endpoints
3. Use alternative selectors

```typescript
{
  id: 'spa-manga-site',
  name: 'SPA Manga Site',
  baseUrl: 'https://spa-manga.com',
  config: {
    searchUrl: 'https://spa-manga.com/api/search',
    headers: {
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    },
    // For API responses, use JSON path selectors (future feature)
    selectors: {
      searchResults: {
        container: '[data-testid="search-results"] > div',
        id: { css: '[data-manga-id]', extract: 'attribute', attribute: 'data-manga-id' },
        title: { css: '[data-testid="manga-title"]', extract: 'text' },
        coverUrl: { css: 'img[loading="lazy"]', extract: 'attribute', attribute: 'src' },
        url: { css: 'a[href*="/manga/"]', extract: 'attribute', attribute: 'href' }
      }
      // ... other selectors
    }
  }
}
```

## Best Practices

1. **Test Selectors**: Always test selectors before deploying
2. **Use Specific Selectors**: More specific = more reliable
3. **Handle Missing Data**: Use fallbacks and optional fields
4. **Monitor Changes**: Websites change; monitor selector failures
5. **Respect Rate Limits**: Don't overwhelm source websites
6. **Cache Results**: Enable caching to reduce requests
7. **Error Handling**: Implement proper error handling
8. **User Agent**: Use a descriptive user agent

## Troubleshooting

### Common Issues

1. **Selectors Not Working**
   - Check if website structure changed
   - Use browser DevTools to verify selectors
   - Try alternative selectors

2. **Rate Limiting**
   - Reduce request frequency
   - Add delays between requests
   - Use authentication if available

3. **Authentication Failing**
   - Verify credentials
   - Check if authentication method changed
   - Look for CAPTCHA requirements

4. **Images Not Loading**
   - Check if images require authentication
   - Verify image URLs are complete
   - Check for hotlink protection

### Debug Mode

Enable debug logging:

```typescript
{
  debug: true,
  logLevel: 'verbose'
}
```

## Advanced Features

### Pagination

Handle paginated results:

```typescript
{
  downloadLinks: {
    imageContainer: '.page-container',
    imageUrl: { css: 'img', extract: 'attribute', attribute: 'src' },
    nextPageUrl: { css: 'a.next-page', extract: 'attribute', attribute: 'href' }
  }
}
```

### Dynamic Content

For content loaded via JavaScript:

```typescript
{
  waitForSelector: '.content-loaded',  // Wait for this selector
  waitTimeout: 10000,                   // Max wait time in ms
  scrollToLoad: true                    // Scroll to trigger lazy loading
}
```

### Custom Download Services

Use specialized download services:

```typescript
{
  downloadServices: [
    {
      type: 'direct',
      config: {
        timeout: 30000,
        retries: 3
      }
    },
    {
      type: 'cloudflare',
      config: {
        workerUrl: 'https://your-worker.workers.dev'
      }
    }
  ]
}
```

---

For more examples and updates, check the [Kapowarr Examples Repository](https://github.com/mugiwara-kaizoku/kapowarr-examples).
