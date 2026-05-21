# Kapowarr User Guide

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for Kapowarr User Guide

---
# Kapowarr Native Downloader Integration

## Overview

The Kapowarr integration brings native manga downloading capabilities to Mugiwara-Kaizoku, allowing you to download manga directly from any website without relying on third-party download clients. This feature is inspired by Kapowarr's approach to content acquisition but tailored specifically for manga.

## Features

- 🌐 **Custom Website Sources**: Add any manga website as a source
- 🔍 **Visual Selector Builder**: Easy-to-use interface for configuring website scraping
- 🔄 **Multi-Source Search**: Search across all configured sources simultaneously
- 📥 **Background Downloads**: Downloads run in the background with progress tracking
- 📊 **Download Management**: View and manage all active and completed downloads
- 🛡️ **Rate Limiting**: Respect website limits to avoid getting blocked
- 🔐 **Authentication Support**: Handle websites that require login

## Getting Started

### Enabling Kapowarr

1. Navigate to **Settings** → **Kapowarr**
2. Ensure the feature is enabled in your environment variables:
   ```env
   KAPOWARR_ENABLED=true
   ```

### Adding a Custom Website Source

1. Go to **Settings** → **Kapowarr** → **Add Source**
2. Enter the website details:
   - **Name**: A friendly name for the source
   - **Base URL**: The main website URL (e.g., `https://mangasite.com`)
   - **Search URL**: The search endpoint with `{query}` placeholder

3. Use the **Visual Selector Builder** to configure how to extract data:
   - Click on elements on the preview to select them
   - The tool will automatically generate CSS selectors
   - Test your selectors before saving

4. Configure optional settings:
   - **Headers**: Custom headers for requests
   - **Rate Limiting**: Requests per second/minute
   - **Authentication**: If the site requires login

5. Click **Validate Website** to test your configuration
6. Save the source

### Searching for Manga

1. Navigate to the **Kapowarr Search** page
2. Enter your search query
3. Select which sources to search (or search all)
4. Click on a result to view details and available chapters

### Downloading Chapters

1. From the manga details page, select chapters to download
2. Choose download options:
   - **Quality**: Image quality preference
   - **Format**: CBZ, PDF, or individual images
   - **Destination**: Where to save the files

3. Click **Download** to add to the queue
4. Monitor progress in the **Downloads** tab

## Advanced Configuration

### Selector Configuration

Selectors define how to extract data from websites. Each selector has:

- **CSS/XPath**: The selector to find elements
- **Extract**: What to extract (text, attribute, or HTML)
- **Transform**: Optional transformations (regex, replace, etc.)

Example selector configuration:
```json
{
  "searchResults": {
    "container": ".manga-list .item",
    "title": {
      "css": ".title a",
      "extract": "text"
    },
    "coverUrl": {
      "css": ".cover img",
      "extract": "attribute",
      "attribute": "src",
      "transform": [{
        "type": "prefix",
        "params": { "value": "https://mangasite.com" }
      }]
    }
  }
}
```

### Authentication

For sites requiring login, configure authentication:

1. **Basic Auth**: Username and password
2. **Bearer Token**: API token
3. **Cookie**: Session cookie
4. **Custom**: Custom authentication flow

### Rate Limiting

Configure rate limiting to avoid overwhelming websites:

- **Requests per second**: Maximum requests in one second
- **Requests per minute**: Maximum requests in one minute
- **Concurrent requests**: Maximum simultaneous requests

## Predefined Sources

Mugiwara-Kaizoku comes with predefined configurations for popular manga sites:

- MangaKakalot
- MangaNato
- MangaDex (when API is unavailable)
- And more...

These can be enabled with a single click.

## Troubleshooting

### Website Structure Changed

If a source stops working:
1. Go to the source settings
2. Click **Re-validate Website**
3. Update selectors if needed
4. Save changes

### Downloads Failing

Common issues and solutions:

- **Rate Limited**: Reduce rate limit settings
- **Cloudflare Protection**: Enable Cloudflare bypass
- **Login Required**: Configure authentication
- **Invalid Selectors**: Re-validate and update selectors

### Performance Issues

- Limit concurrent downloads
- Increase request delays
- Use lower quality images for faster downloads

## Best Practices

1. **Respect Websites**: Don't abuse rate limits
2. **Test Thoroughly**: Validate selectors before bulk downloading
3. **Monitor Usage**: Check download statistics regularly
4. **Update Regularly**: Website structures change frequently
5. **Backup Configurations**: Export your source configurations

## Legal Notice

⚠️ **Important**: This feature is provided for educational and personal use only. Users are responsible for ensuring they have the right to download content from websites. Always respect copyright laws and website terms of service.

## API Reference

For developers looking to extend Kapowarr functionality, see the [Developer Documentation](./kapowarr-development-guide.md).

## Support

If you encounter issues:

1. Check the [FAQ](#faq) section
2. Review error logs in Settings → Logs
3. Report issues on GitHub with:
   - Source configuration (without credentials)
   - Error messages
   - Steps to reproduce

## FAQ

**Q: How many sources can I add?**
A: There's no hard limit, but performance may degrade with too many active sources.

**Q: Can I share my source configurations?**
A: Yes! Export configurations (without credentials) and share with the community.

**Q: Does this work with all manga websites?**
A: Most static HTML sites work. Sites with heavy JavaScript may require additional configuration.

**Q: How do I handle Cloudflare-protected sites?**
A: Enable the Cloudflare bypass option in source settings.

**Q: Can I download entire manga series?**
A: Yes, use the batch download feature from the manga details page.
