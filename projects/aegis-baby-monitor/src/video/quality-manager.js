const EventEmitter = require('events');
const { createLogger } = require('../utils/logger');

class QualityManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = createLogger('QualityManager');
    
    // Configuration
    this.config = {
      adaptationInterval: parseInt(options.adaptationInterval) || 5000, // 5 seconds
      stabilizationWindow: parseInt(options.stabilizationWindow) || 3, // 3 measurements
      qualityRampUpDelay: parseInt(options.qualityRampUpDelay) || 10000, // 10 seconds
      qualityRampDownDelay: parseInt(options.qualityRampDownDelay) || 3000, // 3 seconds
      bandwidthSafetyMargin: parseFloat(options.bandwidthSafetyMargin) || 0.8, // 80% utilization
      enableAdaptation: options.enableAdaptation !== false
    };
    
    // Client tracking and statistics
    this.clientStats = new Map();
    this.qualityHistory = new Map();
    this.adaptationTimers = new Map();
    
    // Network quality thresholds with hysteresis
    this.qualityThresholds = {
      low: {
        maxBitrate: 600000,    // 600 kbps
        minBandwidth: 800000,  // 800 kbps required
        maxLatency: 1000,      // 1 second
        maxPacketLoss: 0.05    // 5%
      },
      medium: {
        maxBitrate: 1800000,   // 1.8 Mbps
        minBandwidth: 2300000, // 2.3 Mbps required
        maxLatency: 500,       // 500ms
        maxPacketLoss: 0.02    // 2%
      },
      high: {
        maxBitrate: 3500000,   // 3.5 Mbps
        minBandwidth: 4500000, // 4.5 Mbps required
        maxLatency: 200,       // 200ms
        maxPacketLoss: 0.01    // 1%
      },
      ultra: {
        maxBitrate: 7000000,   // 7 Mbps
        minBandwidth: 9000000, // 9 Mbps required
        maxLatency: 100,       // 100ms
        maxPacketLoss: 0.005   // 0.5%
      }
    };
    
    // Quality order for adaptation decisions
    this.qualityLevels = ['low', 'medium', 'high', 'ultra'];
    
    this.logger.info('Quality Manager initialized', {
      adaptationInterval: this.config.adaptationInterval,
      enableAdaptation: this.config.enableAdaptation,
      levels: this.qualityLevels
    });
  }

  /**
   * Register a client for quality monitoring
   */
  registerClient(clientId, streamId, initialQuality = 'medium') {
    try {
      if (this.clientStats.has(clientId)) {
        this.logger.warn('Client already registered', { clientId });
        return false;
      }

      const clientData = {
        clientId,
        streamId,
        currentQuality: initialQuality,
        targetQuality: initialQuality,
        registeredAt: Date.now(),
        lastAdaptation: Date.now(),
        adaptationCount: 0,
        networkHistory: [],
        stabilizationCounter: 0,
        isStable: false
      };

      this.clientStats.set(clientId, clientData);
      this.qualityHistory.set(clientId, [initialQuality]);

      // Start monitoring if adaptation is enabled
      if (this.config.enableAdaptation) {
        this.startAdaptationTimer(clientId);
      }

      this.logger.info('Client registered for quality monitoring', {
        clientId,
        streamId,
        initialQuality
      });

      this.emit('clientRegistered', { clientId, streamId, initialQuality });
      return true;

    } catch (error) {
      this.logger.error('Failed to register client', {
        clientId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Unregister a client from quality monitoring
   */
  unregisterClient(clientId) {
    try {
      const clientData = this.clientStats.get(clientId);
      if (!clientData) {
        this.logger.warn('Client not registered', { clientId });
        return false;
      }

      // Clear adaptation timer
      this.clearAdaptationTimer(clientId);

      // Remove client data
      this.clientStats.delete(clientId);
      this.qualityHistory.delete(clientId);

      this.logger.info('Client unregistered from quality monitoring', {
        clientId,
        adaptationCount: clientData.adaptationCount
      });

      this.emit('clientUnregistered', { clientId });
      return true;

    } catch (error) {
      this.logger.error('Failed to unregister client', {
        clientId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Update network statistics for a client
   */
  updateNetworkStats(clientId, networkStats) {
    try {
      const clientData = this.clientStats.get(clientId);
      if (!clientData) {
        this.logger.warn('Client not registered for network stats update', { clientId });
        return false;
      }

      const timestamp = Date.now();
      const statsEntry = {
        timestamp,
        bandwidth: networkStats.bandwidth || 0,
        latency: networkStats.latency || 0,
        packetLoss: networkStats.packetLoss || 0,
        jitter: networkStats.jitter || 0
      };

      // Add to history
      clientData.networkHistory.push(statsEntry);

      // Keep history limited (last 10 measurements)
      if (clientData.networkHistory.length > 10) {
        clientData.networkHistory.shift();
      }

      // Update last seen
      clientData.lastUpdate = timestamp;

      this.logger.debug('Network stats updated', {
        clientId,
        bandwidth: Math.round(statsEntry.bandwidth / 1000) + 'kbps',
        latency: statsEntry.latency + 'ms',
        packetLoss: (statsEntry.packetLoss * 100).toFixed(2) + '%'
      });

      this.emit('networkStatsUpdated', { clientId, stats: statsEntry });
      return true;

    } catch (error) {
      this.logger.error('Failed to update network stats', {
        clientId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Start adaptation timer for a client
   */
  startAdaptationTimer(clientId) {
    if (this.adaptationTimers.has(clientId)) {
      return; // Timer already running
    }

    const timer = setInterval(() => {
      this.evaluateQualityAdaptation(clientId);
    }, this.config.adaptationInterval);

    this.adaptationTimers.set(clientId, timer);

    this.logger.debug('Adaptation timer started', {
      clientId,
      interval: this.config.adaptationInterval
    });
  }

  /**
   * Clear adaptation timer for a client
   */
  clearAdaptationTimer(clientId) {
    const timer = this.adaptationTimers.get(clientId);
    if (timer) {
      clearInterval(timer);
      this.adaptationTimers.delete(clientId);
      
      this.logger.debug('Adaptation timer cleared', { clientId });
    }
  }

  /**
   * Evaluate and potentially adapt quality for a client
   */
  async evaluateQualityAdaptation(clientId) {
    try {
      const clientData = this.clientStats.get(clientId);
      if (!clientData) {
        return;
      }

      const { networkHistory, currentQuality } = clientData;
      
      // Need at least 2 measurements for adaptation
      if (networkHistory.length < 2) {
        this.logger.debug('Insufficient network history for adaptation', {
          clientId,
          measurements: networkHistory.length
        });
        return;
      }

      // Calculate average network conditions
      const avgStats = this.calculateAverageNetworkStats(networkHistory);
      const recommendedQuality = this.determineOptimalQuality(avgStats, currentQuality);

      if (recommendedQuality !== currentQuality) {
        const canAdapt = this.shouldAdaptQuality(clientData, recommendedQuality);
        
        if (canAdapt) {
          await this.adaptClientQuality(clientId, recommendedQuality, avgStats);
        } else {
          this.logger.debug('Quality adaptation delayed', {
            clientId,
            current: currentQuality,
            recommended: recommendedQuality,
            reason: 'stabilization period'
          });
        }
      } else {
        // Quality is stable, increment stabilization counter
        clientData.stabilizationCounter++;
        if (clientData.stabilizationCounter >= this.config.stabilizationWindow) {
          clientData.isStable = true;
        }
      }

    } catch (error) {
      this.logger.error('Failed to evaluate quality adaptation', {
        clientId,
        error: error.message
      });
    }
  }

  /**
   * Calculate average network statistics
   */
  calculateAverageNetworkStats(history) {
    if (history.length === 0) {
      return { bandwidth: 0, latency: 0, packetLoss: 0, jitter: 0 };
    }

    // Use recent measurements with higher weight
    const weights = history.map((_, index) => Math.pow(1.2, index));
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

    const weighted = {
      bandwidth: 0,
      latency: 0,
      packetLoss: 0,
      jitter: 0
    };

    history.forEach((stats, index) => {
      const weight = weights[index] / totalWeight;
      weighted.bandwidth += stats.bandwidth * weight;
      weighted.latency += stats.latency * weight;
      weighted.packetLoss += stats.packetLoss * weight;
      weighted.jitter += stats.jitter * weight;
    });

    return weighted;
  }

  /**
   * Determine optimal quality based on network conditions
   */
  determineOptimalQuality(networkStats, currentQuality) {
    const { bandwidth, latency, packetLoss } = networkStats;
    const safetyMargin = this.config.bandwidthSafetyMargin;
    
    // Apply safety margin to available bandwidth
    const availableBandwidth = bandwidth * safetyMargin;

    // Check each quality level from highest to lowest
    for (let i = this.qualityLevels.length - 1; i >= 0; i--) {
      const quality = this.qualityLevels[i];
      const threshold = this.qualityThresholds[quality];

      const meetsRequirements = 
        availableBandwidth >= threshold.minBandwidth &&
        latency <= threshold.maxLatency &&
        packetLoss <= threshold.maxPacketLoss;

      if (meetsRequirements) {
        return quality;
      }
    }

    // Fallback to lowest quality if no requirements are met
    return 'low';
  }

  /**
   * Check if quality adaptation should proceed
   */
  shouldAdaptQuality(clientData, targetQuality) {
    const now = Date.now();
    const timeSinceLastAdaptation = now - clientData.lastAdaptation;
    const currentIndex = this.qualityLevels.indexOf(clientData.currentQuality);
    const targetIndex = this.qualityLevels.indexOf(targetQuality);
    
    const isUpgrade = targetIndex > currentIndex;
    const isDowngrade = targetIndex < currentIndex;

    // Downgrade immediately if network conditions are poor
    if (isDowngrade) {
      return timeSinceLastAdaptation >= this.config.qualityRampDownDelay;
    }

    // Upgrade more conservatively to avoid oscillation
    if (isUpgrade) {
      const requiredDelay = this.config.qualityRampUpDelay;
      const isStabilized = clientData.stabilizationCounter >= this.config.stabilizationWindow;
      
      return timeSinceLastAdaptation >= requiredDelay && isStabilized;
    }

    return false;
  }

  /**
   * Adapt client quality
   */
  async adaptClientQuality(clientId, newQuality, networkStats) {
    try {
      const clientData = this.clientStats.get(clientId);
      if (!clientData) {
        throw new Error('Client not found');
      }

      const oldQuality = clientData.currentQuality;
      const now = Date.now();

      // Update client data
      clientData.currentQuality = newQuality;
      clientData.targetQuality = newQuality;
      clientData.lastAdaptation = now;
      clientData.adaptationCount++;
      clientData.stabilizationCounter = 0;
      clientData.isStable = false;

      // Update quality history
      const history = this.qualityHistory.get(clientId);
      history.push(newQuality);
      
      // Keep history limited
      if (history.length > 20) {
        history.shift();
      }

      // Log adaptation decision
      this.logger.info('Quality adapted for client', {
        clientId,
        from: oldQuality,
        to: newQuality,
        bandwidth: Math.round(networkStats.bandwidth / 1000) + 'kbps',
        latency: networkStats.latency + 'ms',
        packetLoss: (networkStats.packetLoss * 100).toFixed(2) + '%',
        adaptationCount: clientData.adaptationCount
      });

      // Emit adaptation event
      this.emit('qualityAdapted', {
        clientId,
        streamId: clientData.streamId,
        oldQuality,
        newQuality,
        networkStats,
        adaptationCount: clientData.adaptationCount
      });

      return true;

    } catch (error) {
      this.logger.error('Failed to adapt client quality', {
        clientId,
        quality: newQuality,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get quality recommendation for client
   */
  getQualityRecommendation(clientId) {
    const clientData = this.clientStats.get(clientId);
    if (!clientData) {
      return null;
    }

    if (clientData.networkHistory.length === 0) {
      return {
        recommended: clientData.currentQuality,
        confidence: 'low',
        reason: 'insufficient_data'
      };
    }

    const avgStats = this.calculateAverageNetworkStats(clientData.networkHistory);
    const recommendedQuality = this.determineOptimalQuality(avgStats, clientData.currentQuality);
    
    // Calculate confidence based on measurement consistency
    const variations = this.calculateNetworkVariation(clientData.networkHistory);
    const confidence = variations < 0.2 ? 'high' : variations < 0.5 ? 'medium' : 'low';
    
    const reason = recommendedQuality !== clientData.currentQuality ? 
      'network_conditions_changed' : 'optimal_quality';

    return {
      recommended: recommendedQuality,
      current: clientData.currentQuality,
      confidence,
      reason,
      networkStats: avgStats,
      measurements: clientData.networkHistory.length
    };
  }

  /**
   * Calculate network variation for confidence assessment
   */
  calculateNetworkVariation(history) {
    if (history.length < 2) {
      return 1.0; // High variation for insufficient data
    }

    const bandwidths = history.map(h => h.bandwidth);
    const latencies = history.map(h => h.latency);
    
    const bwVariation = this.calculateCoeffientOfVariation(bandwidths);
    const latencyVariation = this.calculateCoeffientOfVariation(latencies);
    
    // Return average variation
    return (bwVariation + latencyVariation) / 2;
  }

  /**
   * Calculate coefficient of variation
   */
  calculateCoeffientOfVariation(values) {
    if (values.length === 0) return 1.0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    return mean > 0 ? stdDev / mean : 1.0;
  }

  /**
   * Get client quality statistics
   */
  getClientStats(clientId) {
    const clientData = this.clientStats.get(clientId);
    if (!clientData) {
      return null;
    }

    const history = this.qualityHistory.get(clientId) || [];
    const networkHistory = clientData.networkHistory;
    
    const avgStats = networkHistory.length > 0 ? 
      this.calculateAverageNetworkStats(networkHistory) : null;

    return {
      clientId,
      streamId: clientData.streamId,
      currentQuality: clientData.currentQuality,
      targetQuality: clientData.targetQuality,
      adaptationCount: clientData.adaptationCount,
      isStable: clientData.isStable,
      stabilizationCounter: clientData.stabilizationCounter,
      registeredAt: clientData.registeredAt,
      lastAdaptation: clientData.lastAdaptation,
      lastUpdate: clientData.lastUpdate,
      qualityHistory: history.slice(-10), // Last 10 quality changes
      networkStats: avgStats,
      measurements: networkHistory.length
    };
  }

  /**
   * Get all monitored clients
   */
  getAllClientStats() {
    const stats = {};
    
    for (const clientId of this.clientStats.keys()) {
      stats[clientId] = this.getClientStats(clientId);
    }
    
    return stats;
  }

  /**
   * Get quality manager statistics
   */
  getManagerStats() {
    const clients = Array.from(this.clientStats.values());
    
    const qualityDistribution = {};
    this.qualityLevels.forEach(level => {
      qualityDistribution[level] = clients.filter(c => c.currentQuality === level).length;
    });

    const totalAdaptations = clients.reduce((sum, client) => sum + client.adaptationCount, 0);
    const stableClients = clients.filter(c => c.isStable).length;

    return {
      totalClients: clients.length,
      stableClients,
      unstableClients: clients.length - stableClients,
      qualityDistribution,
      totalAdaptations,
      adaptationEnabled: this.config.enableAdaptation,
      adaptationInterval: this.config.adaptationInterval,
      availableQualities: this.qualityLevels
    };
  }

  /**
   * Enable or disable adaptive quality
   */
  setAdaptationEnabled(enabled) {
    const wasEnabled = this.config.enableAdaptation;
    this.config.enableAdaptation = enabled;

    if (enabled && !wasEnabled) {
      // Start timers for all registered clients
      for (const clientId of this.clientStats.keys()) {
        this.startAdaptationTimer(clientId);
      }
      this.logger.info('Quality adaptation enabled');
    } else if (!enabled && wasEnabled) {
      // Stop all timers
      for (const clientId of this.clientStats.keys()) {
        this.clearAdaptationTimer(clientId);
      }
      this.logger.info('Quality adaptation disabled');
    }

    this.emit('adaptationToggled', { enabled });
  }

  /**
   * Shutdown quality manager
   */
  shutdown() {
    try {
      this.logger.info('Shutting down quality manager', {
        clients: this.clientStats.size
      });

      // Clear all adaptation timers
      for (const clientId of this.adaptationTimers.keys()) {
        this.clearAdaptationTimer(clientId);
      }

      // Clear all data
      this.clientStats.clear();
      this.qualityHistory.clear();
      this.adaptationTimers.clear();

      this.emit('shutdown');
      this.logger.info('Quality manager shutdown complete');

    } catch (error) {
      this.logger.error('Error during quality manager shutdown', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = QualityManager;
