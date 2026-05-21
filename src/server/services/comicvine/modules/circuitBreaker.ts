/**
 * Circuit Breaker Pattern for ComicVine API
 *
 * Provides comprehensive error handling with:
 * - Circuit breaker to prevent cascading failures
 * - Health monitoring
 * - Automatic recovery
 * - Fallback mechanisms
 */
import { ApiError, AppError } from '@/utils/error-handling';
import { logger } from '@/utils/logger';
/**
 * Circuit breaker states
 */
export enum CircuitState {
    CLOSED = 'CLOSED',// Normal operation
    OPEN = 'OPEN',// Circuit broken, rejecting requests
    HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}
/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
    failureThreshold?: number; // Number of failures before opening
    successThreshold?: number; // Number of successes to close from half-open
    timeout?: number; // Time in ms before trying half-open
    volumeThreshold?: number; // Minimum requests before evaluating
    errorThresholdPercentage?: number; // Error percentage to trip
    rollingWindowSize?: number; // Size of rolling window in ms
    fallbackFunction?: () => unknown; // Fallback when circuit is open
}
/**
 * Health metrics for monitoring
 */
export interface HealthMetrics {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime?: number;
    lastSuccessTime?: number;
    nextAttempt?: number;
    totalRequests: number;
    errorRate: number;
}
/**
 * Request tracking for rolling window
 */
