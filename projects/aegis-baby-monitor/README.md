# Aegis Baby Monitor

A self-hosted, privacy-first baby monitoring solution with WebRTC streaming, motion detection, and intelligent alerts.

## 🚀 Features

### Phase 1: Core Streaming Infrastructure ✅
- **WebRTC Streaming Server**: Real-time video/audio streaming with Node.js
- **Camera Manager**: Camera input management with quality presets
- **Multi-client Support**: Handle multiple concurrent connections
- **Quality Control**: Adaptive streaming with low/medium/high presets
- **Connection Management**: Automatic reconnection and error handling

### Phase 2: Intelligent Monitoring (Planned)
- **Motion Detection**: OpenCV-based movement analysis
- **Sound Analysis**: Baby cry detection and pattern recognition
- **Smart Alerts**: Customizable notification system

### Phase 3: Mobile & UI (Planned)
- **React Native App**: Cross-platform mobile application
- **Web Dashboard**: Configuration and monitoring interface
- **Data Analytics**: Historical data and insights

## 🏗️ Architecture

```
┌─────────────────┐    WebRTC     ┌──────────────────┐
│   Web Client    │◄──────────────┤   Node.js Server │
│   (Browser)     │   Socket.IO   │                  │
└─────────────────┘               └──────────────────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │   Camera Manager │
                                  │   (Mock for Dev) │
                                  └──────────────────┘
```

### Core Components

1. **WebRTCServer**: Handles peer connections, ICE negotiation, and stream management
2. **CameraManager**: Manages camera input, quality presets, and frame capture
3. **Express Server**: REST API endpoints and static file serving
4. **Socket.IO**: Real-time signaling for WebRTC and control messages

## 📦 Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Camera device (or use mock mode for development)

### Quick Start (Recommended)

```bash
# Navigate to project directory
cd aegis-baby-monitor

# Install basic dependencies (skips problematic optional packages)
npm run setup

# Start the server
npm start

# Access the application at http://localhost:3000
```

### Full Installation

For complete WebRTC functionality:

```bash
# Install all dependencies including WebRTC
npm run install:full

# If wrtc fails to install, fall back to basic install
npm run install:basic

# Start development server
npm run dev
```

### Manual Setup

1. **Clone and navigate to project**:
```bash
cd /path/to/aegis-baby-monitor
```

2. **Install dependencies**:
```bash
npm install
```

3. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
mkdir -p data logs
```

4. **Start development server**:
```bash
npm run dev
```

5. **Access the application**:
   - **Live Stream**: `http://localhost:3000`
   - **Alert Management**: `http://localhost:3000/alerts.html`
   - Click "Connect Camera" to start streaming

### Troubleshooting Installation

If you encounter issues with native dependencies:

1. **WebRTC issues**: The system will work without the `wrtc` package using browser WebRTC
2. **SQLite issues**: Install build tools for your platform
3. **Canvas issues**: Optional for image processing features

```bash
# Ubuntu/Debian
sudo apt-get install build-essential python3

# macOS
xcode-select --install

# Windows
npm install -g windows-build-tools
```

## ⚙️ Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# WebRTC Configuration
WEBRTC_PORT=8080
STUN_SERVER=stun:stun.l.google.com:19302
TURN_SERVER=                    # Optional TURN server
TURN_USERNAME=                  # TURN credentials
TURN_CREDENTIAL=               # TURN credentials

# Camera Configuration
CAMERA_DEVICE_PATH=/dev/video0  # Camera device path
STREAM_QUALITY_PRESET=medium   # low|medium|high
VIDEO_WIDTH=1280
VIDEO_HEIGHT=720
VIDEO_FPS=30

# Security
CORS_ORIGIN=*                   # Configure for production
JWT_SECRET=your-secret-key

