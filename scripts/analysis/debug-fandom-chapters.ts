#!/usr/bin/env npx tsx

import axios from 'axios';
import * as cheerio from 'cheerio';

async function debugFandomChapters() {
    console.log('Debugging Fandom chapter title extraction for Fire Force...\n');

    const volumesUrl = 'https://fire-force.fandom.com/wiki/List_of_Volumes';

    try {
        console.log('Fetching volumes page:', volumesUrl);
        const response = await axios.get(volumesUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 30000
        });

        const $ = cheerio.load(response.data);

        // Look for chapter links
        console.log('\n=== Searching for chapter links ===');

        // Try different selectors
        const selectors = [
            'a[href*="/wiki/Chapter_"]',
            'a[title*="Chapter "]',
            'a:contains("Chapter ")',
            'td a[href*="Chapter"]',
            'li a[href*="Chapter"]'
        ];

        let foundChapters = false;

        for (const selector of selectors) {
            const links = $(selector);
            if (links.length > 0) {
                console.log(`\nFound ${links.length} links with selector: ${selector}`);

                // Show first 5 examples
                links.slice(0, 5).each((i, el) => {
                    const $link = $(el);
                    const href = $link.attr('href');
                    const title = $link.attr('title');
                    const text = $link.text().trim();
                    const html = $link.html();

                    console.log(`\n  Link ${i + 1}:`);
                    console.log(`    href: ${href}`);
                    console.log(`    title: ${title}`);
                    console.log(`    text(): "${text}"`);
                    console.log(`    html(): ${html?.substring(0, 100)}`);

                    // Check parent structure
                    const parent = $link.parent();
                    console.log(`    parent tag: ${parent.prop('tagName')}`);
                    console.log(`    parent text: ${parent.text().substring(0, 100)}`);
                });

                foundChapters = true;
            }
        }

        if (!foundChapters) {
            console.log('\nNo chapter links found with standard selectors.');
            console.log('Checking table structure...');

            // Look for tables
            $('table').each((i, table) => {
                const $table = $(table);
                const headers = $table.find('th').text();

                if (headers.toLowerCase().includes('chapter') || headers.toLowerCase().includes('title')) {
                    console.log(`\nFound potential chapter table ${i + 1}:`);
                    console.log(`Headers: ${headers.substring(0, 200)}`);

                    // Show first row
                    const firstRow = $table.find('tr').eq(1);
                    console.log(`First data row HTML: ${firstRow.html()?.substring(0, 300)}`);
                }
            });
        }

        // Check for specific Fire Force chapter patterns
        console.log('\n=== Checking Fire Force specific patterns ===');

        // Look for Volume 1 chapters specifically
        const volume1Section = $('h2:contains("Volume 1"), h3:contains("Volume 1")').first();
        if (volume1Section.length > 0) {
            console.log('Found Volume 1 section');

            let $current = volume1Section.next();
            let elementsChecked = 0;

            while ($current.length > 0 && elementsChecked < 10 && !$current.is('h2, h3')) {
                const tag = $current.prop('tagName');
                const text = $current.text().substring(0, 200);
                console.log(`\n  Next element (${tag}): ${text}`);

                // Look for links within this element
                const links = $current.find('a');
                if (links.length > 0) {
                    console.log(`    Found ${links.length} links`);
                    links.slice(0, 3).each((i, link) => {
                        const $link = $(link);
                        console.log(`      Link ${i + 1}: text="${$link.text()}" href="${$link.attr('href')}"`);
                    });
                }

                $current = $current.next();
                elementsChecked++;
            }
        }

        console.log('\n=== Summary ===');
        console.log('The issue is likely that chapter titles are:');
        console.log('1. Not present as link text (links might contain only chapter numbers)');
        console.log('2. Located in a different part of the table/list structure');
        console.log('3. Stored in a different attribute or adjacent element');

    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

debugFandomChapters().catch(console.error);