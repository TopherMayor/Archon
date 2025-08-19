/**
 * AlertManager - Core intelligent alert processing system
 * Handles alert creation, processing, priority management, and escalation logic
 */

const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../utils/logger');
const {
  AlertType,
  AlertPriority, 
  AlertStatus,
  NotificationChannel,
  AlertConfig
} = require('./types');

class AlertManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = createLogger('AlertManager');
    this.config = {
      ...AlertConfig,
      ...options.config
    };
    
    // Active alerts storage (in-memory for now)
    this.activeAlerts = new Map();
    this.alertHistory = [];
    this.cooldownTrackers = new Map();
    this.escalationTimers = new Map();
    
    // Statistics tracking
    this.stats = {
      totalAlerts: 0,
      alertsByType: {},
      alertsByPriority: {},
      escalationCount: 0,
      averageResponseTime: 0
    };
    
    // Notification service will be injected
    this.notificationService = null;
    this.userPreferences = null;
    
    this.logger.info('AlertManager initialized');
  }
  
  /**
   * Set notification service dependency
   * @param {NotificationService} service 
   */
  setNotificationService(service) {
    this.notificationService = service;
    this.logger.info('Notification service attached to AlertManager');
  }
  
  /**
   * Set user preferences dependency
   * @param {UserPreferences} preferences 
   */
  setUserPreferences(preferences) {
    this.userPreferences = preferences;
    this.logger.info('User preferences attached to AlertManager');
  }
  
  /**
   * Create and process a new alert
   * @param {Object} alertData - Alert information
   * @returns {Object} Created alert
   */
  async createAlert(alertData) {
    try {
      const alert = this._buildAlert(alertData);
      
      // Check if alert should be suppressed (cooldown, DND, etc.)
      if (await this._shouldSuppressAlert(alert)) {
        this.logger.debug(`Alert suppressed: ${alert.type}`, { alertId: alert.id });
        return null;
      }
      
      // Store alert
      this.activeAlerts.set(alert.id, alert);
      this.alertHistory.push(alert);
      this._updateStats(alert);
      
      // Start processing
      await this._processAlert(alert);
      
      // Set up escalation timer if needed
      this._setupEscalationTimer(alert);
      
      // Update cooldown tracker
      this._updateCooldownTracker(alert.type);
      
      this.logger.info(`Alert created: ${alert.type}`, { 
        alertId: alert.id,
        priority: alert.priority 
      });
      
      // Emit alert created event
      this.emit('alertCreated', alert);
      
      return alert;
      
    } catch (error) {
      this.logger.error('Failed to create alert:', error);
      throw error;
    }
  }
  
  /**
   * Acknowledge an alert
   * @param {string} alertId - Alert ID
   * @param {string} userId - User acknowledging the alert
   */
  async acknowledgeAlert(alertId, userId = 'system') {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        throw new Error(`Alert not found: ${alertId}`);
      }
      
      if (alert.status === AlertStatus.ACKNOWLEDGED) {
        this.logger.warn(`Alert already acknowledged: ${alertId}`);
        return alert;
      }
      
      alert.status = AlertStatus.ACKNOWLEDGED;
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = userId;
      
      // Clear escalation timer
      if (this.escalationTimers.has(alertId)) {
        clearTimeout(this.escalationTimers.get(alertId));
        this.escalationTimers.delete(alertId);
      }
      
      this.logger.info(`Alert acknowledged: ${alertId}`, { userId });
      
      // Emit acknowledgment event
      this.emit('alertAcknowledged', alert);
      
      return alert;
      
    } catch (error) {
      this.logger.error('Failed to acknowledge alert:', error);
      throw error;
    }
  }
  
  /**
   * Resolve an alert
   * @param {string} alertId - Alert ID
   * @param {string} userId - User resolving the alert
   */
  async resolveAlert(alertId, userId = 'system') {
    try {
      const alert = this.activeAlerts.get(alertId);
      if (!alert) {
        throw new Error(`Alert not found: ${alertId}`);
      }
      
      alert.status = AlertStatus.RESOLVED;
      alert.resolvedAt = new Date();
      alert.resolvedBy = userId;
      
      // Remove from active alerts
      this.activeAlerts.delete(alertId);
      
      // Clear any timers
      if (this.escalationTimers.has(alertId)) {
        clearTimeout(this.escalationTimers.get(alertId));
        this.escalationTimers.delete(alertId);
      }
      
      this.logger.info(`Alert resolved: ${alertId}`, { userId });
      
      // Emit resolution event
      this.emit('alertResolved', alert);
      
      return alert;
      
    } catch (error) {
      this.logger.error('Failed to resolve alert:', error);
      throw error;
    }
  }
  
  /**
   * Get active alerts
   * @returns {Array} Active alerts
   */
  getActiveAlerts() {
    return Array.from(this.activeAlerts.values())
      .sort((a, b) => {
        // Sort by priority and timestamp
        const priorityOrder = {
          [AlertPriority.CRITICAL]: 4,
          [AlertPriority.HIGH]: 3,
          [AlertPriority.MEDIUM]: 2,
          [AlertPriority.LOW]: 1
        };
        
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
  }
  
  /**
   * Get alert statistics
   * @returns {Object} Alert statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeAlertsCount: this.activeAlerts.size,
      totalHistoryCount: this.alertHistory.length
    };
  }
  
  /**
   * Update alert configuration
   * @param {Object} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Alert configuration updated');
    this.emit('configUpdated', this.config);
  }
  
  /**
   * Build alert object from input data
   * @param {Object} alertData - Input alert data
   * @returns {Object} Complete alert object
   * @private
   */
  _buildAlert(alertData) {
    const alertId = uuidv4();
    const timestamp = new Date();
    
    // Get configuration for this alert type
    const typeConfig = this.config[alertData.type] || {};
    
    return {
      id: alertId,
      type: alertData.type,
      priority: alertData.priority || typeConfig.priority || AlertPriority.MEDIUM,
      status: AlertStatus.PENDING,
      title: alertData.title || this._generateAlertTitle(alertData.type),
      message: alertData.message || this._generateAlertMessage(alertData.type, alertData),
      metadata: alertData.metadata || {},
      sourceData: alertData.sourceData || {},
      timestamp,
      acknowledgedAt: null,
      resolvedAt: null,
      deliveryAttempts: [],
      escalated: false,
      escalatedAt: null
    };
  }
  
  /**
   * Check if alert should be suppressed
   * @param {Object} alert - Alert to check
   * @returns {boolean} True if should be suppressed
   * @private
   */
  async _shouldSuppressAlert(alert) {
    // Check cooldown period
    if (this._isInCooldownPeriod(alert.type)) {
      return true;
    }
    
    // Check do not disturb settings
    if (await this._isDuringDoNotDisturb(alert)) {
      return true;
    }
    
    // Check if alert type is disabled
    const typeConfig = this.config[alert.type];
    if (typeConfig && !typeConfig.enabled) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Process alert - send notifications
   * @param {Object} alert - Alert to process
   * @private
   */
  async _processAlert(alert) {
    try {
      alert.status = AlertStatus.PROCESSING;
      
      if (!this.notificationService) {
        this.logger.warn('No notification service available');
        alert.status = AlertStatus.FAILED;
        return;
      }
      
      // Get notification channels for this alert type
      const typeConfig = this.config[alert.type] || {};
      const channels = typeConfig.channels || [NotificationChannel.PUSH];
      
      // Send notifications
      for (const channel of channels) {
        try {
          await this._sendNotification(alert, channel);
        } catch (error) {
          this.logger.error(`Failed to send notification via ${channel}:`, error);
        }
      }
      
      alert.status = AlertStatus.DELIVERED;
      this.emit('alertProcessed', alert);
      
    } catch (error) {
      alert.status = AlertStatus.FAILED;
      this.logger.error('Failed to process alert:', error);
    }
  }
  
  /**
   * Send notification via specific channel
   * @param {Object} alert - Alert to send
   * @param {string} channel - Notification channel
   * @private
   */
  async _sendNotification(alert, channel) {
    const deliveryAttempt = {
      id: uuidv4(),
      channel,
      status: 'pending',
      timestamp: new Date(),
      error: null,
      responseData: {}
    };
    
    alert.deliveryAttempts.push(deliveryAttempt);
    
    try {
      const result = await this.notificationService.sendNotification({
        channel,
        alert,
        recipient: this.userPreferences
      });
      
      deliveryAttempt.status = 'success';
      deliveryAttempt.responseData = result;
      
      this.logger.debug(`Notification sent via ${channel}`, { 
        alertId: alert.id,
        channel 
      });
      
    } catch (error) {
      deliveryAttempt.status = 'failed';
      deliveryAttempt.error = error.message;
      this.logger.error(`Notification failed via ${channel}:`, error);
      throw error;
    }
  }
  
  /**
   * Setup escalation timer for alert
   * @param {Object} alert - Alert to setup escalation for
   * @private
   */
  _setupEscalationTimer(alert) {
    if (!this.userPreferences || !this.userPreferences.escalation?.enabled) {
      return;
    }
    
    const timeoutMinutes = this.userPreferences.escalation.timeoutMinutes || 5;
    const timeoutMs = timeoutMinutes * 60 * 1000;
    
    const timer = setTimeout(async () => {
      try {
        await this._escalateAlert(alert);
      } catch (error) {
        this.logger.error('Failed to escalate alert:', error);
      }
    }, timeoutMs);
    
    this.escalationTimers.set(alert.id, timer);
  }
  
  /**
   * Escalate alert if not acknowledged
   * @param {Object} alert - Alert to escalate
   * @private
   */
  async _escalateAlert(alert) {
    if (alert.status === AlertStatus.ACKNOWLEDGED || 
        alert.status === AlertStatus.RESOLVED) {
      return;
    }
    
    alert.escalated = true;
    alert.escalatedAt = new Date();
    this.stats.escalationCount++;
    
    this.logger.warn(`Escalating alert: ${alert.id}`, { 
      type: alert.type,
      priority: alert.priority 
    });
    
    // Send escalation notifications
    const escalateChannels = this.userPreferences.escalation?.escalateChannels || 
                           [NotificationChannel.SMS, NotificationChannel.EMAIL];
    
    for (const channel of escalateChannels) {
      try {
        await this._sendNotification(alert, channel);
      } catch (error) {
        this.logger.error(`Failed to send escalation via ${channel}:`, error);
      }
    }
    
    this.emit('alertEscalated', alert);
  }
  
  /**
   * Check if alert type is in cooldown period
   * @param {string} alertType - Alert type to check
   * @returns {boolean} True if in cooldown
   * @private
   */
  _isInCooldownPeriod(alertType) {
    const tracker = this.cooldownTrackers.get(alertType);
    if (!tracker) return false;
    
    const typeConfig = this.config[alertType];
    if (!typeConfig || !typeConfig.cooldownMinutes) return false;
    
    const cooldownMs = typeConfig.cooldownMinutes * 60 * 1000;
    return (Date.now() - tracker.lastAlert) < cooldownMs;
  }
  
  /**
   * Update cooldown tracker for alert type
   * @param {string} alertType - Alert type
   * @private
   */
  _updateCooldownTracker(alertType) {
    this.cooldownTrackers.set(alertType, {
      lastAlert: Date.now(),
      count: (this.cooldownTrackers.get(alertType)?.count || 0) + 1
    });
  }
  
  /**
   * Check if currently during do not disturb period
   * @param {Object} alert - Alert to check
   * @returns {boolean} True if during DND
   * @private
   */
  async _isDuringDoNotDisturb(alert) {
    if (!this.userPreferences?.doNotDisturb?.enabled) {
      return false;
    }
    
    const dnd = this.userPreferences.doNotDisturb;
    
    // Allow critical alerts during DND if configured
    if (dnd.exceptCritical && alert.priority === AlertPriority.CRITICAL) {
      return false;
    }
    
    // Check if current time is within DND period
    // This is a simplified check - real implementation would handle timezones properly
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5); // HH:MM format
    
    return currentTime >= dnd.startTime && currentTime <= dnd.endTime;
  }
  
  /**
   * Generate alert title based on type
   * @param {string} alertType - Alert type
   * @returns {string} Alert title
   * @private
   */
  _generateAlertTitle(alertType) {
    const titles = {
      [AlertType.MOTION]: 'Motion Detected',
      [AlertType.SOUND]: 'Loud Sound Detected', 
      [AlertType.CRY_DETECTED]: 'Baby Crying Detected',
      [AlertType.NOISE_LEVEL]: 'High Noise Level',
      [AlertType.SYSTEM]: 'System Alert',
      [AlertType.CONNECTION]: 'Connection Issue',
      [AlertType.CAMERA]: 'Camera Issue',
      [AlertType.STORAGE]: 'Storage Issue'
    };
    
    return titles[alertType] || 'Unknown Alert';
  }
  
  /**
   * Generate alert message based on type and data
   * @param {string} alertType - Alert type
   * @param {Object} alertData - Alert data
   * @returns {string} Alert message
   * @private
   */
  _generateAlertMessage(alertType, alertData) {
    const timestamp = new Date().toLocaleString();
    
    switch (alertType) {
      case AlertType.MOTION:
        return `Motion detected in baby's room at ${timestamp}`;
      case AlertType.SOUND:
        return `Loud sound detected (${alertData.volume || 'N/A'} dB) at ${timestamp}`;
      case AlertType.CRY_DETECTED:
        return `Baby crying detected with ${Math.round((alertData.confidence || 0) * 100)}% confidence at ${timestamp}`;
      case AlertType.NOISE_LEVEL:
        return `Noise level exceeded threshold at ${timestamp}`;
      case AlertType.SYSTEM:
        return `System issue detected: ${alertData.details || 'Unknown'} at ${timestamp}`;
      case AlertType.CONNECTION:
        return `Connection issue detected at ${timestamp}`;
      case AlertType.CAMERA:
        return `Camera issue: ${alertData.details || 'Unknown'} at ${timestamp}`;
      case AlertType.STORAGE:
        return `Storage issue: ${alertData.details || 'Low disk space'} at ${timestamp}`;
      default:
        return `Alert triggered at ${timestamp}`;
    }
  }
  
  /**
   * Update statistics
   * @param {Object} alert - Alert to track
   * @private
   */
  _updateStats(alert) {
    this.stats.totalAlerts++;
    
    // Track by type
    this.stats.alertsByType[alert.type] = 
      (this.stats.alertsByType[alert.type] || 0) + 1;
    
    // Track by priority
    this.stats.alertsByPriority[alert.priority] = 
      (this.stats.alertsByPriority[alert.priority] || 0) + 1;
  }
  
  /**
   * Clean up resources
   */
  destroy() {
    // Clear all timers
    for (const timer of this.escalationTimers.values()) {
      clearTimeout(timer);
    }
    this.escalationTimers.clear();
    
    // Clear alerts
    this.activeAlerts.clear();
    this.alertHistory = [];
    this.cooldownTrackers.clear();
    
    this.logger.info('AlertManager destroyed');
  }
}

module.exports = AlertManager;
