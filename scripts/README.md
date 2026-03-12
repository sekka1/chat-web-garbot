# Scripts

Scripts to deploy this app onto a linux server

## Useful PM2 Commands (on server)

```
pm2 status              # See running processes
pm2 logs garbot-chat      # View logs
pm2 restart garbot-chat   # Restart app
pm2 stop garbot-chat      # Stop app
pm2 monit               # Real-time monitoring
```

## Install on the server

If Node.js isn't installed, install it
```
# Using NodeSource (recommended for Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs

# Then install PM2
sudo npm install -g pm2
```

Quick check - what does this return?

```
node -v
npm -v
```

## Install Github Copilot SDK 

```
sudo npm install -g @github/copilot
```