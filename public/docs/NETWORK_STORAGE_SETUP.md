# Network Storage Setup Guide

This guide helps you configure network storage access for Mugiwara-Kaizoku when your download clients and storage are on remote servers.

## Architecture Overview

```
┌─────────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Download Client    │      │   Remote NAS     │      │  Local Machine  │
│  (Network Server)   │─────▶│   Storage        │◀─────│  (App Running)  │
│                     │      │                  │      │                 │
│  - Transmission     │      │  /data/downloads │      │  Must mount NAS │
│  - Deluge          │      │                  │      │  to access files│
│  - NZBGet          │      │                  │      │                 │
└─────────────────────┘      └──────────────────┘      └─────────────────┘
```

## Why Network Mounts Are Required

The application uses Node.js `fs` module for file operations, which requires direct filesystem access. When files are stored on a remote NAS, you must mount the NAS as a network share on your local machine.

**Without mounting:**
```
❌ App tries to access: /data/downloads/manga.cbz
❌ File doesn't exist locally → Import fails
```

**With mounting:**
```
✅ NAS mounted at: /mnt/nas-downloads
✅ App accesses: /mnt/nas-downloads/manga.cbz
✅ File is accessible → Import succeeds
```

## Setup Instructions by Platform

### Linux (NFS or SMB/CIFS)

#### Option A: NFS Mount (Recommended for Linux)

1. **Install NFS client:**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install nfs-common

   # CentOS/RHEL
   sudo yum install nfs-utils
   ```

2. **Create mount point:**
   ```bash
   sudo mkdir -p /mnt/nas-downloads
   ```

3. **Mount NAS:**
   ```bash
   sudo mount -t nfs nas-server:/path/to/downloads /mnt/nas-downloads
   ```

4. **Make persistent (add to /etc/fstab):**
   ```bash
   sudo nano /etc/fstab
   ```

   Add this line:
   ```
   nas-server:/path/to/downloads  /mnt/nas-downloads  nfs  defaults,_netdev  0  0
   ```

5. **Test mount:**
   ```bash
   ls -la /mnt/nas-downloads
   ```

#### Option B: SMB/CIFS Mount

1. **Install CIFS utilities:**
   ```bash
   sudo apt-get install cifs-utils
   ```

2. **Create credentials file:**
   ```bash
   sudo nano /root/.smbcredentials
   ```

   Add:
   ```
   username=your_username
   password=your_password
   ```

   Secure it:
   ```bash
   sudo chmod 600 /root/.smbcredentials
   ```

3. **Mount NAS:**
   ```bash
   sudo mount -t cifs //nas-server/downloads /mnt/nas-downloads -o credentials=/root/.smbcredentials,uid=1000,gid=1000
   ```

4. **Make persistent (/etc/fstab):**
   ```
   //nas-server/downloads  /mnt/nas-downloads  cifs  credentials=/root/.smbcredentials,uid=1000,gid=1000,_netdev  0  0
   ```

### macOS (SMB)

1. **Mount via Finder (GUI):**
   - Open Finder
   - Press `Cmd + K`
   - Enter: `smb://nas-server/downloads`
   - Enter credentials
   - Mount appears at `/Volumes/downloads`

2. **Mount via Terminal:**
   ```bash
   mkdir -p /Volumes/nas-downloads
   mount_smbfs //username:password@nas-server/downloads /Volumes/nas-downloads
   ```

3. **Auto-mount on login:**
   - System Preferences → Users & Groups → Login Items
   - Click `+` and add your NAS server

4. **Alternative: Use automount:**
   ```bash
   sudo nano /etc/auto_master
   ```

   Add:
   ```
   /- auto_smb
   ```

   Create `/etc/auto_smb`:
   ```
   /Volumes/nas-downloads -fstype=smbfs ://username:password@nas-server/downloads
   ```

### Windows

