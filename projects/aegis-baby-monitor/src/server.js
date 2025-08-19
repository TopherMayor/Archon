require('dotenv').config();

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// Internal modules
const { createLogger } = require('./utils/logger');
const WebRTCServer = require('./streaming/webrtc-server');
const CameraManager = require('./streaming/camera-manager');
const VideoStreamProcessor = require('./video/stream-processor');
const QualityManager = require('./video/quality-manager');

// Alert system modules
const AlertManager = require('./alerts/alert-manager');
const NotificationService = require('./alerts/notification-service');
const UserPreferences = require('./alerts/user-preferences');
const AlertHistory = require('./alerts/alert-history');
const createAlertRoutes = require('./routes/alerts');

class AegisBabyMonitorServer {
  constructor() {
    this.logger = createLogger('AegisServer');
    this.port = process.env.PORT || 3000;
    this.webrtcPort = process.env.WEBRTC_PORT || 8080;
    
    // Initialize Express app
    this.app = express();
    this.server = http.createServer(this.app);
    
    // Initialize Socket.IO
    this.io = socketIo(this.server, {
      cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"]
      }
    });
    
    // Initialize components
    this.webrtcServer = new WebRTCServer({
      stunServer: process.env.STUN_SERVER,
      turnServer: process.env.TURN_SERVER,
      turnUsername: process.env.TURN_USERNAME,
      turnCredential: process.env.TURN_CREDENTIAL
    });
    
    this.cameraManager = new CameraManager({
      devicePath: process.env.CAMERA_DEVICE_PATH,
      width: process.env.VIDEO_WIDTH,
      height: process.env.VIDEO_HEIGHT,
      fps: process.env.VIDEO_FPS,
      qualityPreset: process.env.STREAM_QUALITY_PRESET
    });
    
    // Initialize video processing
    this.videoProcessor = new VideoStreamProcessor({
      maxConcurrentStreams: parseInt(process.env.MAX_CONCURRENT_STREAMS) || 10,
      adaptiveStreaming: process.env.ADAPTIVE_STREAMING !== 'false'
    });
    
    // Initialize quality management
    this.qualityManager = new QualityManager({
      adaptationInterval: parseInt(process.env.QUALITY_ADAPTATION_INTERVAL) || 5000,
      enableAdaptation: process.env.ADAPTIVE_STREAMING !== 'false'
    });
    
    // Initialize alert system
    this.logger.info('Initializing alert system...');
    this.userPreferences = new UserPreferences();
    this.alertHistory = new AlertHistory();
    this.notificationService = new NotificationService();
    this.alertManager = new AlertManager();
    
    // Wire up alert system dependencies
    this.alertManager.setNotificationService(this.notificationService);
    this.alertManager.setUserPreferences(this.userPreferences);
    
    // Connected clients
    this.clients = new Map();
    
