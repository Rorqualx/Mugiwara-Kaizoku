#!/usr/bin/env npx tsx

import { DynamicWikiParser } from '../src/server/services/fandom/dynamic/DynamicWikiParser';
import { logger } from '../src/utils/logger';
import axios from 'axios';

// Chapters that were reportedly missing
const missingChapters = [5, 6, 7, 148, 149, 150, 151, 163, 164, 165, 166, 178, 196];

async function testDynamicParserWithFireForce() {
    logger.info('🔍 Testing DynamicWikiParser with Fire Force volumes page...\n');
    
    try {
        const parser = new DynamicWikiParser();
        
        // Fetch the Fire Force List of Volumes page
        const url = 'https://fire-force.fandom.com/wiki/List_of_Volumes';
        logger.info(`Fetching: ${url}`);
        
        const response = await axios.get(url);
        
        // Extract data using the parser
        const result = await parser.extractData({
            url,
            title: 'List of Volumes',
            html: response.data
        });
        
        logger.info(`\n📊 Parser Results:`);
        logger.info(`Success: ${result.success}`);
        logger.info(`Type: ${result.type}`);
        logger.info(`Extraction Method: ${result.extractionMethod}`);
        logger.info(`Confidence: ${result.confidence}`);
        
        if (result.data) {
            const { volumes = [], chapters = [] } = result.data;
            
            logger.info(`\n📚 Volumes: ${volumes.length}`);
            if (volumes.length > 0) {
                logger.info(`First volume: Volume ${volumes[0].number}`);
                logger.info(`Last volume: Volume ${volumes[volumes.length - 1].number}`);
            }
            
            logger.info(`\n📖 Chapters: ${chapters.length}`);
            if (chapters.length > 0) {
                // Extract chapter numbers
                const chapterNumbers = chapters.map((ch: any) => {
                    const num = typeof ch.number === 'string' ? parseFloat(ch.number) : ch.number;
                    return num;
                }).filter((n: number) => !isNaN(n)).sort((a: number, b: number) => a - b);
                
                logger.info(`Chapter range: ${chapterNumbers[0]} - ${chapterNumbers[chapterNumbers.length - 1]}`);
                
                // Check for missing chapters
                logger.info(`\n🔍 Checking for previously missing chapters:`);
                const foundMissing: number[] = [];
                const stillMissing: number[] = [];
                
                for (const chapter of missingChapters) {
                    if (chapterNumbers.includes(chapter)) {
                        foundMissing.push(chapter);
                    } else {
                        stillMissing.push(chapter);
                    }
                }
                
                if (foundMissing.length > 0) {
                    logger.info(`✅ Found these chapters: ${foundMissing.join(', ')}`);
                }
                
                if (stillMissing.length > 0) {
                    logger.warn(`❌ Still missing: ${stillMissing.join(', ')}`);
                } else {
                    logger.info(`🎉 All previously missing chapters are now found!`);
                }
                
                // Check for gaps
                logger.info(`\n📊 Gap Analysis:`);
                const gaps: number[] = [];
                for (let i = 1; i <= 304; i++) {
                    if (!chapterNumbers.includes(i)) {
                        gaps.push(i);
                    }
                }
                
                if (gaps.length > 0) {
                    logger.info(`Missing ${gaps.length} chapters from sequence 1-304`);
                    if (gaps.length <= 20) {
                        logger.info(`Missing chapters: ${gaps.join(', ')}`);
                    } else {
                        logger.info(`Missing chapters: ${gaps.slice(0, 20).join(', ')}... and ${gaps.length - 20} more`);
                    }
                } else {
                    logger.info(`✅ No gaps - all chapters 1-304 present!`);
                }
                
                // Show some sample chapters
                logger.info(`\n📝 Sample chapters:`);
                const samples = [1, 5, 50, 100, 150, 200, 250, 300, 304];
                for (const num of samples) {
                    const chapter = chapters.find((ch: any) => {
                        const chNum = typeof ch.number === 'string' ? parseFloat(ch.number) : ch.number;
                        return chNum === num;
                    });
                    if (chapter) {
                        logger.info(`  Chapter ${num}: ${chapter.title || 'No title'} (Volume ${chapter.volume || 'unknown'})`);
                    }
                }
            }
            
            // Check gallery images
            if (result.data.galleryImages && result.data.galleryImages.length > 0) {
                logger.info(`\n🖼️ Gallery Images: ${result.data.galleryImages.length}`);
            }
        }
        
        if (result.errors && result.errors.length > 0) {
            logger.warn(`\n⚠️ Errors encountered:`);
            result.errors.forEach((err: string) => logger.warn(`  - ${err}`));
        }
        
    } catch (error) {
        logger.error('Error testing parser:', error);
    }
}

testDynamicParserWithFireForce();