interface RequestRecord {
    timestamp: number;
    success: boolean;
    error?: Error;
}
/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker {
    private state: CircuitState = CircuitState.CLOSED;
    private failureCount: number = 0;
    private successCount: number = 0;
    private lastFailureTime?: number;
    private lastSuccessTime?: number;
    private nextAttempt?: number;
    private requestHistory: RequestRecord[] = [];
    // Configuration
    private readonly FAILURE_THRESHOLD: number;
    private readonly SUCCESS_THRESHOLD: number;
    private readonly TIMEOUT: number;
    private readonly VOLUME_THRESHOLD: number;
    private readonly ERROR_THRESHOLD_PERCENTAGE: number;
    private readonly ROLLING_WINDOW_SIZE: number;
    private readonly fallbackFunction?: () => unknown;
    constructor(config: CircuitBreakerConfig = {}) {
        this.FAILURE_THRESHOLD = config.failureThreshold ?? 5;
        this.SUCCESS_THRESHOLD = config.successThreshold ?? 3;
        this.TIMEOUT = config.timeout ?? 60000; // 1 minute
        this.VOLUME_THRESHOLD = config.volumeThreshold ?? 10;
        this.ERROR_THRESHOLD_PERCENTAGE = config.errorThresholdPercentage ?? 50;
        this.ROLLING_WINDOW_SIZE = config.rollingWindowSize ?? 60000; // 1 minute
        if (config.fallbackFunction !== undefined) {
            this.fallbackFunction = config.fallbackFunction;
        }
        logger.info('Circuit breaker initialized', {
            failureThreshold: this.FAILURE_THRESHOLD,
            successThreshold: this.SUCCESS_THRESHOLD,
            timeout: this.TIMEOUT,
            errorThresholdPercentage: this.ERROR_THRESHOLD_PERCENTAGE
        });
    }
    /**
     * Execute a function with circuit breaker protection
     *
     * @param fn Function to execute
     * @returns Result or fallback value
     */
    public async execute<T>(fn: () => Promise<T>): Promise<T> {
        // Check circuit state
        if (this.state === CircuitState.OPEN) {
            if (this.shouldAttemptReset()) {
                this.state = CircuitState.HALF_OPEN;
                logger.info('Circuit breaker entering half-open state');
            }
            else {
                return this.handleOpen<T>();
            }
        }
        try {
            // Execute the function
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error: unknown) {
            const errorObj = error instanceof Error ? error : new Error(String(error));
            this.onFailure(errorObj);
            throw errorObj;
        }
    }
    /**
     * Record successful execution
     */
    private onSuccess(): void {
        this.successCount++;
        this.lastSuccessTime = Date.now();
        // Record in history
        this.recordRequest(true);
        // Handle state transitions
        if (this.state === CircuitState.HALF_OPEN) {
            if (this.successCount >= this.SUCCESS_THRESHOLD) {
                this.close();
            }
        }
        else if (this.state === CircuitState.CLOSED) {
            // Reset failure count on success in closed state
            if (this.failureCount > 0) {
                this.failureCount = Math.max(0, this.failureCount - 1);
            }
        }
    }
    /**
     * Record failed execution
     */
    private onFailure(error: Error): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();
        // Record in history
        this.recordRequest(false, error);
        // Check if we should open the circuit
        if (this.state === CircuitState.CLOSED) {
            if (this.shouldOpen()) {
                this.open();
            }
        }
        else if (this.state === CircuitState.HALF_OPEN) {
            // Any failure in half-open state reopens the circuit
            this.open();
        }
        logger.warn('Circuit breaker recorded failure', {
            state: this.state,
            failureCount: this.failureCount,
            error: (error instanceof Error ? error.message : String(error))
        });
    }
    /**
     * Check if circuit should open
     */
    private shouldOpen(): boolean {
        // Check absolute failure threshold
        if (this.failureCount >= this.FAILURE_THRESHOLD) {
            return true;
        }
        // Check percentage-based threshold
        const recentRequests = this.getRecentRequests();
        if (recentRequests.length >= this.VOLUME_THRESHOLD) {
            const errorRate = this.calculateErrorRate(recentRequests);
            if (errorRate >= this.ERROR_THRESHOLD_PERCENTAGE) {
                return true;
            }
        }
        return false;
    }
    /**
     * Check if we should attempt to reset from open state
     */
    private shouldAttemptReset(): boolean {
        return this.nextAttempt ? Date.now() >= this.nextAttempt : true;
    }
    /**
     * Open the circuit
     */
    private open(): void {
        this.state = CircuitState.OPEN;
        this.nextAttempt = Date.now() + this.TIMEOUT;
        logger.error('Circuit breaker opened', {
            failureCount: this.failureCount,
            nextAttempt: new Date(this.nextAttempt).toISOString()
        });
    }
    /**
     * Close the circuit
     */
    private close(): void {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        // Don't set nextAttempt to preserve the type
        logger.info('Circuit breaker closed');
    }
    /**
     * Handle open circuit
     */
    private handleOpen<T>(): T {
        const timeUntilRetry = this.nextAttempt ? this.nextAttempt - Date.now() : 0;
        logger.debug('Circuit breaker is open', {
            timeUntilRetryMs: timeUntilRetry,
            hasFallback: !!this.fallbackFunction
        });
        if (this.fallbackFunction) {
            return this.fallbackFunction() as T;
        }
        throw new AppError(`Circuit breaker is open. Service unavailable. Retry in ${Math.ceil(timeUntilRetry / 1000)}s`, {
            state: this.state,
            nextAttempt: this.nextAttempt,
            failureCount: this.failureCount
        });
    }
    /**
     * Record request in rolling window
     */
    private recordRequest(success: boolean, error?: Error): void {
        const now = Date.now();
        const record: RequestRecord = {
            timestamp: now,
            success,
            ...(error !== undefined && { error })
        };
        this.requestHistory.push(record);
        // Clean old records
        this.cleanRequestHistory(now);
    }
    /**
     * Clean old request records
     */
    private cleanRequestHistory(now: number): void {
        const cutoff = now - this.ROLLING_WINDOW_SIZE;
        this.requestHistory = this.requestHistory.filter(r => r.timestamp > cutoff);
    }
    /**
     * Get recent requests within rolling window
     */
    private getRecentRequests(): RequestRecord[] {
        const now = Date.now();
        const cutoff = now - this.ROLLING_WINDOW_SIZE;
        return this.requestHistory.filter(r => r.timestamp > cutoff);
    }
    /**
     * Calculate error rate from requests
     */
    private calculateErrorRate(requests: RequestRecord[]): number {
        if (requests.length === 0)
            return 0;
        const failures = requests.filter(r => !r.success).length;
        return (failures / requests.length) * 100;
    }
    /**
     * Get current health metrics
     */
    public getHealth(): HealthMetrics {
        const recentRequests = this.getRecentRequests();
        const errorRate = this.calculateErrorRate(recentRequests);
        const metrics: HealthMetrics = {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            totalRequests: recentRequests.length,
            errorRate,
            ...(this.lastFailureTime !== undefined ? { lastFailureTime: this.lastFailureTime } : {}),
            ...(this.lastSuccessTime !== undefined ? { lastSuccessTime: this.lastSuccessTime } : {}),
            ...(this.nextAttempt !== undefined ? { nextAttempt: this.nextAttempt } : {})
        };
        return metrics;
    }
    /**
     * Manually trip the circuit (for testing or emergency)
     */
    public trip(): void {
        this.open();
    }
    /**
     * Manually reset the circuit (for testing or recovery)
     */
    public reset(): void {
        this.close();
        this.requestHistory = [];
        logger.info('Circuit breaker manually reset');
    }
    /**
     * Check if circuit is allowing requests
     */
    public isAllowingRequests(): boolean {
        if (this.state === CircuitState.CLOSED)
            return true;
        if (this.state === CircuitState.HALF_OPEN)
            return true;
        // State is OPEN at this point - only allow if reset should be attempted
        return this.shouldAttemptReset();
    }
    /**
     * Get detailed error analysis
     */
    public getErrorAnalysis(): {
        recentErrors: Array<{
            timestamp: number;
            message: string;
        }>;
        errorTypes: Record<string, number>;
        recommendations: string[];
    } {
        const recentErrors = this.requestHistory
            .filter(r => !r.success && r.error)
            .slice(-10) // Last 10 errors
            .map(r => ({
            timestamp: r.timestamp,
            message: r.error?.message ?? 'Unknown error'
        }));
        // Categorize errors
        const errorTypes: Record<string, number> = {};
        for (const record of this.requestHistory) {
            if (!record.success && record.error) {
                const type = this.categorizeError(record.error);
                errorTypes[type] = (errorTypes[type] ?? 0) + 1;
            }
        }
        // Generate recommendations
        const recommendations = this.generateRecommendations(errorTypes);
        return {
            recentErrors,
            errorTypes,
            recommendations
        };
    }
    /**
     * Categorize error type
     */
    private categorizeError(error: Error): string {
        if (error instanceof ApiError) {
            if (error.statusCode === 429)
                return 'RATE_LIMIT';
            if (error.statusCode && error.statusCode >= 500)
                return 'SERVER_ERROR';
            if (error.statusCode && error.statusCode >= 400)
                return 'CLIENT_ERROR';
        }
        const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
        if (message.includes('timeout'))
            return 'TIMEOUT';
        if (message.includes('network'))
            return 'NETWORK';
        if (message.includes('econnrefused'))
            return 'CONNECTION_REFUSED';
        return 'UNKNOWN';
    }
    /**
     * Generate recommendations based on error patterns
     */
    private generateRecommendations(errorTypes: Record<string, number>): string[] {
        const recommendations: string[] = [];
        const rateLimit = errorTypes["RATE_LIMIT"] ?? 0;
        if (rateLimit > 0) {
            recommendations.push('Reduce request frequency or implement better rate limiting');
        }
        const serverError = errorTypes["SERVER_ERROR"] ?? 0;
        if (serverError > 5) {
            recommendations.push('ComicVine API may be experiencing issues. Consider using cached data.');
        }
        const timeout = errorTypes["TIMEOUT"] ?? 0;
        if (timeout > 3) {
            recommendations.push('Increase timeout values or optimize request payload');
        }
        const network = errorTypes["NETWORK"] ?? 0;
        if (network > 0) {
            recommendations.push('Check network connectivity and DNS resolution');
        }
        const connectionRefused = errorTypes["CONNECTION_REFUSED"] ?? 0;
        if (connectionRefused > 0) {
            recommendations.push('ComicVine API may be down. Enable fallback mechanisms.');
        }
        if (recommendations.length === 0) {
            recommendations.push('Monitor error patterns and adjust thresholds if needed');
        }
        return recommendations;
    }
}
