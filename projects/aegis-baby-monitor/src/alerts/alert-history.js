/**
 * AlertHistory - Alert history and persistence service
 * Handles storing, retrieving, filtering, and managing alert logs with statistics
 */

const fs = require('fs').promises;
const path = require('path');
const { createLogger } = require('../utils/logger');
const { AlertHistoryFilter, AlertStats } = require('./types');

class AlertHistory {
  constructor(options = {}) {
    this.logger = createLogger('AlertHistory');
    this.dataPath = options.dataPath || path.join(process.cwd(), 'data', 'alert-history');
    this.maxHistoryDays = options.maxHistoryDays || 30; // Keep 30 days of history
    this.batchSize = options.batchSize || 1000; // Batch size for bulk operations
    
    // In-memory cache for recent alerts (last 24 hours)
    this.recentAlerts = [];
    this.cacheMaxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    
    // Statistics cache
    this.statsCache = {
      data: null,
      lastUpdated: null,
      ttl: 5 * 60 * 1000 // 5 minutes
    };
    
    this._ensureDataDirectory();
    this._loadRecentAlerts();
    this._startCleanupInterval();
    
    this.logger.info('AlertHistory initialized');
  }
  
  /**
   * Store alert in history
   * @param {Object} alert - Alert to store
   * @returns {Promise<void>}
   */
  async storeAlert(alert) {
    try {
      // Add to recent cache
      this.recentAlerts.unshift({
        ...alert,
        storedAt: new Date()
      });
      
      // Limit cache size
      if (this.recentAlerts.length > 1000) {
        this.recentAlerts = this.recentAlerts.slice(0, 1000);
      }
      
      // Store to disk
      await this._persistAlert(alert);
      
      // Invalidate stats cache
      this.statsCache.data = null;
      
      this.logger.debug('Alert stored in history', { alertId: alert.id });
      
    } catch (error) {
      this.logger.error('Failed to store alert in history:', error);
      throw error;
    }
  }
  
  /**
   * Retrieve alerts with filtering
   * @param {Object} filter - Alert filter options
   * @returns {Promise<Array>} Filtered alerts
   */
  async getAlerts(filter = {}) {
    try {
      const normalizedFilter = this._normalizeFilter(filter);
      
      // If requesting recent data, use cache
      if (this._isRecentDataRequest(normalizedFilter)) {
        return this._filterAlertsFromCache(normalizedFilter);
      }
      
      // Load from disk for historical data
      return await this._loadAlertsFromDisk(normalizedFilter);
      
    } catch (error) {
      this.logger.error('Failed to retrieve alerts:', error);
      throw error;
    }
  }
  
  /**
   * Get alert by ID
   * @param {string} alertId - Alert ID
   * @returns {Promise<Object|null>} Alert or null if not found
   */
  async getAlertById(alertId) {
    try {
      // Check recent cache first
      const recentAlert = this.recentAlerts.find(alert => alert.id === alertId);
      if (recentAlert) {
        return recentAlert;
      }
      
      // Search in disk files
      return await this._searchAlertInFiles(alertId);
      
    } catch (error) {
      this.logger.error('Failed to get alert by ID:', error);
      throw error;
    }
  }
  
  /**
   * Get alert statistics
   * @param {Object} filter - Optional filter for stats
   * @returns {Promise<Object>} Alert statistics
   */
  async getStatistics(filter = {}) {
    try {
      // Check cache
      if (this.statsCache.data && 
          this.statsCache.lastUpdated && 
          (Date.now() - this.statsCache.lastUpdated) < this.statsCache.ttl) {
        return this.statsCache.data;
      }
      
      // Calculate fresh statistics
      const stats = await this._calculateStatistics(filter);
      
      // Update cache
      this.statsCache.data = stats;
      this.statsCache.lastUpdated = Date.now();
      
      return stats;
      
    } catch (error) {
      this.logger.error('Failed to get statistics:', error);
      throw error;
    }
  }
  
