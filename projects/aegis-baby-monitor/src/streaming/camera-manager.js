const EventEmitter = require('events');
const { createLogger } = require('../utils/logger');

class CameraManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = createLogger('CameraManager');
    this.isInitialized = false;
    this.isStreaming = false;
    this.mediaStream = null;
    
    // Configuration
    this.config = {
      devicePath: options.devicePath || '/dev/video0',
      width: parseInt(options.width) || 1280,
      height: parseInt(options.height) || 720,
      fps: parseInt(options.fps) || 30,
      qualityPreset: options.qualityPreset || 'medium'
    };
    
    // Quality presets
    this.qualityPresets = {
      low: { width: 640, height: 480, fps: 15, bitrate: 500000 },
      medium: { width: 1280, height: 720, fps: 30, bitrate: 1500000 },
      high: { width: 1920, height: 1080, fps: 30, bitrate: 3000000 }
    };
    
    // Apply quality preset
    this.applyQualityPreset(this.config.qualityPreset);
    
    this.logger.info('Camera Manager initialized', {
      devicePath: this.config.devicePath,
      resolution: `${this.config.width}x${this.config.height}`,
      fps: this.config.fps,
      preset: this.config.qualityPreset
    });
  }

  /**
   * Apply quality preset to configuration
   */
  applyQualityPreset(preset) {
    const presetConfig = this.qualityPresets[preset];
    if (presetConfig) {
      this.config = { ...this.config, ...presetConfig };
      this.logger.info('Quality preset applied', { preset, config: presetConfig });
    } else {
      this.logger.warn('Unknown quality preset', { preset });
    }
  }

  /**
   * Initialize camera and create media stream
   */
  async initialize() {
    try {
      this.logger.info('Initializing camera...');
      
      // In a real implementation, this would interface with the camera hardware
      // For development/testing, we'll create a mock media stream
      this.mediaStream = await this.createMockMediaStream();
      
      this.isInitialized = true;
      this.logger.info('Camera initialized successfully');
      this.emit('initialized', { stream: this.mediaStream });
      
      return this.mediaStream;
      
    } catch (error) {
      this.logger.error('Failed to initialize camera', { error: error.message });
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Create a mock media stream for development/testing
   * In production, this would be replaced with actual camera capture
   */
  async createMockMediaStream() {
    // This is a placeholder for actual camera capture
    // In a real implementation, you would use:
    // - node-webrtc's getUserMedia equivalent
    // - OpenCV camera capture
    // - V4L2 bindings for Linux
    // - Platform-specific camera APIs
    
    this.logger.info('Creating mock media stream for development');
    
    // Mock implementation - in real app this would capture from camera
    const mockStream = {
      id: 'mock-camera-stream',
      active: true,
      getTracks: () => [
        {
          id: 'video-track-1',
          kind: 'video',
          enabled: true,
          readyState: 'live',
          getSettings: () => ({
            width: this.config.width,
            height: this.config.height,
            frameRate: this.config.fps
          })
        }
      ],
      getVideoTracks: () => [
        {
          id: 'video-track-1',
          kind: 'video',
          enabled: true,
          readyState: 'live'
        }
      ],
      getAudioTracks: () => []
    };
    
    return mockStream;
  }

  /**
   * Start streaming
   */
  async startStreaming() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      if (this.isStreaming) {
        this.logger.warn('Camera is already streaming');
        return this.mediaStream;
      }
      
      this.isStreaming = true;
      this.logger.info('Camera streaming started');
      this.emit('streamingStarted', { stream: this.mediaStream });
      
      return this.mediaStream;
      
    } catch (error) {
      this.logger.error('Failed to start streaming', { error: error.message });
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Stop streaming
   */
  stopStreaming() {
    try {
      if (!this.isStreaming) {
        this.logger.warn('Camera is not streaming');
        return;
      }
      
      if (this.mediaStream) {
        // Stop all tracks
        this.mediaStream.getTracks().forEach(track => {
          if (track.stop) {
            track.stop();
          }
        });
      }
      
      this.isStreaming = false;
      this.logger.info('Camera streaming stopped');
      this.emit('streamingStopped');
      
    } catch (error) {
      this.logger.error('Failed to stop streaming', { error: error.message });
      this.emit('error', error);
    }
  }

  /**
   * Change camera quality preset
   */
  async changeQualityPreset(preset) {
    try {
      const wasStreaming = this.isStreaming;
      
      if (wasStreaming) {
        this.stopStreaming();
      }
      
      this.applyQualityPreset(preset);
      
      // Reinitialize with new settings
      if (this.isInitialized) {
        this.isInitialized = false;
        await this.initialize();
      }
      
      if (wasStreaming) {
        await this.startStreaming();
      }
      
      this.logger.info('Quality preset changed', { preset });
      this.emit('qualityChanged', { preset, config: this.config });
      
    } catch (error) {
      this.logger.error('Failed to change quality preset', { 
        preset, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Get camera capabilities
   */
  getCapabilities() {
    return {
      devicePath: this.config.devicePath,
      currentResolution: {
        width: this.config.width,
        height: this.config.height
      },
      currentFps: this.config.fps,
      qualityPreset: this.config.qualityPreset,
      availablePresets: Object.keys(this.qualityPresets),
      isInitialized: this.isInitialized,
      isStreaming: this.isStreaming
    };
  }

  /**
   * Get current stream statistics
   */
  getStreamStats() {
    if (!this.mediaStream) {
      return null;
    }
    
    const videoTracks = this.mediaStream.getVideoTracks();
    if (videoTracks.length === 0) {
      return null;
    }
    
    const videoTrack = videoTracks[0];
    const settings = videoTrack.getSettings ? videoTrack.getSettings() : {};
    
    return {
      streamId: this.mediaStream.id,
      trackId: videoTrack.id,
      enabled: videoTrack.enabled,
      readyState: videoTrack.readyState,
      settings: {
        width: settings.width || this.config.width,
        height: settings.height || this.config.height,
        frameRate: settings.frameRate || this.config.fps
      },
      config: {
        devicePath: this.config.devicePath,
        qualityPreset: this.config.qualityPreset
      },
      status: {
        isInitialized: this.isInitialized,
        isStreaming: this.isStreaming
      }
    };
  }

  /**
   * Capture a single frame (screenshot)
   */
  async captureFrame() {
    try {
      if (!this.isStreaming) {
        throw new Error('Camera is not streaming');
      }
      
      // In a real implementation, this would capture a frame from the video stream
      // For now, return mock frame data
      const frameData = {
        timestamp: new Date().toISOString(),
        width: this.config.width,
        height: this.config.height,
        format: 'jpeg',
        size: Math.floor(Math.random() * 100000) + 50000, // Mock size
        data: 'mock-frame-data' // In real implementation, this would be image buffer
      };
      
      this.logger.debug('Frame captured', { 
        timestamp: frameData.timestamp,
        size: frameData.size 
      });
      
      this.emit('frameCaptured', frameData);
      return frameData;
      
    } catch (error) {
      this.logger.error('Failed to capture frame', { error: error.message });
      throw error;
    }
  }

  /**
   * Shutdown camera manager
   */
  shutdown() {
    try {
      this.logger.info('Shutting down camera manager');
      
      this.stopStreaming();
      
      if (this.mediaStream) {
        this.mediaStream = null;
      }
      
      this.isInitialized = false;
      this.emit('shutdown');
      
      this.logger.info('Camera manager shutdown complete');
      
    } catch (error) {
      this.logger.error('Error during camera manager shutdown', { 
        error: error.message 
      });
    }
  }
}

module.exports = CameraManager;
