# Deploying SparkForge Kids (free)

This puts the API and web app on a free cloud server (Google Cloud e2-micro, or Oracle Cloud) with HTTPS, so the iOS and Android apps and other people's browsers can reach it. It takes about 30 minutes the first time.

**How it works:** every merge to `main` runs the **Release image** workflow, which builds the server image (x86 and ARM) and publishes it to GitHub Container Registry. The server runs that image behind [Caddy](https://caddyserver.com), which gets and renews the HTTPS certificate automatically. A cron job checks for a new image every 5 minutes and restarts the app when there is one. All data (database, encryption key) lives in `~/sparkforge/data` on the server.

## 1. Create the server (Google Cloud free e2-micro)

1. Create an account at [cloud.google.com/free](https://cloud.google.com/free) (a card is needed to verify you). New accounts also get trial credit; the e2-micro stays free after the trial ends.
2. In [Billing → Budgets & alerts](https://console.cloud.google.com/billing/budgets), add a budget of $1 with email alerts, so you hear about any charge right away.
3. Open [Compute Engine → VM instances](https://console.cloud.google.com/compute/instances) (enable the Compute Engine API when asked) → **Create instance**. These settings keep it inside the free tier:
   - Region: **us-west1**, **us-central1** or **us-east1** (other regions are not free)
   - Machine type: **E2 → e2-micro**
   - Boot disk: **Ubuntu 24.04 LTS (x86/64)**, disk type **Standard persistent disk** (the default "Balanced" is *not* free), size **30 GB**
   - Firewall: tick **Allow HTTP traffic** and **Allow HTTPS traffic**
4. Copy the instance's **External IP**. It stays the same while the VM runs; if you stop and start the VM it can change, so update your DNS record then.

<details><summary>Oracle Cloud Always Free instead</summary>

1. Sign up at [oracle.com/cloud/free](https://www.oracle.com/cloud/free/) and pick a home region near you.
2. **Compute → Instances → Create instance**: Ubuntu 24.04, shape **VM.Standard.A1.Flex** (2 OCPUs, 12 GB) or **VM.Standard.E2.1.Micro**, public IPv4 on, upload your SSH key.
3. On the instance's **subnet → Security list → Add ingress rules**: source `0.0.0.0/0`, TCP, ports `80,443`.
4. Copy the public IP. Use `ubuntu@<ip>` for SSH below.
</details>

## 2. Get a domain name

HTTPS needs a name, not just an IP. Free option: [duckdns.org](https://www.duckdns.org) — sign in, create a subdomain (e.g. `sparkforge-family.duckdns.org`), and set its IP to your server's public IP. If you own a domain, add an `A` record pointing to the IP instead.

## 3. Let the server download the image

The image is private while the repository is private. Either:

- **Make the image public** (simplest): after the first **Release image** run, open GitHub → your profile → **Packages → appforkids → Package settings → Change visibility → Public**. The image contains the app code but no data or secrets. Or
- **Use a token**: GitHub → Settings → Developer settings → **Personal access tokens (classic)** → generate one with only `read:packages`. You'll pass it to the setup script below.

## 4. Run the setup script

Copy the `deploy` folder to the server and run the script. On Google Cloud the easiest way is the **SSH** button next to the VM: in that window use **Upload file** to upload `deploy.zip` (zip the repo's `deploy` folder first), then:

```bash
sudo apt-get install -y unzip && unzip deploy.zip
bash deploy/setup.sh sparkforge-family.duckdns.org
# with a private image:
GHCR_USER=<your-github-username> GHCR_TOKEN=<token> bash deploy/setup.sh sparkforge-family.duckdns.org
```

With SSH from your own computer instead: `scp -r deploy <user>@<server-ip>:` then `ssh <user>@<server-ip>`.

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

## Limits of the free server

Google's free tier includes 1 GB/month of outbound traffic (about $0.12/GB beyond that), which suits a family or small group. `setup.sh` works on any Ubuntu 22.04/24.04 server with ports 80/443 open, so you can move to a bigger host later: copy `~/sparkforge/data` and `.env` across.
