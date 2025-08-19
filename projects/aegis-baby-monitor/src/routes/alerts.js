/**
 * Alert Management API Routes
 * REST API endpoints for alert configuration, history, and testing
 */

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { AlertType, AlertPriority, NotificationChannel } = require('../alerts/types');

/**
 * Create alert routes
 * @param {Object} services - Alert system services
 * @returns {Router} Express router
 */
function createAlertRoutes(services) {
  const router = express.Router();
  const { alertManager, notificationService, userPreferences, alertHistory } = services;

  // Validation middleware
  const validateAlert = [
    body('type').isIn(Object.values(AlertType)).withMessage('Invalid alert type'),
    body('priority').optional().isIn(Object.values(AlertPriority)).withMessage('Invalid priority'),
    body('title').optional().isString().isLength({ min: 1, max: 100 }).withMessage('Title must be 1-100 characters'),
    body('message').optional().isString().isLength({ min: 1, max: 500 }).withMessage('Message must be 1-500 characters')
  ];

  const validateChannel = [
    body('channel').isIn(Object.values(NotificationChannel)).withMessage('Invalid notification channel')
  ];

  const validatePreferences = [
    body('doNotDisturb.enabled').optional().isBoolean(),
    body('doNotDisturb.startTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (HH:MM)'),
    body('doNotDisturb.endTime').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (HH:MM)'),
    body('escalation.timeoutMinutes').optional().isInt({ min: 1, max: 60 }).withMessage('Timeout must be 1-60 minutes')
  ];

  // Error handling middleware
  const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }
    next();
  };

  // ======================
  // ALERT MANAGEMENT
  // ======================

  /**
   * GET /api/alerts/active
   * Get active alerts
   */
  router.get('/active', async (req, res) => {
    try {
      const alerts = alertManager.getActiveAlerts();
      
      res.json({
        success: true,
        data: {
          alerts,
          count: alerts.length
        }
      });
    } catch (error) {
      logger.error('Failed to get active alerts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve active alerts'
      });
    }
  });

  /**
   * POST /api/alerts
   * Create a new alert (for testing)
   */
  router.post('/', validateAlert, handleValidationErrors, async (req, res) => {
    try {
      const { type, priority, title, message, metadata, sourceData } = req.body;
      
      const alert = await alertManager.createAlert({
        type,
        priority,
        title,
        message,
        metadata: metadata || {},
        sourceData: sourceData || {}
      });

      if (!alert) {
        return res.status(200).json({
          success: true,
          message: 'Alert was suppressed due to current settings',
          suppressed: true
        });
      }

      res.status(201).json({
        success: true,
        data: alert
      });
    } catch (error) {
      logger.error('Failed to create alert:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create alert'
      });
    }
  });

  /**
   * POST /api/alerts/:id/acknowledge
   * Acknowledge an alert
   */
  router.post('/:id/acknowledge', async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.body.userId || 'api-user';
      
      const alert = await alertManager.acknowledgeAlert(id, userId);
      
      res.json({
        success: true,
        data: alert
      });
    } catch (error) {
      logger.error('Failed to acknowledge alert:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/alerts/:id/resolve
   * Resolve an alert
   */
  router.post('/:id/resolve', async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.body.userId || 'api-user';
      
      const alert = await alertManager.resolveAlert(id, userId);
      
      res.json({
        success: true,
        data: alert
      });
    } catch (error) {
      logger.error('Failed to resolve alert:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/alerts/stats
   * Get alert statistics
   */
  router.get('/stats', async (req, res) => {
    try {
      const stats = alertManager.getStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get alert stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alert statistics'
      });
    }
  });

  // ======================
  // ALERT HISTORY
  // ======================

  /**
   * GET /api/alerts/history
   * Get alert history with filtering
   */
  router.get('/history', [
    query('types').optional().isString(),
    query('priorities').optional().isString(),
    query('statuses').optional().isString(),
    query('dateFrom').optional().isISO8601(),
    query('dateTo').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('offset').optional().isInt({ min: 0 })
  ], handleValidationErrors, async (req, res) => {
    try {
      const filter = {
        types: req.query.types ? req.query.types.split(',') : [],
        priorities: req.query.priorities ? req.query.priorities.split(',') : [],
        statuses: req.query.statuses ? req.query.statuses.split(',') : [],
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom) : null,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo) : null,
        limit: parseInt(req.query.limit) || 50,
        offset: parseInt(req.query.offset) || 0
      };

      const alerts = await alertHistory.getAlerts(filter);
      
      res.json({
        success: true,
        data: {
          alerts,
          count: alerts.length,
          filter
        }
      });
    } catch (error) {
      logger.error('Failed to get alert history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alert history'
      });
    }
  });

  /**
   * GET /api/alerts/history/:id
   * Get specific alert by ID
   */
  router.get('/history/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const alert = await alertHistory.getAlertById(id);
      
      if (!alert) {
        return res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
      }

      res.json({
        success: true,
        data: alert
      });
    } catch (error) {
      logger.error('Failed to get alert by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alert'
      });
    }
  });

  /**
   * GET /api/alerts/history/stats
   * Get historical alert statistics
   */
  router.get('/history/stats', async (req, res) => {
    try {
      const stats = await alertHistory.getStatistics();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get history stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve history statistics'
      });
    }
  });

  /**
   * DELETE /api/alerts/history/cleanup
   * Clean up old alerts
   */
  router.delete('/history/cleanup', [
    query('daysOld').optional().isInt({ min: 1, max: 365 })
  ], handleValidationErrors, async (req, res) => {
    try {
      const daysOld = parseInt(req.query.daysOld) || null;
      
      const deletedCount = await alertHistory.deleteOldAlerts(daysOld);
      
      res.json({
        success: true,
        data: {
          deletedCount,
          daysOld: daysOld || alertHistory.maxHistoryDays
        }
      });
    } catch (error) {
      logger.error('Failed to cleanup alerts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup alert history'
      });
    }
  });

  /**
   * GET /api/alerts/history/export
   * Export alert history
   */
  router.get('/history/export', async (req, res) => {
    try {
      const filter = {
        types: req.query.types ? req.query.types.split(',') : [],
        priorities: req.query.priorities ? req.query.priorities.split(',') : [],
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom) : null,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo) : null
      };

      const exportData = await alertHistory.exportHistory(filter);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=alert-history-${new Date().toISOString().split('T')[0]}.json`);
      
      res.json(exportData);
    } catch (error) {
      logger.error('Failed to export history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export alert history'
      });
    }
  });

  // ======================
  // USER PREFERENCES
  // ======================

  /**
   * GET /api/alerts/preferences
   * Get user preferences
   */
  router.get('/preferences', async (req, res) => {
    try {
      const preferences = userPreferences.getPreferences();
      
      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      logger.error('Failed to get preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve preferences'
      });
    }
  });

  /**
   * PUT /api/alerts/preferences
   * Update user preferences
   */
  router.put('/preferences', validatePreferences, handleValidationErrors, async (req, res) => {
    try {
      const updates = req.body;
      
      const preferences = await userPreferences.updatePreferences(updates);
      
      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      logger.error('Failed to update preferences:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/alerts/preferences/reset
   * Reset preferences to defaults
   */
  router.post('/preferences/reset', async (req, res) => {
    try {
      const preferences = await userPreferences.resetPreferences();
      
      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      logger.error('Failed to reset preferences:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset preferences'
      });
    }
  });

  /**
   * GET /api/alerts/preferences/channels/:channel
   * Get specific channel settings
   */
  router.get('/preferences/channels/:channel', async (req, res) => {
    try {
      const { channel } = req.params;
      
      if (!Object.values(NotificationChannel).includes(channel)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid notification channel'
        });
      }
      
      const settings = userPreferences.getChannelSettings(channel);
      
      res.json({
        success: true,
        data: {
          channel,
          settings
        }
      });
    } catch (error) {
      logger.error('Failed to get channel settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve channel settings'
      });
    }
  });

  /**
   * PUT /api/alerts/preferences/channels/:channel
   * Update specific channel settings
   */
  router.put('/preferences/channels/:channel', async (req, res) => {
    try {
      const { channel } = req.params;
      const settings = req.body;
      
      if (!Object.values(NotificationChannel).includes(channel)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid notification channel'
        });
      }
      
      const preferences = await userPreferences.updateChannelSettings(channel, settings);
      
      res.json({
        success: true,
        data: {
          channel,
          settings: preferences.channels[channel]
        }
      });
    } catch (error) {
      logger.error('Failed to update channel settings:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // ======================
  // NOTIFICATION TESTING
  // ======================

  /**
   * POST /api/alerts/test/:channel
   * Test notification channel
   */
  router.post('/test/:channel', validateChannel, handleValidationErrors, async (req, res) => {
    try {
      const { channel } = req.params;
      const recipient = userPreferences.getPreferences();
      
      const result = await notificationService.testChannel(channel, recipient);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to test channel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test notification channel'
      });
    }
  });

  /**
   * GET /api/alerts/notifications/stats
   * Get notification service statistics
   */
  router.get('/notifications/stats', async (req, res) => {
    try {
      const stats = notificationService.getStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get notification stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve notification statistics'
      });
    }
  });

  // ======================
  // CONFIGURATION
  // ======================

  /**
   * GET /api/alerts/config
   * Get alert configuration
   */
  router.get('/config', async (req, res) => {
    try {
      const config = alertManager.config;
      
      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      logger.error('Failed to get alert config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alert configuration'
      });
    }
  });

  /**
   * PUT /api/alerts/config
   * Update alert configuration
   */
  router.put('/config', async (req, res) => {
    try {
      const newConfig = req.body;
      
      alertManager.updateConfig(newConfig);
      
      res.json({
        success: true,
        data: alertManager.config
      });
    } catch (error) {
      logger.error('Failed to update alert config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update alert configuration'
      });
    }
  });

  /**
   * GET /api/alerts/storage
   * Get storage information
   */
  router.get('/storage', async (req, res) => {
    try {
      const storageInfo = await alertHistory.getStorageInfo();
      
      res.json({
        success: true,
        data: storageInfo
      });
    } catch (error) {
      logger.error('Failed to get storage info:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve storage information'
      });
    }
  });

  // ======================
  // TESTING & VALIDATION
  // ======================

  /**
   * POST /api/alerts/test/run
   * Run comprehensive alert system tests
   */
  router.post('/test/run', [
    body('skipSlowTests').optional().isBoolean(),
    body('testChannels').optional().isArray(),
    body('testEmail').optional().isEmail(),
    body('testPhone').optional().isMobilePhone()
  ], handleValidationErrors, async (req, res) => {
    try {
      const AlertTester = require('../alerts/alert-tester');
      const tester = new AlertTester({ alertManager, notificationService, userPreferences, alertHistory });
      
      const options = {
        skipSlowTests: req.body.skipSlowTests || false,
        testChannels: req.body.testChannels || ['push'],
        testEmail: req.body.testEmail,
        testPhone: req.body.testPhone
      };
      
      const results = await tester.runAllTests(options);
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Failed to run alert tests:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute alert system tests'
      });
    }
  });

  /**
   * POST /api/alerts/test/scenario/:scenario
   * Run specific test scenario
   */
  router.post('/test/scenario/:scenario', async (req, res) => {
    try {
      const { scenario } = req.params;
      const params = req.body || {};
      
      const AlertTester = require('../alerts/alert-tester');
      const tester = new AlertTester({ alertManager, notificationService, userPreferences, alertHistory });
      
      const result = await tester.testScenario(scenario, params);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error(`Failed to run test scenario '${req.params.scenario}':`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * GET /api/alerts/validate/configuration
   * Validate alert system configuration
   */
  router.get('/validate/configuration', async (req, res) => {
    try {
      const AlertTester = require('../alerts/alert-tester');
      const tester = new AlertTester({ alertManager, notificationService, userPreferences, alertHistory });
      
      const validationResults = await tester.validateConfiguration();
      
      res.json({
        success: validationResults.failed === 0,
        data: validationResults
      });
    } catch (error) {
      logger.error('Failed to validate configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate alert system configuration'
      });
    }
  });

  /**
   * POST /api/alerts/test/delivery/:channel
   * Test notification delivery for specific channel
   */
  router.post('/test/delivery/:channel', async (req, res) => {
    try {
      const { channel } = req.params;
      const config = req.body || {};
      
      const AlertTester = require('../alerts/alert-tester');
      const tester = new AlertTester({ alertManager, notificationService, userPreferences, alertHistory });
      
      const result = await tester.testNotificationDelivery(channel, config);
      
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      logger.error(`Failed to test delivery for channel '${req.params.channel}':`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * POST /api/alerts/test/create
   * Create test alert for validation
   */
  router.post('/test/create', validateAlert, handleValidationErrors, async (req, res) => {
    try {
      const testAlert = {
        ...req.body,
        title: req.body.title || 'Test Alert',
        message: req.body.message || 'This is a test alert for validation purposes'
      };
      
      const alert = await alertManager.createAlert(testAlert);
      
      if (!alert) {
        return res.status(200).json({
          success: true,
          message: 'Test alert was suppressed due to current settings',
          suppressed: true
        });
      }
      
      // Auto-resolve test alerts after a short delay
      setTimeout(async () => {
        try {
          await alertManager.resolveAlert(alert.id, 'auto-test-cleanup');
        } catch (error) {
          logger.warn('Failed to auto-cleanup test alert:', error);
        }
      }, 30000); // 30 seconds
      
      res.status(201).json({
        success: true,
        data: alert,
        message: 'Test alert created successfully (will be auto-resolved in 30 seconds)'
      });
    } catch (error) {
      logger.error('Failed to create test alert:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create test alert'
      });
    }
  });

  return router;
}

module.exports = createAlertRoutes;
