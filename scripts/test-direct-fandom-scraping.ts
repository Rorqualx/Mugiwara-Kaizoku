import axios from 'axios';
import * as cheerio from 'cheerio';

async function testDirectFandomScraping() {
  console.log('Testing direct Fandom HTML scraping for gallery extraction...\n');

  const url = 'https://fire-force.fandom.com/wiki/Fire_Force_(manga)';

  try {
    console.log(`Fetching: ${url}\n`);
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Extract gallery images using our improved logic
    const gallery: string[] = [];
    const seenUrls = new Set<string>();

    const gallerySelectors = [
      '.wikia-gallery-item img',
      '.gallery img',
      '#gallery-0 img',
      '.pi-image-collection img',
      '.pi-image img',
      '.image-thumbnail img',
      'a.image img',
      'img[alt*="Volume"]',
      'img[alt*="Cover"]',
      'img[src*="Volume"]',
      'img[src*="Cover"]',
      'img[src*="Fire_Force"]',
      'img[src*="Fire_Brigade"]',
      'img[src*="Issue"]'
    ];

    for (const selector of gallerySelectors) {
      $(selector).each((_, img) => {
        // Try data-src first (for lazy-loaded images), then fall back to src
        const dataSrc = $(img).attr('data-src');
        const src = $(img).attr('src');

        // Prefer data-src over src, skip data URIs (base64 placeholders)
        const imgUrl = dataSrc || src;

        if (imgUrl && !imgUrl.startsWith('data:') && !seenUrls.has(imgUrl)) {
          // Clean up the URL (remove thumbnailing parameters)
          let fullSrc = imgUrl;
          if (imgUrl.includes('/revision/')) {
            // Keep revision/latest for consistent full-size images
            fullSrc = imgUrl.split('/revision/')[0] + '/revision/latest';
          }
          if (imgUrl.includes('/scale-to-width-down/')) {
            // Remove scale parameters
            fullSrc = fullSrc.replace(/\/scale-to-width-down\/\d+/, '');
          }

          seenUrls.add(fullSrc);
          gallery.push(fullSrc);
        }
      });
    }

    console.log(`✅ Successfully scraped Fandom page!\n`);
    console.log(`Total unique gallery images found: ${gallery.length}\n`);

    if (gallery.length > 0) {
      console.log('First 10 gallery images:');
      gallery.slice(0, 10).forEach((img, i) => {
        const filename = img.split('/').pop()?.split('?')[0] || img;
        console.log(`  ${i + 1}. ${filename}`);
      });

      // Check for specific images
      const targetImages = [
        'Fire_Force_Volumes.png',
        'Fire_Brigade_of_Flames_Cover',
        'Issue_13,_2020.jpg'
      ];

      console.log('\nLooking for specific images:');
      for (const target of targetImages) {
        const found = gallery.some(img => img.includes(target.replace(',', '')));
        console.log(`  ${found ? '✓' : '✗'} ${target}`);
      }

      // Count Fire Force specific images
      const fireForceImages = gallery.filter(img =>
        img.includes('Fire_Force') ||
        img.includes('Fire_Brigade') ||
        img.includes('fire-brigade-of-flames') ||
        img.includes('Issue') ||
        img.includes('Volume')
      );

      console.log(`\nFire Force specific images: ${fireForceImages.length}/${gallery.length}`);

      // Show a few Fire Force specific URLs
      if (fireForceImages.length > 0) {
        console.log('\nFire Force specific image URLs (first 5):');
        fireForceImages.slice(0, 5).forEach((img, i) => {
          console.log(`  ${i + 1}. ${img}`);
        });
      }
    }

    // Also test metadata extraction
    console.log('\n\nMetadata Extraction:');

    // Extract title
    const title = $('h1.page-header__title, h1#firstHeading').first().text().trim() ||
                  $('.pi-title').text().trim();
    console.log('  Title:', title);

    // Extract author from infobox
    const author = $('.pi-data-label:contains("Author"), .pi-data-label:contains("Written by")')
      .next('.pi-data-value')
      .text()
      .trim();
    console.log('  Author:', author);

    // Extract volume/chapter counts
    const volumes = $('.pi-data-label:contains("Volumes")')
      .next('.pi-data-value')
      .text()
      .trim();
    console.log('  Volumes:', volumes);

    const chapters = $('.pi-data-label:contains("Chapters")')
      .next('.pi-data-value')
      .text()
      .trim();
    console.log('  Chapters:', chapters);

    // Check for volumes list URL
    const volumesListUrl = $('a[href*="List_of_Volumes"], a:contains("List of Volumes")')
      .first()
      .attr('href');
    if (volumesListUrl) {
      const fullUrl = volumesListUrl.startsWith('http')
        ? volumesListUrl
        : `https://fire-force.fandom.com${volumesListUrl}`;
      console.log('  Volumes List URL:', fullUrl);
    }

  } catch (error) {
    console.error('❌ Error during scraping:', error);
  }
}

testDirectFandomScraping().catch(console.error);