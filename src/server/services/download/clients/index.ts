// src/api/downloadClients/index.ts
export * from './types';
// Consolidated clients
export * from './transmission';
export * from './sabnzbdClient';
export * from './delugeClient';
export * from './nzbgetClient';
// Import consolidated clients
import { ValidationError } from '@/utils/errors';

import { createDelugeClient } from './delugeClient';
import { createNzbgetClient } from './nzbgetClient';
import { createSabnzbdClient } from './sabnzbdClient';
import { createTransmissionClient } from './transmission';
// Helper to parse URL into host/port
const parseUrl = (url: string): { host: string; port: number; ssl: boolean; basePath: string | undefined } => {
    const parsed = new URL(url);
    return {
        host: parsed.hostname,
        port: parseInt(parsed.port || (parsed.protocol === 'https:' ? '443' : '80')),
        ssl: parsed.protocol === 'https:',
        basePath: parsed.pathname === '/' ? undefined : parsed.pathname
    };
};
// Create a client factory to simplify client creation
export const createClient = (config: {
    type: 'transmission' | 'deluge' | 'sabnzbd' | 'nzbget';
    url: string;
    apiKey?: string;
    username?: string;
    password?: string;
    proxyMode?: boolean;
}): unknown => {
    const { host, port, ssl, basePath } = parseUrl(config.url);
    const baseConfig = {
        host,
        port,
        ssl,
        basePath,
        baseURL: config.url,
        useProxy: config.proxyMode
    };
    switch (config.type) {
        case 'transmission':
            return createTransmissionClient({
                ...baseConfig,
                username: config.username,
                password: config.password,
            } as unknown as Parameters<typeof createTransmissionClient>[0]);
        case 'sabnzbd':
            if (!config.apiKey)
                throw new ValidationError('API key required for SABnzbd');
            return createSabnzbdClient({
                ...baseConfig,
                apiKey: config.apiKey,
            } as unknown as Parameters<typeof createSabnzbdClient>[0]);
        case 'deluge':
            if (!config.password)
                throw new ValidationError('Password required for Deluge');
            return createDelugeClient({
                ...baseConfig,
                password: config.password,
            } as unknown as Parameters<typeof createDelugeClient>[0]);
        case 'nzbget':
            if (!config.username || !config.password) {
                throw new ValidationError('Username and password required for NZBGet');
            }
            return createNzbgetClient({
                ...baseConfig,
                username: config.username,
                password: config.password,
            } as unknown as Parameters<typeof createNzbgetClient>[0]);
        default: throw new ValidationError(`Unsupported client type: ${config.type}`);
    }
};
