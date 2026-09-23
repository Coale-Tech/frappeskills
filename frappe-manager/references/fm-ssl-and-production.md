# FM Production & SSL

Part of [frappe-manager.md](frappe-manager.md). Site creation flags are in
[fm-sites-and-installation.md](fm-sites-and-installation.md).

## Production setup

```bash
fm create example.com \
  --apps erpnext \
  --environment prod \
  --ssl letsencrypt \
  --letsencrypt-preferred-challenge http01 \
  --letsencrypt-email admin@example.com
```

## Let's Encrypt

### HTTP-01 challenge

For servers reachable on port 80 with the domain already pointing at the host:

```bash
fm create example.com \
  --environment prod \
  --ssl letsencrypt \
  --letsencrypt-preferred-challenge http01 \
  --letsencrypt-email admin@example.com
```

### DNS-01 challenge

For servers behind a firewall or without port 80 open:

```bash
fm create example.com \
  --environment prod \
  --ssl letsencrypt \
  --letsencrypt-preferred-challenge dns01 \
  --letsencrypt-email admin@example.com
```

FM prints a TXT record to add to DNS, then verifies it and issues the
certificate once it propagates.

### Wildcard certificates

Multiple subdomains require the DNS-01 challenge:

```bash
fm create '*.example.com' \
  --ssl letsencrypt \
  --letsencrypt-preferred-challenge dns01 \
  --letsencrypt-email admin@example.com
```

## Custom / self-signed certificates

```bash
# Existing certificate
fm ssl example.com custom \
  --cert-path /path/to/fullchain.pem \
  --key-path /path/to/privkey.pem

# Self-signed, for local development
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout selfsigned.key -out selfsigned.crt \
  -subj "/CN=example.localhost"

fm ssl example.localhost custom \
  --cert-path selfsigned.crt \
  --key-path selfsigned.key
```

## SSL management

```bash
fm ssl <site> status
fm ssl <site> renew
fm ssl <site> renew --force
fm ssl <site> disable
fm ssl <site> enable
```

## Manual Nginx SSL config

For a hand-rolled reverse proxy in front of FM:

```nginx
server {
    listen 443 ssl http2;
    server_name example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=63072000" always;

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

server {
    listen 80;
    server_name example.com;
    return 301 https://$host$request_uri;
}
```

## Operation notes

- Sites are named like `example.localhost`, accessible at `http://example.localhost`
- For custom domains without DNS, add entries to `/etc/hosts`
- Run FM as a non-root user
- After updating Python packages, run `bench restart` or `fmx restart` inside the container
- `prod` disables developer mode and admin tools by default; `dev` enables them

## Troubleshooting

```bash
# Confirm domain DNS
dig example.com

# Confirm port 80 is reachable (for HTTP-01)
curl -v http://example.com

# Look for certbot activity in container logs
fm logs <site> | grep -i certbot

# Check certificate expiry directly
echo | openssl s_client -connect example.com:443 2>/dev/null | openssl x509 -noout -dates
```

Mixed-content warnings usually mean `site_config.json` has the wrong scheme:

```json
{
  "host_name": "https://example.com"
}
```

| Error | Cause | Fix |
|-------|-------|-----|
| Rate limit exceeded | Too many certificate requests | Wait an hour; test against Let's Encrypt staging first |
| DNS not propagated | TXT record not yet visible | Wait 5–10 minutes, verify with `dig` |
| Port 80 blocked | Firewall/ISP restriction | Use the DNS-01 challenge instead |
| CAA record issue | DNS CAA restricts issuers | Add `CAA 0 issue "letsencrypt.org"` |

Sources: Let's Encrypt, Certbot, Nginx SSL (official docs); FM SSL behavior per
[rtCamp/Frappe-Manager](https://github.com/rtCamp/Frappe-Manager) — third-party
tool, confirm exact flags with `fm ssl --help`.