  /**
   * Delete alerts older than specified days
   * @param {number} daysOld - Number of days
   * @returns {Promise<number>} Number of alerts deleted
   */
  async deleteOldAlerts(daysOld = null) {
    try {
      const cutoffDays = daysOld || this.maxHistoryDays;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - cutoffDays);
      
      let deletedCount = 0;
      
      // Clean recent cache
      const initialCacheSize = this.recentAlerts.length;
      this.recentAlerts = this.recentAlerts.filter(alert => 
        new Date(alert.timestamp) > cutoffDate
      );
      deletedCount += initialCacheSize - this.recentAlerts.length;
      
      // Clean disk files
      deletedCount += await this._deleteOldFiles(cutoffDate);
      
      // Invalidate stats cache
      this.statsCache.data = null;
      
      this.logger.info(`Deleted ${deletedCount} old alerts older than ${cutoffDays} days`);
      
      return deletedCount;
      
    } catch (error) {
      this.logger.error('Failed to delete old alerts:', error);
      throw error;
    }
  }
  
  /**
   * Export alert history
   * @param {Object} filter - Export filter
   * @returns {Promise<Object>} Export data
   */
  async exportHistory(filter = {}) {
    try {
      const alerts = await this.getAlerts(filter);
      const stats = await this.getStatistics(filter);
      
      return {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        filter,
        totalAlerts: alerts.length,
        statistics: stats,
        alerts
      };
      
    } catch (error) {
      this.logger.error('Failed to export history:', error);
      throw error;
    }
  }
  
  /**
   * Clear all alert history
   * @returns {Promise<void>}
   */
  async clearHistory() {
    try {
      // Clear cache
      this.recentAlerts = [];
      
      // Remove all data files
      const files = await fs.readdir(this.dataPath);
      const dataFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of dataFiles) {
        await fs.unlink(path.join(this.dataPath, file));
      }
      
      // Invalidate stats cache
      this.statsCache.data = null;
      
      this.logger.info('Alert history cleared');
      
    } catch (error) {
      this.logger.error('Failed to clear history:', error);
      throw error;
    }
  }
  
  /**
   * Get storage information
   * @returns {Promise<Object>} Storage info
   */
  async getStorageInfo() {
    try {
      const files = await fs.readdir(this.dataPath);
      const dataFiles = files.filter(file => file.endsWith('.json'));
      
      let totalSize = 0;
      let totalAlerts = this.recentAlerts.length;
      
      for (const file of dataFiles) {
        const filePath = path.join(this.dataPath, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        
        // Estimate alerts in file (rough calculation)
        const estimatedAlerts = Math.floor(stats.size / 500); // ~500 bytes per alert
        totalAlerts += estimatedAlerts;
      }
      
      return {
        totalFiles: dataFiles.length,
        totalSize: totalSize,
        totalAlertsEstimate: totalAlerts,
        cacheSize: this.recentAlerts.length,
        dataPath: this.dataPath
      };
      
    } catch (error) {
      this.logger.error('Failed to get storage info:', error);
      throw error;
    }
  }
  
  /**
   * Ensure data directory exists
   * @private
   */
  async _ensureDataDirectory() {
    try {
      await fs.mkdir(this.dataPath, { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create data directory:', error);
    }
  }
  
  /**
   * Persist alert to disk
   * @param {Object} alert - Alert to persist
   * @private
   */
  async _persistAlert(alert) {
    try {
      const dateKey = new Date(alert.timestamp).toISOString().split('T')[0]; // YYYY-MM-DD
      const filename = `alerts-${dateKey}.json`;
      const filepath = path.join(this.dataPath, filename);
      
      let alerts = [];
      
      // Load existing alerts for the day
      try {
        const data = await fs.readFile(filepath, 'utf8');
        alerts = JSON.parse(data);
      } catch (error) {
        // File doesn't exist, start with empty array
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
      
      // Add new alert
      alerts.push(alert);
      
      // Sort by timestamp
      alerts.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      // Save back to file
      await fs.writeFile(filepath, JSON.stringify(alerts, null, 2));
      
    } catch (error) {
      this.logger.error('Failed to persist alert:', error);
      throw error;
    }
  }
  
  /**
   * Load recent alerts into cache
   * @private
   */
  async _loadRecentAlerts() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setTime(cutoffDate.getTime() - this.cacheMaxAge);
      
      // Load alerts from recent files
      const files = await fs.readdir(this.dataPath);
      const dataFiles = files.filter(file => file.endsWith('.json'));
      
      const recentAlerts = [];
      
      for (const file of dataFiles) {
        const filePath = path.join(this.dataPath, file);
        
        try {
          const data = await fs.readFile(filePath, 'utf8');
          const alerts = JSON.parse(data);
          
          // Filter recent alerts
          const recent = alerts.filter(alert => 
            new Date(alert.timestamp) > cutoffDate
          );
          
          recentAlerts.push(...recent);
        } catch (error) {
          this.logger.warn(`Failed to load alert file ${file}:`, error);
        }
      }
      
      // Sort by timestamp (newest first)
      recentAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      this.recentAlerts = recentAlerts;
      
      this.logger.info(`Loaded ${this.recentAlerts.length} recent alerts into cache`);
      
    } catch (error) {
      this.logger.error('Failed to load recent alerts:', error);
    }
  }
  
  /**
   * Normalize filter parameters
   * @param {Object} filter - Raw filter
   * @returns {Object} Normalized filter
   * @private
   */
  _normalizeFilter(filter) {
    return {
      types: filter.types || [],
      priorities: filter.priorities || [],
      statuses: filter.statuses || [],
      dateFrom: filter.dateFrom ? new Date(filter.dateFrom) : null,
      dateTo: filter.dateTo ? new Date(filter.dateTo) : null,
      limit: Math.min(filter.limit || 50, 1000), // Max 1000 results
      offset: filter.offset || 0
    };
  }
  
  /**
   * Check if filter requests recent data only
   * @param {Object} filter - Normalized filter
   * @returns {boolean} True if recent data request
   * @private
   */
  _isRecentDataRequest(filter) {
    if (!filter.dateFrom && !filter.dateTo) {
      return true; // No date filter, use cache
    }
    
    const cutoffDate = new Date();
    cutoffDate.setTime(cutoffDate.getTime() - this.cacheMaxAge);
    
    return filter.dateFrom >= cutoffDate;
  }
  
  /**
   * Filter alerts from cache
   * @param {Object} filter - Normalized filter
   * @returns {Array} Filtered alerts
   * @private
   */
  _filterAlertsFromCache(filter) {
    let filtered = this.recentAlerts;
    
    // Apply filters
    if (filter.types.length > 0) {
      filtered = filtered.filter(alert => filter.types.includes(alert.type));
    }
    
    if (filter.priorities.length > 0) {
      filtered = filtered.filter(alert => filter.priorities.includes(alert.priority));
    }
    
    if (filter.statuses.length > 0) {
      filtered = filtered.filter(alert => filter.statuses.includes(alert.status));
    }
    
    if (filter.dateFrom) {
      filtered = filtered.filter(alert => new Date(alert.timestamp) >= filter.dateFrom);
    }
    
    if (filter.dateTo) {
      filtered = filtered.filter(alert => new Date(alert.timestamp) <= filter.dateTo);
    }
    
    // Apply pagination
    const start = filter.offset;
    const end = start + filter.limit;
    
    return filtered.slice(start, end);
  }
  
  /**
   * Load alerts from disk files
   * @param {Object} filter - Normalized filter
   * @returns {Promise<Array>} Filtered alerts
   * @private
   */
  async _loadAlertsFromDisk(filter) {
    try {
      const files = await fs.readdir(this.dataPath);
      const dataFiles = files.filter(file => file.endsWith('.json'));
      
      const allAlerts = [];
      
      for (const file of dataFiles) {
        const filePath = path.join(this.dataPath, file);
        
        try {
          const data = await fs.readFile(filePath, 'utf8');
          const alerts = JSON.parse(data);
          allAlerts.push(...alerts);
        } catch (error) {
          this.logger.warn(`Failed to load alert file ${file}:`, error);
        }
      }
      
      // Sort by timestamp (newest first)
      allAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Apply same filtering as cache
      return this._filterAlertsFromCache.call({ recentAlerts: allAlerts }, filter);
      
    } catch (error) {
      this.logger.error('Failed to load alerts from disk:', error);
      throw error;
    }
  }
  
  /**
   * Search for alert in files by ID
   * @param {string} alertId - Alert ID to search
   * @returns {Promise<Object|null>} Alert or null
   * @private
   */
  async _searchAlertInFiles(alertId) {
    try {
      const files = await fs.readdir(this.dataPath);
      const dataFiles = files.filter(file => file.endsWith('.json'));
      
      for (const file of dataFiles) {
        const filePath = path.join(this.dataPath, file);
        
        try {
          const data = await fs.readFile(filePath, 'utf8');
          const alerts = JSON.parse(data);
          
          const found = alerts.find(alert => alert.id === alertId);
          if (found) {
            return found;
          }
        } catch (error) {
          this.logger.warn(`Failed to search in file ${file}:`, error);
        }
      }
      
      return null;
      
    } catch (error) {
      this.logger.error('Failed to search for alert:', error);
      throw error;
    }
  }
  
  /**
   * Calculate statistics
   * @param {Object} filter - Filter for stats
   * @returns {Promise<Object>} Statistics
   * @private
   */
  async _calculateStatistics(filter) {
    try {
      const alerts = await this.getAlerts({
        ...filter,
        limit: 10000, // Get more data for accurate stats
        offset: 0
      });
      
      const stats = {
        total: alerts.length,
        byType: {},
        byPriority: {},
        byStatus: {},
        deliveryRate: 0,
        averageResponseTime: 0,
        escalationRate: 0,
        timeRange: {
          from: alerts.length > 0 ? alerts[alerts.length - 1].timestamp : null,
          to: alerts.length > 0 ? alerts[0].timestamp : null
        }
      };
      
      if (alerts.length === 0) {
        return stats;
      }
      
      let totalResponseTime = 0;
      let responseTimeCount = 0;
      let deliveredCount = 0;
      let escalatedCount = 0;
      
      // Calculate statistics
      for (const alert of alerts) {
        // By type
        stats.byType[alert.type] = (stats.byType[alert.type] || 0) + 1;
        
        // By priority
        stats.byPriority[alert.priority] = (stats.byPriority[alert.priority] || 0) + 1;
        
        // By status
        stats.byStatus[alert.status] = (stats.byStatus[alert.status] || 0) + 1;
        
        // Delivery rate
        if (alert.status === 'delivered') {
          deliveredCount++;
        }
        
        // Response time
        if (alert.acknowledgedAt) {
          const responseTime = new Date(alert.acknowledgedAt) - new Date(alert.timestamp);
          totalResponseTime += responseTime;
          responseTimeCount++;
        }
        
        // Escalation rate
        if (alert.escalated) {
          escalatedCount++;
        }
      }
      
      stats.deliveryRate = deliveredCount / alerts.length;
      stats.averageResponseTime = responseTimeCount > 0 ? 
        totalResponseTime / responseTimeCount : 0;
      stats.escalationRate = escalatedCount / alerts.length;
      
      return stats;
      
    } catch (error) {
      this.logger.error('Failed to calculate statistics:', error);
      throw error;
    }
  }
  
  /**
   * Delete old files
   * @param {Date} cutoffDate - Cutoff date
   * @returns {Promise<number>} Number of alerts deleted
   * @private
   */
  async _deleteOldFiles(cutoffDate) {
    try {
      const files = await fs.readdir(this.dataPath);
      const dataFiles = files.filter(file => file.endsWith('.json'));
      
      let deletedCount = 0;
      
      for (const file of dataFiles) {
        const filePath = path.join(this.dataPath, file);
        
        try {
          const data = await fs.readFile(filePath, 'utf8');
          const alerts = JSON.parse(data);
          
          const newAlerts = alerts.filter(alert => 
            new Date(alert.timestamp) > cutoffDate
          );
          
          deletedCount += alerts.length - newAlerts.length;
          
          if (newAlerts.length === 0) {
            // Delete entire file
            await fs.unlink(filePath);
          } else if (newAlerts.length !== alerts.length) {
            // Update file with remaining alerts
            await fs.writeFile(filePath, JSON.stringify(newAlerts, null, 2));
          }
          
        } catch (error) {
          this.logger.warn(`Failed to process file ${file} for cleanup:`, error);
        }
      }
      
      return deletedCount;
      
    } catch (error) {
      this.logger.error('Failed to delete old files:', error);
      throw error;
    }
  }
  
  /**
   * Start cleanup interval
   * @private
   */
  _startCleanupInterval() {
    // Run cleanup every 4 hours
    const cleanupInterval = 4 * 60 * 60 * 1000;
    
    setInterval(async () => {
      try {
        await this.deleteOldAlerts();
      } catch (error) {
        this.logger.error('Automatic cleanup failed:', error);
      }
    }, cleanupInterval);
    
    this.logger.info('Alert history cleanup interval started');
  }
}

module.exports = AlertHistory;
