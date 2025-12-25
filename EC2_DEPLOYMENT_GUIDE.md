# Complete EC2 Deployment Guide for NestJS + PostgreSQL

## Overview
This guide covers the complete setup of a NestJS API on Amazon Linux 2023 EC2 instance with PostgreSQL database, domain configuration, SSL/HTTPS, and production deployment using PM2.

---

## 1. PostgreSQL Installation & Configuration

### Install PostgreSQL
```bash
# Update system
sudo dnf update -y

# Install PostgreSQL 15 with contrib extensions
sudo dnf install postgresql15-server postgresql15-contrib -y

# Initialize database
sudo postgresql-setup --initdb

# Start and enable PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Check status
sudo systemctl status postgresql
```

### Configure PostgreSQL Authentication

**Enable password authentication (required for application access):**

```bash
# Edit pg_hba.conf
sudo vi /var/lib/pgsql/data/pg_hba.conf
```

Change these lines from `peer`/`ident` to `md5`:
```conf
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
host    all             all             ::1/128                 md5
```

```bash
# Restart PostgreSQL to apply changes
sudo systemctl restart postgresql
```

### Setup Database

```bash
# Set postgres user password
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"

# Create application database
sudo -u postgres psql -c "CREATE DATABASE solpass;"

# Enable UUID extension (required for TypeORM)
sudo -u postgres psql -d solpass -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"

# Verify extension is installed
sudo -u postgres psql -d solpass -c "\dx"
```

### PostgreSQL Useful Commands

```bash
# Check status
sudo systemctl status postgresql

# View logs
sudo tail -f /var/lib/pgsql/data/log/postgresql-*.log

# Connect to database
sudo -u postgres psql -d solpass

# Stop/Start/Restart
sudo systemctl stop postgresql
sudo systemctl start postgresql
sudo systemctl restart postgresql
```

---

## 2. Node.js Installation

### Install Node.js 20.x (LTS)

```bash
# Install Node.js from NodeSource repository
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show v10.x.x
```

### Alternative: Install via nvm (More Flexible)

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Install Node.js LTS
nvm install --lts

# Verify
node --version
npm --version
```

---

## 3. Application Deployment

### Clone Repository

```bash
# Install git
sudo dnf install git -y

# Navigate to home directory
cd /home/ec2-user

# Clone your repository
git clone https://github.com/your-username/solpass-api.git

# Navigate to project
cd solpass-api
```

### Setup Environment Variables

```bash
# Create .env file
nano .env
```

Add your environment variables:
```env
# Application
PORT=3000
NODE_ENV=production
API_PREFIX=api/v1

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=solpass

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-characters
JWT_REFRESH_EXPIRES_IN=7d

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_CLUSTER=devnet
SOLANA_SERVER_SECRET=your-solana-secret-key
SOLANA_PROGRAM_ID=your-program-id
```

### Install Dependencies & Build

```bash
# Install dependencies
npm install

# Build the application
npm run build

# Test the build
npm run start:prod
# Press Ctrl+C to stop after verifying it works
```

---

## 4. PM2 Process Manager Setup

### Install & Configure PM2

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start your application with PM2
cd /home/ec2-user/solpass-api
pm2 start npm --name "solpass-api" -- run start:prod

# Save PM2 process list
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Copy and run the command it outputs (sudo env PATH=...)

# Verify PM2 setup
pm2 status
pm2 logs solpass-api --lines 50
```

### PM2 Useful Commands

```bash
# View status
pm2 status

# View logs (live)
pm2 logs solpass-api

# View last 50 lines
pm2 logs solpass-api --lines 50

# View only errors
pm2 logs solpass-api --err

# Restart application
pm2 restart solpass-api

# Stop application
pm2 stop solpass-api

# Delete from PM2
pm2 delete solpass-api

# Monitor in real-time
pm2 monit

# Save current process list
pm2 save

# Resurrect saved processes
pm2 resurrect
```

---

## 5. EC2 Security Group Configuration

### Required Inbound Rules

Configure these inbound rules in AWS Console (EC2 → Security Groups → Inbound rules):

