#!/usr/bin/env npx tsx
/**
 * Test the complete AniList data flow from API to UI
 */

import { AniListProvider } from '../src/server/services/search/providers/AniListProvider';
import { SearchResultValidator } from '../src/server/services/search/providers/SearchResultValidator';
import { MetadataProvider } from '@prisma/client';
import { processSearchResults } from '../src/utils/search/searchResultGuards';

async function testCompleteFlow() {
    try {
        console.log('🔍 Testing complete AniList data flow for Fire Force\n');
        
        // Step 1: Get raw data from AniList
        const provider = new AniListProvider();
        const searchResults = await provider.search('Fire Force');
        
        const fireForce = searchResults.find((r: any) => 
            r.title?.toLowerCase().includes('fire force') || 
            r.id === '86310' || 
            r.anilistId === 86310
        );
        
        if (!fireForce) {
            console.log('❌ Fire Force not found');
            return;
        }
        
        console.log('1️⃣ RAW ANILIST DATA:');
        console.log('====================');
        console.log('Direct properties:');
        console.log(`  id: ${fireForce.id}`);
        console.log(`  anilistId: ${fireForce.anilistId}`);
        console.log(`  malId: ${fireForce.malId}`);
        console.log(`  status: ${fireForce.status}`);
        console.log(`  volumes: ${fireForce.volumes}`);
        console.log(`  chapters: ${fireForce.chapters}`);
        console.log(`  authors: ${JSON.stringify(fireForce.authors)}`);
        console.log(`  artists: ${JSON.stringify(fireForce.artists)}`);
        console.log(`  startDate: ${JSON.stringify(fireForce.startDate)}`);
        console.log(`  endDate: ${JSON.stringify(fireForce.endDate)}`);
        console.log(`  bannerImage: ${fireForce.bannerImage}`);
        
        if (fireForce.metadata) {
            console.log('\nMetadata object:');
            console.log(`  metadata.idMal: ${fireForce.metadata.idMal}`);
            console.log(`  metadata.status: ${fireForce.metadata.status}`);
            console.log(`  metadata.volumes: ${fireForce.metadata.volumes}`);
            console.log(`  metadata.chapters: ${fireForce.metadata.chapters}`);
            console.log(`  metadata.staff: ${fireForce.metadata.staff ? 'Present' : 'Missing'}`);
            console.log(`  metadata.startDate: ${JSON.stringify(fireForce.metadata.startDate)}`);
            console.log(`  metadata.endDate: ${JSON.stringify(fireForce.metadata.endDate)}`);
        }
        
        // Step 2: Test SearchResultValidator
        console.log('\n2️⃣ SEARCHRESULTVALIDATOR OUTPUT:');
        console.log('==================================');
        const validated = SearchResultValidator.validateAndTransform(fireForce, MetadataProvider.ANILIST);
        
        if (validated) {
            console.log('Direct properties:');
            console.log(`  id: ${validated.id}`);
            console.log(`  anilistId: ${(validated as any).anilistId}`);
            console.log(`  malId: ${(validated as any).malId}`);
            console.log(`  status: ${validated.status}`);
            console.log(`  volumes: ${validated.volumes}`);
            console.log(`  chapters: ${validated.chapters}`);
            console.log(`  authors: ${JSON.stringify((validated as any).authors)}`);
            console.log(`  artists: ${JSON.stringify((validated as any).artists)}`);
            console.log(`  startDate: ${JSON.stringify((validated as any).startDate)}`);
            console.log(`  endDate: ${JSON.stringify((validated as any).endDate)}`);
            console.log(`  bannerImage: ${(validated as any).bannerImage}`);
            
            if ((validated as any).metadata) {
                console.log('\nMetadata preserved:');
                const meta = (validated as any).metadata;
                console.log(`  metadata.idMal: ${meta.idMal}`);
                console.log(`  metadata.volumes: ${meta.volumes}`);
                console.log(`  metadata.chapters: ${meta.chapters}`);
                console.log(`  metadata.staff: ${meta.staff ? 'Present' : 'Missing'}`);
            }
        }
        
        // Step 3: Test processSearchResults (client-side)
        console.log('\n3️⃣ CLIENT-SIDE PROCESSING:');
        console.log('===========================');
        const processed = processSearchResults([validated!], 'anilist');
        
        if (processed && processed.length > 0) {
            const result = processed[0];
            console.log('Direct properties:');
            console.log(`  id: ${result.id}`);
            console.log(`  anilistId: ${(result as any).anilistId}`);
            console.log(`  malId: ${(result as any).malId}`);
            console.log(`  status: ${result.status}`);
            console.log(`  volumes: ${result.volumes}`);
            console.log(`  chapters: ${result.chapters}`);
            console.log(`  authors: ${JSON.stringify((result as any).authors)}`);
            console.log(`  artists: ${JSON.stringify((result as any).artists)}`);
            console.log(`  startDate: ${JSON.stringify((result as any).startDate)}`);
            console.log(`  endDate: ${JSON.stringify((result as any).endDate)}`);
            console.log(`  bannerImage: ${(result as any).bannerImage}`);
            
            if ((result as any).metadata) {
                console.log('\nMetadata after processing:');
                const meta = (result as any).metadata;
                console.log(`  metadata.idMal: ${meta.idMal}`);
                console.log(`  metadata.volumes: ${meta.volumes}`);
                console.log(`  metadata.chapters: ${meta.chapters}`);
                console.log(`  metadata.staff: ${meta.staff ? 'Present' : 'Missing'}`);
            }
        }
        
        // Step 4: Check what fields would be available in UI
        console.log('\n4️⃣ FIELD AVAILABILITY FOR UI:');
        console.log('==============================');
        const uiData = processed && processed[0] ? processed[0] : null;
        
        if (uiData) {
            const checkField = (name: string, locations: string[]) => {
                for (const loc of locations) {
                    const parts = loc.split('.');
                    let value: any = uiData;
                    for (const part of parts) {
                        value = value?.[part];
                    }
                    if (value !== undefined && value !== null && value !== '') {
                        return { available: true, location: loc, value };
                    }
                }
                return { available: false };
            };
            
            const fields = [
                { name: 'Status', paths: ['status', 'metadata.status'] },
                { name: 'Authors', paths: ['authors', 'metadata.authors', 'metadata.staff'] },
                { name: 'Artists', paths: ['artists', 'metadata.artists', 'metadata.staff'] },
                { name: 'Start Date', paths: ['startDate', 'metadata.startDate'] },
                { name: 'End Date', paths: ['endDate', 'metadata.endDate'] },
                { name: 'Volumes', paths: ['volumes', 'metadata.volumes'] },
                { name: 'Chapters', paths: ['chapters', 'metadata.chapters'] },
                { name: 'AniList ID', paths: ['anilistId', 'id', 'metadata.anilistId'] },
                { name: 'MAL ID', paths: ['malId', 'metadata.malId', 'metadata.idMal'] },
                { name: 'Banner', paths: ['bannerImage', 'metadata.bannerImage'] }
            ];
            
            fields.forEach(field => {
                const result = checkField(field.name, field.paths);
                if (result.available) {
                    console.log(`✅ ${field.name}: Available at ${result.location} = ${JSON.stringify(result.value).substring(0, 50)}`);
                } else {
                    console.log(`❌ ${field.name}: Not available`);
                }
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

testCompleteFlow().catch(console.error);