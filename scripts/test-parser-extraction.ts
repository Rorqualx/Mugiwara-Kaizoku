#!/usr/bin/env tsx

/**
 * Test just the parser extraction without the scraper
 */

import { DynamicWikiParser } from '../src/server/services/fandom/dynamic/DynamicWikiParser';
import axios from 'axios';

async function testParserExtraction() {
    console.log('Testing DynamicWikiParser extraction directly');
    console.log('='.repeat(80));
    
    const parser = new DynamicWikiParser();
    const url = 'https://fire-force.fandom.com/wiki/List_of_Volumes';
    
    try {
        const response = await axios.get(url);
        const html = response.data;
        
        // Analyze page structure
        console.log('1. Analyzing page structure...');
        const structure = await parser.analyzePageStructure(html, url);
        console.log('Structure type:', structure.type);
        console.log('Confidence:', structure.confidence);
        console.log('Metadata:', structure.metadata);
        
        // Extract data
        console.log('\n2. Extracting data...');
        const extractedData = await parser.extractData({
            url,
            html,
            title: 'List of Volumes',
            structure
        });
        
        console.log('Extraction success:', extractedData.success);
        console.log('Extraction method:', extractedData.extractionMethod);
        
        if (extractedData.data) {
            console.log('\n3. Extracted Data:');
            console.log('Volumes found:', extractedData.data.volumes?.length || 0);
            console.log('Chapters found:', extractedData.data.chapters?.length || 0);
            
            if (extractedData.data.volumes?.length > 0) {
                console.log('\nFirst volume:');
                const firstVolume = extractedData.data.volumes[0];
                console.log('  Number:', firstVolume.number);
                console.log('  Title:', firstVolume.title);
                console.log('  Chapters:', firstVolume.chapters?.length || 0);
                console.log('  ISBN:', firstVolume.isbn);
                console.log('  Release Date:', firstVolume.releaseDate);
            }
            
            if (extractedData.data.chapters?.length > 0) {
                console.log('\nFirst 5 chapters:');
                extractedData.data.chapters.slice(0, 5).forEach((ch: any) => {
                    console.log(`  Chapter ${ch.number}: ${ch.title} (Volume ${ch.volume})`);
                });
            }
        }
        
        if (extractedData.errors && extractedData.errors.length > 0) {
            console.log('\nErrors encountered:');
            extractedData.errors.forEach((err: string) => console.log('  -', err));
        }
        
    } catch (error) {
        console.error('Test failed:', error);
        if (error instanceof Error) {
            console.error('Message:', error.message);
            console.error('Stack:', error.stack);
        }
    }
}

// Run the test
testParserExtraction().then(() => {
    console.log('\nTest completed');
    process.exit(0);
}).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});