| Type       | Protocol | Port Range | Source      | Description              |
|------------|----------|------------|-------------|--------------------------|
| SSH        | TCP      | 22         | 0.0.0.0/0   | SSH access               |
| HTTP       | TCP      | 80         | 0.0.0.0/0   | HTTP (nginx)             |
| HTTPS      | TCP      | 443        | 0.0.0.0/0   | HTTPS (SSL)              |
| Custom TCP | TCP      | 3000       | 0.0.0.0/0   | NestJS API (optional)    |

### Via AWS CLI (Alternative)

```bash
# Get security group ID
aws ec2 describe-instances --instance-ids i-05f17d29bca3488c3 \
  --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId'

# Add rules (replace sg-xxxxx with your security group ID)
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxx \
  --ip-permissions \
    IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges='[{CidrIp=0.0.0.0/0}]' \
    IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges='[{CidrIp=0.0.0.0/0}]'
```

---

## 6. Domain Configuration

### Setup Domain DNS

**Option A: Using Route53 (AWS)**

1. Go to Route53 → Hosted Zones
2. Create hosted zone for your domain
3. Add A Record:
   - Name: `api` (for api.solpass.app)
   - Type: A
   - Value: Your EC2 Public IP (3.239.151.238)
   - TTL: 300

**Option B: External Domain Registrar**

In your domain registrar's DNS settings:
```
Type: A
Host: api
Value: 3.239.151.238
TTL: 300
```

### Verify DNS Propagation

```bash
# Test DNS resolution
nslookup api.solpass.app

# Or using dig
dig api.solpass.app

# Should return your EC2 IP address
```

---

## 7. Nginx Reverse Proxy Setup

### Install Nginx

