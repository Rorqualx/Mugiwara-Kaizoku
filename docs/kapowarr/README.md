# README

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for README

---
# Kapowarr - Native Manga Downloader

Kapowarr is a powerful, flexible manga downloader integrated into Mugiwara-Kaizoku that can download manga from any website using configurable selectors.

## 🌟 Features

- **Universal Compatibility**: Works with any manga website
- **Visual Configuration**: Build selectors using the visual inspector
- **Multi-Source Search**: Search across all configured sources
- **Download Management**: Queue, pause, resume, and monitor downloads
- **Rate Limiting**: Respect website limits with configurable rate limiting
- **Authentication Support**: Handle sites requiring login
- **Extensible**: Easy to add custom adapters and transforms

## 🚀 Quick Start

### 1. Run Setup Script

```bash
./scripts/setup-kapowarr.sh
```

### 2. Start the Application

```bash
pnpm dev
```

### 3. Configure Your First Source

1. Navigate to **Settings → Kapowarr**
2. Click **"Add New Source"**
3. Use the **Website Inspector** to build selectors
4. **Validate** and **Save** your source

### 4. Download Manga

1. Go to **Library → Add Manga**
2. Select your Kapowarr source
3. Search and download!

## 📚 Documentation

### For Users
- [**User Guide**](./USER_GUIDE.md) - Complete guide for using Kapowarr
- [**Configuration Guide**](./CONFIGURATION_GUIDE.md) - Detailed selector configuration
- [**Examples**](./examples/) - Pre-configured source examples

### For Developers
- [**Developer Guide**](./DEVELOPER_GUIDE.md) - Extend and customize Kapowarr
- [**Technical Specification**](./KAPOWARR_TECHNICAL_SPEC.md) - Architecture details
- [**API Reference**](./deployment/DEPLOYMENT_GUIDE.md#api-extension) - tRPC endpoints

### For Administrators
- [**Deployment Guide**](./deployment/DEPLOYMENT_GUIDE.md) - Production deployment
- [**Troubleshooting**](./troubleshooting/) - Common issues and solutions

## 🔧 Configuration Examples

### Basic Manga Site

```typescript
{
  id: 'simple-manga',
  name: 'Simple Manga Site',
  baseUrl: 'https://simple-manga.com',
  config: {
    searchUrl: 'https://simple-manga.com/search',
    selectors: {
      searchResults: {
        container: '.manga-list .manga',
        title: { css: '.title', extract: 'text' },
        coverUrl: { css: 'img', extract: 'attribute', attribute: 'src' },
        url: { css: 'a', extract: 'attribute', attribute: 'href' }
      }
      // ... more selectors
    }
  }
}
```

### With Authentication

```typescript
{
  authentication: {
    type: 'basic',
    credentials: {
      username: process.env.MANGA_USERNAME,
      password: process.env.MANGA_PASSWORD
    }
  }
}
```

### With Rate Limiting

```typescript
{
  rateLimit: {
    requestsPerSecond: 2,
    requestsPerMinute: 100,
    concurrentRequests: 3
  }
}
```

## 🛠️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│     UI      │────▶│ tRPC Router  │────▶│  Service   │
│   (React)   │     │    (API)     │     │ (Manager)  │
└─────────────┘     └──────────────┘     └────────────┘
                                               │
                    ┌──────────────────────────┼────────┐
                    │                          │        │
              ┌─────▼────┐          ┌─────────▼──┐  ┌──▼───┐
              │ Adapters │          │ WebScraper │  │Queue │
              │  (Base)  │          │ (Cheerio)  │  │ (PG) │
              └──────────┘          └────────────┘  └──────┘
```

## 🧪 Testing

Run Kapowarr tests:

```bash
# Unit tests
pnpm test -- --testPathPattern=kapowarr

# Integration tests
pnpm test:integration -- kapowarr
```

## 🤝 Contributing

1. Read the [Developer Guide](./DEVELOPER_GUIDE.md)
2. Follow Mugiwara-Kaizoku coding standards
3. Add tests for new features
4. Update documentation
5. Submit a pull request

## ⚠️ Important Notes

- Always respect website terms of service
- Use appropriate rate limiting
- Don't share authentication credentials
- Test selectors before bulk downloading
- Keep sources updated when websites change

## 🐛 Troubleshooting

### Common Issues

1. **"No results found"**
   - Check search URL and selectors
   - Verify the site is accessible
   - Try the Website Inspector

2. **"Download failed"**
   - Check image selectors
   - Verify rate limits
   - Look at error logs

3. **"Validation failed"**
   - Website structure may have changed
   - Update selectors using Website Inspector

### Getting Help

- Check [troubleshooting guides](./troubleshooting/)
- Review logs in Settings → Logs → Kapowarr
- Join the Discord community
- Submit an issue on GitHub

## 📈 Roadmap

### Current Features (v1.0)
- ✅ Basic web scraping
- ✅ Configurable selectors
- ✅ Download management
- ✅ Multi-source search
- ✅ Visual configuration tools

### Future Enhancements
- 🔄 Headless browser support
- 🔄 API mode for direct integration
- 🔄 Import/Export configurations
- 🔄 Auto-update selectors
- 🔄 Plugin system

## 📄 License

Kapowarr is part of Mugiwara-Kaizoku and follows the same license terms.

---

**Version**: 1.0.0  
**Status**: Production Ready  
**Last Updated**: January 2025

For the complete implementation details, see [IMPLEMENTATION_SUMMARY_FINAL.md](./IMPLEMENTATION_SUMMARY_FINAL.md).
