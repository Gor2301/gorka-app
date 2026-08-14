const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, 'src', 'renderer', 'index.html');
const dest = path.join(__dirname, 'dist', 'renderer', 'index.html');

// Ensure the destination directory exists
const destDir = path.dirname(dest);
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy the file
fs.copyFileSync(src, dest);
console.log('HTML file copied successfully!');