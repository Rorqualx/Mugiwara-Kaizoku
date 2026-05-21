# USER_GUIDE

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for USER_GUIDE

---
# Kapowarr User Guide

This guide explains how to use the Kapowarr native downloader in Mugiwara-Kaizoku.

## Overview

Kapowarr allows you to download manga from any website by configuring how to find and extract content. Think of it as a universal manga downloader that you can teach to work with any manga website.

## Getting Started

### Accessing Kapowarr Settings

1. Navigate to **Settings** in the main menu
2. Click on **Kapowarr** in the sidebar
3. You'll see the Kapowarr management interface

### Understanding the Interface

The Kapowarr interface has several sections:

- **Sources**: List of configured manga websites
- **Add Source**: Form to add new websites
- **Downloads**: View active and completed downloads
- **Tools**: Validation and testing tools

## Adding a Manga Source

### Step 1: Basic Information

1. Click **"Add New Source"**
2. Fill in the basic details:
   - **Name**: A friendly name (e.g., "My Favorite Manga Site")
   - **Base URL**: The website's main URL (e.g., `https://example-manga.com`)
   - **Search URL**: The search page URL (e.g., `https://example-manga.com/search`)

### Step 2: Configure Selectors

Selectors tell Kapowarr how to find content on the website. You'll need to configure:

#### Search Results
- Where to find search results
- How to extract manga titles, IDs, and cover images

#### Manga Details
- Where to find manga information
- How to extract description, genres, authors

#### Chapter List
- Where to find chapters
- How to extract chapter numbers and titles

#### Download Links
- Where to find manga pages/images
- How to extract image URLs

### Step 3: Use the Selector Builder

The **Selector Builder** helps you create selectors visually:

1. Enter a sample URL from the website
2. Click **"Inspect Website"**
3. Click on elements to automatically generate selectors
4. Test each selector to ensure it works

### Step 4: Validate and Save

1. Click **"Validate Source"**
2. Review any errors or warnings
3. Fix issues if needed
4. Click **"Save Source"**

## Searching and Downloading Manga

### Search for Manga

1. Go to **Library** → **Add Manga**
2. In the search providers, select your Kapowarr source
3. Search for manga by title
4. Click on a result to view details

### Download Chapters

1. Select the manga you want to download
2. Click **"Download"** on specific chapters
3. Or use **"Download All"** for all chapters
4. Monitor progress in the **Downloads** section

### Download Management

In the **Downloads** section, you can:

- View download progress
- Pause/resume downloads
- Retry failed downloads
- Cancel active downloads

## Managing Sources

### Edit a Source

1. Click the **Edit** icon next to a source
2. Modify settings as needed
3. Re-validate if you changed selectors
4. Save changes

### Disable/Enable Sources

- Use the toggle switch to temporarily disable a source
- Disabled sources won't appear in search results

### Delete a Source

1. Click the **Delete** icon
2. Confirm deletion
3. Note: This doesn't delete downloaded manga

## Advanced Features

### Rate Limiting

Protect websites from being overwhelmed:

1. Edit the source
2. Expand **"Advanced Settings"**
3. Set rate limits:
   - **Requests per second**: How fast to make requests
   - **Concurrent downloads**: How many chapters at once

### Authentication

For sites requiring login:

1. Edit the source
2. Expand **"Authentication"**
3. Choose authentication type:
   - **Basic**: Username and password
   - **Bearer**: API token
   - **Cookie**: Session cookies

### Custom Headers

Add custom headers if needed:

1. Edit the source
2. Expand **"Headers"**
3. Add header name and value

## Troubleshooting

### "No Results Found"

- Check if the search URL is correct
- Verify search result selectors
- Test with a known manga title
- Check if the site requires authentication

### "Download Failed"

- Check if chapter URLs are accessible
- Verify image selectors are correct
- Look for rate limit errors
- Check your internet connection

### "Validation Failed"

- Review each selector
- Use the Website Inspector to update selectors
- Check if the website structure changed
- Look for JavaScript-rendered content

### Selector Tips

1. **Use specific selectors**: Instead of `img`, use `.manga-page img`
2. **Test with multiple pages**: Ensure selectors work across different manga
3. **Handle variations**: Some sites have different layouts for different manga
4. **Check attributes**: Make sure `src` vs `data-src` for images

## Best Practices

### Do's
- ✅ Test sources thoroughly before bulk downloading
- ✅ Set reasonable rate limits
- ✅ Keep selectors updated when sites change
- ✅ Use the validation tool regularly
- ✅ Backup your source configurations

### Don'ts
- ❌ Don't set rate limits too high
- ❌ Don't download too many chapters simultaneously
- ❌ Don't ignore validation warnings
- ❌ Don't share authentication credentials
- ❌ Don't violate website terms of service

## Website Inspector

The Website Inspector helps you build selectors:

### How to Use

1. Click **"Website Inspector"**
2. Enter a page URL
3. The page loads in the inspector
4. Click on elements to generate selectors
5. Test selectors immediately
6. Copy working selectors to your source

### Inspector Features

- **Element Highlighter**: Hover to see element boundaries
- **Selector Generator**: Click to create CSS selectors
- **Live Testing**: Test selectors in real-time
- **Multiple Selector**: Select multiple similar elements
- **Attribute Viewer**: See all element attributes

## FAQ

### Can I download from any manga website?
Yes, as long as you can create working selectors and the site doesn't block automated access.

### How do I update selectors when a website changes?
Use the Website Inspector to find new selectors, then update your source configuration.

### Can I share source configurations?
Yes, you can export and import source configurations. Go to Settings → Kapowarr → Export/Import.

### Why are my downloads slow?
Check rate limits, concurrent download settings, and your internet connection.

### Can I download manga in specific formats?
Kapowarr downloads images as-is. Use Mugiwara-Kaizoku's conversion features for different formats.

### What if a website uses JavaScript?
Currently, Kapowarr works best with static HTML. JavaScript-heavy sites may require special configuration or may not work.

### How do I handle CAPTCHA?
Websites with CAPTCHA protection cannot be automated. Consider using official sources or APIs when available.

### Can I schedule downloads?
Not directly, but you can use Mugiwara-Kaizoku's monitoring features to automatically download new chapters.

## Tips and Tricks

### Quick Selector Testing

1. Right-click on a webpage
2. Select "Inspect Element"
3. Use browser DevTools to test CSS selectors
4. Copy working selectors to Kapowarr

### Handling Different Page Layouts

Some sites have different layouts for different manga:

1. Test selectors on multiple manga
2. Use multiple selector alternatives
3. Set fallback selectors

### Optimizing Download Speed

1. Increase concurrent downloads (carefully)
2. Use a faster DNS server
3. Enable download resumption
4. Clear temporary files regularly

### Monitoring Source Health

1. Check source status regularly
2. Set up alerts for failed downloads
3. Review logs for selector failures
4. Update sources proactively

## Getting Help

If you encounter issues:

1. Check the [Configuration Guide](./CONFIGURATION_GUIDE.md) for detailed selector help
2. Review logs in Settings → Logs → Kapowarr
3. Test selectors using the Website Inspector
4. Ask for help in the community Discord

Remember: Always respect website terms of service and copyright laws when downloading manga.

---

Last Updated: January 2025
