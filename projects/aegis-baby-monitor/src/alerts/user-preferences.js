/**
 * UserPreferences - User preferences and configuration management
 * Handles customizable alert thresholds, notification schedules, channel preferences, and escalation rules
 */

const fs = require('fs').promises;
const path = require('path');
const { createLogger } = require('../utils/logger');
const { UserPreferences: DefaultPreferences, NotificationChannel } = require('./types');

class UserPreferences {
  constructor(options = {}) {
    this.logger = createLogger('UserPreferences');
    this.configPath = options.configPath || path.join(process.cwd(), 'data', 'user-preferences.json');
    this.preferences = { ...DefaultPreferences };
    this.listeners = new Map();
    
    // Ensure data directory exists
    this._ensureDataDirectory();
    
    // Load existing preferences
    this._loadPreferences();
    
    this.logger.info('UserPreferences initialized');
  }
  
  /**
   * Get all user preferences
   * @returns {Object} Complete preferences object
   */
  getPreferences() {
    return { ...this.preferences };
  }
  
  /**
   * Update user preferences
   * @param {Object} updates - Preference updates
   * @returns {Promise<Object>} Updated preferences
   */
  async updatePreferences(updates) {
    try {
      // Merge updates with current preferences
      this.preferences = this._deepMerge(this.preferences, updates);
      
      // Validate preferences
      this._validatePreferences(this.preferences);
      
      // Save to disk
      await this._savePreferences();
      
      // Notify listeners
      this._notifyListeners('updated', this.preferences);
      
      this.logger.info('User preferences updated');
      
      return this.preferences;
      
    } catch (error) {
      this.logger.error('Failed to update preferences:', error);
      throw error;
    }
  }
  
  /**
   * Reset preferences to defaults
   * @returns {Promise<Object>} Reset preferences
   */
  async resetPreferences() {
    try {
      this.preferences = { ...DefaultPreferences };
      await this._savePreferences();
      
      this._notifyListeners('reset', this.preferences);
      
      this.logger.info('User preferences reset to defaults');
      
      return this.preferences;
      
    } catch (error) {
      this.logger.error('Failed to reset preferences:', error);
      throw error;
    }
  }
  
  /**
   * Get do not disturb settings
   * @returns {Object} DND settings
   */
  getDoNotDisturbSettings() {
    return { ...this.preferences.doNotDisturb };
  }
  
  /**
   * Update do not disturb settings
   * @param {Object} dndSettings - DND settings
   * @returns {Promise<Object>} Updated DND settings
   */
  async updateDoNotDisturbSettings(dndSettings) {
    return await this.updatePreferences({
      doNotDisturb: dndSettings
    });
  }
  
  /**
   * Get notification channel settings
   * @param {string} channel - Notification channel
   * @returns {Object} Channel settings
   */
  getChannelSettings(channel) {
    return { ...this.preferences.channels[channel] } || {};
  }
  
  /**
   * Update notification channel settings
   * @param {string} channel - Notification channel
   * @param {Object} settings - Channel settings
   * @returns {Promise<Object>} Updated preferences
   */
  async updateChannelSettings(channel, settings) {
    if (!Object.values(NotificationChannel).includes(channel)) {
      throw new Error(`Invalid notification channel: ${channel}`);
    }
    
    return await this.updatePreferences({
      channels: {
        [channel]: settings
      }
    });
  }
  
  /**
   * Get escalation settings
   * @returns {Object} Escalation settings
   */
  getEscalationSettings() {
    return { ...this.preferences.escalation };
  }
  
  /**
   * Update escalation settings
   * @param {Object} escalationSettings - Escalation settings
   * @returns {Promise<Object>} Updated preferences
   */
  async updateEscalationSettings(escalationSettings) {
    return await this.updatePreferences({
      escalation: escalationSettings
    });
  }
  
  /**
   * Check if currently in do not disturb period
   * @returns {boolean} True if in DND period
   */
  isDoNotDisturbActive() {
    const dnd = this.preferences.doNotDisturb;
    
    if (!dnd.enabled) {
      return false;
    }
    
    // Get current time in user's timezone
    const now = new Date();
    const userTimeZone = dnd.timezone || 'UTC';
    const currentTime = now.toLocaleTimeString('en-US', {
      timeZone: userTimeZone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Check if current time is within DND period
    return this._isTimeInRange(currentTime, dnd.startTime, dnd.endTime);
  }
  
  /**
   * Check if alert should be allowed during DND
   * @param {Object} alert - Alert object
   * @returns {boolean} True if alert should be allowed
   */
  shouldAllowDuringDND(alert) {
    const dnd = this.preferences.doNotDisturb;
    
    if (!this.isDoNotDisturbActive()) {
      return true;
    }
    
    // Allow critical alerts if configured
    return dnd.exceptCritical && alert.priority === 'critical';
  }
  
  /**
   * Get effective notification channels for alert
   * @param {Object} alert - Alert object
   * @returns {Array} Available notification channels
   */
  getEffectiveChannels(alert) {
    const channels = [];
    
    for (const [channelName, settings] of Object.entries(this.preferences.channels)) {
      if (!settings.enabled) {
        continue;
      }
      
      // Check if channel has required configuration
      if (this._isChannelConfigured(channelName, settings)) {
        channels.push(channelName);
      }
    }
    
    return channels;
  }
  
  /**
   * Add preference change listener
   * @param {string} event - Event type (updated, reset)
   * @param {Function} callback - Callback function
   * @returns {string} Listener ID
   */
  addListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Map());
    }
    
    const listenerId = Math.random().toString(36).substring(7);
    this.listeners.get(event).set(listenerId, callback);
    
