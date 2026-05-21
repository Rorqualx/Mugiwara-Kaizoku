# DOWNLOAD_CLIENT_ERRORS_QUICK_FIX

*Status: Active*  
*Author: Documentation Team*  
*Canonical: Yes*

## Overview

Documentation for DOWNLOAD_CLIENT_ERRORS_QUICK_FIX

---
# Download Client Connection Issues - Quick Fix Guide

## Your Errors Explained

### 1. Deluge Authentication Error
**What's happening**: Deluge is rejecting your login credentials

**Most likely causes**:
- Wrong password (default is `deluge`)
- Deluge WebUI only accepts localhost connections by default

**Quick fix**:
```bash
# On your Deluge server, edit the config
nano ~/.config/deluge/web.conf

# Change these settings:
"interface": "0.0.0.0",  # Allow remote connections
"https": false,

# Restart Deluge
sudo systemctl restart deluge-web
```

### 2. NZBGet Response Error
**What's happening**: NZBGet is returning HTML instead of JSON data

**Most likely cause**:
- Your URL format is incorrect

**Quick fix**:
- Use: `http://your-server:6789` (WITHOUT /jsonrpc)
- NOT: `http://your-server:6789/jsonrpc`

## Immediate Steps to Test

1. **Test Deluge** (from Kaizoku server):
```bash
curl -X POST http://your-deluge-server:8112/json \
  -H "Content-Type: application/json" \
  -d '{"method":"auth.login","params":["deluge"],"id":1}'
```

2. **Test NZBGet** (from Kaizoku server):
```bash
curl -u nzbget:tegbzn6789 \
  -X POST http://your-nzbget-server:6789/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{"method":"version","params":[],"id":1}'
```

If these curl commands work, the issue is with your Kaizoku configuration. If they fail, the issue is with your download client setup.

## Common Configuration Values

### Deluge
- URL: `http://your-server:8112`
- Default Password: `deluge`
- No username required

### NZBGet  
- URL: `http://your-server:6789` (no /jsonrpc)
- Default Username: `nzbget`
- Default Password: `tegbzn6789`

## Still Not Working?

Check if your download clients allow remote connections:
- Deluge: Must set interface to "0.0.0.0" in web.conf
- NZBGet: Must set ControlIP=0.0.0.0 in nzbget.conf

Also check firewall:
```bash
sudo ufw allow 8112/tcp  # Deluge
sudo ufw allow 6789/tcp  # NZBGet
```
