/**
 * Alert System Type Definitions
 * Defines all types, enums, and data structures for the Aegis alert system
 */

// Alert Types - Different categories of alerts
const AlertType = {
  MOTION: 'motion',
  SOUND: 'sound', 
  CRY_DETECTED: 'cry_detected',
  NOISE_LEVEL: 'noise_level',
  SYSTEM: 'system',
  CONNECTION: 'connection',
  CAMERA: 'camera',
  STORAGE: 'storage'
};

// Alert Priority Levels
const AlertPriority = {
  LOW: 'low',
  MEDIUM: 'medium', 
  HIGH: 'high',
  CRITICAL: 'critical'
};

// Alert Status
const AlertStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved'
};

// Notification Channels
const NotificationChannel = {
  PUSH: 'push',
  EMAIL: 'email',
  SMS: 'sms',
  WEBHOOK: 'webhook'
};

// Alert Configuration Schema
const AlertConfig = {
  // Motion detection settings
  motion: {
    enabled: true,
    sensitivity: 0.5, // 0.0 - 1.0
    cooldownMinutes: 2,
    priority: AlertPriority.MEDIUM,
    channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL]
  },
  
  // Sound detection settings  
  sound: {
    enabled: true,
    threshold: 60, // decibels
    cooldownMinutes: 1,
    priority: AlertPriority.HIGH,
    channels: [NotificationChannel.PUSH, NotificationChannel.SMS]
  },
  
  // Cry detection settings
  cry: {
    enabled: true,
    confidence: 0.7, // 0.0 - 1.0
    cooldownMinutes: 0, // No cooldown for cry detection
    priority: AlertPriority.CRITICAL,
    channels: [NotificationChannel.PUSH, NotificationChannel.SMS, NotificationChannel.EMAIL]
  },
  
  // System alerts
  system: {
    enabled: true,
    priority: AlertPriority.MEDIUM,
    channels: [NotificationChannel.EMAIL]
  }
};

// User Notification Preferences
const UserPreferences = {
  // Do not disturb periods
  doNotDisturb: {
    enabled: false,
    startTime: '22:00',
    endTime: '07:00',
    timezone: 'UTC',
    exceptCritical: true // Allow critical alerts during DND
  },
  
  // Channel preferences
  channels: {
    push: {
      enabled: true,
      deviceTokens: [] // FCM/APNS device tokens
    },
    email: {
      enabled: true,
      addresses: [], // Email addresses
      maxFrequency: 5 // Max emails per hour
    },
    sms: {
      enabled: false,
      phoneNumbers: [], // Phone numbers
      maxFrequency: 3 // Max SMS per hour
    }
  },
  
  // Escalation rules
  escalation: {
    enabled: true,
    timeoutMinutes: 5, // Escalate if not acknowledged
    escalateChannels: [NotificationChannel.SMS, NotificationChannel.EMAIL]
  }
};

// Alert Data Structure
const AlertSchema = {
  id: '', // Unique alert ID
  type: AlertType.MOTION, // Alert type
  priority: AlertPriority.MEDIUM, // Priority level
  status: AlertStatus.PENDING, // Current status
  title: '', // Alert title
  message: '', // Alert message/description
  metadata: {}, // Additional context data
  sourceData: {}, // Original trigger data
  timestamp: new Date(), // When alert was triggered
  acknowledgedAt: null, // When acknowledged
  resolvedAt: null, // When resolved
  deliveryAttempts: [], // Delivery attempt history
  escalated: false, // Whether alert was escalated
  escalatedAt: null // When escalation occurred
};

// Delivery Attempt Schema
const DeliveryAttempt = {
  id: '', // Attempt ID
  channel: NotificationChannel.PUSH, // Channel used
  status: 'pending', // pending, success, failed
  timestamp: new Date(), // Attempt timestamp
  error: null, // Error details if failed
  responseData: {} // Response from delivery service
};

// Alert History Filter
const AlertHistoryFilter = {
  types: [], // Filter by alert types
  priorities: [], // Filter by priorities
  statuses: [], // Filter by statuses
  dateFrom: null, // Start date filter
  dateTo: null, // End date filter
  limit: 50, // Number of results
  offset: 0 // Pagination offset
};

// Alert Statistics
const AlertStats = {
  total: 0,
  byType: {},
  byPriority: {},
  byStatus: {},
  deliveryRate: 0.0,
  averageResponseTime: 0,
  escalationRate: 0.0
};

module.exports = {
  AlertType,
  AlertPriority,
  AlertStatus,
  NotificationChannel,
  AlertConfig,
  UserPreferences,
  AlertSchema,
  DeliveryAttempt,
  AlertHistoryFilter,
  AlertStats
};
