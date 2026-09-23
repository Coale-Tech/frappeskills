# Frappe Manager — Docker Dev Environments

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `frappe-manager/SKILL.md`.

## Frappe Manager

Manage Docker-based Frappe development environments using Frappe Manager (FM).

### When to use

- Setting up a local Frappe development environment
- Creating isolated test environments
- Agent-driven development (vibe coding) workflows
- Quick prototyping without full bench setup
- Reproducible environments across machines

### Inputs required

- Docker installed and running
- Python 3.11+ with pipx
- Site/bench name
- Apps to install (frappe, erpnext, hrms, custom)
- Environment type (dev/prod)

### Procedure

#### 0) Install Frappe Manager

```bash
# Install via pipx
pipx install frappe-manager

# Enable shell completion
fm --install-completion
```

#### 1) Create a site

```bash
# Basic site (frappe only)
fm create mysite

# Site with ERPNext
fm create mysite --apps erpnext:version-15

# Site with multiple apps
fm create mysite --apps erpnext --apps hrms --environment dev

# Production site with SSL
fm create example.com --apps erpnext --env prod --ssl letsencrypt
```

#### 2) Manage sites

```bash
# List all sites
fm list

# Start/stop site
fm start mysite
fm stop mysite

# View site info
fm info mysite

# View logs (follow)
fm logs mysite -f

# Delete site
fm delete mysite
```

#### 3) Development workflow

```bash
# Access shell inside container
fm shell mysite

# Inside container - common commands:
bench new-app my_custom_app
bench --site mysite install-app my_custom_app
bench --site mysite migrate
bench build --app my_custom_app
bench --site mysite run-tests --app my_custom_app

# Exit shell
exit

# Open in VSCode
fm code mysite

# Open with debugger
fm code mysite --debugger
```

#### 4) Agent-driven development

Perfect for AI agents developing Frappe apps:

```bash
# 1. Setup: Create fresh environment
fm create testsite --apps erpnext:version-15 --environment dev
fm start testsite

# 2. Develop: Enter shell, create app
fm shell testsite
bench new-app my_app
bench --site testsite install-app my_app
# ... make code changes ...
exit

# 3. Test: Run tests
fm shell testsite
bench --site testsite run-tests --app my_app
exit

# 4. Verify: Check logs
fm logs testsite -f

# 5. Reset if needed: Start fresh
fm stop testsite
fm delete testsite
fm create testsite --apps erpnext:version-15 --environment dev
```

#### 5) Internal service management (fmx)

Inside the container, use `fmx` for service control:

```bash
fm shell mysite

fmx status      # Check service status
fmx restart     # Restart Frappe services
fmx start       # Start services
fmx stop        # Stop services
```

### Verification

- [ ] Site accessible at http://mysite.localhost
- [ ] Can login with admin credentials (default: admin/admin)
- [ ] Custom app installed and visible
- [ ] Tests run successfully inside container
- [ ] Logs show no critical errors

### Failure modes / debugging

- **Docker not running**: Start Docker daemon
- **Port conflict**: Use different site name or check port 80/443
- **Site not accessible**: Check `fm list` for status, try `fm start`
- **App not installing**: Check `fm logs` for errors
- **Slow startup**: First run downloads images—be patient

### Escalation

- For advanced Docker config, see [references/docker-config.md](./frappe-manager.md)
- For SSL issues, see [references/ssl-setup.md](./frappe-manager.md)
- For bench commands, see [references/bench-commands.md](./bench.md)

### References

- [references/fm-commands.md](./frappe-manager.md) - Full FM command reference
- [references/agent-workflow.md](./frappe-manager.md) - Agent development patterns
- [references/bench-commands.md](./bench.md) - Bench CLI inside container
- https://github.com/rtCamp/Frappe-Manager

### Guardrails

- **Always backup before operations**: Run `fm backup <site>` before major changes or updates
- **Use named sites**: Avoid generic names; use descriptive site names for project identification
- **Check SSH access**: Ensure SSH keys are configured for private repos before app installation
- **Verify Docker status**: Run `fm doctor` to check Docker and FM health before operations
- **Use `fm shell` for commands**: Always enter container shell before running bench commands

