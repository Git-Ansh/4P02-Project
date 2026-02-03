# GitHub Actions CI/CD Setup

This repository uses GitHub Actions for automated testing and deployment.

## Workflows

### CI/CD Pipeline (`deploy.yml`)

**Triggers:**
- Push to `main` branch → Run tests + Deploy to VPS
- Pull requests to `main` → Run tests only

**Jobs:**
1. **test-backend** - Run Python/pytest tests
2. **test-frontend** - Run Node.js/npm tests (commented out until frontend is initialized)
3. **deploy** - Deploy to VPS via SSH
4. **notify** - Report deployment status

## Required GitHub Secrets

To enable auto-deployment, configure these secrets in your GitHub repository:

### Navigation: 
`Repository Settings` → `Secrets and variables` → `Actions` → `New repository secret`

### Required Secrets:

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `VPS_HOST` | VPS IP address or domain | `51.222.106.47` |
| `VPS_USERNAME` | SSH username | `ubuntu` |
| `VPS_SSH_KEY` | Private SSH key for authentication | Contents of `~/.ssh/id_ed25519` |
| `VPS_SSH_PASSPHRASE` | SSH key passphrase (if key is password-protected) | Your key passphrase |
| `VPS_PORT` | SSH port (optional, defaults to 22) | `22` |

### How to Add SSH Key Secret

On your **local machine** (not VPS):

```bash
# Display your private key
cat ~/.ssh/id_ed25519

# Copy the entire output including:
# -----BEGIN OPENSSH PRIVATE KEY-----
# ...
# -----END OPENSSH PRIVATE KEY-----
```

Paste the complete private key into the `VPS_SSH_KEY` secret field.

## Deployment Process

When you push to `main`:

1. ✅ Backend tests run
2. ✅ SSH into VPS
3. ✅ Pull latest code
4. ✅ Rebuild Docker containers
5. ✅ Restart services
6. ✅ Verify deployment

## Manual Deployment

To deploy manually on VPS:

```bash
cd ~/COSC_4P02/Project/4P02-Project
git pull origin main
docker-compose down
docker-compose up -d --build
```

## Monitoring Deployments

View workflow runs:
- Go to repository → **Actions** tab
- Click on a workflow run to see logs
- Green ✓ = Success, Red ✗ = Failed

## Environment Variables

The workflow copies `.env.example` to `.env` on first deployment.

**Important:** Configure your `.env` file on the VPS with production values:

```bash
ssh ubuntu@51.222.106.47
cd ~/COSC_4P02/Project/4P02-Project
nano .env  # Edit with actual credentials
```

## Troubleshooting

### Deployment fails with "Permission denied"
- Ensure SSH key is correctly added to GitHub Secrets
- Verify the public key is in `~/.ssh/authorized_keys` on VPS

### Docker build fails
- SSH into VPS and check logs: `docker-compose logs`
- Verify `.env` file exists and is configured

### Tests failing
- Check the Actions tab for detailed error logs
- Run tests locally: `cd backend && pytest`

## Future Enhancements

- [ ] Add frontend testing when React app is initialized
- [ ] Add code quality checks (linting, formatting)
- [ ] Add security scanning
- [ ] Add staging environment deployment
- [ ] Add rollback capability
