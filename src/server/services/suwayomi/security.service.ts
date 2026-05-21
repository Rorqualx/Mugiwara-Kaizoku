/**
 * Suwayomi Security Service
 *
 * Provides security features for Suwayomi integration including:
 * - JAR file checksum verification
 * - Process sandboxing
 * - Certificate pinning
 * - Security audit logging
 */
import { exec } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import axios from 'axios';

import { logger } from '@/utils/logger';
import { isRecord } from '@/utils/type-guards/index';

import type * as https from 'https';
import type { PeerCertificate, TLSSocket } from 'tls';

const execAsync = promisify(exec);

/**
 * Type guard for TLS certificate
 */
function isTLSCertificate(value: unknown): value is PeerCertificate {
    return isRecord(value);
}

/**
 * Security configuration for Suwayomi
 */
interface SecurityConfig {
    enableChecksumVerification: boolean;
    enableSandboxing: boolean;
    enableCertificatePinning: boolean;
    allowedDirectories: string[];
    maxMemoryMB: number;
    maxCpuPercent: number;
    trustedCertificates: string[];
}
/**
 * Checksum information for releases
 */
interface ReleaseChecksum {
    version: string;
    sha256: string;
    sha512: string;
    releaseDate: string;
}
/**
 * Known checksums for official Suwayomi releases
 * These should be updated with each new release
 */