### Common Mistakes

| Mistake | Why It Fails | Fix |
|---------|--------------|-----|
| Running bench commands outside `fm shell` | "Command not found" or wrong site | Always `fm shell <site>` first |
| Wrong site context | Operations affect wrong site | Check prompt shows correct site; use `bench --site <site>` |
| Missing volumes on recreate | Data loss | Use `fm recreate --keep-volumes` or backup first |
| Not checking `fm doctor` | Silent configuration issues | Run `fm doctor` to diagnose problems |
| Using `localhost` in site URL | DNS resolution issues | Use `<site>.localhost` format for local access |
| Forgetting to `fm start` after reboot | Site not accessible | Run `fm start <site>` or `fm start --all` |

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `frappe-manager/references/frappe-manager.md`.

## Frappe Manager (Docker-based dev/prod environment)

### Overview
Frappe Manager (FM) is a CLI tool by **rtCamp** that simplifies managing Frappe-based projects using Docker Compose. It streamlines the entire lifecycle from development to deployment.

**Note**: Frappe Manager is a third-party tool by rtCamp, not an official Frappe project. It's built on official [Frappe Docker](https://github.com/frappe/frappe_docker) images.

### Bench vs Frappe Manager
| Aspect | Bench | Frappe Manager |
|--------|-------|----------------|
| **Setup** | Native Python, manual dependencies | Docker-based, minimal host setup |
| **Isolation** | Shared host environment | Isolated containers per site |
| **Best for** | Production servers, direct control | Local dev, quick onboarding, reproducible envs |
| **Requirements** | Python, Node, MariaDB, Redis, etc. | Python 3.11+, Docker |

### Requirements
- Python 3.11 or higher
- Docker
- VSCode (optional, for development features)

### Installation
```bash
# Install stable version
pipx install frappe-manager

# Install latest develop
pipx install git+https://github.com/rtcamp/frappe-manager@develop

# Setup shell completion
fm --install-completion
```

### Quick Start
```bash
# Create your first site (dev environment, frappe version-15)
fm create mysite

# Create site with ERPNext
fm create mysite --apps erpnext:version-15

# Create site with multiple apps
fm create mysite --apps erpnext --apps hrms --environment dev
```

### Commands Reference

#### Site Management
```bash
fm create <benchname>     # Create a new bench/site
fm delete <benchname>     # Delete a bench
fm start <benchname>      # Start a bench
fm stop <benchname>       # Stop a bench
fm list                   # List all benches
fm info <benchname>       # Show bench information
fm logs <benchname> -f    # View logs (follow mode)
fm update <benchname>     # Update bench
```

#### Development
```bash
fm shell <benchname>              # Access shell inside container
fm code <benchname>               # Open in VSCode
fm code <benchname> --debugger    # Open in VSCode with debugger
```

#### Services & SSL
```bash
fm services                       # Manage global services
fm ssl <benchname>                # Manage SSL for a bench
```

### fm create Options
```bash
fm create [OPTIONS] BENCHNAME

Options:
  -a, --apps TEXT              Apps to install (format: app or app:branch)
  --environment, --env         Environment type: dev|prod (default: dev)
  --developer-mode             Toggle developer mode: enable|disable
  --frappe-branch TEXT         Frappe branch (default: version-15)
  --admin-pass TEXT            Admin password (default: admin)
  --ssl                        Enable SSL: letsencrypt|disable
  --template / --no-template   Create template bench
```

#### Prebaked Apps
These apps are prebaked in Frappe Docker images (faster installation):
- `frappe`: version-15
- `erpnext`: version-15
- `hrms`: version-15

#### Examples
```bash
# Basic site with frappe only
fm create example

# Site with frappe develop branch
fm create example --frappe-branch develop

# Site with ERPNext and HRMS
fm create example --apps erpnext --apps hrms

# Production site with SSL
fm create example.com --apps erpnext --env prod --ssl letsencrypt
```

### Production Setup
```bash
# Create production site with SSL (HTTP01 challenge)
fm create example.com --environment prod \
  --ssl letsencrypt \
  --letsencrypt-preferred-challenge http01 \
  --letsencrypt-email admin@example.com

# Create production site with SSL (DNS01 challenge)
fm create example.com --environment prod \
  --ssl letsencrypt \
  --letsencrypt-preferred-challenge dns01 \
  --letsencrypt-email admin@example.com
```

