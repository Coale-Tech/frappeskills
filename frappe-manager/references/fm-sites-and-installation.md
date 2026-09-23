# FM Installation, Sites & Global Commands

Part of [frappe-manager.md](frappe-manager.md). Frappe Manager (`fm`) is a
third-party CLI by rtCamp, built on official [Frappe Docker](https://github.com/frappe/frappe_docker)
images — not an official Frappe project.

## Install

```bash
# Stable
pipx install frappe-manager

# Latest develop branch
pipx install git+https://github.com/rtcamp/frappe-manager@develop

# Shell completion
fm --install-completion
fm --uninstall-completion

# Version / help
fm --version
fm --help
```

Requirements: Python 3.11+, Docker, VSCode (optional, for `fm code`).

## Bench vs Frappe Manager

| Aspect | Bench | Frappe Manager |
|--------|-------|----------------|
| Setup | Native Python, manual dependencies | Docker-based, minimal host setup |
| Isolation | Shared host environment | Isolated containers per site |
| Best for | Production servers, direct control | Local dev, quick onboarding, reproducible envs |
| Requirements | Python, Node, MariaDB, Redis, etc. | Python 3.11+, Docker |

## `fm create`

```bash
fm create [OPTIONS] BENCHNAME
```

| Option | Description | Default |
|--------|-------------|---------|
| `-a, --apps TEXT` | Apps to install (format: `app` or `app:branch`) | frappe |
| `--environment, --env` | Environment type: `dev` \| `prod` | dev |
| `--developer-mode` | Toggle developer mode: `enable` \| `disable` | enable |
| `--frappe-branch TEXT` | Frappe branch | version-15 |
| `--admin-pass TEXT` | Admin password | admin |
| `--ssl` | SSL type: `letsencrypt` \| `disable` | disable |
| `--letsencrypt-email TEXT` | Email for Let's Encrypt | — |
| `--letsencrypt-preferred-challenge` | `http01` \| `dns01` | http01 |
| `--template / --no-template` | Create template bench | no-template |

Prebaked apps (faster install, bundled in the Frappe Docker images): `frappe`,
`erpnext`, `hrms`.

```bash
# Basic site (frappe only)
fm create mysite

# Site with ERPNext
fm create mysite --apps erpnext:version-15

# Site with multiple apps
fm create mysite --apps erpnext --apps hrms --environment dev

# Frappe develop branch instead of a pinned version
fm create mysite --frappe-branch develop
```

Production setup and SSL options are covered in
[fm-ssl-and-production.md](fm-ssl-and-production.md).

## Site management

```bash
fm list                    # list all sites
fm info <site>              # show site information
fm start <site>
fm stop <site>
fm update <site>            # update bench/apps
fm logs <site>
fm logs <site> -f           # follow mode
fm logs <site> --tail 100   # last N lines
fm delete <site>
fm delete <site> --force
```

## Services & health

```bash
fm doctor                   # check Docker and FM health before operations
fm ps                       # list FM-managed containers
fm ps -a                    # with details

fm services list
fm services start
fm services stop
fm services restart

fm clean --containers       # remove stopped containers
fm clean                    # remove unused images
fm clean --all              # remove everything (dangerous)
```

## Configuration

```bash
fm config show
fm config set KEY VALUE
fm config get KEY
```

FM stores its own configuration at `~/.fm/config.yml`:

```yaml
default_frappe_branch: version-15
default_environment: dev
default_admin_password: admin
docker_compose_version: "3.8"
```

Environment variables:

```bash
export FM_HOME=/path/to/fm             # FM home directory
export FM_DEFAULT_FRAPPE_BRANCH=version-15
export FM_DEBUG=1                       # enable debug output
```

## Advanced site operations

```bash
fm export <site> --output /path/to/backup
fm import /path/to/backup --name <newsite>
fm clone <source-site> <new-site>
```

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Site not found |
| 4 | Docker error |

Sources: [rtCamp/Frappe-Manager](https://github.com/rtCamp/Frappe-Manager),
[FM documentation](https://opensource.rtcamp.com/Frappe-Manager/dev/). Third-party
tool — not verified against the installed bench; run `fm <command> --help` to
confirm exact flags before relying on them.
