#!/bin/bash
# AWS EC2 User Data Script for ShopMind Deployment
# This script installs Docker, Docker Compose, clones your repository, and starts the ShopMind platform.
# Target OS: Amazon Linux 2023 or Ubuntu 22.04 LTS

# 1. Update system packages
apt-get update -y || yum update -y

# 2. Create a 2GB Swap File (CRITICAL for running on a free 1GB t2.micro instance)
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab

# 3. Install Git
apt-get install -y git || yum install -y git

# 3. Install Docker
if ! command -v docker &> /dev/null; then
    if [ -f /etc/amazon-linux-release ]; then
        yum install -y docker
        service docker start
        usermod -a -G docker ec2-user
        chkconfig docker on
    else
        apt-get install -y ca-certificates curl gnupg
        install -m 0755 -d /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
        echo \
          "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
          "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
          tee /etc/apt/sources.list.d/docker.list > /dev/null
        apt-get update -y
        apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
        usermod -aG docker ubuntu
    fi
fi

# 4. Install Docker Compose (if not included as plugin)
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# 5. Setup Project Directory
mkdir -p /opt/shopmind
cd /opt/shopmind

# === IMPORTANT ===
# Your actual GitHub repository URL
REPO_URL="https://github.com/mobilalshaikh0102-art/ShopMInd.git"
# =================

# 6. Clone the repository
git clone $REPO_URL .

# 7. Create Environment File
cat << 'EOF' > .env
POSTGRES_USER=shopmind
POSTGRES_PASSWORD=shopmind_super_secret_production_password
POSTGRES_DB=shopmind_db
# Replace with your actual Gemini API Key before running
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
EOF

# 8. Build and Start the application
docker-compose up -d --build

echo "ShopMind Deployment Completed Successfully!"