    return listenerId;
  }
  
  /**
   * Remove preference change listener
   * @param {string} event - Event type
   * @param {string} listenerId - Listener ID
   */
  removeListener(event, listenerId) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(listenerId);
    }
  }
  
  /**
   * Export preferences for backup
   * @returns {Object} Exportable preferences
   */
  exportPreferences() {
    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      preferences: this.preferences
    };
  }
  
  /**
   * Import preferences from backup
   * @param {Object} importData - Imported preferences data
   * @returns {Promise<Object>} Updated preferences
   */
  async importPreferences(importData) {
    try {
      if (!importData.preferences) {
        throw new Error('Invalid import data format');
      }
      
      // Validate imported preferences
      this._validatePreferences(importData.preferences);
      
      this.preferences = { ...importData.preferences };
      await this._savePreferences();
      
      this._notifyListeners('imported', this.preferences);
      
      this.logger.info('Preferences imported successfully');
      
      return this.preferences;
      
    } catch (error) {
      this.logger.error('Failed to import preferences:', error);
      throw error;
    }
  }
  
  /**
   * Ensure data directory exists
   * @private
   */
  async _ensureDataDirectory() {
    try {
      const dataDir = path.dirname(this.configPath);
      await fs.mkdir(dataDir, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create data directory:', error);
    }
  }
  
  /**
   * Load preferences from disk
   * @private
   */
  async _loadPreferences() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      const loadedPrefs = JSON.parse(data);
      
      // Merge with defaults to ensure all properties exist
      this.preferences = this._deepMerge(DefaultPreferences, loadedPrefs);
      
      this.logger.info('User preferences loaded from disk');
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, use defaults
        this.logger.info('No existing preferences found, using defaults');
        await this._savePreferences();
      } else {
        this.logger.error('Failed to load preferences:', error);
      }
    }
  }
  
  /**
   * Save preferences to disk
   * @private
   */
  async _savePreferences() {
    try {
      const data = JSON.stringify(this.preferences, null, 2);
      await fs.writeFile(this.configPath, data, 'utf8');
    } catch (error) {
      this.logger.error('Failed to save preferences:', error);
      throw error;
    }
  }
  
  /**
   * Validate preferences object
   * @param {Object} prefs - Preferences to validate
   * @private
   */
  _validatePreferences(prefs) {
    // Validate DND settings
    if (prefs.doNotDisturb) {
      const dnd = prefs.doNotDisturb;
      if (dnd.startTime && !this._isValidTime(dnd.startTime)) {
        throw new Error('Invalid DND start time format');
      }
      if (dnd.endTime && !this._isValidTime(dnd.endTime)) {
        throw new Error('Invalid DND end time format');
      }
    }
    
    // Validate channel settings
    if (prefs.channels) {
      for (const [channel, settings] of Object.entries(prefs.channels)) {
        if (!Object.values(NotificationChannel).includes(channel)) {
          throw new Error(`Invalid notification channel: ${channel}`);
        }
        
        if (settings.maxFrequency && (settings.maxFrequency < 1 || settings.maxFrequency > 100)) {
          throw new Error(`Invalid max frequency for ${channel}: must be between 1 and 100`);
        }
      }
    }
    
    // Validate escalation settings
    if (prefs.escalation?.timeoutMinutes) {
      const timeout = prefs.escalation.timeoutMinutes;
      if (timeout < 1 || timeout > 60) {
        throw new Error('Escalation timeout must be between 1 and 60 minutes');
      }
    }
  }
  
  /**
   * Check if time format is valid (HH:MM)
   * @param {string} time - Time string
   * @returns {boolean} True if valid
   * @private
   */
  _isValidTime(time) {
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  }
  
  /**
   * Check if current time is in range
   * @param {string} current - Current time (HH:MM)
   * @param {string} start - Start time (HH:MM)
   * @param {string} end - End time (HH:MM)
   * @returns {boolean} True if in range
   * @private
   */
  _isTimeInRange(current, start, end) {
    const currentMinutes = this._timeToMinutes(current);
    const startMinutes = this._timeToMinutes(start);
    const endMinutes = this._timeToMinutes(end);
    
    if (startMinutes <= endMinutes) {
      // Same day range
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Cross-midnight range
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  }
  
  /**
   * Convert time string to minutes since midnight
   * @param {string} time - Time string (HH:MM)
   * @returns {number} Minutes since midnight
   * @private
   */
  _timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
  
  /**
   * Check if notification channel is properly configured
   * @param {string} channel - Channel name
   * @param {Object} settings - Channel settings
   * @returns {boolean} True if configured
   * @private
   */
  _isChannelConfigured(channel, settings) {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return settings.addresses && settings.addresses.length > 0;
      case NotificationChannel.SMS:
        return settings.phoneNumbers && settings.phoneNumbers.length > 0;
      case NotificationChannel.PUSH:
        return settings.deviceTokens && settings.deviceTokens.length > 0;
      case NotificationChannel.WEBHOOK:
        return settings.urls && settings.urls.length > 0;
      default:
        return false;
    }
  }
  
  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   * @private
   */
  _deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this._deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }
  
  /**
   * Notify preference change listeners
   * @param {string} event - Event type
   * @param {Object} data - Event data
   * @private
   */
  _notifyListeners(event, data) {
    if (this.listeners.has(event)) {
      for (const callback of this.listeners.get(event).values()) {
        try {
          callback(data);
        } catch (error) {
          this.logger.error('Error in preference listener:', error);
        }
      }
    }
  }
}

module.exports = UserPreferences;
