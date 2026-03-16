const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const binDir = path.join(__dirname, '../bin');
const isWindows = process.platform === 'win32';
const ytDlpFilename = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
const ytDlpPath = path.join(binDir, ytDlpFilename);

// Create bin directory if it doesn't exist
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
  console.log('✅ Created bin directory');
}

console.log(`📥 Downloading yt-dlp for ${process.platform}...`);

// Determine download URL based on platform
let downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
if (isWindows) {
  downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
}

const file = fs.createWriteStream(ytDlpPath);

https.get(downloadUrl, (response) => {
  if (response.statusCode !== 200) {
    console.error(`❌ Download failed with status: ${response.statusCode}`);
    return;
  }

  response.pipe(file);
  
  file.on('finish', () => {
    file.close();
    // Make executable on Unix-like systems
    if (!isWindows) {
      fs.chmodSync(ytDlpPath, '755');
    }
    console.log(`✅ yt-dlp downloaded successfully to: ${ytDlpPath}`);
    
    // Verify it works
    exec(`"${ytDlpPath}" --version`, (error, stdout) => {
      if (error) {
        console.error('❌ yt-dlp verification failed:', error.message);
      } else {
        console.log(`✅ yt-dlp version: ${stdout.trim()}`);
      }
    });
  });
}).on('error', (err) => {
  fs.unlink(ytDlpPath, () => {});
  console.error('❌ Failed to download yt-dlp:', err.message);
});