    this.logger.info('Aegis Baby Monitor Server initialized');
  }

  /**
   * Set up Express middleware
   */
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          mediaSrc: ["'self'", "blob:", "mediastream:"],
          connectSrc: ["'self'", "ws:", "wss:"]
        }
      }
    }));
    
    // CORS middleware
    this.app.use(cors({
      origin: process.env.CORS_ORIGIN || true,
      credentials: true
    }));
    
    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Static file serving
    this.app.use(express.static(path.join(__dirname, '../public')));
    
    // Request logging
    this.app.use((req, res, next) => {
      this.logger.http('HTTP Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
    
    this.logger.info('Express middleware configured');
  }

  /**
   * Set up API routes
   */
  setupRoutes() {
// Health check endpoint
    this.app.get('/api/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          webrtc: this.webrtcServer ? 'running' : 'stopped',
          camera: this.cameraManager.isInitialized ? 'initialized' : 'not initialized',
          videoProcessor: this.videoProcessor ? 'running' : 'stopped',
          qualityManager: this.qualityManager ? 'running' : 'stopped'
        }
      });
    });

    // Camera control endpoints
    this.app.get('/api/camera/status', (req, res) => {
      try {
        const capabilities = this.cameraManager.getCapabilities();
        const stats = this.cameraManager.getStreamStats();
        
        res.json({
          success: true,
          capabilities,
          stats
        });
      } catch (error) {
        this.logger.error('Failed to get camera status', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.post('/api/camera/start', async (req, res) => {
      try {
        await this.cameraManager.startStreaming();
        res.json({
          success: true,
          message: 'Camera streaming started'
        });
      } catch (error) {
        this.logger.error('Failed to start camera', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.post('/api/camera/stop', (req, res) => {
      try {
        this.cameraManager.stopStreaming();
        res.json({
          success: true,
          message: 'Camera streaming stopped'
        });
      } catch (error) {
        this.logger.error('Failed to stop camera', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.post('/api/camera/quality', async (req, res) => {
      try {
        const { preset } = req.body;
        if (!preset) {
          return res.status(400).json({
            success: false,
            error: 'Quality preset is required'
          });
        }
        
        await this.cameraManager.changeQualityPreset(preset);
        res.json({
          success: true,
          message: `Quality preset changed to ${preset}`
        });
      } catch (error) {
        this.logger.error('Failed to change quality preset', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

// Video processor endpoints
    this.app.get('/api/video/streams', (req, res) => {
      try {
        const streams = this.videoProcessor.getAllStreams();
        res.json({
          success: true,
          streams,
          count: Object.keys(streams).length
        });
      } catch (error) {
        this.logger.error('Failed to get streams', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.get('/api/video/processor/stats', (req, res) => {
      try {
        const stats = this.videoProcessor.getProcessorStats();
        res.json({
          success: true,
          stats
        });
      } catch (error) {
        this.logger.error('Failed to get processor stats', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Quality manager endpoints
    this.app.get('/api/video/quality/stats', (req, res) => {
      try {
        const stats = this.qualityManager.getManagerStats();
        res.json({
          success: true,
          stats
        });
      } catch (error) {
        this.logger.error('Failed to get quality stats', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.post('/api/video/quality/adaptation', (req, res) => {
      try {
        const { enabled } = req.body;
        if (enabled === undefined) {
          return res.status(400).json({
            success: false,
            error: 'Enabled parameter is required'
          });
        }

        this.qualityManager.setAdaptationEnabled(enabled === true);
        res.json({
          success: true,
          message: `Quality adaptation ${enabled ? 'enabled' : 'disabled'}`
        });
      } catch (error) {
        this.logger.error('Failed to set adaptation', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });
    
    // WebRTC connection stats
    this.app.get('/api/webrtc/connections', (req, res) => {
      try {
        const connections = this.webrtcServer.getActiveConnections();
        res.json({
          success: true,
          connections,
          count: Object.keys(connections).length
        });
      } catch (error) {
        this.logger.error('Failed to get WebRTC connections', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Alert system routes
    this.app.use('/api/alerts', createAlertRoutes({
      alertManager: this.alertManager,
      notificationService: this.notificationService,
      userPreferences: this.userPreferences,
      alertHistory: this.alertHistory
    }));

    // Serve main page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    this.logger.info('API routes configured');
  }

  /**
   * Set up alert system event integrations
   */
  setupAlertSystemEvents() {
    // Monitor camera for motion detection
    this.cameraManager.on('motionDetected', async (data) => {
      try {
        await this.alertManager.createAlert({
          type: 'motion',
          priority: 'medium',
          metadata: {
            sensitivity: data.sensitivity || 'unknown',
            confidence: data.confidence || 0.8,
            area: data.area || 'unknown'
          },
          sourceData: data
        });
      } catch (error) {
        this.logger.error('Failed to create motion alert:', error);
      }
    });

    // Monitor for sound/cry detection
    this.cameraManager.on('soundDetected', async (data) => {
      try {
        const alertType = data.isCrying ? 'cry_detected' : 'sound';
        const priority = data.isCrying ? 'critical' : 'high';
        
        await this.alertManager.createAlert({
          type: alertType,
          priority,
          metadata: {
            volume: data.volume || 'unknown',
            duration: data.duration || 0,
            confidence: data.confidence || 0.7
          },
          sourceData: data
        });
      } catch (error) {
        this.logger.error('Failed to create sound alert:', error);
      }
    });

    // Monitor system health
    this.cameraManager.on('error', async (error) => {
      try {
        await this.alertManager.createAlert({
          type: 'camera',
          priority: 'high',
          metadata: {
            error: error.message,
            component: 'camera'
          },
          sourceData: { error: error.toString() }
        });
      } catch (alertError) {
        this.logger.error('Failed to create camera error alert:', alertError);
      }
    });

    this.webrtcServer.on('connectionError', async (data) => {
      try {
        await this.alertManager.createAlert({
          type: 'connection',
          priority: 'medium',
          metadata: {
            clientId: data.clientId,
            error: data.error
          },
          sourceData: data
        });
      } catch (error) {
        this.logger.error('Failed to create connection alert:', error);
      }
    });

    // Forward alert events to clients via Socket.IO
    this.alertManager.on('alertCreated', (alert) => {
      this.io.emit('alert:created', {
        id: alert.id,
        type: alert.type,
        priority: alert.priority,
        title: alert.title,
        message: alert.message,
        timestamp: alert.timestamp
      });
    });

    this.alertManager.on('alertAcknowledged', (alert) => {
      this.io.emit('alert:acknowledged', {
        id: alert.id,
        acknowledgedAt: alert.acknowledgedAt,
        acknowledgedBy: alert.acknowledgedBy
      });
    });

    this.alertManager.on('alertResolved', (alert) => {
      this.io.emit('alert:resolved', {
        id: alert.id,
        resolvedAt: alert.resolvedAt,
        resolvedBy: alert.resolvedBy
      });
    });

    this.alertManager.on('alertEscalated', (alert) => {
      this.io.emit('alert:escalated', {
        id: alert.id,
        escalatedAt: alert.escalatedAt
      });
    });

    // Store alerts in history
    this.alertManager.on('alertCreated', async (alert) => {
      try {
        await this.alertHistory.storeAlert(alert);
      } catch (error) {
        this.logger.error('Failed to store alert in history:', error);
      }
    });

    this.logger.info('Alert system events configured');
  }

  /**
   * Set up Socket.IO event handlers
   */
  /**
   * Set up video processor events
   */
  setupVideoProcessorEvents() {
    // Forward quality adaptation events
    this.qualityManager.on('qualityAdapted', async ({ clientId, streamId, oldQuality, newQuality }) => {
      try {
        // Update video stream quality
        await this.videoProcessor.changeStreamQuality(streamId, newQuality);
        
        // Notify client
        const client = this.clients.get(clientId);
        if (client) {
          client.socket.emit('video:quality-changed', { 
            oldQuality, 
            newQuality,
            resolution: this.videoProcessor.qualityPresets[newQuality]
          });
        }
        
        this.logger.info('Client quality adapted', {
          clientId,
          streamId,
          from: oldQuality,
          to: newQuality
        });
      } catch (error) {
        this.logger.error('Error handling quality adaptation', {
          error: error.message,
          clientId,
          streamId
        });
      }
    });
    
    // Forward processed frames to clients
    this.videoProcessor.on('frameProcessed', ({ streamId, data, clients }) => {
      for (const clientId of clients) {
        const client = this.clients.get(clientId);
        if (client) {
          client.socket.emit('video:frame', { 
            streamId, 
            data: data.data.toString('base64'), // Convert buffer to base64 for transmission
            timestamp: data.timestamp,
            keyframe: data.keyframe || false
          });
        }
      }
    });
    
    // Log stream creation/destruction
    this.videoProcessor.on('streamCreated', ({ streamId, config }) => {
      this.logger.info('Video stream created', { 
        streamId, 
        quality: config.quality,
        resolution: `${config.preset.width}x${config.preset.height}`
      });
    });
    
    this.videoProcessor.on('streamDestroyed', ({ streamId }) => {
      this.logger.info('Video stream destroyed', { streamId });
    });
  }
  
  /**
   * Set up Socket.IO event handlers
   */
  setupSocketHandlers() {
    this.io.on('connection', async (socket) => {
      const clientId = socket.id;
      this.logger.info('Client connected', { clientId });
      
      // Store client
      this.clients.set(clientId, {
        socket,
        connectedAt: new Date().toISOString(),
        peerConnection: null
      });

      // Create default video stream for client
      const streamId = `stream-${clientId}`;
      try {
        await this.videoProcessor.createStream(streamId, { quality: 'medium' });
        this.videoProcessor.addClient(streamId, clientId);
        this.qualityManager.registerClient(clientId, streamId, 'medium');
      } catch (error) {
        this.logger.error('Failed to initialize video stream', {
          clientId,
          streamId,
          error: error.message
        });
      }
      
      // Network statistics reporting
      socket.on('network:stats', (data) => {
        try {
          this.qualityManager.updateNetworkStats(clientId, data.stats);
        } catch (error) {
          this.logger.error('Failed to process network stats', {
            clientId,
            error: error.message
          });
        }
      });
      
      // Video control handlers
      socket.on('video:quality', async (data) => {
        try {
          const { quality } = data;
          const streamId = `stream-${clientId}`;
          
          await this.videoProcessor.changeStreamQuality(streamId, quality);
          
          socket.emit('video:quality-changed', { 
            quality,
            resolution: this.videoProcessor.qualityPresets[quality]
          });
          
          this.logger.info('Client manually changed quality', {
            clientId,
            streamId,
            quality
          });
        } catch (error) {
          this.logger.error('Failed to change video quality', {
            clientId,
            error: error.message
          });
          socket.emit('video:error', { error: error.message });
        }
      });
      
      // WebRTC signaling handlers
      socket.on('webrtc:offer', async (data) => {
        try {
          this.logger.debug('WebRTC offer received', { clientId });
          
          // Create peer connection if not exists
          if (!this.clients.get(clientId).peerConnection) {
            const mediaStream = await this.cameraManager.startStreaming();
            await this.webrtcServer.createPeerConnection(clientId, mediaStream);
            this.clients.get(clientId).peerConnection = true;
          }
          
          // Handle the offer
          const answer = await this.webrtcServer.handleOffer(clientId, data.offer);
          
          // Send answer back to client
          socket.emit('webrtc:answer', { answer });
          
        } catch (error) {
          this.logger.error('Failed to handle WebRTC offer', { 
            clientId, 
            error: error.message 
          });
          socket.emit('webrtc:error', { error: error.message });
        }
      });

      socket.on('webrtc:ice-candidate', async (data) => {
        try {
          this.logger.debug('ICE candidate received', { clientId });
          await this.webrtcServer.handleIceCandidate(clientId, data.candidate);
        } catch (error) {
          this.logger.error('Failed to handle ICE candidate', { 
            clientId, 
            error: error.message 
          });
        }
      });

      // Camera control handlers
      socket.on('camera:capture-frame', async () => {
        try {
          const frame = await this.cameraManager.captureFrame();
          socket.emit('camera:frame-captured', frame);
        } catch (error) {
          this.logger.error('Failed to capture frame', { 
            clientId, 
            error: error.message 
          });
          socket.emit('camera:error', { error: error.message });
        }
      });

      // Client disconnection
      socket.on('disconnect', () => {
        this.logger.info('Client disconnected', { clientId });
        
        // Clean up peer connection
        this.webrtcServer.closePeerConnection(clientId);
        
        // Clean up video streams
        try {
          const streamId = `stream-${clientId}`;
          this.videoProcessor.removeClient(streamId, clientId);
          this.qualityManager.unregisterClient(clientId);
        } catch (error) {
          this.logger.error('Error cleaning up video resources', {
            clientId, 
            error: error.message
          });
        }
        
        // Remove client
        this.clients.delete(clientId);
      });
    });

    // Set up WebRTC server event handlers
    this.webrtcServer.on('iceCandidate', ({ clientId, candidate }) => {
      const client = this.clients.get(clientId);
      if (client) {
        client.socket.emit('webrtc:ice-candidate', { candidate });
      }
    });

    this.webrtcServer.on('connectionStateChange', ({ clientId, state }) => {
      const client = this.clients.get(clientId);
      if (client) {
        client.socket.emit('webrtc:connection-state', { state });
      }
    });

    this.logger.info('Socket.IO handlers configured');
  }

  /**
   * Start the server
   */
  async start() {
    try {
      this.logger.info('Starting Aegis Baby Monitor Server...');
      
      // Set up middleware and routes
      this.setupMiddleware();
      this.setupRoutes();
      this.setupSocketHandlers();
      
      // Initialize camera
      this.logger.info('Initializing camera...');
      await this.cameraManager.initialize();
      
      // Set up video processor events
      this.setupVideoProcessorEvents();
      
      // Set up alert system events
      this.setupAlertSystemEvents();
      
      // Start HTTP server
      this.server.listen(this.port, () => {
        this.logger.info('Server started successfully', {
          port: this.port,
          webrtcPort: this.webrtcPort,
          environment: process.env.NODE_ENV || 'development'
        });
      });
      
      // Handle graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      this.logger.error('Failed to start server', { error: error.message });
      process.exit(1);
    }
  }

  /**
   * Set up graceful shutdown handlers
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      this.logger.info('Shutdown signal received', { signal });
      
      try {
        // Close server
        this.server.close(() => {
          this.logger.info('HTTP server closed');
        });
        
        // Shutdown components
        this.webrtcServer.shutdown();
        this.cameraManager.shutdown();
        this.videoProcessor.shutdown();
        this.qualityManager.shutdown();
        
        // Shutdown alert system
        if (this.alertManager) {
          this.alertManager.destroy();
        }
        
        this.logger.info('Graceful shutdown complete');
        process.exit(0);
        
      } catch (error) {
        this.logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
      }
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection', { reason, promise });
      process.exit(1);
    });
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new AegisBabyMonitorServer();
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = AegisBabyMonitorServer;