1. **Map Network Drive (GUI):**
   - Open File Explorer
   - Right-click "This PC" → "Map network drive"
   - Select drive letter (e.g., `Z:`)
   - Folder: `\\nas-server\downloads`
   - Check "Reconnect at sign-in"
   - Enter credentials if prompted

2. **Map via Command Line:**
   ```cmd
   net use Z: \\nas-server\downloads /user:username password /persistent:yes
   ```

3. **Using PowerShell:**
   ```powershell
   New-PSDrive -Name "Z" -PSProvider "FileSystem" -Root "\\nas-server\downloads" -Persist
   ```

## Configuration in Mugiwara-Kaizoku

You have **two options** for configuring paths:

### Option 1: Configure Download Clients (Recommended)

After mounting, configure your download clients to use the mounted paths directly.

#### Transmission Example
```json
{
  "download-dir": "/mnt/nas-downloads"
}
```

Or use Transmission's web UI:
- Settings → Downloading → Download to: `/mnt/nas-downloads`

**Do this for all clients:**
- **Transmission**: Settings → download-dir
- **Deluge**: Preferences → Downloads → Download to
- **SABnzbd**: Config → Folders → Completed Download Folder
- **NZBGet**: Settings → PATHS → DestDir

✅ **No path mapping needed** - files are already at the right location!

---

### Option 2: Use Path Mapping (If You Can't Change Client Settings)

If you **can't change** your download client paths, use the app's path mapping feature.

#### Via Settings UI (Easiest)

1. Go to **Settings → Media Management → Path Mappings**
2. For each client you're using, enter:
   - **Remote Path**: What the download client reports (e.g., `/data/transmission/complete`)
   - **Local Mount Path**: Where you mounted it (e.g., `/mnt/nas/transmission`)
3. Click **"Test All Paths"** to verify
4. Click **"Save Mappings"**

#### Via Environment Variable (Advanced)

Set the `PATH_MAPPINGS` environment variable:

```bash
# Format: remote_path1:local_path1,remote_path2:local_path2
export PATH_MAPPINGS="/data/transmission:/mnt/nas/transmission,/data/deluge:/mnt/nas/deluge"
```

Add to `.env` file:
```env
# Transmission completed folder
PATH_MAPPINGS=/data/transmission/complete:/mnt/nas/transmission
```

#### How Path Mapping Works

1. Download client reports: `/data/transmission/manga.cbz`
2. Path mapper detects prefix `/data/transmission`
3. Replaces with local mount: `/mnt/nas/transmission/manga.cbz`
4. File import uses mapped path

**Example Client-Specific Mappings:**
```env
# All download clients mapped
PATH_MAPPINGS=/data/transmission:/mnt/nas/transmission,/data/deluge:/mnt/nas/deluge,/data/sabnzbd:/mnt/nas/sabnzbd,/data/nzbget:/mnt/nas/nzbget

# Windows paths
PATH_MAPPINGS=C:/Downloads/Transmission:Z:/transmission,C:/Downloads/SABnzbd:Z:/sabnzbd

# Docker container paths
PATH_MAPPINGS=/downloads:/mnt/host-downloads
```

## Verification

### Test Mount Accessibility

1. **Check mount is active:**
   ```bash
   # Linux/macOS
   df -h | grep nas

   # Windows
   net use
   ```

2. **Test file access:**
   ```bash
   # Linux/macOS
   ls -la /mnt/nas-downloads
   touch /mnt/nas-downloads/test.txt
   rm /mnt/nas-downloads/test.txt

   # Windows
   dir Z:\
   echo test > Z:\test.txt
   del Z:\test.txt
   ```

3. **Test from Node.js (in app directory):**
   ```javascript
   const fs = require('fs');
   fs.readdir('/mnt/nas-downloads', (err, files) => {
     if (err) {
       console.error('Mount not accessible:', err);
     } else {
       console.log('Mount accessible! Files:', files);
     }
   });
   ```