### Working Inside Containers

#### fm shell
Access the container shell to run bench commands:
```bash
fm shell mysite

# Inside container:
bench new-app my_app
bench --site mysite install-app my_app
bench migrate
bench build --app my_app
```

#### fmx CLI (Inside Container)
The `fmx` CLI manages internal services (Frappe, Workers, Scheduler):
```bash
fm shell mysite

# Inside container:
fmx status              # Check service status
fmx restart             # Restart Frappe services
fmx start               # Start services
fmx stop                # Stop services
```

### Operation Notes
- Sites are named like `example.localhost` (accessible at http://example.localhost)
- For custom domains without DNS, add entries to `/etc/hosts`
- Run as non-root user
- After updating Python packages, use `bench restart` or `fmx restart`
- In `prod` environment, developer mode and admin tools are disabled by default
- In `dev` environment, developer mode and admin tools are enabled by default

### Sample Dev Workflow
```bash
# 1. Create dev site with ERPNext
fm create devsite --apps erpnext:version-15 --environment dev

# 2. Start the site
fm start devsite

# 3. Access shell and create custom app
fm shell devsite
bench new-app my_custom_app
bench --site devsite install-app my_custom_app
exit

# 4. Open in VSCode with debugger
fm code devsite --debugger
```

### Agent-Driven Development Workflow

Frappe Manager is the recommended environment for AI code agents (vibe coding) to develop and test Frappe apps. It provides isolated, reproducible environments that agents can create, test, and reset.

#### Why Frappe Manager for Agents
- **Isolated environments**: Each site runs in Docker containers—no host pollution
- **Quick reset**: Delete and recreate sites to test from clean state
- **Minimal dependencies**: Only Docker needed on host
- **Shell access**: Agents can run commands via `fm shell`
- **Reproducible**: Same environment across different machines

#### Agent Workflow

```bash
# 1. Setup: Create a fresh dev environment
fm create testsite --apps erpnext:version-15 --environment dev
fm start testsite

# 2. Develop: Enter shell and create/modify app
fm shell testsite
bench new-app my_app
bench --site testsite install-app my_app
# ... make code changes ...
exit

# 3. Test: Run tests inside the container
fm shell testsite
bench --site testsite run-tests --app my_app
exit

# 4. Verify: Check logs for errors
fm logs testsite -f

# 5. Reset (if needed): Start fresh
fm stop testsite
fm delete testsite
fm create testsite --apps erpnext:version-15 --environment dev
```

#### Key Commands for Agents

| Task | Command |
|------|---------|
| Create environment | `fm create <site> --environment dev` |
| Start environment | `fm start <site>` |
| Run shell command | `fm shell <site>` then run commands |
| View logs | `fm logs <site> -f` |
| Check site info | `fm info <site>` |
| List all sites | `fm list` |
| Stop environment | `fm stop <site>` |
| Delete environment | `fm delete <site>` |
| Restart services | `fm shell <site>` then `fmx restart` |

#### Testing Inside Container
```bash
fm shell testsite

# Run all tests for an app
bench --site testsite run-tests --app my_app

# Run specific test module
bench --site testsite run-tests --module my_app.tests.test_feature

# Run with verbose output
bench --site testsite run-tests --app my_app -v

# Migrate after schema changes
bench --site testsite migrate

# Clear cache between tests
bench --site testsite clear-cache
```

### References
- https://github.com/rtCamp/Frappe-Manager
- https://github.com/rtCamp/Frappe-Manager/wiki
- https://github.com/frappe/frappe_docker (base images)

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `frappe-manager/references/fm-commands.md`.

```markdown
# FM Commands Reference

## Overview
Complete reference for Frappe Manager CLI commands.

## Global Commands

```bash
## Show version
fm --version

## Show help
fm --help

## Install shell completion
fm --install-completion

## Uninstall shell completion
fm --uninstall-completion
```

## Site Creation

### fm create
Create a new Frappe bench/site.

```bash
fm create [OPTIONS] BENCHNAME
```

**Options:**
| Option | Description | Default |
|--------|-------------|---------|
| `-a, --apps TEXT` | Apps to install (format: app or app:branch) | frappe |
| `--environment, --env` | Environment type: dev | prod | dev |
| `--developer-mode` | Toggle developer mode: enable | disable | enable |
| `--frappe-branch TEXT` | Frappe branch | version-15 |
| `--admin-pass TEXT` | Admin password | admin |
| `--ssl` | SSL type: letsencrypt | disable | disable |
| `--letsencrypt-email TEXT` | Email for Let's Encrypt | - |
| `--letsencrypt-preferred-challenge` | http01 | dns01 | http01 |
| `--template / --no-template` | Create template bench | no-template |

**Examples:**
```bash
## Basic site
fm create mysite

## With ERPNext
fm create mysite --apps erpnext:version-15

## Production with SSL
fm create example.com --env prod --ssl letsencrypt --letsencrypt-email admin@example.com

## Multiple apps
fm create mysite --apps erpnext --apps hrms --apps insights
```

## Site Management

### List Sites
```bash
fm list
```

### Start/Stop
```bash
fm start BENCHNAME
fm stop BENCHNAME
```

### Delete Site
```bash
fm delete BENCHNAME

## Force delete
fm delete BENCHNAME --force
```

### Site Info
```bash
fm info BENCHNAME
```

### View Logs
```bash
fm logs BENCHNAME

## Follow mode
fm logs BENCHNAME -f

## Last N lines
fm logs BENCHNAME --tail 100
```

### Update Site
```bash
fm update BENCHNAME
```

## Development Commands

### Shell Access
```bash
fm shell BENCHNAME
```

Opens an interactive shell inside the container with bench available.

### VS Code Integration
```bash
## Open in VS Code
fm code BENCHNAME

## With debugger
fm code BENCHNAME --debugger
```

### Restart Services
```bash
fm restart BENCHNAME
```

## SSL Management

### fm ssl
Manage SSL certificates for a site.

```bash
## Check status
fm ssl BENCHNAME status

## Enable Let's Encrypt
fm ssl BENCHNAME letsencrypt --email admin@example.com

## Use custom certificate
fm ssl BENCHNAME custom --cert-path /path/to/cert.pem --key-path /path/to/key.pem

## Disable SSL
fm ssl BENCHNAME disable

## Renew certificate
fm ssl BENCHNAME renew
```

## Global Services

### fm services
Manage global FM services (reverse proxy, etc.).

```bash
## List services
fm services list

## Start services
fm services start

## Stop services
fm services stop

## Restart services
fm services restart
```

## Configuration

### fm config
Manage FM configuration.

```bash
## Show config
fm config show

## Set value
fm config set KEY VALUE

## Get value
fm config get KEY
```

## Advanced Operations

### Export/Import

```bash
## Export site (for backup/migration)
fm export BENCHNAME --output /path/to/backup

## Import site
fm import /path/to/backup --name newsite
```

### Clone Site
```bash
fm clone SOURCEBENCH NEWBENCH
```

## Troubleshooting Commands

### Check Health
```bash
fm info BENCHNAME
```

### View All Containers
```bash
fm ps

## With details
fm ps -a
```

### Clean Up
```bash
## Remove unused images
fm clean

## Remove stopped containers
fm clean --containers

## Remove all (dangerous)
fm clean --all
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Site not found |
| 4 | Docker error |

## Environment Variables

```bash
## Set FM home directory
export FM_HOME=/path/to/fm

## Set default Frappe version
export FM_DEFAULT_FRAPPE_BRANCH=version-15

## Enable debug output
export FM_DEBUG=1
```

## Configuration File

FM stores configuration in `~/.fm/config.yml`:

```yaml
## ~/.fm/config.yml
default_frappe_branch: version-15
default_environment: dev
default_admin_password: admin
docker_compose_version: "3.8"
```

Sources: Frappe Manager GitHub (rtCamp/Frappe-Manager)
```

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `frappe-manager/references/docker-config.md`.

```markdown
# Docker Configuration Reference

## Overview
Advanced Docker configuration for Frappe Manager sites.

## Environment Variables

### Common Variables
```bash
## Database
MYSQL_ROOT_PASSWORD=root
MYSQL_DATABASE=your_site
DB_HOST=mariadb

## Redis
REDIS_CACHE=redis://redis-cache:6379
REDIS_QUEUE=redis://redis-queue:6379
REDIS_SOCKETIO=redis://redis-socketio:6379

## Frappe
FRAPPE_SITE=your-site.localhost
DEVELOPER_MODE=1
ADMIN_PASSWORD=admin
```

### Docker Compose Override

Create `docker-compose.override.yml` for custom configuration:

```yaml
## docker-compose.override.yml
version: "3.8"

services:
  frappe:
    environment:
      - DEVELOPER_MODE=1
      - FRAPPE_SENTRY_DSN=https://key@sentry.io/123
    volumes:
      - ./custom-config:/app/custom-config:ro
    ports:
      - "8001:8000"  # Different port
```

## Resource Limits

```yaml
services:
  frappe:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

## Database Configuration

### Custom MariaDB Settings

```yaml
services:
  mariadb:
    image: mariadb:10.6
    command:
      - --character-set-server=utf8mb4
      - --collation-server=utf8mb4_unicode_ci
      - --max_allowed_packet=256M
      - --innodb_buffer_pool_size=1G
    environment:
      - MYSQL_ROOT_PASSWORD=root
```

### Persistent Data
```yaml
volumes:
  mariadb_data:
    driver: local
  
services:
  mariadb:
    volumes:
      - mariadb_data:/var/lib/mysql
```

## Redis Configuration

```yaml
services:
  redis-cache:
    image: redis:alpine
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
  
  redis-queue:
    image: redis:alpine
    command: redis-server --appendonly yes
```

## Networking

### Custom Network
```yaml
networks:
  frappe_network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.28.0.0/16

services:
  frappe:
    networks:
      frappe_network:
        ipv4_address: 172.28.0.10
```

### Expose to Host
```yaml
services:
  frappe:
    ports:
      - "8000:8000"      # Web
      - "9000:9000"      # Socket.IO
      - "6787:6787"      # Debugger (if enabled)
```

## Volume Mounts for Development

```yaml
services:
  frappe:
    volumes:
      # Mount local apps for live editing
      - ./apps/my_app:/workspace/frappe-bench/apps/my_app:cached
      
      # Persist sites data
      - sites_data:/workspace/frappe-bench/sites
      
      # Persist logs
      - ./logs:/workspace/frappe-bench/logs
```

## Multi-Site Configuration

```yaml
services:
  frappe:
    environment:
      - FRAPPE_SITE=site1.localhost
    volumes:
      - sites_data:/workspace/frappe-bench/sites
  
  nginx:
    image: nginx:alpine
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    ports:
      - "80:80"
```

## Debugging Configuration

### Enable Xdebug
```yaml
services:
  frappe:
    environment:
      - XDEBUG_MODE=debug
      - XDEBUG_CONFIG=client_host=host.docker.internal client_port=9003
```

### VS Code Debug Config
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Frappe Python",
      "type": "python",
      "request": "attach",
      "connect": {
        "host": "localhost",
        "port": 6787
      },
      "pathMappings": [
        {
          "localRoot": "${workspaceFolder}/apps/my_app",
          "remoteRoot": "/workspace/frappe-bench/apps/my_app"
        }
      ]
    }
  ]
}
```

## Health Checks

```yaml
services:
  frappe:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
  
  mariadb:
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
```

## Backup Configuration

```yaml
services:
  backup:
    image: frrouting/backup
    volumes:
      - sites_data:/backup/sites:ro
      - ./backups:/backup/output
    environment:
      - BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM
```

## Production Overrides

```yaml
## docker-compose.prod.yml
version: "3.8"

services:
  frappe:
    environment:
      - DEVELOPER_MODE=0
    restart: unless-stopped
    deploy:
      replicas: 2
  
  nginx:
    restart: unless-stopped
  
  mariadb:
    restart: unless-stopped
```

Usage:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Sources: Docker Compose, Frappe Docker (official repos)
```

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `frappe-manager/references/ssl-setup.md`.

```markdown
# SSL Setup Reference

## Overview
Configure SSL/TLS for Frappe Manager sites using Let's Encrypt or custom certificates.

## Let's Encrypt (Automatic)

### HTTP-01 Challenge
For servers accessible on port 80:

```bash
fm create example.com \
  --apps erpnext:version-15 \
  --environment prod \
  --ssl letsencrypt \
  --letsencrypt-preferred-challenge http01 \
  --letsencrypt-email admin@example.com
```

**Requirements:**
- Domain must point to your server
- Port 80 must be accessible
- Valid email for certificate notifications

### DNS-01 Challenge
For servers behind firewalls or without port 80:

```bash
fm create example.com \
  --apps erpnext:version-15 \
  --environment prod \
  --ssl letsencrypt \
  --letsencrypt-preferred-challenge dns01 \
  --letsencrypt-email admin@example.com
```

**Process:**
1. FM will display a TXT record to add
2. Add the TXT record to your DNS
3. Wait for DNS propagation
4. FM verifies and issues certificate

### Certificate Renewal
Let's Encrypt certificates auto-renew. Check status:

```bash
fm ssl example.com status
```

## Custom Certificates

### Using Existing Certificate
```bash
fm ssl example.com custom \
  --cert-path /path/to/fullchain.pem \
  --key-path /path/to/privkey.pem
```

### Self-Signed (Development)
```bash
## Generate self-signed certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout selfsigned.key \
  -out selfsigned.crt \
  -subj "/CN=example.localhost"

## Apply to site
fm ssl example.localhost custom \
  --cert-path selfsigned.crt \
  --key-path selfsigned.key
```

## Wildcard Certificates

For multiple subdomains:

```bash
## Requires DNS-01 challenge
fm create *.example.com \
  --ssl letsencrypt \
  --letsencrypt-preferred-challenge dns01 \
  --letsencrypt-email admin@example.com
```

## SSL Management Commands

```bash
## Check SSL status
fm ssl mysite status

## Renew certificate
fm ssl mysite renew

## Disable SSL
fm ssl mysite disable

## Re-enable SSL
fm ssl mysite enable
```

## Nginx SSL Configuration

For manual Nginx configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;
    
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # Proxy to Frappe
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

## Redirect HTTP to HTTPS
server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}
```

## Troubleshooting

### Certificate Not Issued
```bash
## Check domain DNS
dig example.com