# Storage & Logging
DATA_STORAGE_PATH=./data
LOG_LEVEL=info
LOG_TO_FILE=true               # Enable file logging
```

### Quality Presets

| Preset | Resolution | FPS | Bitrate | Use Case |
|--------|------------|-----|---------|----------|
| Low    | 640x480    | 15  | 500kbps | Mobile/Low bandwidth |
| Medium | 1280x720   | 30  | 1.5Mbps | Standard monitoring |
| High   | 1920x1080  | 30  | 3Mbps   | High-quality recording |

## 🔧 API Endpoints

### Health & Status

- `GET /api/health` - System health check
- `GET /api/camera/status` - Camera status and capabilities
- `GET /api/webrtc/connections` - Active WebRTC connections

### Camera Control

- `POST /api/camera/start` - Start camera streaming
- `POST /api/camera/stop` - Stop camera streaming
- `POST /api/camera/quality` - Change quality preset

### WebRTC Signaling (via Socket.IO)

- `webrtc:offer` - WebRTC offer from client
- `webrtc:answer` - WebRTC answer from server
- `webrtc:ice-candidate` - ICE candidate exchange
- `camera:capture-frame` - Capture single frame

## 🧪 Development

### Running Tests

```bash
npm test                # Run all tests
npm run test:unit      # Unit tests only
npm run test:integration # Integration tests
```

### Code Quality

```bash
npm run lint           # ESLint code checking
npm run format         # Code formatting
```

### Docker Development

```bash
npm run docker:build  # Build Docker image
npm run docker:run    # Run in Docker container
```

## 📱 Usage

### Web Interface

1. **Connect**: Click "Connect Camera" to establish WebRTC connection
2. **Quality**: Use dropdown to change video quality (low/medium/high)
3. **Capture**: Take snapshots with "Capture" button
4. **Monitor**: View connection status and system health

### Mobile Access

- Access `http://[server-ip]:3000` from mobile browser
- Responsive design adapts to mobile screens
- Touch-friendly controls for easy operation

## 🔒 Security Considerations

### Current Implementation

- **Helmet.js**: Security headers and content security policy
- **CORS**: Configurable cross-origin resource sharing
- **Input Validation**: All API inputs validated and sanitized
- **Local Processing**: No data sent to external servers

### Production Recommendations

- **HTTPS**: Enable SSL/TLS certificates
- **Authentication**: Add user authentication system
- **Network Isolation**: Deploy on isolated network segment
- **Firewall**: Restrict access to necessary ports only
- **Updates**: Regular security updates and patches

## 🚧 Development Status

### Completed ✅

- [x] WebRTC streaming server architecture
- [x] Camera management with quality presets
- [x] Multi-client connection handling
- [x] Real-time WebRTC signaling
- [x] Web interface with video streaming
- [x] Error handling and connection recovery
- [x] Comprehensive logging system
- [x] REST API endpoints
- [x] Development documentation

### In Progress 🔄

- [ ] Motion detection integration
- [ ] Audio processing and cry detection
- [ ] Database storage for events
- [ ] Alert notification system

### Planned 📋

- [ ] React Native mobile app
- [ ] Advanced web dashboard
- [ ] Machine learning integration
- [ ] Cloud storage options
- [ ] Multi-camera support

## 🐛 Known Issues

1. **Mock Camera**: Development mode uses mock video stream
2. **WebRTC Compatibility**: May require TURN server for some network configurations
3. **Mobile Safari**: WebRTC support limitations on iOS Safari
4. **Resource Usage**: High CPU usage during streaming (optimization needed)

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-feature`
3. Make changes and test thoroughly
4. Follow existing code style and patterns
5. Submit pull request with detailed description

### Code Standards

- Use ESLint configuration for code style
- Write tests for new functionality
- Document API changes
- Follow semantic versioning

## 📄 License

MIT License - See LICENSE file for details.

## 🙏 Acknowledgments

- **WebRTC**: Real-time communication technology
- **Node.js Community**: Excellent libraries and documentation
- **Socket.IO**: Real-time bidirectional event-based communication
- **OpenCV**: Computer vision library for future motion detection

## 📞 Support

For issues, questions, or contributions:

1. **Issues**: Use GitHub Issues for bug reports
2. **Documentation**: Check README and inline comments
3. **Community**: Join discussions in GitHub Discussions
4. **Security**: Report security issues privately

---

**Aegis Baby Monitor** - *Secure, Private, Self-Hosted Baby Monitoring*
