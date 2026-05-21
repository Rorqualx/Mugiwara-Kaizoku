/**
 * Email Notification Adapter
 *
 * This module implements email notifications using Nodemailer.
 * It supports SMTP configuration with TLS, authentication, and HTML email formatting.
 *
 * @module emailAdapter
 */
import nodemailer from 'nodemailer';

import type { EmailSettings, NotificationTestResult } from '@/types/search.types';
import {
  createSuccessResult,
  createErrorResult,
  isError
} from '@/utils/async-result';
import type {
  AsyncResult} from '@/utils/async-result';
import { logger } from '@/utils/logger';

import { BaseNotificationAdapter } from '../base/BaseNotificationAdapter';
import { getEventEmoji, getEventColor } from '../utils/event-helpers';

import type { NotificationPayload } from '../base/BaseNotificationAdapter';
import type { NotificationEventType } from '@prisma/client';
import type { Transporter } from 'nodemailer';
/**
 * Email adapter for sending notifications via SMTP
 *
 * Implements the NotificationAdapter interface to send notifications
 * through email using Nodemailer. Supports HTML formatting, multiple
 * recipients, and secure SMTP connections.
 *
 * @class EmailAdapter
 * @extends {BaseNotificationAdapter}
 */
export class EmailAdapter extends BaseNotificationAdapter {
    /**
     * Nodemailer transporter instance
     * @private
     */
    private transporter: Transporter | null = null;
    /**
     * Email configuration settings
     * @private
     */
    private config: EmailSettings;
    /**
     * Creates an instance of EmailAdapter
     *
     * @constructor
     * @param {EmailSettings} config - Email configuration settings
     */
    constructor(config: EmailSettings) {
        super(config.enabled, config.events ?? []);
        this.config = config;
        if (this.enabled) {
            this.initializeTransporter();
        }
    }
    /**
     * Initialize the Nodemailer transporter
     *
     * Creates a new transporter instance with the configured SMTP settings.
     * Handles errors gracefully and logs them for debugging.
     *
     * @private
     * @returns {void}
     */
    private initializeTransporter(): void {
        try {
            this.transporter = nodemailer.createTransport({
                host: this.config.host,
                port: this.config.port,
                secure: this.config.secure, // true for 465, false for other ports
                auth: {
                    user: this.config.username,
                    pass: this.config.password,
                },
                tls: {
                    rejectUnauthorized: this.config.secure,
                    minVersion: 'TLSv1.2' as const,
                },
                connectionTimeout: 30000, // 30 seconds
                greetingTimeout: 30000, // 30 seconds
            });
            logger.info('Email transporter initialized successfully');
        }
        catch (error: unknown) {
            logger.error('Failed to initialize email transporter', error instanceof Error ? error.message : String(error));
            this.transporter = null;
        }
    }
    /**
     * Send an email notification
     *
     * @param {NotificationPayload} payload - The notification data
     * @returns {Promise<AsyncResult<boolean, Error>>} Result of the send operation
     */
    async send(payload: NotificationPayload): Promise<AsyncResult<boolean, Error>> {
        // Check if adapter should handle this event
        if (!this.isEnabled() || !this.shouldSendEvent(payload.event)) {
            return createSuccessResult(true);
        }
        if (!this.transporter) {
            return createErrorResult(new Error('Email transporter not initialized'));
        }
        try {
            const mailOptions = {
                from: this.formatFromAddress(),
                to: this.config.to.join(', '),
                subject: this.formatSubject(payload),
                text: this.formatTextEmail(payload),
                html: this.formatHtmlEmail(payload),
            };
            const info: unknown = await this.transporter.sendMail(mailOptions);
            const messageId = info && typeof info === 'object' && 'messageId' in info ? info.messageId : undefined;
            const accepted = info && typeof info === 'object' && 'accepted' in info ? info.accepted : undefined;
            const rejected = info && typeof info === 'object' && 'rejected' in info ? info.rejected : undefined;
            logger.info('Email sent successfully', {
                messageId,
                accepted,
                rejected
            });
            return createSuccessResult(true);
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
return createErrorResult(this.createError('Failed to send email', errorMessage));
        }
    }
    /**
     * Test the email configuration by sending a test email
     *
     * @returns {Promise<AsyncResult<NotificationTestResult, Error>>} Test result
     */
    async test(): Promise<AsyncResult<NotificationTestResult, Error>> {
        if (!this.transporter) {
            return createErrorResult(new Error('Email transporter not initialized'));
        }
        try {
            // Verify SMTP connection
            await this.transporter.verify();
            logger.info('SMTP connection verified successfully');
            // Send test email
            const testResult = await this.send({
                title: 'Test Email from Mugiwara Kaizoku',
                body: 'This is a test email to verify your notification settings are working correctly.',
                event: 'UPDATE_AVAILABLE' as NotificationEventType,
                metadata: {
                    test: true,
                    timestamp: new Date().toISOString()
                }
            });
            if (testResult["status"] === 'success') {
                return createSuccessResult({
                    success: true,
                    message: 'Test email sent successfully. Please check your inbox.',
                });
            }
            else if (isError(testResult)) {
                return createErrorResult(testResult.error);
            }
            else {
                return createErrorResult(new Error('Unknown test result status'));
            }
        }
        catch (error: unknown) {const errorMessage = error instanceof Error ? error.message : String(error);
return createErrorResult(this.createError('Email test failed', errorMessage));
        }
    }
    /**
     * Validate the email configuration
     *
     * @returns {AsyncResult<boolean, Error>} Validation result
     */
    validateConfig(): AsyncResult<boolean, Error> {
        // Check required fields
        const requiredFields: (keyof EmailSettings)[] = ['host', 'port', 'from', 'to'];
        const missingFields: string[] = [];
        for (const field of requiredFields) {
            const value = this.config[field as keyof EmailSettings];
            if (value === undefined || value === '') {
                missingFields.push(field);
            }
        }
        if (missingFields.length > 0) {
            return createErrorResult(new Error(`Missing required email configuration: ${missingFields.join(', ')}`));
        }
        // Validate recipient addresses
        if (!Array.isArray(this.config.to) || this.config.to.length === 0) {
            return createErrorResult(new Error('At least one recipient address is required'));
        }
        // Validate email addresses format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(this.config.from)) {
            return createErrorResult(new Error('Invalid from address format'));
        }
        const invalidRecipients = this.config.to.filter((email: string) => !emailRegex.test(email));
        if (invalidRecipients.length > 0) {
            return createErrorResult(new Error(`Invalid recipient email addresses: ${invalidRecipients.join(', ')}`));
        }
        // Validate port number
        if (this.config.port < 1 || this.config.port > 65535) {
            return createErrorResult(new Error('Invalid SMTP port number'));
        }
        return createSuccessResult(true);
    }
    /**
     * Format the from address with optional display name
     *
     * @private
     * @returns {string} Formatted from address
     */
    private formatFromAddress(): string {
        return `"Mugiwara Kaizoku" <${this.config.from}>`;
    }
    /**
     * Format the email subject with event context
     *
     * @private
     * @param {NotificationPayload} payload - The notification payload
     * @returns {string} Formatted subject
     */
    private formatSubject(payload: NotificationPayload): string {
        const emoji = getEventEmoji(payload.event);
        return `${emoji} ${payload["title"]}`;
    }
    /**
     * Format the plain text version of the email
     *
     * @private
     * @param {NotificationPayload} payload - The notification payload
     * @returns {string} Plain text email content
     */
    private formatTextEmail(payload: NotificationPayload): string {
        let text = `${payload["title"]}\n\n${payload.body}`;
        if (payload.url) {
            text += `\n\nView Details: ${payload.url}`;
        }
        text += '\n\n---\nThis notification was sent by Mugiwara Kaizoku';
        return text;
    }
    /**
     * Format the HTML version of the email
     *
     * @private
     * @param {NotificationPayload} payload - The notification payload
     * @returns {string} HTML email content
     */
    private formatHtmlEmail(payload: NotificationPayload): string {
        const accentColorNum = getEventColor(payload.event);
        const accentColor = '#' + accentColorNum.toString(16).padStart(6, '0');
        const footer = payload.url
            ? `<p style="margin-top: 20px;">
          <a href="${payload.url}" style="display: inline-block; padding: 10px 20px; background-color: ${accentColor}; color: white; text-decoration: none; border-radius: 4px;">
            View Details
          </a>
        </p>`
            : '';
        return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background-color: #f5f5f5; border-radius: 8px; padding: 30px;">
              <div style="border-left: 4px solid ${accentColor}; padding-left: 20px;">
                <h2 style="color: #333; margin: 0 0 15px 0; font-size: 24px;">
                  ${payload["title"]}
                </h2>
                <div style="color: #666; line-height: 1.6; font-size: 16px;">
                  ${payload.body.replace(/\n/g, '<br>')}
                </div>
                ${footer}
              </div>
            </div>
            <div style="text-align: center; margin-top: 30px;">
              <p style="color: #999; font-size: 12px;">
                This notification was sent by Mugiwara Kaizoku
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
    }
    /**
     * Wrapper method for compatibility with notification providers
     *
     * @param {NotificationPayload} payload - The notification data
     * @returns {Promise<AsyncResult<boolean, Error>>} Result of the send operation
     */
    async sendNotification(payload: NotificationPayload): Promise<AsyncResult<boolean, Error>> {
        return this.send(payload);
    }
    /**
     * Wrapper method for compatibility with notification providers
     *
     * @returns {Promise<AsyncResult<NotificationTestResult, Error>>} Test result
     */
    async testConnection(): Promise<AsyncResult<NotificationTestResult, Error>> {
        return this.test();
    }
    /**
     * Check if the adapter is configured
     *
     * @returns {boolean} True if configured
     */
    isConfigured(): boolean {
        return this.isEnabled();
    }
}
/**
 * Factory function to create an EmailAdapter instance
 *
 * @param {EmailSettings} config - Email configuration settings
 * @returns {EmailAdapter} New EmailAdapter instance
 */
export function createEmailAdapter(config: EmailSettings): EmailAdapter {
    return new EmailAdapter(config);
}
