#!/bin/bash
# Deployment script for Garbot Chat Web
# Usage: 
#   Local:  ./scripts/deploy.sh
#   CI:     ./scripts/deploy.sh --ci
#
# Environment variables (required for --ci mode):
#   AWS_ACCESS_KEY_ID
#   AWS_SECRET_ACCESS_KEY
#   AWS_REGION
#   LIGHTSAIL_INSTANCE_NAME
#   SSH_PRIVATE_KEY (base64 encoded)

set -e  # Exit on any error

# Configuration
SERVER_USER="bitnami"
SERVER_HOST="3.220.214.231"
SERVER="${SERVER_USER}@${SERVER_HOST}"
REMOTE_DIR="/opt/bitnami/apps/garbot-chat"
APP_NAME="garbot-chat"
LIGHTSAIL_INSTANCE_NAME="${LIGHTSAIL_INSTANCE_NAME:-WordPress-2}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# nvm must be sourced in non-interactive SSH sessions
NVM_SOURCE='export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"'

# Parse arguments
CI_MODE=false
RUNNER_IP=""

while [[ "$#" -gt 0 ]]; do
  case $1 in
    --ci) CI_MODE=true ;;
    *) echo "Unknown parameter: $1"; exit 1 ;;
  esac
  shift
done

# Function to get current public IP
get_public_ip() {
  curl -s https://checkip.amazonaws.com || curl -s https://ifconfig.me
}

# Function to add IP to Lightsail firewall
add_firewall_rule() {
  local ip=$1
  echo "🔓 Adding SSH access for IP: ${ip}/32..."
  aws lightsail open-instance-public-ports \
    --instance-name "$LIGHTSAIL_INSTANCE_NAME" \
    --port-info "fromPort=22,toPort=22,protocol=tcp,cidrs=${ip}/32" \
    --region "$AWS_REGION"
}

# Function to remove IP from Lightsail firewall
remove_firewall_rule() {
  local ip=$1
  echo "🔒 Removing SSH access for IP: ${ip}/32..."
  aws lightsail close-instance-public-ports \
    --instance-name "$LIGHTSAIL_INSTANCE_NAME" \
    --port-info "fromPort=22,toPort=22,protocol=tcp,cidrs=${ip}/32" \
    --region "$AWS_REGION" || true
}

# Cleanup function for CI mode
cleanup() {
  if [[ "$CI_MODE" == true && -n "$RUNNER_IP" ]]; then
    echo ""
    echo "🧹 Cleaning up firewall rules..."
    remove_firewall_rule "$RUNNER_IP"
  fi
  
  # Remove temporary SSH key
  if [[ -f "$HOME/.ssh/deploy_key" ]]; then
    rm -f "$HOME/.ssh/deploy_key"
  fi
}

# Set trap to cleanup on exit
trap cleanup EXIT

# CI Mode: Setup SSH and firewall
if [[ "$CI_MODE" == true ]]; then
  echo "🤖 Running in CI mode..."
  
  # Get runner's public IP
  RUNNER_IP=$(get_public_ip)
  echo "📍 Runner IP: $RUNNER_IP"
  
  # Add firewall rule for this runner
  add_firewall_rule "$RUNNER_IP"
  
  # Setup SSH key
  mkdir -p ~/.ssh
  echo "$SSH_PRIVATE_KEY" | base64 -d > ~/.ssh/deploy_key
  chmod 600 ~/.ssh/deploy_key
  
  # Use the deploy key for SSH
  export SSH_KEY_PATH="$HOME/.ssh/deploy_key"
  SSH_OPTS="-i $SSH_KEY_PATH -o StrictHostKeyChecking=no"
  
  # Wait for firewall rule to propagate before attempting SSH
  echo "⏳ Waiting for firewall rule to propagate..."
  sleep 10
  
  # Add server to known hosts (|| true to prevent set -e from killing script)
  ssh-keyscan -H "$SERVER_HOST" >> ~/.ssh/known_hosts 2>/dev/null || true
