/**
 * Example: Authentication Service with Enhanced Notifications
 * 
 * This example shows how to integrate the enhanced notification system
 * into an existing service (authentication) to demonstrate practical usage.
 */

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { authLogger } from '@/utils/logging/unified-logger';
import { EventType } from '@/server/services/events/eventTypes';
import { NotificationService } from '@/services/notifications/notification-service';

export class AuthenticationService {
  constructor(
    private notificationService: NotificationService
  ) {}

  /**
   * Handle user login with enhanced logging and notifications
   */
  async login(username: string, password: string, ipAddress: string) {
    try {
      // Log login attempt
      authLogger.info('Login attempt', { username, ipAddress });

      // Find user
      const user = await prisma.user.findUnique({
        where: { username }
      });

      if (!user) {
        // Log failed attempt
        authLogger.warn('Login failed - user not found', { username, ipAddress });
        
        // Send notification for failed login
        await this.notificationService.handleSystemEvent(
          EventType.USER_LOGGED_IN,
          'warning',
          'authentication',
          `Failed login attempt for non-existent user: ${username}`,
          { username, ipAddress, reason: 'user_not_found' }
        );

        throw new Error('Invalid credentials');
      }

      // Check password
      const validPassword = await bcrypt.compare(password, user.password);
      
      if (!validPassword) {
        // Log failed attempt
        authLogger.warn('Login failed - invalid password', { username, ipAddress });
        
        // Check for suspicious activity (multiple failures)
        const recentFailures = await this.checkRecentFailures(username, ipAddress);
        
        if (recentFailures > 5) {
          // Critical - possible brute force
          authLogger.critical('Suspicious login activity detected', {
            username,
            ipAddress,
            failureCount: recentFailures
          });
          
          // This will automatically trigger a notification due to CRITICAL level
          await this.notificationService.sendNotification(
            'auth_suspicious_activity',
            `Multiple failed login attempts detected for user ${username} from IP ${ipAddress}`,
            {
              username,
              ipAddress,
              failureCount: recentFailures,
              timestamp: new Date()
            }
          );
        }

        throw new Error('Invalid credentials');
      }

      // Successful login
      authLogger.info('Login successful', { 
        userId: user.id, 
        username, 
        ipAddress 
      });

      // Log the event (notification will be sent based on user preferences)
      authLogger.logEvent(
        EventType.USER_LOGGED_IN,
        `User ${username} logged in successfully`,
        { userId: user.id, username, ipAddress }
      );

      return user;

    } catch (error) {
      // Log error with full context
      authLogger.error('Login process failed', error);
      throw error;
    }
  }

  /**
   * Handle password change with notifications
   */
  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const contextLogger = authLogger.child({ userId });
    
    try {
      contextLogger.info('Password change requested');

      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        contextLogger.error('User not found for password change');
        throw new Error('User not found');
      }

      // Verify old password
      const validPassword = await bcrypt.compare(oldPassword, user.password);
      
      if (!validPassword) {
        contextLogger.warn('Password change failed - invalid current password');
        
        // Notify about failed password change attempt
        await this.notificationService.sendNotification(
          'auth_password_changed',
          `Failed password change attempt for user ${user.username}`,
          {
            userId,
            username: user.username,
            reason: 'invalid_current_password',
            timestamp: new Date()
          }
        );

        throw new Error('Invalid current password');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update password
      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });

      contextLogger.info('Password changed successfully');

      // Send notification about successful password change
      await this.notificationService.sendNotification(
        'auth_password_changed',
        `Password successfully changed for user ${user.username}`,
        {
          userId,
          username: user.username,
          timestamp: new Date()
        }
      );

      return true;

    } catch (error) {
      contextLogger.error('Password change process failed', error);
      throw error;
    }
  }

  /**
   * Handle logout with logging
   */
  async logout(userId: number, sessionId: string) {
    const contextLogger = authLogger.child({ userId, sessionId });
    
    try {
      contextLogger.info('Logout requested');

      // Invalidate session
      await prisma.session.delete({
        where: { id: sessionId }
      });

      // Log the event
      contextLogger.logEvent(
        EventType.USER_LOGGED_OUT,
        `User logged out`,
        { userId, sessionId }
      );

      return true;

    } catch (error) {
      contextLogger.error('Logout process failed', error);
      throw error;
    }
  }

  /**
   * Check recent login failures for suspicious activity detection
   */
  private async checkRecentFailures(username: string, ipAddress: string): Promise<number> {
    // This would query a login attempts table or cache
    // For this example, returning a mock value
    return 0;
  }
}

/**
 * Example usage in API route
 */
export async function createAuthService(notificationService: NotificationService) {
  return new AuthenticationService(notificationService);
}

/**
 * Example: How existing code can be gradually migrated
 */

// OLD CODE:
/*
console.log('Login attempt for user:', username);
if (!validPassword) {
  console.error('Invalid password for user:', username);
}
*/

// NEW CODE (Phase 1 - Just logging):
/*
authLogger.info('Login attempt', { username });
if (!validPassword) {
  authLogger.warn('Invalid password', { username });
}
*/

// NEW CODE (Phase 2 - With notifications):
/*
authLogger.info('Login attempt', { username });
if (!validPassword) {
  authLogger.warn('Invalid password', { username });
  await notificationService.handleSystemEvent(
    EventType.USER_LOGGED_IN,
    'warning',
    'authentication',
    'Failed login attempt',
    { username, reason: 'invalid_password' }
  );
}
*/