### Common Issues

#### "Permission Denied"
```bash
# Linux: Check UID/GID match
id
# Then remount with correct uid/gid:
sudo mount -t cifs //nas-server/share /mnt/nas -o uid=1000,gid=1000
```

#### "Connection Refused"
```bash
# Check firewall allows NFS (port 2049) or SMB (port 445)
# On NAS, ensure NFS/SMB services are running
```

#### "Stale File Handle"
```bash
# NFS mount became stale, remount:
sudo umount -f /mnt/nas-downloads
sudo mount -t nfs nas-server:/path /mnt/nas-downloads
```

#### "Path Not Found" in App
- Verify mount point matches download client configuration
- Check file exists: `ls /mnt/nas-downloads/manga.cbz`
- Review app logs for actual path being accessed

## Performance Considerations

### Network Bandwidth
- Large manga files (50-200MB) over network
- Use Gigabit ethernet when possible
- Consider caching frequently accessed files

### Mount Options for Performance

**NFS:**
```bash
mount -t nfs nas-server:/downloads /mnt/nas -o rsize=8192,wsize=8192,timeo=14,intr
```

**CIFS:**
```bash
mount -t cifs //nas-server/downloads /mnt/nas -o cache=strict,actimeo=30
```

## Troubleshooting

### Enable Debug Logging

Set environment variable:
```bash
export DEBUG=mugiwara:fileImporter
npm run dev
```

### Check App Logs

Look for these patterns:
```
[FileImporter] Starting import for job X
[FileImporter] Found N manga files in /path/to/download
[FileImporter] Error reading directory: ENOENT (path not found)
[FileImporter] Error: EACCES (permission denied)
```

### Network Mount Health Check

Create a cron job to verify mounts:
```bash
#!/bin/bash
# check-mounts.sh
if ! mountpoint -q /mnt/nas-downloads; then
  echo "Mount failed! Remounting..."
  sudo mount -a
fi
```

Run every 5 minutes:
```bash
crontab -e
# Add: */5 * * * * /path/to/check-mounts.sh
```

## Security Best Practices

1. **Use credential files, not inline passwords**
   ```bash
   # Bad: password visible in mount command
   mount -t cifs //nas/share /mnt/nas -o username=user,password=pass

   # Good: password in protected file
   mount -t cifs //nas/share /mnt/nas -o credentials=/root/.smbcredentials
   ```

2. **Restrict credential file permissions:**
   ```bash
   chmod 600 /root/.smbcredentials
   chown root:root /root/.smbcredentials
   ```

3. **Use read-only mounts when possible:**
   ```bash
   mount -t nfs nas:/downloads /mnt/nas -o ro
   ```

4. **Enable firewall rules:**
   ```bash
   # Allow only specific NAS IP
   sudo ufw allow from 192.168.1.100 to any port 2049  # NFS
   sudo ufw allow from 192.168.1.100 to any port 445   # SMB
   ```

## Advanced: Docker Setup

If running Mugiwara-Kaizoku in Docker:

```yaml
# docker-compose.yml
version: '3.8'
services:
  mugiwara-kaizoku:
    image: mugiwara-kaizoku:latest
    volumes:
      - /mnt/nas-downloads:/downloads:ro  # Mount into container
    environment:
      - DOWNLOAD_PATH=/downloads
```

Or use Docker volume with NFS:
```yaml
volumes:
  nas-downloads:
    driver: local
    driver_opts:
      type: nfs
      o: addr=nas-server,rw
      device: ":/path/to/downloads"
```

## Support

If you continue having issues after following this guide:
1. Check the app logs for specific error messages
2. Verify mount accessibility with `ls` and `touch` commands
3. Test with Manual Import modal using explicit file paths
4. Open an issue with:
   - Your OS and version
   - Mount command used
   - Error messages from app logs
   - Output of `df -h` and `mount` commands
