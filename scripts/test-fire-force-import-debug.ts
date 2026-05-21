#!/usr/bin/env npx tsx

import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';

const prisma = new PrismaClient();

async function simulateFireForceImport() {
    logger.info('Starting Fire Force import simulation...');
    
    // Simulate searching for Fire Force on AniList
    const searchQuery = 'Fire Force';
    logger.info('Searching for:', searchQuery);
    
    try {
        // Make API call to search endpoint (using GET for query procedures)
        const params = new URLSearchParams({
            input: JSON.stringify({
                json: {
                    query: searchQuery,
                    provider: 'ANILIST'
                }
            })
        });
        const searchResponse = await fetch(`http://localhost:3000/api/trpc/search.withProvider?${params}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });
        
        const searchData = await searchResponse.json();
        logger.info('Search results:', searchData);
        
        // Find Fire Force in results
        const fireForce = searchData.result?.data?.json?.find((manga: any) => 
            manga.title?.toLowerCase().includes('fire force') || 
            manga.title?.toLowerCase().includes('enen no shouboutai')
        );
        
        if (fireForce) {
            logger.info('Found Fire Force:', fireForce);
            
            // Get detailed metadata
            const metadataResponse = await fetch('http://localhost:3000/api/trpc/metadata.getDirectMetadata', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    json: {
                        sourceId: fireForce.sourceId || fireForce.id,
                        provider: 'ANILIST'
                    }
                })
            });
            
            const metadataData = await metadataResponse.json();
            logger.info('Metadata response:', JSON.stringify(metadataData, null, 2));
            
            // Check what fields are available
            const metadata = metadataData.result?.data?.json;
            if (metadata) {
                logger.info('Available fields:', {
                    hasTitle: !!metadata.title,
                    hasStatus: !!metadata.status,
                    hasFormat: !!metadata.format,
                    hasStartDate: !!metadata.startDate,
                    hasEndDate: !!metadata.endDate,
                    hasVolumes: !!metadata.volumes,
                    hasChapters: !!metadata.chapters,
                    hasDescription: !!metadata.description,
                    hasCoverImage: !!metadata.coverImage,
                    statusValue: metadata.status,
                    formatValue: metadata.format
                });
            }
        } else {
            logger.error('Fire Force not found in search results');
        }
        
    } catch (error) {
        logger.error('Error during simulation:', error);
    } finally {
        await prisma.$disconnect();
    }
}

simulateFireForceImport().catch(console.error);