else
  echo "💻 Running in local mode..."
  SSH_OPTS=""
fi

echo ""
echo "🚀 Starting deployment to $SERVER..."

# 1. Build locally
echo ""
echo "📦 Building TypeScript..."
npm run build

# 2. Create remote directory if it doesn't exist
echo ""
echo "📁 Preparing remote directory..."
ssh $SSH_OPTS $SERVER "sudo mkdir -p $REMOTE_DIR/logs && sudo chown -R ${SERVER_USER}:${SERVER_USER} $REMOTE_DIR"

# 3. Copy files to server
echo ""
echo "📤 Copying files to server..."
if [[ "$CI_MODE" == true ]]; then
  rsync -avz --delete \
    -e "ssh $SSH_OPTS" \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'screenshots' \
    --exclude '*.log' \
    --exclude 'data/*.db' \
    --exclude 'data/*.db-wal' \
    --exclude 'data/*.db-shm' \
    dist \
    package.json \
    package-lock.json \
    ecosystem.config.cjs \
    public \
    data \
    scripts \
    $SERVER:$REMOTE_DIR/
else
  rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude 'screenshots' \
    --exclude '*.log' \
    --exclude 'data/*.db' \
    --exclude 'data/*.db-wal' \
    --exclude 'data/*.db-shm' \
    dist \
    package.json \
    package-lock.json \
    ecosystem.config.cjs \
    public \
    data \
    scripts \
    $SERVER:$REMOTE_DIR/
fi

# 4. Install dependencies on server
echo ""
echo "📥 Installing production dependencies..."
ssh $SSH_OPTS $SERVER "$NVM_SOURCE && cd $REMOTE_DIR && npm install --omit=dev --engine-strict=false"

# 5. Auto-seed users if database doesn't exist
echo ""
echo "🔐 Checking auth database..."
ssh $SSH_OPTS $SERVER "$NVM_SOURCE && cd $REMOTE_DIR && if [ ! -f data/auth.db ]; then echo 'Database not found — seeding users...' && npx tsx scripts/seed-users.ts; else echo 'Auth database already exists — skipping seed.'; fi"

# 6. Persist SESSION_SECRET on the server so manual PM2 restarts pick it up
echo ""
echo "🔑 Configuring session secret..."
if [[ -n "${SESSION_SECRET:-}" ]]; then
  ssh $SSH_OPTS $SERVER "cd $REMOTE_DIR && \
    touch .env && \
    if grep -q '^SESSION_SECRET=' .env 2>/dev/null; then \
      sed -i 's|^SESSION_SECRET=.*|SESSION_SECRET=${SESSION_SECRET}|' .env; \
    else \
      echo 'SESSION_SECRET=${SESSION_SECRET}' >> .env; \
    fi && \
    chmod 600 .env && \
    echo 'SESSION_SECRET written to .env'"
else
  echo "⚠️  SESSION_SECRET not set — skipping .env update"
fi

# 7. Restart the app with PM2 (pass SESSION_SECRET)
echo ""
echo "🔄 Restarting application..."
ssh $SSH_OPTS $SERVER "$NVM_SOURCE && cd $REMOTE_DIR && export SESSION_SECRET='${SESSION_SECRET:-}' && (pm2 describe $APP_NAME > /dev/null 2>&1 && pm2 restart $APP_NAME --update-env || pm2 start ecosystem.config.cjs)"

# 8. Save PM2 process list
ssh $SSH_OPTS $SERVER "$NVM_SOURCE && pm2 save"

echo ""
echo "✅ Deployment complete!"
echo "🌐 App should be running at https://garbot.managedkube.com"

# Note: Firewall cleanup happens automatically via 'trap cleanup EXIT' (line 75)
# The cleanup function removes the GitHub Actions runner IP from Lightsail firewall
