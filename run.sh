#!/bin/bash

# Simple File Manager - PM2 Run Script
# This script manages the file manager application using PM2

set -e  # Exit on error

APP_NAME="simple-file-manager"
NODE_ENV="${NODE_ENV:-production}"
PORT="${PORT:-3000}"

# Function to read .env file
read_env_value() {
    local key=$1
    local default=$2
    if [ -f ".env" ]; then
        local value=$(grep "^${key}=" .env | cut -d '=' -f2- | tr -d '\r')
        echo "${value:-$default}"
    else
        echo "$default"
    fi
}

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    echo -e "${2}${1}${NC}"
}

print_message "🚀 Simple File Manager - PM2 Deployment Script" "$BLUE"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_message "❌ Node.js is not installed. Please install Node.js first." "$RED"
    exit 1
fi

print_message "✓ Node.js version: $(node -v)" "$GREEN"

# Check if pm2 is installed
if ! command -v pm2 &> /dev/null; then
    print_message "⚠️  PM2 is not installed. Installing PM2 globally..." "$YELLOW"
    npm install -g pm2
    print_message "✓ PM2 installed successfully" "$GREEN"
else
    print_message "✓ PM2 version: $(pm2 -v)" "$GREEN"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_message "📦 Installing dependencies..." "$BLUE"
    npm install
    print_message "✓ Dependencies installed" "$GREEN"
else
    print_message "✓ Dependencies already installed" "$GREEN"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_message "📝 Creating .env file..." "$YELLOW"
    cat > .env << EOF
PORT=${PORT}
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
UPLOAD_DIR=uploads
NODE_ENV=${NODE_ENV}

# Cache Configuration
CACHE_ENABLED=true
CACHE_DB_PATH=./.cache/files.db
CACHE_SYNC_INTERVAL_INTERNAL=600000
CACHE_SYNC_INTERVAL_EXTERNAL=300000
EOF
    print_message "✓ .env file created" "$GREEN"
else
    print_message "✓ .env file exists" "$GREEN"
fi

# Ensure uploads directory exists
if [ ! -d "uploads" ]; then
    mkdir -p uploads
    print_message "✓ Created uploads directory" "$GREEN"
fi

# Stop the application if it's already running
if pm2 list | grep -q "$APP_NAME"; then
    print_message "🔄 Stopping existing instance..." "$YELLOW"
    pm2 stop "$APP_NAME"
    pm2 delete "$APP_NAME"
fi

# Start the application with PM2
print_message "🚀 Starting $APP_NAME with PM2..." "$BLUE"
pm2 start src/server.js \
    --name "$APP_NAME" \
    --node-args="--max-old-space-size=512" \
    --time \
    --env production

# Save PM2 process list
pm2 save

print_message "✓ Application started successfully!" "$GREEN"
echo ""

# Read configuration from .env
ENV_PORT=$(read_env_value "PORT" "$PORT")
ENV_UPLOAD_DIR=$(read_env_value "UPLOAD_DIR" "uploads")
ENV_ALLOW_EXTERNAL=$(read_env_value "ALLOW_EXTERNAL_UPLOAD_FOLDER" "false")

# Display application info
print_message "📋 Application Information:" "$BLUE"
echo "   • Name: $APP_NAME"
echo "   • Port: $ENV_PORT"
echo "   • Environment: $NODE_ENV"
echo "   • URL: http://localhost:$ENV_PORT"
echo "   • Admin Panel: http://localhost:$ENV_PORT/admin"
echo "   • API Docs: http://localhost:$ENV_PORT/api-docs"
echo ""

# Display storage configuration
print_message "💾 Storage Configuration:" "$BLUE"
echo "   • Upload Directory: $ENV_UPLOAD_DIR"

# Display ALLOW_EXTERNAL_UPLOAD_FOLDER status with color
if [ "$ENV_ALLOW_EXTERNAL" = "true" ]; then
    echo -e "   • External Upload Folder: ${GREEN}✓ Allowed${NC}"
else
    echo -e "   • External Upload Folder: ${YELLOW}✗ Not Allowed (Default)${NC}"
fi
echo ""

# Display PM2 commands
print_message "📌 Useful PM2 Commands:" "$BLUE"
echo "   • View logs:       pm2 logs $APP_NAME"
echo "   • Monitor:         pm2 monit"
echo "   • Stop:            pm2 stop $APP_NAME"
echo "   • Restart:         pm2 restart $APP_NAME"
echo "   • Delete:          pm2 delete $APP_NAME"
echo "   • View status:     pm2 status"
echo "   • View details:    pm2 show $APP_NAME"
echo ""

# Display current status
print_message "📊 Current Status:" "$BLUE"
pm2 status

# Setup PM2 to start on system boot (optional)
echo ""
print_message "💡 Tip: To make PM2 start on system boot, run:" "$YELLOW"
echo "   pm2 startup"
echo "   Then run the command it provides"

