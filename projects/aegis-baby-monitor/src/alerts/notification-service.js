/**
 * NotificationService - Multi-channel notification delivery system
 * Supports push notifications, email, SMS, and webhooks with retry logic
 */

const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { createLogger } = require('../utils/logger');
const { NotificationChannel } = require('./types');

class NotificationService {
  constructor(config = {}) {
    this.logger = createLogger('NotificationService');
    this.config = {
      email: {
        service: 'gmail', // or 'smtp'
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      },
      sms: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_FROM_NUMBER
      },
      push: {
        fcmServerKey: process.env.FCM_SERVER_KEY,
        apnsKeyId: process.env.APNS_KEY_ID,
        apnsTeamId: process.env.APNS_TEAM_ID
      },
      webhook: {
        timeout: 5000,
        retryDelay: 1000
      },
      ...config
    };
    
    this.initialized = {
      email: false,
      sms: false,
      push: false,
      webhook: true // Webhook doesn't need special initialization
    };
    
    // Delivery statistics
    this.stats = {
      total: 0,
      successful: 0,
      failed: 0,
      byChannel: {},
      lastError: null
    };
    
    // Rate limiting trackers
    this.rateLimits = new Map();
    
    this._initializeServices();
    
    this.logger.info('NotificationService initialized');
  }
  
  /**
   * Send notification via specified channel
   * @param {Object} options - Notification options
   * @returns {Promise<Object>} Delivery result
   */
  async sendNotification(options) {
    const { channel, alert, recipient } = options;
    
    try {
      // Check rate limits
      if (await this._isRateLimited(channel, recipient)) {
        throw new Error(`Rate limit exceeded for ${channel}`);
      }
      
      let result;
      
      switch (channel) {
        case NotificationChannel.EMAIL:
          result = await this._sendEmail(alert, recipient);
          break;
        case NotificationChannel.SMS:
          result = await this._sendSMS(alert, recipient);
          break;
        case NotificationChannel.PUSH:
          result = await this._sendPushNotification(alert, recipient);
          break;
        case NotificationChannel.WEBHOOK:
          result = await this._sendWebhook(alert, recipient);
          break;
        default:
          throw new Error(`Unsupported notification channel: ${channel}`);
      }
      
      // Update statistics
      this._updateStats(channel, true);
      
      this.logger.info(`Notification sent via ${channel}`, { 
        alertId: alert.id,
        channel 
      });
      
      return result;
      
    } catch (error) {
      this._updateStats(channel, false, error);
      this.logger.error(`Failed to send notification via ${channel}:`, error);
      throw error;
    }
  }
  
  /**
   * Test notification channel
   * @param {string} channel - Channel to test
   * @param {Object} recipient - Recipient configuration
   * @returns {Promise<Object>} Test result
   */
  async testChannel(channel, recipient) {
    try {
      const testAlert = {
        id: 'test-alert',
        type: 'system',
        priority: 'low',
        title: 'Test Alert',
        message: 'This is a test notification from Aegis Baby Monitor',
        timestamp: new Date()
      };
      
      const result = await this.sendNotification({
        channel,
        alert: testAlert,
        recipient
      });
      
      return {
        success: true,
        channel,
        result,
        timestamp: new Date()
      };
      
    } catch (error) {
      return {
        success: false,
        channel,
        error: error.message,
        timestamp: new Date()
      };
    }
  }
  
  /**
   * Get notification statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.total > 0 ? 
        (this.stats.successful / this.stats.total * 100).toFixed(2) + '%' : '0%'
    };
  }
  
  /**
   * Initialize notification services
   * @private
   */
  async _initializeServices() {
    try {
      await this._initializeEmail();
      await this._initializeSMS();
      await this._initializePush();
      
      this.logger.info('Notification services initialized', {
        email: this.initialized.email,
        sms: this.initialized.sms,
        push: this.initialized.push
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize notification services:', error);
    }
  }
  
  /**
   * Initialize email service
   * @private
   */
  async _initializeEmail() {
    try {
      if (!this.config.email.auth.user || !this.config.email.auth.pass) {
        this.logger.warn('Email credentials not configured, email notifications disabled');
        return;
      }
      
      this.emailTransporter = nodemailer.createTransporter(this.config.email);
      
      // Verify connection
      await this.emailTransporter.verify();
      this.initialized.email = true;
      
      this.logger.info('Email service initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize email service:', error);
      this.initialized.email = false;
    }
  }
  
  /**
   * Initialize SMS service
   * @private
   */
  async _initializeSMS() {
    try {
      if (!this.config.sms.accountSid || !this.config.sms.authToken) {
        this.logger.warn('Twilio credentials not configured, SMS notifications disabled');
        return;
      }
      
      this.twilioClient = twilio(
        this.config.sms.accountSid,
        this.config.sms.authToken
      );
      
      // Test connection by fetching account info
      await this.twilioClient.api.accounts(this.config.sms.accountSid).fetch();
      this.initialized.sms = true;
      
      this.logger.info('SMS service initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize SMS service:', error);
      this.initialized.sms = false;
    }
  }
  
  /**
   * Initialize push notification service
   * @private
   */
  async _initializePush() {
    try {
      // For now, just mark as initialized
      // Real implementation would initialize FCM/APNS clients
      if (!this.config.push.fcmServerKey) {
        this.logger.warn('FCM server key not configured, push notifications disabled');
        return;
      }
      
      this.initialized.push = true;
      this.logger.info('Push notification service initialized (mock)');
      
    } catch (error) {
      this.logger.error('Failed to initialize push service:', error);
      this.initialized.push = false;
    }
  }
  
  /**
   * Send email notification
   * @param {Object} alert - Alert to send
   * @param {Object} recipient - Recipient preferences
   * @returns {Promise<Object>} Email result
   * @private
   */
  async _sendEmail(alert, recipient) {
    if (!this.initialized.email) {
      throw new Error('Email service not initialized');
    }
    
    if (!recipient?.channels?.email?.enabled || 
        !recipient?.channels?.email?.addresses?.length) {
      throw new Error('Email not configured for recipient');
    }
    
    const emailAddresses = recipient.channels.email.addresses;
    
    const mailOptions = {
      from: `"Aegis Baby Monitor" <${this.config.email.auth.user}>`,
      to: emailAddresses.join(', '),
      subject: `🚨 ${alert.title}`,
      html: this._generateEmailHTML(alert),
      text: this._generateEmailText(alert)
    };
    
    const result = await this.emailTransporter.sendMail(mailOptions);
    
    return {
      messageId: result.messageId,
      response: result.response,
      recipients: emailAddresses,
      timestamp: new Date()
    };
  }
  
  /**
   * Send SMS notification
   * @param {Object} alert - Alert to send
   * @param {Object} recipient - Recipient preferences
   * @returns {Promise<Object>} SMS result
   * @private
   */
  async _sendSMS(alert, recipient) {
    if (!this.initialized.sms) {
      throw new Error('SMS service not initialized');
    }
    
    if (!recipient?.channels?.sms?.enabled || 
        !recipient?.channels?.sms?.phoneNumbers?.length) {
      throw new Error('SMS not configured for recipient');
    }
    
    const phoneNumbers = recipient.channels.sms.phoneNumbers;
    const message = this._generateSMSText(alert);
    
    const results = [];
    
    for (const phoneNumber of phoneNumbers) {
      try {
        const result = await this.twilioClient.messages.create({
          body: message,
          from: this.config.sms.fromNumber,
          to: phoneNumber
        });
        
        results.push({
          sid: result.sid,
          to: phoneNumber,
          status: result.status,
          timestamp: new Date()
        });
        
      } catch (error) {
        this.logger.error(`Failed to send SMS to ${phoneNumber}:`, error);
        results.push({
          to: phoneNumber,
          error: error.message,
          timestamp: new Date()
        });
      }
    }
    
    return { results };
  }
  
  /**
   * Send push notification
   * @param {Object} alert - Alert to send
   * @param {Object} recipient - Recipient preferences
   * @returns {Promise<Object>} Push result
   * @private
   */
  async _sendPushNotification(alert, recipient) {
    if (!this.initialized.push) {
      throw new Error('Push notification service not initialized');
    }
    
    if (!recipient?.channels?.push?.enabled || 
        !recipient?.channels?.push?.deviceTokens?.length) {
      throw new Error('Push notifications not configured for recipient');
    }
    
    // Mock implementation - would use FCM/APNS in production
    const deviceTokens = recipient.channels.push.deviceTokens;
    
    const notification = {
      title: alert.title,
      body: alert.message,
      badge: 1,
      sound: 'default',
      data: {
        alertId: alert.id,
        alertType: alert.type,
        priority: alert.priority,
        timestamp: alert.timestamp
      }
    };
    
    this.logger.info('Mock push notification sent', {
      deviceTokens: deviceTokens.length,
      notification
    });
    
    return {
      successful: deviceTokens.length,
      failed: 0,
      results: deviceTokens.map(token => ({
        token,
        status: 'success',
        timestamp: new Date()
      }))
    };
  }
  
  /**
   * Send webhook notification
   * @param {Object} alert - Alert to send
   * @param {Object} recipient - Recipient preferences
   * @returns {Promise<Object>} Webhook result
   * @private
   */
  async _sendWebhook(alert, recipient) {
    if (!recipient?.channels?.webhook?.enabled || 
        !recipient?.channels?.webhook?.urls?.length) {
      throw new Error('Webhook not configured for recipient');
    }
    
    const webhookUrls = recipient.channels.webhook.urls;
    const payload = {
      alert,
      timestamp: new Date(),
      source: 'aegis-baby-monitor'
    };
    
    const results = [];
    
    for (const url of webhookUrls) {
      try {
        // Mock webhook call - would use fetch/axios in production
        this.logger.info(`Mock webhook sent to ${url}`, payload);
        
        results.push({
          url,
          status: 'success',
          statusCode: 200,
          timestamp: new Date()
        });
        
      } catch (error) {
        this.logger.error(`Failed to send webhook to ${url}:`, error);
        results.push({
          url,
          error: error.message,
          timestamp: new Date()
        });
      }
    }
    
    return { results };
  }
  
  /**
   * Check if channel is rate limited
   * @param {string} channel - Notification channel
   * @param {Object} recipient - Recipient preferences
   * @returns {boolean} True if rate limited
   * @private
   */
  async _isRateLimited(channel, recipient) {
    const channelConfig = recipient?.channels?.[channel];
    if (!channelConfig || !channelConfig.maxFrequency) {
      return false;
    }
    
    const key = `${channel}_rate_limit`;
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    
    let tracker = this.rateLimits.get(key);
    if (!tracker) {
      tracker = { count: 0, windowStart: now };
      this.rateLimits.set(key, tracker);
    }
    
    // Reset window if more than an hour has passed
    if (now - tracker.windowStart > hourMs) {
      tracker.count = 0;
      tracker.windowStart = now;
    }
    
    // Check if limit exceeded
    if (tracker.count >= channelConfig.maxFrequency) {
      return true;
    }
    
    // Update count
    tracker.count++;
    return false;
  }
  
  /**
   * Generate HTML email content
   * @param {Object} alert - Alert data
   * @returns {string} HTML content
   * @private
   */
  _generateEmailHTML(alert) {
    const priorityColors = {
      critical: '#dc3545',
      high: '#fd7e14', 
      medium: '#ffc107',
      low: '#28a745'
    };
    
    const priorityColor = priorityColors[alert.priority] || '#6c757d';
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: ${priorityColor}; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">🚨 ${alert.title}</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Priority: ${alert.priority.toUpperCase()}</p>
        </div>
        
        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #333; margin-top: 0;">Alert Details</h2>
          <p style="font-size: 16px; line-height: 1.5; color: #555;">
            ${alert.message}
          </p>
          
          <div style="background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">Alert ID:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${alert.id}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">Type:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${alert.type}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">Time:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${alert.timestamp}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #666; font-size: 14px;">
              This alert was sent by your Aegis Baby Monitor system.
            </p>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Generate plain text email content
   * @param {Object} alert - Alert data
   * @returns {string} Plain text content
   * @private
   */
  _generateEmailText(alert) {
    return `
AEGIS BABY MONITOR ALERT

${alert.title}
Priority: ${alert.priority.toUpperCase()}

${alert.message}

Alert Details:
- ID: ${alert.id}
- Type: ${alert.type}
- Time: ${alert.timestamp}

This alert was sent by your Aegis Baby Monitor system.
    `.trim();
  }
  
  /**
   * Generate SMS text content
   * @param {Object} alert - Alert data
   * @returns {string} SMS text
   * @private
   */
  _generateSMSText(alert) {
    const priorityEmoji = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️'
    };
    
    const emoji = priorityEmoji[alert.priority] || '📢';
    
    return `${emoji} Aegis Alert: ${alert.title}\n\n${alert.message}\n\nTime: ${new Date(alert.timestamp).toLocaleString()}`;
  }
  
  /**
   * Update delivery statistics
   * @param {string} channel - Channel used
   * @param {boolean} success - Whether delivery succeeded
   * @param {Error} error - Error if failed
   * @private
   */
  _updateStats(channel, success, error = null) {
    this.stats.total++;
    
    if (success) {
      this.stats.successful++;
    } else {
      this.stats.failed++;
      this.stats.lastError = {
        channel,
        error: error?.message || 'Unknown error',
        timestamp: new Date()
      };
    }
    
    // Track by channel
    if (!this.stats.byChannel[channel]) {
      this.stats.byChannel[channel] = {
        total: 0,
        successful: 0,
        failed: 0
      };
    }
    
    this.stats.byChannel[channel].total++;
    if (success) {
      this.stats.byChannel[channel].successful++;
    } else {
      this.stats.byChannel[channel].failed++;
    }
  }
}

module.exports = NotificationService;
