/**
 * AlertTester - Alert system testing and validation utilities
 * Provides comprehensive testing scenarios for alert functionality and notification delivery
 */

const { createLogger } = require('../utils/logger');
const { AlertType, AlertPriority, NotificationChannel } = require('./types');

class AlertTester {
  constructor(services) {
    this.alertManager = services.alertManager;
    this.notificationService = services.notificationService;
    this.userPreferences = services.userPreferences;
    this.alertHistory = services.alertHistory;
    
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
    
    this.logger = createLogger('AlertTester');
    this.logger.info('AlertTester initialized');
  }
  
  /**
   * Run all test scenarios
   * @param {Object} options - Test options
   * @returns {Promise<Object>} Complete test results
   */
  async runAllTests(options = {}) {
    const {
      skipSlowTests = false,
      testChannels = ['push'], // Default to mock channels only
      testEmail = null,
      testPhone = null
    } = options;
    
    this._resetResults();
    
    this.logger.info('Starting comprehensive alert system tests...');
    
    try {
      // Core functionality tests
      await this._testAlertCreation();
      await this._testAlertPriorities();
      await this._testAlertLifecycle();
      await this._testCooldownLogic();
      await this._testDoNotDisturbLogic();
      
      // Notification tests
      await this._testNotificationChannels(testChannels, testEmail, testPhone);
      await this._testRateLimiting();
      
      // Preference tests
      await this._testUserPreferences();
      
      // History tests
      await this._testAlertHistory();
      
      // Integration tests
      await this._testEventIntegration();
      
      // Error handling tests
      await this._testErrorHandling();
      
      // Performance tests (if not skipped)
      if (!skipSlowTests) {
        await this._testPerformance();
        await this._testConcurrency();
      }
      
      const summary = this._generateTestSummary();
      this.logger.info('Alert system tests completed', summary);
      
      return {
        success: this.testResults.failed === 0,
        summary,
        details: this.testResults.details
      };
      
    } catch (error) {
      this.logger.error('Test execution failed:', error);
      return {
        success: false,
        error: error.message,
        summary: this._generateTestSummary(),
        details: this.testResults.details
      };
    }
  }
  
  /**
   * Test specific alert scenario
   * @param {string} scenario - Test scenario name
   * @param {Object} params - Test parameters
   * @returns {Promise<Object>} Test result
   */
  async testScenario(scenario, params = {}) {
    this._resetResults();
    
    const scenarios = {
      'baby-crying': () => this._testBabyCryingScenario(params),
      'motion-detection': () => this._testMotionDetectionScenario(params),
      'system-failure': () => this._testSystemFailureScenario(params),
      'notification-delivery': () => this._testNotificationDeliveryScenario(params),
      'escalation': () => this._testEscalationScenario(params),
      'do-not-disturb': () => this._testDoNotDisturbScenario(params)
    };
    
    if (!scenarios[scenario]) {
      throw new Error(`Unknown test scenario: ${scenario}`);
    }
    
    try {
      await scenarios[scenario]();
      
      return {
        success: this.testResults.failed === 0,
        scenario,
        summary: this._generateTestSummary(),
        details: this.testResults.details
      };
      
    } catch (error) {
      this.logger.error(`Test scenario '${scenario}' failed:`, error);
      return {
        success: false,
        scenario,
        error: error.message,
        summary: this._generateTestSummary(),
        details: this.testResults.details
      };
    }
  }
  