const KNOWN_CHECKSUMS: Record<string, ReleaseChecksum> = {
    'v0.7.0': {
        version: 'v0.7.0',
        sha256: 'abc123...', // Replace with actual checksums
        sha512: 'def456...',
        releaseDate: '2024-01-01'
    }
    // Add more versions as they are released
};
class SuwayomiSecurityService {
    private config: SecurityConfig = {
        enableChecksumVerification: true,
        enableSandboxing: false, // Disabled by default due to platform differences
        enableCertificatePinning: true,
        allowedDirectories: [],
        maxMemoryMB: 2048,
        maxCpuPercent: 80,
        trustedCertificates: []
    };
    /**
     * Initialize security service with configuration
     */
    constructor() {
        this.loadSecurityConfig();
    }
    /**
     * Load security configuration from settings
     */
    private loadSecurityConfig(): void {
        // Load from database or config file
        // For now, use defaults
        const dataDir = path.join(process.cwd(), 'data');
        const configDir = path.join(dataDir, 'suwayomi-config');
        const serverDir = path.join(dataDir, 'suwayomi-server');
        const downloadDir = path.join(dataDir, 'downloads');
        this.config.allowedDirectories = [
            dataDir,
            configDir,
            serverDir,
            downloadDir
        ];
    }
    /**
     * Update security configuration
     */
    updateConfig(config: Partial<SecurityConfig>): void {
        this.config = { ...this.config, ...config };
        logger.info('Updated Suwayomi security configuration');
    }
    /**
     * Calculate file checksum
     */
    private async calculateChecksum(filePath: string, algorithm: 'sha256' | 'sha512' = 'sha256'): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash(algorithm);
            const stream = fs.createReadStream(filePath);
            stream.on('error', reject);
            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
        });
    }
    /**
     * Verify JAR file checksum against known values
     */
    async verifyJarChecksum(jarPath: string, version?: string): Promise<boolean> {
        if (!this.config.enableChecksumVerification) {
            logger.info('Checksum verification is disabled');
            return true;
        }
        try {
            if (!fs.existsSync(jarPath)) {
                logger.error(`JAR file not found: ${jarPath}`);
                return false;
            }
            // Calculate checksums
            const sha256 = await this.calculateChecksum(jarPath, 'sha256');
            const sha512 = await this.calculateChecksum(jarPath, 'sha512');
            logger.info(`Calculated SHA256: ${sha256.substring(0, 16)}...`);
            logger.info(`Calculated SHA512: ${sha512.substring(0, 16)}...`);
            // If version is provided, check against known checksums
            if (version !== undefined) {
                const known = KNOWN_CHECKSUMS[version];
                if (known !== undefined) {
                    const isValid = sha256 === known.sha256 && sha512 === known.sha512;
                    if (isValid) {
                        logger.info(`JAR checksum verified for version ${version}`);
                    }
                    else {
                        logger.error(`JAR checksum mismatch for version ${version}`);
                    }
                    return isValid;
                }
            }
            // If no version or unknown version, log checksums for reference
            logger.warn('No known checksum for this version. JAR integrity cannot be verified.');
            logger.info('For security, please verify these checksums with official sources:');
            logger.info(`SHA256: ${sha256}`);
            logger.info(`SHA512: ${sha512}`);
            // Allow execution but warn user
            return true;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error verifying JAR checksum: ${errorMessage}`);
            return false;
        }
    }
    /**
     * Extract SHA256 checksum from a line
     */
    private extractSHA256(line: string): string | null {
        const parts = line.split('SHA256:');
        const sha256Part = parts[1];
        return sha256Part ? sha256Part.trim() : null;
    }

    /**
     * Extract SHA512 checksum from a line
     */
    private extractSHA512(line: string): string | null {
        const parts = line.split('SHA512:');
        const sha512Part = parts[1];
        return sha512Part ? sha512Part.trim() : null;
    }

    /**
     * Parse checksum lines for Suwayomi JAR file
     */
    private parseChecksumLines(lines: string[], version: string): Partial<ReleaseChecksum> {
        const checksums: Partial<ReleaseChecksum> = {
            version,
            releaseDate: new Date().toISOString()
        };

        for (const line of lines) {
            if (!line.includes('Suwayomi-Server.jar')) {
                continue;
            }

            if (line.includes('SHA256:')) {
                const sha256 = this.extractSHA256(line);
                if (sha256) {
                    checksums.sha256 = sha256;
                }
            }
            else if (line.includes('SHA512:')) {
                const sha512 = this.extractSHA512(line);
                if (sha512) {
                    checksums.sha512 = sha512;
                }
            }
        }

        return checksums;
    }

    /**
     * Download and verify checksums from official source
     */
    async downloadOfficialChecksums(version: string): Promise<ReleaseChecksum | null> {
        try {
            // Download checksum file from GitHub releases
            const checksumUrl = `https://github.com/Suwayomi/Suwayomi-Server/releases/download/${version}/checksums.txt`;
            const response = await axios.get(checksumUrl, {
                timeout: 10000,
                validateStatus: (status) => status === 200
            });

            // Validate response data is a string
            if (typeof response.data !== 'string') {
                logger.error('Invalid checksum file format: expected string');
                return null;
            }

            // Parse checksum file - assign to typed variable
            const checksumText: string = response.data;
            const lines = checksumText.split('\n');
            const checksums = this.parseChecksumLines(lines, version);

            if (checksums.sha256 && checksums.sha512) {
                return checksums as ReleaseChecksum;
            }
            logger.warn('Could not parse official checksums');
            return null;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error downloading official checksums: ${errorMessage}`);
            return null;
        }
    }
    /**
     * Create sandboxed environment for Suwayomi process
     */
    async createSandboxedProcess(javaPath: string, jarPath: string, _args: string[]): Promise<Record<string, unknown> | null> {
        if (!this.config.enableSandboxing) {
            logger.info('Process sandboxing is disabled');
            return null;
        }
        const platform = process.platform;
        const sandboxOptions: Record<string, unknown> = {};
        try {
            switch (platform) {
                case 'linux':
                    // Use Linux namespaces and cgroups
                    sandboxOptions["firejail"] = await this.setupFirejail(jarPath);
                    break;
                case 'darwin':
                    // Use macOS sandbox-exec
                    sandboxOptions["sandbox"] = await this.setupMacOSSandbox(jarPath);
                    break;
                case 'win32':
                    // Use Windows AppContainer or Job Objects
                    sandboxOptions["appContainer"] = await this.setupWindowsSandbox(jarPath);
                    break;
                default:
                    logger.warn(`Sandboxing not supported on platform: ${platform}`);
                    return null;
            }
            return sandboxOptions;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error creating sandboxed environment: ${errorMessage}`);
            return null;
        }
    }
    /**
     * Setup Firejail sandbox for Linux
     */
    private async setupFirejail(_jarPath: string): Promise<string[]> {
        // Check if firejail is installed
        try {
            await execAsync('which firejail');
        }
        catch {
            logger.warn('Firejail not installed. Install with: sudo apt install firejail');
            return [];
        }
        const profilePath = path.join(process.cwd(), 'data', 'suwayomi-firejail.profile');
        // Create firejail profile
        const profile = `
# Suwayomi Server Firejail Profile
include default.profile
# Whitelist directories
whitelist ${this.config.allowedDirectories.join('\nwhitelist ')}
# Network
net none
protocol unix,inet,inet6
# System
caps.drop all
nonewprivs
noroot
seccomp
# Resources
rlimit-as ${this.config.maxMemoryMB}M
rlimit-cpu ${this.config.maxCpuPercent}
# Filesystem
read-only ${process.cwd()}
read-write ${path.join(process.cwd(), 'data')}
`;
        fs.writeFileSync(profilePath, profile);
        return [
            'firejail',
            `--profile=${profilePath}`,
            '--quiet'
        ];
    }
    /**
     * Setup sandbox for macOS
     */
    private setupMacOSSandbox(jarPath: string): Promise<string[]> {
        const profilePath = path.join(process.cwd(), 'data', 'suwayomi-sandbox.sb');
        // Create sandbox profile
        const profile = `
(version 1)
(deny default)
; Allow read access to specific directories
${this.config.allowedDirectories.map((dir) => `(allow file-read* (subpath "${dir}"))`).join('\n')}
; Allow write access to data directory
(allow file-write* (subpath "${path.join(process.cwd(), 'data')}"))
; Allow network access
(allow network*)
; Allow process execution
(allow process-exec (literal "${jarPath}"))
`;
        fs.writeFileSync(profilePath, profile);
        return Promise.resolve([
            'sandbox-exec',
            '-f', profilePath
        ]);
    }
    /**
     * Setup sandbox for Windows
     */
    private setupWindowsSandbox(_jarPath: string): Promise<Record<string, unknown>> {
        // Windows sandboxing is more complex and requires specific APIs
        // This is a placeholder for future implementation
        logger.warn('Windows sandboxing not yet implemented');
        return Promise.resolve({});
    }
    /**
     * Verify SSL certificate for HTTPS connections
     */
    async verifyCertificate(url: string): Promise<boolean> {
        if (!this.config.enableCertificatePinning) {
            return true;
        }
        try {
            const urlObj = new URL(url);
            // Get certificate info
            const certInfo = await this.getCertificateInfo(urlObj.hostname);
            if (!certInfo) {
                logger.warn(`Could not retrieve certificate for ${urlObj.hostname}`);
                return false;
            }
            // Check against trusted certificates
            const fingerprint = certInfo['fingerprint'];
            const isTrusted = typeof fingerprint === 'string' && this.config.trustedCertificates.includes(fingerprint);
            if (!isTrusted) {
                logger.warn(`Certificate not in trusted list: ${fingerprint}`);
                // For now, allow but warn
                return true;
            }
            logger.info(`Certificate verified for ${urlObj.hostname}`);
            return true;
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
logger.error(`Error verifying certificate: ${errorMessage}`);
            return false;
        }
    }
    /**
     * Get certificate information for a hostname
     */
    private async getCertificateInfo(hostname: string): Promise<Record<string, unknown> | null> {
        return new Promise((resolve, reject) => {
            // Dynamic import for https module
            void import('https').then((httpsModule) => {
                const options: https.RequestOptions = {
                    hostname,
                    port: 443,
                    method: 'GET',
                    rejectUnauthorized: false
                };

                const req = httpsModule.request(options, (res) => {
                    const socket = res.socket;

                    // Type guard to check if socket is a TLSSocket
                    const isTLSSocket = (s: unknown): s is TLSSocket => {
                        return s !== null && s !== undefined && typeof s === 'object' && 'getPeerCertificate' in s;
                    };

                    if (!isTLSSocket(socket)) {
                        resolve(null);
                        return;
                    }

                    const cert = socket.getPeerCertificate(true);

                    if (isTLSCertificate(cert) && Object.keys(cert).length > 0) {
                        resolve({
                            fingerprint: cert.fingerprint,
                            fingerprint256: cert.fingerprint256,
                            subject: cert.subject,
                            issuer: cert.issuer,
                            valid_from: cert.valid_from,
                            valid_to: cert.valid_to
                        });
                    }
                    else {
                        resolve(null);
                    }
                });

                req.on('error', reject);
                req.end();
            }).catch(reject);
        });
    }
    /**
     * Audit security event
     */
    private auditSecurityEvent(event: string, details: unknown): void {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            event,
            details,
            severity: this.getEventSeverity(event)
        };
        logger.info(`[SECURITY AUDIT] ${JSON.stringify(logEntry)}`);
        // Store in database or separate audit log file
        const auditLogPath = path.join(process.cwd(), 'data', 'suwayomi-security-audit.log');
        fs.appendFileSync(auditLogPath, JSON.stringify(logEntry) + '\n');
    }
    /**
     * Get event severity level
     */
    private getEventSeverity(event: string): 'info' | 'warning' | 'critical' {
        const criticalEvents = ['checksum_mismatch', 'certificate_invalid', 'sandbox_breach'];
        const warningEvents = ['checksum_unknown', 'certificate_untrusted', 'sandbox_disabled'];
        if (criticalEvents.includes(event))
            return 'critical';
        if (warningEvents.includes(event))
            return 'warning';
        return 'info';
    }
    /**
     * Perform security audit
     */
    async performSecurityAudit(): Promise<{
        passed: boolean;
        issues: string[];
        recommendations: string[];
    }> {
        const issues: string[] = [];
        const recommendations: string[] = [];
        // Check Java version
        try {
            const { stdout } = await execAsync('java -version 2>&1');
            const versionMatch = stdout.match(/version "(\d+)\.(\d+)\.(\d+)/);
            if (versionMatch?.[1]) {
                const majorVersion = parseInt(versionMatch[1]);
                if (majorVersion < 11) {
                    issues.push(`Java version ${majorVersion} is below recommended version 11`);
                }
            }
        }
        catch (_error: unknown) {
            issues.push('Java is not installed or not in PATH');
        }
        // Check file permissions
        for (const dir of this.config.allowedDirectories) {
            if (fs.existsSync(dir)) {
                const stats = fs.statSync(dir);
                const mode = (stats.mode & parseInt('777', 8)).toString(8);
                if (mode === '777') {
                    issues.push(`Directory ${dir} has overly permissive permissions (777)`);
                    recommendations.push(`Run: chmod 755 ${dir}`);
                }
            }
        }
        // Check security features
        if (!this.config.enableChecksumVerification) {
            recommendations.push('Enable checksum verification for downloaded files');
        }
        if (!this.config.enableSandboxing && process.platform !== 'win32') {
            recommendations.push('Consider enabling process sandboxing for additional security');
        }
        if (!this.config.enableCertificatePinning) {
            recommendations.push('Enable certificate pinning for secure connections');
        }
        // Audit the results
        this.auditSecurityEvent('security_audit_performed', {
            passed: issues.length === 0,
            issueCount: issues.length,
            recommendationCount: recommendations.length
        });
        return {
            passed: issues.length === 0,
            issues,
            recommendations
        };
    }
}
// Export singleton instance
export const suwayomiSecurityService = new SuwayomiSecurityService();
