#!/bin/bash
# Run this ONCE on a fresh Ubuntu 24.04 EC2 instance
# Usage: bash ec2-setup.sh
set -e

REPO_URL="https://github.com/YOUR_ORG/YOUR_REPO.git"  # ← CHANGE THIS

echo "==> Updating system packages..."
sudo apt update && sudo apt upgrade -y

echo "==> Installing Python, Nginx, Git, Certbot..."
sudo apt install -y \
  python3.11 python3.11-venv python3-pip \
  nginx certbot python3-certbot-nginx \
  git curl

echo "==> Cloning repository..."
sudo git clone "$REPO_URL" /app
sudo chown -R ubuntu:ubuntu /app

echo "==> Creating Python virtual environment..."
python3.11 -m venv /app/backend/venv

echo "==> Installing Python dependencies..."
/app/backend/venv/bin/pip install --upgrade pip
/app/backend/venv/bin/pip install -r /app/backend/requirements.txt

echo "==> Creating .env file (YOU MUST FILL THIS IN)..."
cat > /app/backend/.env << 'EOF'
MONGO_URL=mongodb+srv://CHANGE_ME
DB_NAME=gradnext_production
CORS_ORIGINS=https://yourdomain.com
RAZORPAY_KEY_ID=CHANGE_ME
RAZORPAY_KEY_SECRET=CHANGE_ME
RAZORPAY_WEBHOOK_SECRET=CHANGE_ME
GOOGLE_OAUTH_CLIENT_ID=CHANGE_ME
GOOGLE_OAUTH_CLIENT_SECRET=CHANGE_ME
GOOGLE_SERVICE_ACCOUNT_JSON=CHANGE_ME
GOOGLE_IMPERSONATE_EMAIL=CHANGE_ME
EMERGENT_LLM_KEY=CHANGE_ME
JWT_SECRET=CHANGE_ME_USE_RANDOM_STRING
WATI_API_TOKEN=CHANGE_ME
EOF
echo "⚠️  IMPORTANT: Edit /app/backend/.env with your real production values!"

echo "==> Installing systemd service..."
sudo cp /app/deploy/gradnext-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable gradnext-backend

echo "==> Setting up Nginx..."
sudo cp /app/deploy/nginx.conf /etc/nginx/sites-available/gradnext
sudo ln -sf /etc/nginx/sites-available/gradnext /etc/nginx/sites-enabled/gradnext
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t

echo ""
echo "✅ Setup complete! Next steps:"
echo ""
echo "1. Edit /app/backend/.env with your production values"
echo "2. Start the backend:    sudo systemctl start gradnext-backend"
echo "3. Check it's running:   sudo systemctl status gradnext-backend"
echo "4. Set up HTTPS:         sudo certbot --nginx -d api.yourdomain.com"
echo "5. Start nginx:          sudo systemctl start nginx"
echo ""
echo "GitHub Actions will handle all future deployments automatically."