  /**
   * Test notification delivery for specific channel
   * @param {string} channel - Notification channel
   * @param {Object} config - Channel configuration
   * @returns {Promise<Object>} Delivery test result
   */
  async testNotificationDelivery(channel, config = {}) {
    const testName = `Notification Delivery - ${channel}`;
    
    try {
      // Configure test recipient
      const testPreferences = {
        channels: {
          [channel]: {
            enabled: true,
            ...config
          }
        }
      };
      
      // Test notification delivery
      const result = await this.notificationService.testChannel(channel, testPreferences);
      
      if (result.success) {
        this._recordTestResult(testName, true, 'Notification delivered successfully');
      } else {
        this._recordTestResult(testName, false, `Delivery failed: ${result.error}`);
      }
      
      return result;
      
    } catch (error) {
      this._recordTestResult(testName, false, `Test error: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Validate alert system configuration
   * @returns {Promise<Object>} Validation results
   */
  async validateConfiguration() {
    const validationResults = {
      passed: 0,
      failed: 0,
      issues: []
    };
    
    const addIssue = (level, category, message) => {
      validationResults.issues.push({ level, category, message });
      if (level === 'error') validationResults.failed++;
      else validationResults.passed++;
    };
    
    // Validate alert manager configuration
    const alertConfig = this.alertManager.config;
    
    // Check alert type configurations
    for (const [type, config] of Object.entries(alertConfig)) {
      if (!Object.values(AlertType).includes(type)) {
        addIssue('error', 'configuration', `Invalid alert type: ${type}`);
        continue;
      }
      
      if (!config.enabled === undefined) {
        addIssue('warning', 'configuration', `Missing 'enabled' flag for alert type: ${type}`);
      }
      
      if (!config.priority || !Object.values(AlertPriority).includes(config.priority)) {
        addIssue('error', 'configuration', `Invalid priority for alert type ${type}: ${config.priority}`);
      }
      
      if (!config.channels || !Array.isArray(config.channels)) {
        addIssue('error', 'configuration', `Missing or invalid channels for alert type: ${type}`);
      } else {
        for (const channel of config.channels) {
          if (!Object.values(NotificationChannel).includes(channel)) {
            addIssue('error', 'configuration', `Invalid channel '${channel}' for alert type: ${type}`);
          }
        }
      }
    }
    
    // Validate user preferences
    const preferences = this.userPreferences.getPreferences();
    
    // Check do not disturb configuration
    const dnd = preferences.doNotDisturb;
    if (dnd.enabled && (!dnd.startTime || !dnd.endTime)) {
      addIssue('error', 'preferences', 'Do not disturb enabled but missing time configuration');
    }
    
    // Check notification channels
    for (const [channel, settings] of Object.entries(preferences.channels)) {
      if (!Object.values(NotificationChannel).includes(channel)) {
        addIssue('error', 'preferences', `Invalid notification channel: ${channel}`);
        continue;
      }
      
      if (settings.enabled) {
        switch (channel) {
          case NotificationChannel.EMAIL:
            if (!settings.addresses || settings.addresses.length === 0) {
              addIssue('warning', 'preferences', 'Email notifications enabled but no addresses configured');
            }
            break;
          case NotificationChannel.SMS:
            if (!settings.phoneNumbers || settings.phoneNumbers.length === 0) {
              addIssue('warning', 'preferences', 'SMS notifications enabled but no phone numbers configured');
            }
            break;
          case NotificationChannel.PUSH:
            if (!settings.deviceTokens || settings.deviceTokens.length === 0) {
              addIssue('warning', 'preferences', 'Push notifications enabled but no device tokens configured');
            }
            break;
        }
      }
    }
    
    // Validate notification service
    const notificationStats = this.notificationService.getStats();
    if (notificationStats.total > 0 && notificationStats.successRate === '0%') {
      addIssue('error', 'notifications', 'All notifications have failed - check service configuration');
    }
    
    this.logger.info('Configuration validation completed', {
      passed: validationResults.passed,
      failed: validationResults.failed,
      totalIssues: validationResults.issues.length
    });
    
    return validationResults;
  }
  
  /**
   * Test alert creation functionality
   * @private
   */
  async _testAlertCreation() {
    const testName = 'Alert Creation';
    
    try {
      const alert = await this.alertManager.createAlert({
        type: AlertType.SYSTEM,
        priority: AlertPriority.LOW,
        title: 'Test Alert',
        message: 'This is a test alert'
      });
      
      if (alert && alert.id && alert.type === AlertType.SYSTEM) {
        this._recordTestResult(testName, true, 'Alert created successfully');
      } else {
        this._recordTestResult(testName, false, 'Alert creation failed or returned invalid data');
      }
    } catch (error) {
      this._recordTestResult(testName, false, `Alert creation error: ${error.message}`);
    }
  }
  
  /**
   * Test alert priority handling
   * @private
   */
  async _testAlertPriorities() {
    const testName = 'Alert Priorities';
    
    try {
      const alerts = [];
      
      // Create alerts with different priorities
      for (const priority of Object.values(AlertPriority)) {
        const alert = await this.alertManager.createAlert({
          type: AlertType.SYSTEM,
          priority,
          title: `${priority} Priority Test`,
          message: `Testing ${priority} priority alert`
        });
        
        if (alert) alerts.push(alert);
      }
      
      // Get active alerts and check sorting
      const activeAlerts = this.alertManager.getActiveAlerts();
      
      // Verify priority sorting (critical first)
      const priorityOrder = [AlertPriority.CRITICAL, AlertPriority.HIGH, AlertPriority.MEDIUM, AlertPriority.LOW];
      let properlyOrdered = true;
      
      for (let i = 0; i < activeAlerts.length - 1; i++) {
        const currentIndex = priorityOrder.indexOf(activeAlerts[i].priority);
        const nextIndex = priorityOrder.indexOf(activeAlerts[i + 1].priority);
        
        if (currentIndex > nextIndex) {
          properlyOrdered = false;
          break;
        }
      }
      
      if (properlyOrdered) {
        this._recordTestResult(testName, true, 'Alert priorities handled correctly');
      } else {
        this._recordTestResult(testName, false, 'Alert priorities not sorted correctly');
      }
      
      // Clean up test alerts
      for (const alert of alerts) {
        await this.alertManager.resolveAlert(alert.id, 'test');
      }
      
    } catch (error) {
      this._recordTestResult(testName, false, `Priority test error: ${error.message}`);
    }
  }
  
  /**
   * Test alert lifecycle (acknowledge/resolve)
   * @private
   */
  async _testAlertLifecycle() {
    const testName = 'Alert Lifecycle';
    
    try {
      // Create test alert
      const alert = await this.alertManager.createAlert({
        type: AlertType.SYSTEM,
        priority: AlertPriority.MEDIUM,
        title: 'Lifecycle Test Alert',
        message: 'Testing alert lifecycle'
      });
      
      if (!alert) {
        this._recordTestResult(testName, false, 'Failed to create test alert');
        return;
      }
      
      // Test acknowledgment
      const acknowledgedAlert = await this.alertManager.acknowledgeAlert(alert.id, 'tester');
      
      if (acknowledgedAlert.status !== 'acknowledged' || !acknowledgedAlert.acknowledgedAt) {
        this._recordTestResult(testName, false, 'Alert acknowledgment failed');
        return;
      }
      
      // Test resolution
      const resolvedAlert = await this.alertManager.resolveAlert(alert.id, 'tester');
      
      if (resolvedAlert.status !== 'resolved' || !resolvedAlert.resolvedAt) {
        this._recordTestResult(testName, false, 'Alert resolution failed');
        return;
      }
      
      // Verify alert is no longer in active alerts
      const activeAlerts = this.alertManager.getActiveAlerts();
      const stillActive = activeAlerts.find(a => a.id === alert.id);
      
      if (stillActive) {
        this._recordTestResult(testName, false, 'Resolved alert still appears in active alerts');
      } else {
        this._recordTestResult(testName, true, 'Alert lifecycle completed successfully');
      }
      
    } catch (error) {
      this._recordTestResult(testName, false, `Lifecycle test error: ${error.message}`);
    }
  }
  
  /**
   * Test cooldown logic
   * @private
   */
  async _testCooldownLogic() {
    const testName = 'Cooldown Logic';
    
    try {
      // Configure a short cooldown for testing
      const originalConfig = this.alertManager.config;
      this.alertManager.updateConfig({
        ...originalConfig,
        [AlertType.SYSTEM]: {
          ...originalConfig[AlertType.SYSTEM],
          cooldownMinutes: 0.1 // 6 seconds for testing
        }
      });
      
      // Create first alert
      const alert1 = await this.alertManager.createAlert({
        type: AlertType.SYSTEM,
        priority: AlertPriority.LOW,
        title: 'Cooldown Test 1',
        message: 'First alert'
      });
      
      if (!alert1) {
        this._recordTestResult(testName, false, 'First alert creation failed');
        return;
      }
      
      // Immediately try to create second alert (should be suppressed)
      const alert2 = await this.alertManager.createAlert({
        type: AlertType.SYSTEM,
        priority: AlertPriority.LOW,
        title: 'Cooldown Test 2',
        message: 'Second alert (should be suppressed)'
      });
      
      if (alert2) {
        this._recordTestResult(testName, false, 'Cooldown logic failed - second alert was not suppressed');
      } else {
        this._recordTestResult(testName, true, 'Cooldown logic working correctly');
      }
      
      // Clean up
      if (alert1) {
        await this.alertManager.resolveAlert(alert1.id, 'test');
      }
      
      // Restore original config
      this.alertManager.updateConfig(originalConfig);
      
    } catch (error) {
      this._recordTestResult(testName, false, `Cooldown test error: ${error.message}`);
    }
  }
  
  /**
   * Test do not disturb logic
   * @private
   */
  async _testDoNotDisturbLogic() {
    const testName = 'Do Not Disturb Logic';
    
    try {
      // Configure DND for current time
      const now = new Date();
      const startTime = new Date(now.getTime() - 60000).toTimeString().substring(0, 5); // 1 minute ago
      const endTime = new Date(now.getTime() + 60000).toTimeString().substring(0, 5); // 1 minute from now
      
      await this.userPreferences.updateDoNotDisturbSettings({
        enabled: true,
        startTime,
        endTime,
        exceptCritical: true
      });
      
      // Test regular alert (should be suppressed)
      const regularAlert = await this.alertManager.createAlert({
        type: AlertType.SYSTEM,
        priority: AlertPriority.MEDIUM,
        title: 'DND Test Regular',
        message: 'Regular alert during DND'
      });
      
      // Test critical alert (should not be suppressed)
      const criticalAlert = await this.alertManager.createAlert({
        type: AlertType.CRY_DETECTED,
        priority: AlertPriority.CRITICAL,
        title: 'DND Test Critical',
        message: 'Critical alert during DND'
      });
      
      if (regularAlert) {
        this._recordTestResult(testName, false, 'Regular alert was not suppressed during DND');
      } else if (!criticalAlert) {
        this._recordTestResult(testName, false, 'Critical alert was suppressed during DND');
      } else {
        this._recordTestResult(testName, true, 'Do Not Disturb logic working correctly');
      }
      
      // Clean up
      if (criticalAlert) {
        await this.alertManager.resolveAlert(criticalAlert.id, 'test');
      }
      
      // Disable DND
      await this.userPreferences.updateDoNotDisturbSettings({
        enabled: false
      });
      
    } catch (error) {
      this._recordTestResult(testName, false, `DND test error: ${error.message}`);
    }
  }
  
  /**
   * Test notification channels
   * @private
   */
  async _testNotificationChannels(testChannels, testEmail, testPhone) {
    for (const channel of testChannels) {
      const testName = `Notification Channel - ${channel}`;
      
      try {
        let config = { enabled: true };
        
        switch (channel) {
          case NotificationChannel.EMAIL:
            if (testEmail) {
              config.addresses = [testEmail];
            } else {
              config.addresses = ['test@example.com'];
            }
            break;
          case NotificationChannel.SMS:
            if (testPhone) {
              config.phoneNumbers = [testPhone];
            } else {
              config.phoneNumbers = ['+1234567890'];
            }
            break;
          case NotificationChannel.PUSH:
            config.deviceTokens = ['test-device-token'];
            break;
          case NotificationChannel.WEBHOOK:
            config.urls = ['https://httpbin.org/post'];
            break;
        }
        
        const result = await this.testNotificationDelivery(channel, config);
        
        // Result is already recorded in testNotificationDelivery
        
      } catch (error) {
        this._recordTestResult(testName, false, `Channel test error: ${error.message}`);
      }
    }
  }
  
  /**
   * Test rate limiting
   * @private
   */
  async _testRateLimiting() {
    const testName = 'Rate Limiting';
    
    try {
      // Configure low rate limit for testing
      await this.userPreferences.updateChannelSettings(NotificationChannel.PUSH, {
        enabled: true,
        deviceTokens: ['test-token'],
        maxFrequency: 2 // 2 notifications per hour
      });
      
      const testPrefs = this.userPreferences.getPreferences();
      
      // Send 3 notifications quickly
      const results = [];
      for (let i = 0; i < 3; i++) {
        try {
          const result = await this.notificationService.sendNotification({
            channel: NotificationChannel.PUSH,
            alert: {
              id: `rate-test-${i}`,
              title: `Rate Limit Test ${i + 1}`,
              message: 'Testing rate limiting'
            },
            recipient: testPrefs
          });
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }
      
      // Check that third notification was rate limited
      const successCount = results.filter(r => r.success).length;
      const rateLimitedCount = results.filter(r => !r.success && r.error.includes('rate limit')).length;
      
      if (successCount <= 2 && rateLimitedCount >= 1) {
        this._recordTestResult(testName, true, 'Rate limiting working correctly');
      } else {
        this._recordTestResult(testName, false, `Rate limiting failed - ${successCount} succeeded, ${rateLimitedCount} rate limited`);
      }
      
    } catch (error) {
      this._recordTestResult(testName, false, `Rate limiting test error: ${error.message}`);
    }
  }
  
  /**
   * Test user preferences
   * @private
   */
  async _testUserPreferences() {
    const testName = 'User Preferences';
    
    try {
      const originalPrefs = this.userPreferences.getPreferences();
      
      // Test preference updates
      const testUpdates = {
        doNotDisturb: {
          enabled: true,
          startTime: '22:00',
          endTime: '07:00'
        }
      };
      
      const updatedPrefs = await this.userPreferences.updatePreferences(testUpdates);
      
      if (updatedPrefs.doNotDisturb.enabled && updatedPrefs.doNotDisturb.startTime === '22:00') {
        this._recordTestResult(testName, true, 'User preferences updated successfully');
      } else {
        this._recordTestResult(testName, false, 'User preferences update failed');
      }
      
      // Restore original preferences
      await this.userPreferences.updatePreferences(originalPrefs);
      
    } catch (error) {
      this._recordTestResult(testName, false, `User preferences test error: ${error.message}`);
    }
  }
  
  /**
   * Test alert history
   * @private
   */
  async _testAlertHistory() {
    const testName = 'Alert History';
    
    try {
      // Create test alert
      const testAlert = {
        id: 'history-test-' + Date.now(),
        type: AlertType.SYSTEM,
        priority: AlertPriority.LOW,
        title: 'History Test Alert',
        message: 'Testing alert history storage',
        timestamp: new Date(),
        status: 'delivered'
      };
      
      // Store in history
      await this.alertHistory.storeAlert(testAlert);
      
      // Retrieve from history
      const retrievedAlert = await this.alertHistory.getAlertById(testAlert.id);
      
      if (retrievedAlert && retrievedAlert.id === testAlert.id) {
        this._recordTestResult(testName, true, 'Alert history storage and retrieval working');
      } else {
        this._recordTestResult(testName, false, 'Alert history storage or retrieval failed');
      }
      
    } catch (error) {
      this._recordTestResult(testName, false, `Alert history test error: ${error.message}`);
    }
  }
  
  /**
   * Test event integration
   * @private
   */
  async _testEventIntegration() {
    const testName = 'Event Integration';
    
    try {
      let alertReceived = false;
      
      // Set up event listener
      const listener = (alert) => {
        if (alert.title === 'Event Integration Test') {
          alertReceived = true;
        }
      };
      
      this.alertManager.on('alertCreated', listener);
      
      // Create alert to trigger event
      await this.alertManager.createAlert({
        type: AlertType.SYSTEM,
        priority: AlertPriority.LOW,
        title: 'Event Integration Test',
        message: 'Testing event integration'
      });
      
      // Wait a moment for event processing
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Remove listener
      this.alertManager.removeListener('alertCreated', listener);
      
      if (alertReceived) {
        this._recordTestResult(testName, true, 'Event integration working correctly');
      } else {
        this._recordTestResult(testName, false, 'Event integration failed - no event received');
      }
      
    } catch (error) {
      this._recordTestResult(testName, false, `Event integration test error: ${error.message}`);
    }
  }
  
  /**
   * Test error handling
   * @private
   */
  async _testErrorHandling() {
    const testName = 'Error Handling';
    
    try {
      let errorCount = 0;
      
      // Test invalid alert creation
      try {
        await this.alertManager.createAlert({
          type: 'invalid-type',
          priority: 'invalid-priority'
        });
      } catch (error) {
        errorCount++;
      }
      
      // Test invalid alert acknowledgment
      try {
        await this.alertManager.acknowledgeAlert('non-existent-id');
      } catch (error) {
        errorCount++;
      }
      
      // Test invalid notification
      try {
        await this.notificationService.sendNotification({
          channel: 'invalid-channel',
          alert: {},
          recipient: {}
        });
      } catch (error) {
        errorCount++;
      }
      
      if (errorCount >= 2) {
        this._recordTestResult(testName, true, 'Error handling working correctly');
      } else {
        this._recordTestResult(testName, false, `Error handling insufficient - only ${errorCount} errors caught`);
      }
      
    } catch (error) {
      this._recordTestResult(testName, false, `Error handling test error: ${error.message}`);
    }
  }
  
  /**
   * Test performance
   * @private
   */
  async _testPerformance() {
    const testName = 'Performance';
    
    try {
      const startTime = Date.now();
      const alertCount = 50;
      
      // Create multiple alerts rapidly
      const promises = [];
      for (let i = 0; i < alertCount; i++) {
        promises.push(this.alertManager.createAlert({
          type: AlertType.SYSTEM,
          priority: AlertPriority.LOW,
          title: `Performance Test ${i}`,
          message: `Testing performance with alert ${i}`
        }));
      }
      
      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
      const endTime = Date.now();
      const duration = endTime - startTime;
      const throughput = (successCount / duration) * 1000; // alerts per second
      
      if (throughput > 10 && successCount >= alertCount * 0.8) {
        this._recordTestResult(testName, true, `Performance acceptable: ${throughput.toFixed(1)} alerts/sec`);
      } else {
        this._recordTestResult(testName, false, `Performance poor: ${throughput.toFixed(1)} alerts/sec, ${successCount}/${alertCount} succeeded`);
      }
      
      // Clean up test alerts
      const activeAlerts = this.alertManager.getActiveAlerts();
      for (const alert of activeAlerts) {
        if (alert.title.startsWith('Performance Test')) {
          await this.alertManager.resolveAlert(alert.id, 'test');
        }
      }
      
    } catch (error) {
      this._recordTestResult(testName, false, `Performance test error: ${error.message}`);
    }
  }
  
  /**
   * Test concurrency
   * @private
   */
  async _testConcurrency() {
    const testName = 'Concurrency';
    
    try {
      // Test concurrent operations
      const operations = [
        () => this.alertManager.createAlert({
          type: AlertType.SYSTEM,
          priority: AlertPriority.LOW,
          title: 'Concurrency Test 1',
          message: 'Testing concurrent alert creation'
        }),
        () => this.userPreferences.updatePreferences({
          testField: Date.now()
        }),
        () => this.alertHistory.getStatistics(),
        () => this.notificationService.getStats()
      ];
      
      const results = await Promise.allSettled(operations.map(op => op()));
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      if (successCount === operations.length) {
        this._recordTestResult(testName, true, 'Concurrency handling successful');
      } else {
        this._recordTestResult(testName, false, `Concurrency issues - ${successCount}/${operations.length} operations succeeded`);
      }
      
    } catch (error) {
      this._recordTestResult(testName, false, `Concurrency test error: ${error.message}`);
    }
  }
  
  /**
   * Test baby crying scenario
   * @private
   */
  async _testBabyCryingScenario(params) {
    const alert = await this.alertManager.createAlert({
      type: AlertType.CRY_DETECTED,
      priority: AlertPriority.CRITICAL,
      title: 'Baby Crying Detected',
      message: 'Baby crying detected with high confidence',
      metadata: {
        confidence: params.confidence || 0.9,
        duration: params.duration || 5000
      }
    });
    
    this._recordTestResult('Baby Crying Scenario', !!alert, 
      alert ? 'Baby crying alert created successfully' : 'Failed to create baby crying alert');
  }
  
  /**
   * Test motion detection scenario
   * @private
   */
  async _testMotionDetectionScenario(params) {
    const alert = await this.alertManager.createAlert({
      type: AlertType.MOTION,
      priority: AlertPriority.MEDIUM,
      title: 'Motion Detected',
      message: 'Motion detected in baby room',
      metadata: {
        sensitivity: params.sensitivity || 0.7,
        area: params.area || 'crib'
      }
    });
    
    this._recordTestResult('Motion Detection Scenario', !!alert,
      alert ? 'Motion detection alert created successfully' : 'Failed to create motion alert');
  }
  
  /**
   * Test system failure scenario
   * @private
   */
  async _testSystemFailureScenario(params) {
    const alert = await this.alertManager.createAlert({
      type: AlertType.SYSTEM,
      priority: AlertPriority.HIGH,
      title: 'System Failure',
      message: params.message || 'Camera system failure detected',
      metadata: {
        component: params.component || 'camera',
        error: params.error || 'Connection timeout'
      }
    });
    
    this._recordTestResult('System Failure Scenario', !!alert,
      alert ? 'System failure alert created successfully' : 'Failed to create system failure alert');
  }
  
  /**
   * Test notification delivery scenario
   * @private
   */
  async _testNotificationDeliveryScenario(params) {
    const channel = params.channel || NotificationChannel.PUSH;
    const config = params.config || { enabled: true, deviceTokens: ['test-token'] };
    
    const result = await this.testNotificationDelivery(channel, config);
    
    this._recordTestResult('Notification Delivery Scenario', result.success,
      result.success ? 'Notification delivered successfully' : `Delivery failed: ${result.error}`);
  }
  
  /**
   * Test escalation scenario
   * @private
   */
  async _testEscalationScenario(params) {
    // Configure short escalation timeout for testing
    await this.userPreferences.updateEscalationSettings({
      enabled: true,
      timeoutMinutes: 0.1, // 6 seconds for testing
      escalateChannels: [NotificationChannel.PUSH]
    });
    
    const alert = await this.alertManager.createAlert({
      type: AlertType.CRY_DETECTED,
      priority: AlertPriority.CRITICAL,
      title: 'Escalation Test',
      message: 'Testing alert escalation'
    });
    
    if (!alert) {
      this._recordTestResult('Escalation Scenario', false, 'Failed to create escalation test alert');
      return;
    }
    
    // Wait for escalation timeout
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Check if alert was escalated
    const updatedAlert = await this.alertHistory.getAlertById(alert.id);
    
    this._recordTestResult('Escalation Scenario', updatedAlert && updatedAlert.escalated,
      updatedAlert && updatedAlert.escalated ? 'Alert escalation successful' : 'Alert escalation failed');
  }
  
  /**
   * Test do not disturb scenario
   * @private
   */
  async _testDoNotDisturbScenario(params) {
    // Configure DND for current time
    const now = new Date();
    const startTime = new Date(now.getTime() - 60000).toTimeString().substring(0, 5);
    const endTime = new Date(now.getTime() + 60000).toTimeString().substring(0, 5);
    
    await this.userPreferences.updateDoNotDisturbSettings({
      enabled: true,
      startTime,
      endTime,
      exceptCritical: params.exceptCritical !== false
    });
    
    const priority = params.priority || AlertPriority.MEDIUM;
    const shouldBeAllowed = priority === AlertPriority.CRITICAL && params.exceptCritical !== false;
    
    const alert = await this.alertManager.createAlert({
      type: AlertType.SYSTEM,
      priority,
      title: 'DND Scenario Test',
      message: 'Testing do not disturb functionality'
    });
    
    const success = shouldBeAllowed ? !!alert : !alert;
    const message = shouldBeAllowed ? 
      (alert ? 'Critical alert allowed during DND' : 'Critical alert incorrectly suppressed during DND') :
      (alert ? 'Regular alert incorrectly allowed during DND' : 'Regular alert correctly suppressed during DND');
    
    this._recordTestResult('Do Not Disturb Scenario', success, message);
  }
  
  /**
   * Record test result
   * @private
   */
  _recordTestResult(testName, passed, message) {
    this.testResults.total++;
    
    if (passed) {
      this.testResults.passed++;
    } else {
      this.testResults.failed++;
    }
    
    this.testResults.details.push({
      test: testName,
      passed,
      message,
      timestamp: new Date().toISOString()
    });
    
    const status = passed ? 'PASS' : 'FAIL';
    this.logger.info(`TEST [${status}] ${testName}: ${message}`);
  }
  
  /**
   * Reset test results
   * @private
   */
  _resetResults() {
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0,
      details: []
    };
  }
  
  /**
   * Generate test summary
   * @private
   */
  _generateTestSummary() {
    return {
      total: this.testResults.total,
      passed: this.testResults.passed,
      failed: this.testResults.failed,
      passRate: this.testResults.total > 0 ? 
        ((this.testResults.passed / this.testResults.total) * 100).toFixed(1) + '%' : '0%'
    };
  }
}

module.exports = AlertTester;
