# Deploying SparkForge Kids (free)

This puts the API and web app on a free cloud server with HTTPS, so the iOS and Android apps and other people's browsers can reach it. It takes about 30 minutes the first time.

**How it works:** every merge to `main` runs the **Release image** workflow, which builds the server image (x86 and ARM) and publishes it to GitHub Container Registry. The server runs that image behind [Caddy](https://caddyserver.com), which gets and renews the HTTPS certificate automatically. A cron job checks for a new image every 5 minutes and restarts the app when there is one. All data (database, encryption key) lives in `~/sparkforge/data` on the server.

## 1. Create the server (Oracle Cloud Always Free)

1. Sign up at [oracle.com/cloud/free](https://www.oracle.com/cloud/free/). A card is needed to verify you, but Always Free resources are not charged. Pick a home region near you; it can't be changed later.
2. **Compute → Instances → Create instance**
   - Image: **Ubuntu 24.04** (Canonical)
   - Shape: **Ampere → VM.Standard.A1.Flex**, 2 OCPUs, 12 GB memory (within the free allowance). If it says "out of capacity", try another availability domain or try again later; or use **VM.Standard.E2.1.Micro** (also free, smaller).
   - Networking: keep "Assign a public IPv4 address" on.
   - SSH keys: upload your public key (or let it generate one and download it).
3. Open the web ports: on the instance page, click the **subnet → Security list → Add ingress rules**: source `0.0.0.0/0`, TCP, destination ports `80,443`.
4. Copy the instance's **public IP address**.

## 2. Get a domain name

HTTPS needs a name, not just an IP. Free option: [duckdns.org](https://www.duckdns.org) — sign in, create a subdomain (e.g. `sparkforge-family.duckdns.org`), and set its IP to your server's public IP. If you own a domain, add an `A` record pointing to the IP instead.

## 3. Let the server download the image

The image is private while the repository is private. Either:

- **Make the image public** (simplest): after the first **Release image** run, open GitHub → your profile → **Packages → appforkids → Package settings → Change visibility → Public**. The image contains the app code but no data or secrets. Or
- **Use a token**: GitHub → Settings → Developer settings → **Personal access tokens (classic)** → generate one with only `read:packages`. You'll pass it to the setup script below.

## 4. Run the setup script

From a checkout of this repo on your computer:

```bash
scp -r deploy ubuntu@<server-ip>:
ssh ubuntu@<server-ip>
bash deploy/setup.sh sparkforge-family.duckdns.org
# with a private image:
GHCR_USER=<your-github-username> GHCR_TOKEN=<token> bash deploy/setup.sh sparkforge-family.duckdns.org
```

It installs Docker, opens the VM firewall, writes `~/sparkforge/.env` (with a fresh random `SPARKFORGE_SECRET`), starts the app and Caddy, and installs the update cron job. After a minute, open `https://<your-domain>`.

## 5. Settings

Edit `~/sparkforge/.env` on the server, then run `cd ~/sparkforge && sudo docker compose up -d`:

- `ANTHROPIC_API_KEY` — live AI (paid per use at [console.anthropic.com](https://console.anthropic.com)). Empty = free practice mode.
- `SMTP_URL`, `SMTP_FROM` — send emails to parent-approved contacts.

**Keep `SPARKFORGE_SECRET` and `data/` safe.** The secret encrypts connector credentials; losing it means reconnecting them. Back up with `sudo tar czf sparkforge-backup.tgz -C ~/sparkforge data .env`.

## 6. Point the mobile apps at it

In `mobile/eas.json`, set `EXPO_PUBLIC_API_URL` in the `preview` and `production` profiles to `https://<your-domain>`, then build with EAS (see the main README). For development, `EXPO_PUBLIC_API_URL=https://<your-domain> npx expo start` works too.

## Everyday operations

```bash
cd ~/sparkforge
sudo docker compose logs -f app     # app logs
sudo docker compose ps              # status
./update.sh                         # update now instead of waiting for cron
```

## Other hosts

`setup.sh` works on any Ubuntu 22.04/24.04 server with ports 80/443 open. On **Google Cloud's free e2-micro** (us-west1, us-central1 or us-east1; 30 GB standard disk), allow HTTP/HTTPS traffic when creating the VM and run the same steps. Its free tier includes only 1 GB/month of outbound traffic, so it suits a family or small group.
