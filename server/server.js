const http = require('http');
const app = require('./app');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const PORT = process.env.PORT || 5000;

// Ensure temp directories exist
const tempDir = path.join(__dirname, '../temp/downloads');
fs.ensureDirSync(tempDir);

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Downloads directory: ${tempDir}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server...');
  server.close(() => {
    console.log('Server closed');
    // Cleanup temp files
    fs.emptyDirSync(tempDir);
    process.exit(0);
  });
});