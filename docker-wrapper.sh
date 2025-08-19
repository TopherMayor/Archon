#!/bin/bash
# Docker wrapper script for external SSD installation

DOCKER_PATH="/Volumes/2TB/External-Applications/Docker.app/Contents/Resources/bin/docker"

# Check if Docker binary exists
if [ ! -f "$DOCKER_PATH" ]; then
    echo "Error: Docker not found at $DOCKER_PATH"
    exit 1
fi

# Execute Docker with all arguments
exec "$DOCKER_PATH" "$@"