## Verify port 80 is accessible
curl -v http://example.com

## Check certbot logs
fm logs mysite | grep -i certbot
```

### Certificate Expired
```bash
## Force renewal
fm ssl mysite renew --force

## Check certificate expiry
echo | openssl s_client -connect example.com:443 2>/dev/null | openssl x509 -noout -dates
```

### Mixed Content Warnings
Ensure `site_config.json` has correct URL:

```json
{
  "host_name": "https://example.com"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Rate limit exceeded | Too many certificate requests | Wait 1 hour, use staging first |
| DNS not propagated | TXT record not available | Wait 5-10 minutes, verify with dig |
| Port 80 blocked | Firewall/ISP restriction | Use DNS-01 challenge |
| CAA record issue | DNS CAA restricts issuers | Add `CAA 0 issue "letsencrypt.org"` |

Sources: Let's Encrypt, Certbot, Nginx SSL (official docs)
```

> Adopted from [lubusIN/frappe-skills](https://github.com/lubusIN/frappe-skills) (MIT) — `frappe-manager/references/agent-workflow.md`.

```markdown
# Agent Workflow Reference

## Overview
Optimized workflows for AI agents developing Frappe applications using Frappe Manager.

## Quick Start Workflow

### 1. Environment Setup
```bash
## Create isolated development environment
fm create devsite --apps erpnext:version-15 --environment dev
fm start devsite
```

### 2. Create Custom App
```bash
fm shell devsite
bench new-app my_custom_app
bench --site devsite install-app my_custom_app
exit
```

### 3. Development Cycle
```bash
## Make changes to app code in apps/my_custom_app/

## Test changes
fm shell devsite
bench --site devsite migrate
bench --site devsite run-tests --app my_custom_app
exit

## Check logs if issues
fm logs devsite -f
```

### 4. Reset if Needed
```bash
fm stop devsite
fm delete devsite --force
fm create devsite --apps erpnext:version-15 --environment dev
```

## Agent-Optimized Patterns

### Fast Iteration Loop
```bash
## One-liner for test iteration
fm shell devsite -c "bench --site devsite run-tests --app my_app"
```

### Check Changes Without Shell
```bash
## Run single command in container
docker exec -it devsite-frappe bench --site devsite migrate
```

### Verify Site Status
```bash
## Quick health check
fm info devsite
fm logs devsite --tail 20
```

## Directory Structure for Agents

```
~/frappe-manager/
├── devsite/                    # FM site directory
│   ├── workspace/
│   │   └── frappe-bench/
│   │       ├── apps/
│   │       │   ├── frappe/
│   │       │   ├── erpnext/
│   │       │   └── my_custom_app/  ← Your app code
│   │       └── sites/
│   │           └── devsite/
│   │               └── site_config.json
│   └── docker-compose.yml
```

## File Editing Workflow

### Edit from Host (Recommended)
```bash
## Files are mounted, edit directly on host
code ~/frappe-manager/devsite/workspace/frappe-bench/apps/my_custom_app/

## Or use VS Code with FM
fm code devsite
```

### Apply Changes
```bash
fm shell devsite
bench build --app my_custom_app  # For JS changes
bench --site devsite migrate      # For schema changes
bench --site devsite clear-cache  # For Python changes
exit
```

## Testing Strategies

### Run Single Test
```bash
fm shell devsite -c "bench --site devsite run-tests --module my_app.doctype.my_doc.test_my_doc"
```

### Run with Output
```bash
fm shell devsite -c "bench --site devsite run-tests --app my_app -v"
```

### Test Specific DocType
```bash
fm shell devsite -c "bench --site devsite run-tests --doctype 'My DocType'"
```

## Debugging Workflow

### Enable Debug Mode
```bash
fm shell devsite
bench set-config -g developer_mode 1
exit

## Open with debugger
fm code devsite --debugger
```

### Check Error Logs
```bash
## Recent errors
fm logs devsite | grep -i error | tail -20

## Follow live
fm logs devsite -f
```

### Console Debugging
```bash
fm shell devsite
bench --site devsite console
>>> doc = frappe.get_doc("My DocType", "XYZ")
>>> doc.status
>>> exit()
```

## Database Operations

### Quick DB Access
```bash
fm shell devsite -c "bench --site devsite mariadb -e 'SHOW TABLES;'"
```

### Backup Before Changes
```bash
fm shell devsite -c "bench --site devsite backup"
```

### Reset Database
```bash
fm shell devsite
bench --site devsite reinstall --yes
exit
```

## Multi-App Development

```bash
## Create shared environment
fm create multiapp --apps erpnext:version-15 --apps hrms:version-15

## Install your apps
fm shell multiapp
bench new-app app_one
bench new-app app_two
bench --site multiapp install-app app_one
bench --site multiapp install-app app_two
exit
```

## CI/CD Integration

### GitHub Actions Integration
```yaml
- name: Setup FM
  run: pipx install frappe-manager @
- name: Create Test Site
  run: |
    fm create testsite --apps erpnext:version-15
    fm shell testsite -c "bench --site testsite install-app ${{ github.workspace }}"

- name: Run Tests
  run: fm shell testsite -c "bench --site testsite run-tests --app my_app"
```

## Cleanup

### Daily Cleanup
```bash
## Remove stopped sites
fm clean --containers

## Remove old images
docker image prune -f
```

### Full Reset
```bash
## Remove all FM sites
fm list | xargs -I {} fm delete {} --force

## Clean Docker
docker system prune -af
```

## Quick Reference Card

| Task | Command |
|------|---------|
| Create site | `fm create mysite --apps erpnext` |
| Enter shell | `fm shell mysite` |
| Run tests | `fm shell mysite -c "bench --site mysite run-tests --app my_app"` |
| Check logs | `fm logs mysite -f` |
| Restart | `fm restart mysite` |
| Delete | `fm delete mysite --force` |

Sources: Frappe Manager, Agent Development Patterns
```
