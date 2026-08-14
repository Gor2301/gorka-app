const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  console.log('App ready, creating window...');
  const win = new BrowserWindow({ 
    width: 800, 
    height: 600,
    show: true
  });
  win.loadURL('https://example.com');
  win.show();
  console.log('Window should be visible');
});