# FM Docker Compose Configuration

Part of [frappe-manager.md](frappe-manager.md). Advanced Docker Compose
overrides for FM-managed sites — normal usage doesn't need any of this.

## Common environment variables

```bash
# Database
MYSQL_ROOT_PASSWORD=root
MYSQL_DATABASE=your_site
DB_HOST=mariadb

# Redis
REDIS_CACHE=redis://redis-cache:6379
REDIS_QUEUE=redis://redis-queue:6379
REDIS_SOCKETIO=redis://redis-socketio:6379

# Frappe
FRAPPE_SITE=your-site.localhost
DEVELOPER_MODE=1
ADMIN_PASSWORD=admin
```

## Compose override

Create `docker-compose.override.yml` for custom configuration:

```yaml
services:
  frappe:
    environment:
      - DEVELOPER_MODE=1
    volumes:
      - ./custom-config:/app/custom-config:ro
    ports:
      - "8001:8000"  # different host port
```

## Resource limits

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

## Database configuration

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
    volumes:
      - mariadb_data:/var/lib/mysql

volumes:
  mariadb_data:
    driver: local
```

## Redis configuration

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
    ports:
      - "8000:8000"   # web
      - "9000:9000"   # socket.io
      - "6787:6787"   # debugger, if enabled
```

## Volume mounts for development

```yaml
services:
  frappe:
    volumes:
      # Mount a local app for live editing
      - ./apps/my_app:/workspace/frappe-bench/apps/my_app:cached
      - sites_data:/workspace/frappe-bench/sites
      - ./logs:/workspace/frappe-bench/logs
```

## Multi-site configuration

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

## Debugging (Xdebug)

```yaml
services:
  frappe:
    environment:
      - XDEBUG_MODE=debug
      - XDEBUG_CONFIG=client_host=host.docker.internal client_port=9003
```

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Frappe Python",
      "type": "python",
      "request": "attach",
      "connect": { "host": "localhost", "port": 6787 },
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

## Health checks

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

## Backup service

```yaml
services:
  backup:
    image: frrouting/backup
    volumes:
      - sites_data:/backup/sites:ro
      - ./backups:/backup/output
    environment:
      - BACKUP_SCHEDULE=0 2 * * *  # daily at 2 AM
```

## Production overrides

```yaml
# docker-compose.prod.yml
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

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Sources: Docker Compose, Frappe Docker (official repos). These are raw
Compose overrides — validate against the FM-generated `docker-compose.yml`
for the target site before applying, since FM owns that file's structure.
