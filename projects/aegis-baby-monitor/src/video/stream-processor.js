const EventEmitter = require('events');
const { createLogger } = require('../utils/logger');

class VideoStreamProcessor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = createLogger('VideoStreamProcessor');
    
    // Configuration
    this.config = {
      maxConcurrentStreams: parseInt(options.maxConcurrentStreams) || 10,
      adaptiveStreaming: options.adaptiveStreaming !== false,
      bitrateControl: options.bitrateControl !== false,
      frameRateControl: options.frameRateControl !== false
    };
    
    // Active streams tracking
    this.activeStreams = new Map();
    this.streamStats = new Map();
    
    // Quality presets with detailed encoding parameters
    this.qualityPresets = {
      low: {
        width: 640,
        height: 480,
        fps: 15,
        bitrate: 500000,
        keyframeInterval: 30,
        codec: 'h264',
        profile: 'baseline',
        level: '3.0'
      },
      medium: {
        width: 1280,
        height: 720,
        fps: 30,
        bitrate: 1500000,
        keyframeInterval: 60,
        codec: 'h264',
        profile: 'main',
        level: '3.1'
      },
      high: {
        width: 1920,
        height: 1080,
        fps: 30,
        bitrate: 3000000,
        keyframeInterval: 90,
        codec: 'h264',
        profile: 'high',
        level: '4.0'
      },
      ultra: {
        width: 2560,
        height: 1440,
        fps: 60,
        bitrate: 6000000,
        keyframeInterval: 120,
        codec: 'h264',
        profile: 'high',
        level: '5.0'
      }
    };
    
    // Adaptive streaming thresholds
    this.adaptiveThresholds = {
      bandwidth: {
        low: 800000,    // < 800 kbps
        medium: 2000000, // < 2 Mbps
        high: 5000000   // < 5 Mbps
      },
      latency: {
        good: 100,      // < 100ms
        fair: 300,      // < 300ms
        poor: 1000      // > 1000ms
      },
      packetLoss: {
        good: 0.01,     // < 1%
        fair: 0.05,     // < 5%
        poor: 0.1       // > 10%
      }
    };
    
    this.logger.info('Video Stream Processor initialized', {
      maxStreams: this.config.maxConcurrentStreams,
      adaptiveStreaming: this.config.adaptiveStreaming,
      presets: Object.keys(this.qualityPresets)
    });
  }

  /**
   * Create a new video stream with specified quality
   */
  async createStream(streamId, options = {}) {
    try {
      if (this.activeStreams.has(streamId)) {
        throw new Error(`Stream ${streamId} already exists`);
      }

      if (this.activeStreams.size >= this.config.maxConcurrentStreams) {
        throw new Error('Maximum concurrent streams reached');
      }

      const qualityPreset = options.quality || 'medium';
      const preset = this.qualityPresets[qualityPreset];
      
      if (!preset) {
        throw new Error(`Invalid quality preset: ${qualityPreset}`);
      }

      // Create stream configuration
      const streamConfig = {
        id: streamId,
        quality: qualityPreset,
        preset: { ...preset },
        options: { ...options },
        createdAt: new Date().toISOString(),
        clients: new Set(),
        state: 'initializing'
      };

      // Apply custom overrides
      if (options.width) streamConfig.preset.width = parseInt(options.width);
      if (options.height) streamConfig.preset.height = parseInt(options.height);
      if (options.fps) streamConfig.preset.fps = parseInt(options.fps);
      if (options.bitrate) streamConfig.preset.bitrate = parseInt(options.bitrate);

      // Initialize stream statistics
      this.streamStats.set(streamId, {
        startTime: Date.now(),
        frameCount: 0,
        bytesSent: 0,
        errors: 0,
        clients: 0,
        averageBitrate: 0,
        currentFps: 0,
        adaptiveChanges: 0,
        qualityHistory: [qualityPreset]
      });

      // Store stream
      this.activeStreams.set(streamId, streamConfig);

      // Initialize processing pipeline
      await this.initializeProcessingPipeline(streamConfig);

      streamConfig.state = 'active';
      
      this.logger.info('Video stream created', {
        streamId,
        quality: qualityPreset,
        resolution: `${streamConfig.preset.width}x${streamConfig.preset.height}`,
        fps: streamConfig.preset.fps,
        bitrate: streamConfig.preset.bitrate
      });

      this.emit('streamCreated', { streamId, config: streamConfig });
      return streamConfig;

    } catch (error) {
      this.logger.error('Failed to create video stream', {
        streamId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Initialize video processing pipeline for a stream
   */
  async initializeProcessingPipeline(streamConfig) {
    try {
      const { id: streamId, preset } = streamConfig;

      // Create processing pipeline components
      const pipeline = {
        decoder: await this.createDecoder(streamId, preset),
        encoder: await this.createEncoder(streamId, preset),
        scaler: await this.createScaler(streamId, preset),
        filter: await this.createVideoFilter(streamId, preset),
        muxer: await this.createMuxer(streamId, preset)
      };

      // Configure pipeline chain
      pipeline.chain = [
        'decoder',
        'scaler', 
        'filter',
        'encoder',
        'muxer'
      ];

      streamConfig.pipeline = pipeline;

      this.logger.debug('Processing pipeline initialized', {
        streamId,
        components: Object.keys(pipeline).filter(k => k !== 'chain')
      });

      return pipeline;

    } catch (error) {
      this.logger.error('Failed to initialize processing pipeline', {
        streamId: streamConfig.id,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Create video decoder for input stream
   */
  async createDecoder(streamId, preset) {
    // In a real implementation, this would use FFmpeg or similar
    // For now, return a mock decoder interface
    return {
      type: 'decoder',
      codec: preset.codec,
      initialize: async () => {
        this.logger.debug('Decoder initialized', { streamId, codec: preset.codec });
      },
      decode: async (inputData) => {
        // Mock decode operation
        return {
          frames: [{
            width: preset.width,
            height: preset.height,
            format: 'yuv420p',
            data: Buffer.alloc(preset.width * preset.height * 1.5), // YUV420 size
            timestamp: Date.now()
          }]
        };
      },
      destroy: async () => {
        this.logger.debug('Decoder destroyed', { streamId });
      }
    };
  }

  /**
   * Create video encoder for output stream
   */
  async createEncoder(streamId, preset) {
    return {
      type: 'encoder',
      codec: preset.codec,
      profile: preset.profile,
      level: preset.level,
      bitrate: preset.bitrate,
      fps: preset.fps,
      keyframeInterval: preset.keyframeInterval,
      initialize: async () => {
        this.logger.debug('Encoder initialized', {
          streamId,
          codec: preset.codec,
          bitrate: preset.bitrate
        });
      },
      encode: async (frameData) => {
        // Mock encode operation
        const encodedSize = Math.floor(preset.bitrate / preset.fps / 8);
        return {
          data: Buffer.alloc(encodedSize),
          keyframe: Math.random() < (1 / preset.keyframeInterval),
          timestamp: frameData.timestamp,
          size: encodedSize
        };
      },
      updateBitrate: async (newBitrate) => {
        preset.bitrate = newBitrate;
        this.logger.debug('Encoder bitrate updated', { streamId, bitrate: newBitrate });
      },
      destroy: async () => {
        this.logger.debug('Encoder destroyed', { streamId });
      }
    };
  }

  /**
   * Create video scaler for resolution adjustment
   */
  async createScaler(streamId, preset) {
    return {
      type: 'scaler',
      targetWidth: preset.width,
      targetHeight: preset.height,
      algorithm: 'lanczos',
      initialize: async () => {
        this.logger.debug('Scaler initialized', {
          streamId,
          resolution: `${preset.width}x${preset.height}`
        });
      },
      scale: async (frameData) => {
        // Mock scaling operation
        return {
          ...frameData,
          width: preset.width,
          height: preset.height,
          data: Buffer.alloc(preset.width * preset.height * 1.5)
        };
      },
      updateResolution: async (width, height) => {
        preset.width = width;
        preset.height = height;
        this.logger.debug('Scaler resolution updated', {
          streamId,
          resolution: `${width}x${height}`
        });
      },
      destroy: async () => {
        this.logger.debug('Scaler destroyed', { streamId });
      }
    };
  }

  /**
   * Create video filter for enhancement and processing
   */
  async createVideoFilter(streamId, preset) {
    return {
      type: 'filter',
      filters: ['denoise', 'enhance', 'stabilize'],
      initialize: async () => {
        this.logger.debug('Video filter initialized', { streamId });
      },
      filter: async (frameData) => {
        // Mock filtering operation
        return {
          ...frameData,
          filtered: true,
          enhancement: {
            denoise: 0.8,
            sharpness: 1.2,
            brightness: 1.0,
            contrast: 1.1
          }
        };
      },
      updateFilters: async (newFilters) => {
        this.filters = newFilters;
        this.logger.debug('Video filters updated', { streamId, filters: newFilters });
      },
      destroy: async () => {
        this.logger.debug('Video filter destroyed', { streamId });
      }
    };
  }

  /**
   * Create muxer for stream output
   */
  async createMuxer(streamId, preset) {
    return {
      type: 'muxer',
      format: 'mp4',
      container: 'fragmented',
      initialize: async () => {
        this.logger.debug('Muxer initialized', { streamId, format: 'mp4' });
      },
      mux: async (encodedData) => {
        // Mock muxing operation
        return {
          data: encodedData.data,
          format: 'mp4',
          fragment: true,
          timestamp: encodedData.timestamp,
          duration: 1000 / preset.fps // Frame duration in ms
        };
      },
      destroy: async () => {
        this.logger.debug('Muxer destroyed', { streamId });
      }
    };
  }

  /**
   * Add client to stream
   */
  addClient(streamId, clientId, clientOptions = {}) {
    try {
      const stream = this.activeStreams.get(streamId);
      if (!stream) {
        throw new Error(`Stream ${streamId} not found`);
      }

      if (stream.clients.has(clientId)) {
        this.logger.warn('Client already connected to stream', { streamId, clientId });
        return false;
      }

      // Add client with options
      stream.clients.add(clientId);
      
      // Update statistics
      const stats = this.streamStats.get(streamId);
      if (stats) {
        stats.clients = stream.clients.size;
      }

      // Store client-specific options
      if (!stream.clientOptions) {
        stream.clientOptions = new Map();
      }
      stream.clientOptions.set(clientId, clientOptions);

      this.logger.info('Client added to stream', {
        streamId,
        clientId,
        totalClients: stream.clients.size
      });

      this.emit('clientAdded', { streamId, clientId, totalClients: stream.clients.size });
      return true;

    } catch (error) {
      this.logger.error('Failed to add client to stream', {
        streamId,
        clientId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Remove client from stream
   */
  removeClient(streamId, clientId) {
    try {
      const stream = this.activeStreams.get(streamId);
      if (!stream) {
        this.logger.warn('Attempted to remove client from non-existent stream', {
          streamId,
          clientId
        });
        return false;
      }

      if (!stream.clients.has(clientId)) {
        this.logger.warn('Client not connected to stream', { streamId, clientId });
        return false;
      }

      // Remove client
      stream.clients.delete(clientId);
      
      // Clean up client options
      if (stream.clientOptions) {
        stream.clientOptions.delete(clientId);
      }

      // Update statistics
      const stats = this.streamStats.get(streamId);
      if (stats) {
        stats.clients = stream.clients.size;
      }

      this.logger.info('Client removed from stream', {
        streamId,
        clientId,
        remainingClients: stream.clients.size
      });

      this.emit('clientRemoved', { streamId, clientId, remainingClients: stream.clients.size });

      // Auto-cleanup stream if no clients remain
      if (stream.clients.size === 0 && stream.options.autoCleanup !== false) {
        setTimeout(() => {
          if (stream.clients.size === 0) {
            this.destroyStream(streamId);
          }
        }, 30000); // 30 second grace period
      }

      return true;

    } catch (error) {
      this.logger.error('Failed to remove client from stream', {
        streamId,
        clientId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process video frame through pipeline
   */
  async processFrame(streamId, frameData) {
    try {
      const stream = this.activeStreams.get(streamId);
      if (!stream || stream.state !== 'active') {
        throw new Error(`Stream ${streamId} not active`);
      }

      const { pipeline } = stream;
      let processedData = frameData;

      // Process through pipeline chain
      for (const component of pipeline.chain) {
        const processor = pipeline[component];
        
        switch (component) {
          case 'decoder':
            processedData = await processor.decode(processedData);
            break;
          case 'scaler':
            if (processedData.frames) {
              processedData.frames = await Promise.all(
                processedData.frames.map(frame => processor.scale(frame))
              );
            }
            break;
          case 'filter':
            if (processedData.frames) {
              processedData.frames = await Promise.all(
                processedData.frames.map(frame => processor.filter(frame))
              );
            }
            break;
          case 'encoder':
            if (processedData.frames) {
              processedData = await processor.encode(processedData.frames[0]);
            }
            break;
          case 'muxer':
            processedData = await processor.mux(processedData);
            break;
        }
      }

      // Update statistics
      this.updateStreamStats(streamId, processedData);

      // Emit processed frame
      this.emit('frameProcessed', {
        streamId,
        data: processedData,
        clients: Array.from(stream.clients)
      });

      return processedData;

    } catch (error) {
      this.logger.error('Failed to process frame', {
        streamId,
        error: error.message
      });
      
      // Update error statistics
      const stats = this.streamStats.get(streamId);
      if (stats) {
        stats.errors++;
      }
      
      throw error;
    }
  }

  /**
   * Update stream statistics
   */
  updateStreamStats(streamId, processedData) {
    const stats = this.streamStats.get(streamId);
    if (!stats) return;

    const now = Date.now();
    const elapsed = (now - stats.startTime) / 1000; // seconds

    stats.frameCount++;
    stats.bytesSent += processedData.size || 0;
    stats.averageBitrate = elapsed > 0 ? (stats.bytesSent * 8) / elapsed : 0;
    stats.currentFps = elapsed > 0 ? stats.frameCount / elapsed : 0;
    stats.lastFrameTime = now;
  }

  /**
   * Adapt stream quality based on network conditions
   */
  async adaptStreamQuality(streamId, networkStats) {
    try {
      if (!this.config.adaptiveStreaming) {
        return false;
      }

      const stream = this.activeStreams.get(streamId);
      if (!stream || stream.state !== 'active') {
        return false;
      }

      const currentQuality = stream.quality;
      let targetQuality = currentQuality;

      // Analyze network conditions
      const { bandwidth, latency, packetLoss } = networkStats;

      // Determine optimal quality based on network conditions
      if (bandwidth < this.adaptiveThresholds.bandwidth.low ||
          latency > this.adaptiveThresholds.latency.poor ||
          packetLoss > this.adaptiveThresholds.packetLoss.poor) {
        targetQuality = 'low';
      } else if (bandwidth < this.adaptiveThresholds.bandwidth.medium ||
                 latency > this.adaptiveThresholds.latency.fair ||
                 packetLoss > this.adaptiveThresholds.packetLoss.fair) {
        targetQuality = 'medium';
      } else if (bandwidth >= this.adaptiveThresholds.bandwidth.high &&
                 latency <= this.adaptiveThresholds.latency.good &&
                 packetLoss <= this.adaptiveThresholds.packetLoss.good) {
        targetQuality = 'high';
      }

      // Apply quality change if different
      if (targetQuality !== currentQuality) {
        await this.changeStreamQuality(streamId, targetQuality);
        
        // Update statistics
        const stats = this.streamStats.get(streamId);
        if (stats) {
          stats.adaptiveChanges++;
          stats.qualityHistory.push(targetQuality);
          
          // Keep history limited
          if (stats.qualityHistory.length > 10) {
            stats.qualityHistory.shift();
          }
        }

        this.logger.info('Adaptive quality change applied', {
          streamId,
          from: currentQuality,
          to: targetQuality,
          networkStats
        });

        return true;
      }

      return false;

    } catch (error) {
      this.logger.error('Failed to adapt stream quality', {
        streamId,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Change stream quality preset
   */
  async changeStreamQuality(streamId, newQuality) {
    try {
      const stream = this.activeStreams.get(streamId);
      if (!stream) {
        throw new Error(`Stream ${streamId} not found`);
      }

      const newPreset = this.qualityPresets[newQuality];
      if (!newPreset) {
        throw new Error(`Invalid quality preset: ${newQuality}`);
      }

      const oldQuality = stream.quality;
      
      // Update stream configuration
      stream.quality = newQuality;
      stream.preset = { ...newPreset };

      // Update pipeline components
      const { pipeline } = stream;
      
      if (pipeline.encoder) {
        await pipeline.encoder.updateBitrate(newPreset.bitrate);
      }
      
      if (pipeline.scaler) {
        await pipeline.scaler.updateResolution(newPreset.width, newPreset.height);
      }

      this.logger.info('Stream quality changed', {
        streamId,
        from: oldQuality,
        to: newQuality,
        resolution: `${newPreset.width}x${newPreset.height}`,
        bitrate: newPreset.bitrate
      });

      this.emit('qualityChanged', {
        streamId,
        oldQuality,
        newQuality,
        preset: newPreset
      });

      return true;

    } catch (error) {
      this.logger.error('Failed to change stream quality', {
        streamId,
        quality: newQuality,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get stream information
   */
  getStreamInfo(streamId) {
    const stream = this.activeStreams.get(streamId);
    const stats = this.streamStats.get(streamId);

    if (!stream) {
      return null;
    }

    return {
      id: streamId,
      quality: stream.quality,
      preset: stream.preset,
      state: stream.state,
      clients: Array.from(stream.clients),
      clientCount: stream.clients.size,
      createdAt: stream.createdAt,
      statistics: stats ? {
        runtime: stats.startTime ? (Date.now() - stats.startTime) / 1000 : 0,
        frameCount: stats.frameCount,
        bytesSent: stats.bytesSent,
        errors: stats.errors,
        averageBitrate: Math.round(stats.averageBitrate),
        currentFps: Math.round(stats.currentFps * 100) / 100,
        adaptiveChanges: stats.adaptiveChanges,
        qualityHistory: stats.qualityHistory.slice(-5) // Last 5 quality changes
      } : null
    };
  }

  /**
   * Get all active streams
   */
  getAllStreams() {
    const streams = {};
    
    for (const streamId of this.activeStreams.keys()) {
      streams[streamId] = this.getStreamInfo(streamId);
    }
    
    return streams;
  }

  /**
   * Get processor statistics
   */
  getProcessorStats() {
    const totalClients = Array.from(this.activeStreams.values())
      .reduce((sum, stream) => sum + stream.clients.size, 0);
    
    const totalFrames = Array.from(this.streamStats.values())
      .reduce((sum, stats) => sum + stats.frameCount, 0);
    
    const totalBytes = Array.from(this.streamStats.values())
      .reduce((sum, stats) => sum + stats.bytesSent, 0);

    return {
      activeStreams: this.activeStreams.size,
      maxStreams: this.config.maxConcurrentStreams,
      totalClients,
      totalFramesProcessed: totalFrames,
      totalBytesProcessed: totalBytes,
      adaptiveStreaming: this.config.adaptiveStreaming,
      availablePresets: Object.keys(this.qualityPresets)
    };
  }

  /**
   * Destroy a stream and clean up resources
   */
  async destroyStream(streamId) {
    try {
      const stream = this.activeStreams.get(streamId);
      if (!stream) {
        this.logger.warn('Attempted to destroy non-existent stream', { streamId });
        return false;
      }

      this.logger.info('Destroying stream', {
        streamId,
        clients: stream.clients.size,
        state: stream.state
      });

      // Clean up pipeline components
      if (stream.pipeline) {
        const { pipeline } = stream;
        
        for (const componentName of Object.keys(pipeline)) {
          if (componentName === 'chain') continue;
          
          const component = pipeline[componentName];
          if (component && typeof component.destroy === 'function') {
            try {
              await component.destroy();
            } catch (error) {
              this.logger.warn('Error destroying pipeline component', {
                streamId,
                component: componentName,
                error: error.message
              });
            }
          }
        }
      }

      // Remove from active streams
      this.activeStreams.delete(streamId);
      
      // Clean up statistics
      this.streamStats.delete(streamId);

      this.logger.info('Stream destroyed successfully', { streamId });
      this.emit('streamDestroyed', { streamId });

      return true;

    } catch (error) {
      this.logger.error('Failed to destroy stream', {
        streamId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Shutdown processor and clean up all resources
   */
  async shutdown() {
    try {
      this.logger.info('Shutting down video stream processor', {
        activeStreams: this.activeStreams.size
      });

      // Destroy all active streams
      const streamIds = Array.from(this.activeStreams.keys());
      await Promise.all(streamIds.map(streamId => 
        this.destroyStream(streamId).catch(error => 
          this.logger.error('Error destroying stream during shutdown', {
            streamId,
            error: error.message
          })
        )
      ));

      // Clear all data structures
      this.activeStreams.clear();
      this.streamStats.clear();

      this.emit('shutdown');
      this.logger.info('Video stream processor shutdown complete');

    } catch (error) {
      this.logger.error('Error during video stream processor shutdown', {
        error: error.message
      });
      throw error;
    }
  }
}

module.exports = VideoStreamProcessor;
