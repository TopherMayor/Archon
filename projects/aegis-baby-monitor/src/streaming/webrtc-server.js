const EventEmitter = require('events');
const { createLogger } = require('../utils/logger');

// Try to load wrtc, fallback to browser WebRTC if not available
let wrtc;
try {
  wrtc = require('wrtc');
} catch (error) {
  // wrtc not available - will use browser WebRTC or mock implementation
  console.warn('wrtc package not available, WebRTC functionality will be limited');
  wrtc = null;
}

class WebRTCServer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.logger = createLogger('WebRTCServer');
    this.peers = new Map();
    this.streams = new Map();
    
    // Configuration
    this.config = {
      iceServers: [
        { urls: options.stunServer || 'stun:stun.l.google.com:19302' },
        ...(options.turnServer ? [{
          urls: options.turnServer,
          username: options.turnUsername,
          credential: options.turnCredential
        }] : [])
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'balanced',
      rtcpMuxPolicy: 'require'
    };
    
    this.logger.info('WebRTC Server initialized', { 
      iceServers: this.config.iceServers.length 
    });
  }

  /**
   * Create a new WebRTC peer connection for a client
   */
  async createPeerConnection(clientId, mediaStream = null) {
    try {
      if (!wrtc) {
        throw new Error('WebRTC functionality not available - wrtc package not installed');
      }
      const peerConnection = new wrtc.RTCPeerConnection(this.config);
      
      // Set up event handlers
      this.setupPeerEventHandlers(peerConnection, clientId);
      
      // Add media stream if provided
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, mediaStream);
          this.logger.debug('Added track to peer connection', { 
            clientId, 
            trackKind: track.kind 
          });
        });
      }
      
      // Store peer connection
      this.peers.set(clientId, {
        peerConnection,
        connectionState: 'new',
        iceConnectionState: 'new',
        createdAt: new Date().toISOString()
      });
      
      this.logger.info('Peer connection created', { clientId });
      this.emit('peerCreated', { clientId, peerConnection });
      
      return peerConnection;
      
    } catch (error) {
      this.logger.error('Failed to create peer connection', { 
        clientId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Handle WebRTC offer from client
   */
  async handleOffer(clientId, offer) {
    try {
      const peer = this.peers.get(clientId);
      if (!peer) {
        throw new Error('Peer connection not found');
      }
      
      const { peerConnection } = peer;
      
      // Set remote description
      if (!wrtc) {
        throw new Error('WebRTC functionality not available - wrtc package not installed');
      }
      await peerConnection.setRemoteDescription(new wrtc.RTCSessionDescription(offer));
      this.logger.debug('Remote description set', { clientId });
      
      // Create answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      this.logger.info('WebRTC answer created', { clientId });
      this.emit('answerCreated', { clientId, answer });
      
      return answer;
      
    } catch (error) {
      this.logger.error('Failed to handle offer', { 
        clientId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Handle ICE candidate from client
   */
  async handleIceCandidate(clientId, candidate) {
    try {
      const peer = this.peers.get(clientId);
      if (!peer) {
        throw new Error('Peer connection not found');
      }
      
      const { peerConnection } = peer;
      
      if (candidate && candidate.candidate && wrtc) {
        await peerConnection.addIceCandidate(new wrtc.RTCIceCandidate(candidate));
        this.logger.debug('ICE candidate added', { clientId });
      }
      
    } catch (error) {
      this.logger.error('Failed to handle ICE candidate', { 
        clientId, 
        error: error.message 
      });
    }
  }

  /**
   * Set up event handlers for peer connection
   */
  setupPeerEventHandlers(peerConnection, clientId) {
    // Connection state changes
    peerConnection.addEventListener('connectionstatechange', () => {
      const state = peerConnection.connectionState;
      this.updatePeerState(clientId, 'connectionState', state);
      
      this.logger.info('Connection state changed', { clientId, state });
      this.emit('connectionStateChange', { clientId, state });
      
      if (state === 'failed' || state === 'disconnected') {
        this.handlePeerDisconnection(clientId);
      }
    });

    // ICE connection state changes
    peerConnection.addEventListener('iceconnectionstatechange', () => {
      const state = peerConnection.iceConnectionState;
      this.updatePeerState(clientId, 'iceConnectionState', state);
      
      this.logger.info('ICE connection state changed', { clientId, state });
      this.emit('iceConnectionStateChange', { clientId, state });
    });

    // ICE candidates
    peerConnection.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        this.logger.debug('ICE candidate generated', { clientId });
        this.emit('iceCandidate', { clientId, candidate: event.candidate });
      }
    });

    // Data channel handling
    peerConnection.addEventListener('datachannel', (event) => {
      const channel = event.channel;
      this.logger.info('Data channel received', { 
        clientId, 
        label: channel.label 
      });
      
      this.setupDataChannelHandlers(channel, clientId);
      this.emit('dataChannel', { clientId, channel });
    });
  }

  /**
   * Set up data channel handlers
   */
  setupDataChannelHandlers(channel, clientId) {
    channel.addEventListener('open', () => {
      this.logger.info('Data channel opened', { clientId, label: channel.label });
    });

    channel.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        this.logger.debug('Data channel message received', { 
          clientId, 
          type: data.type 
        });
        
        this.emit('dataChannelMessage', { clientId, data });
      } catch (error) {
        this.logger.warn('Invalid data channel message', { 
          clientId, 
          error: error.message 
        });
      }
    });

    channel.addEventListener('close', () => {
      this.logger.info('Data channel closed', { clientId, label: channel.label });
    });
  }

  /**
   * Update peer state
   */
  updatePeerState(clientId, stateType, value) {
    const peer = this.peers.get(clientId);
    if (peer) {
      peer[stateType] = value;
      peer.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Handle peer disconnection
   */
  handlePeerDisconnection(clientId) {
    const peer = this.peers.get(clientId);
    if (peer) {
      try {
        peer.peerConnection.close();
        this.peers.delete(clientId);
        
        this.logger.info('Peer connection cleaned up', { clientId });
        this.emit('peerDisconnected', { clientId });
        
      } catch (error) {
        this.logger.error('Error cleaning up peer connection', { 
          clientId, 
          error: error.message 
        });
      }
    }
  }

  /**
   * Get connection statistics
   */
  async getConnectionStats(clientId) {
    const peer = this.peers.get(clientId);
    if (!peer) {
      return null;
    }
    
    try {
      const stats = await peer.peerConnection.getStats();
      const statsObject = {};
      
      stats.forEach((report, id) => {
        statsObject[id] = report;
      });
      
      return {
        clientId,
        connectionState: peer.connectionState,
        iceConnectionState: peer.iceConnectionState,
        createdAt: peer.createdAt,
        updatedAt: peer.updatedAt,
        stats: statsObject
      };
      
    } catch (error) {
      this.logger.error('Failed to get connection stats', { 
        clientId, 
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Get all active connections
   */
  getActiveConnections() {
    const connections = {};
    
    for (const [clientId, peer] of this.peers.entries()) {
      connections[clientId] = {
        connectionState: peer.connectionState,
        iceConnectionState: peer.iceConnectionState,
        createdAt: peer.createdAt,
        updatedAt: peer.updatedAt
      };
    }
    
    return connections;
  }

  /**
   * Close peer connection
   */
  closePeerConnection(clientId) {
    const peer = this.peers.get(clientId);
    if (peer) {
      this.handlePeerDisconnection(clientId);
      return true;
    }
    return false;
  }

  /**
   * Shutdown server
   */
  shutdown() {
    this.logger.info('Shutting down WebRTC server', { 
      activePeers: this.peers.size 
    });
    
    // Close all peer connections
    for (const clientId of this.peers.keys()) {
      this.closePeerConnection(clientId);
    }
    
    this.peers.clear();
    this.streams.clear();
    
    this.emit('shutdown');
    this.logger.info('WebRTC server shutdown complete');
  }
}

module.exports = WebRTCServer;