```bash
# Install nginx
sudo dnf install nginx -y

# Start and enable nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

### Configure Nginx for Your Application

```bash
# Create nginx configuration file
sudo tee /etc/nginx/conf.d/solpass.conf > /dev/null <<'EOF'
server {
    listen 80;
    server_name api.solpass.app;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Nginx Useful Commands

```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo systemctl reload nginx

# Restart nginx
sudo systemctl restart nginx

# View error logs
sudo tail -f /var/log/nginx/error.log

# View access logs
sudo tail -f /var/log/nginx/access.log

# Check status
sudo systemctl status nginx
```

---

## 8. SSL/HTTPS Configuration with Let's Encrypt

### Install Certbot

```bash
# Install Certbot and nginx plugin
sudo dnf install certbot python3-certbot-nginx -y
```

### Obtain SSL Certificate

```bash
# Get SSL certificate (replace with your email and domain)
sudo certbot --nginx -d api.solpass.app \
  --non-interactive \
  --agree-tos \
  -m your-email@example.com

# Certbot will automatically:
# - Obtain SSL certificate
# - Update nginx configuration
# - Setup HTTP to HTTPS redirect
# - Configure auto-renewal
```

### Test Auto-Renewal

```bash
# Test certificate renewal process
sudo certbot renew --dry-run

# View certificate information
sudo certbot certificates
```

### Manual Certificate Renewal

```bash
# Renew all certificates
sudo certbot renew

# Renew specific certificate
sudo certbot renew --cert-name api.solpass.app

# Renew and restart nginx
sudo certbot renew --post-hook "systemctl reload nginx"
```

---

## 9. Deployment Workflow

### Update Application (Manual)

```bash
# Navigate to project
cd /home/ec2-user/solpass-api

# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build application
npm run build

# Restart PM2
pm2 restart solpass-api

# Check logs
pm2 logs solpass-api --lines 20
```

### Create Deployment Script

```bash
# Create update script
nano ~/update-solpass.sh
```

Add this content:
```bash
#!/bin/bash
set -e

echo "Starting deployment..."
cd /home/ec2-user/solpass-api

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
npm install

echo "Building application..."
npm run build

echo "Restarting PM2..."
pm2 restart solpass-api

echo "Deployment complete!"
echo "Application status:"
pm2 status

echo "Recent logs:"
pm2 logs solpass-api --lines 20 --nostream
```

```bash
# Make script executable
chmod +x ~/update-solpass.sh

# Run deployment
~/update-solpass.sh
```

---

## 10. Monitoring & Troubleshooting

### Check Application Status

```bash
# PM2 status
pm2 status

# View logs
pm2 logs solpass-api

# Check if app is listening on port 3000
sudo netstat -tlnp | grep 3000

# Check nginx status
sudo systemctl status nginx

# Check PostgreSQL status
sudo systemctl status postgresql
```

### Common Issues & Solutions

**1. Application not starting:**
```bash
# Check PM2 logs
pm2 logs solpass-api --err

# Check environment variables
cat /home/ec2-user/solpass-api/.env

# Test database connection
sudo -u postgres psql -d solpass -c "SELECT 1;"
```

**2. Database connection errors:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check pg_hba.conf authentication
sudo cat /var/lib/pgsql/data/pg_hba.conf | grep md5

# Test connection
psql -h localhost -U postgres -d solpass
```

**3. Domain not resolving:**
```bash
# Check DNS
nslookup api.solpass.app
dig api.solpass.app

# Check nginx configuration
sudo nginx -t

# Check if nginx is listening
sudo netstat -tlnp | grep 80
```

**4. SSL certificate issues:**
```bash
# Check certificate status
sudo certbot certificates

# View nginx SSL configuration
sudo cat /etc/nginx/conf.d/solpass.conf

# Test renewal
sudo certbot renew --dry-run
```

---

## 11. Production Best Practices

### Security

- Use strong passwords for PostgreSQL
- Keep JWT secrets secure
- Regularly update system packages: `sudo dnf update -y`
- Use Elastic IP to prevent IP changes
- Configure firewall rules properly
- Enable automatic security updates

### Backups

```bash
# Backup PostgreSQL database
sudo -u postgres pg_dump solpass > solpass_backup_$(date +%Y%m%d).sql

# Restore database
sudo -u postgres psql solpass < solpass_backup_20231222.sql

# Setup automated backups with cron
crontab -e
# Add: 0 2 * * * /usr/bin/pg_dump -U postgres solpass > /backup/solpass_$(date +\%Y\%m\%d).sql
```

### Performance Monitoring

```bash
# Monitor system resources
htop

# Check disk usage
df -h

# Check memory usage
free -h

# Monitor PM2 processes
pm2 monit
```

---

## 12. Access URLs

After complete setup, your API will be accessible at:

- **HTTPS (Production):** https://api.solpass.app
- **API Documentation:** https://api.solpass.app/api/docs
- **Health Check:** https://api.solpass.app/api/v1

---

## 13. Quick Reference Commands

```bash
# Application Management
pm2 restart solpass-api              # Restart app
pm2 logs solpass-api                 # View logs
pm2 status                           # Check status

# System Services
sudo systemctl restart postgresql    # Restart database
sudo systemctl restart nginx         # Restart web server
sudo systemctl status postgresql     # Check PostgreSQL
sudo systemctl status nginx          # Check nginx

# Database
sudo -u postgres psql -d solpass     # Connect to database

# Deployment
cd /home/ec2-user/solpass-api && git pull && npm install && npm run build && pm2 restart solpass-api

# SSL Certificate
sudo certbot renew                   # Renew certificates
sudo certbot certificates            # View certificates

# Monitoring
pm2 monit                            # Process monitor
sudo tail -f /var/log/nginx/error.log  # Nginx errors
htop                                 # System resources
```

---

## Summary

You now have a complete production-ready setup with:
- ✅ PostgreSQL database with UUID support
- ✅ Node.js 20.x LTS
- ✅ NestJS API running with PM2
- ✅ Nginx reverse proxy
- ✅ SSL/HTTPS with Let's Encrypt
- ✅ Custom domain (api.solpass.app)
- ✅ Auto-restart on crash
- ✅ Auto-start on server reboot
- ✅ Easy deployment workflow

Your API is accessible at: **https://api.solpass.app**
