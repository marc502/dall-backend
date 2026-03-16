const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs-extra');
const EventEmitter = require('events'); // Add this import
const config = require('../config/server.config');

const execPromise = util.promisify(exec);

class TikTokService extends EventEmitter { // Extend EventEmitter
  constructor() {
    super(); // Call parent constructor
    this.downloads = new Map();
  }

  _escapeArg(arg) {
    return `"${arg.replace(/"/g, '\\"')}"`;
  }

  async getVideoInfo(videoId) {
    try {
      // Try multiple URL formats that TikTok uses
      const urlFormats = [
        `https://www.tiktok.com/@user/video/${videoId}`,
        `https://www.tiktok.com/v/${videoId}`,
        `https://vm.tiktok.com/${videoId}`,
        `https://m.tiktok.com/v/${videoId}`
      ];
      
      let lastError;
      for (const url of urlFormats) {
        try {
          const command = `python -m yt_dlp ${this._escapeArg(url)} --dump-json --no-playlist`;
          console.log('Executing TikTok info command:', command);
          
          const { stdout, stderr } = await execPromise(command, { maxBuffer: 10 * 1024 * 1024 });
          if (stderr) console.error('yt-dlp stderr:', stderr);
          
          return JSON.parse(stdout);
        } catch (e) {
          lastError = e;
          continue;
        }
      }
      throw lastError || new Error('Failed to get TikTok video info');
    } catch (error) {
      console.error('Get TikTok info error:', error);
      throw new Error(`Failed to get TikTok video info: ${error.message}`);
    }
  }

  async downloadVideo(videoId, options) {
    const { watermark = true, downloadId } = options;
    const downloadDir = path.join(config.downloadPath, downloadId);
    
    await fs.ensureDir(downloadDir);
    
    // Try multiple URL formats
    const url = `https://www.tiktok.com/@user/video/${videoId}`;
    const outputTemplate = path.join(downloadDir, '%(title)s.%(ext)s');
    
    // Build format specification based on options
    let formatSpec = 'best[ext=mp4]/best';
    if (!watermark) {
      // For no-watermark, try to get the best quality without watermark
      formatSpec = 'best[protocol^=https][ext=mp4]/best';
    }
    
    const command = `python -m yt_dlp ${this._escapeArg(url)} \
      -f ${this._escapeArg(formatSpec)} \
      -o ${this._escapeArg(outputTemplate)} \
      --no-playlist \
      --newline \
      --progress`;

    console.log('Executing TikTok download command:', command);

    return new Promise((resolve, reject) => {
      const process = exec(command, { maxBuffer: 50 * 1024 * 1024 });
      let filePath = '';

      process.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('Download progress:', output);
        
        // Try to extract filename
        const destMatch = output.match(/Destination: (.+)/);
        if (destMatch) {
          filePath = destMatch[1];
        }
        
        // Parse progress percentage
        const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
        if (progressMatch) {
          const percentage = parseFloat(progressMatch[1]);
          // Emit progress event
          this.emit('progress', { downloadId, percentage });
        }
      });

      process.stderr.on('data', (data) => {
        console.error('yt-dlp error:', data.toString());
      });

      process.on('close', (code) => {
        if (code === 0) {
          // Find the downloaded file if we couldn't capture the path
          if (!filePath || !fs.existsSync(filePath)) {
            try {
              const files = fs.readdirSync(downloadDir);
              if (files.length > 0) {
                filePath = path.join(downloadDir, files[0]);
              }
            } catch (err) {
              console.error('Error reading download directory:', err);
            }
          }
          
          if (filePath && fs.existsSync(filePath)) {
            // Emit completion event
            this.emit('progress', { downloadId, percentage: 100 });
            resolve({
              downloadId,
              filePath,
              filename: path.basename(filePath)
            });
          } else {
            reject(new Error('Download completed but file not found'));
          }
        } else {
          reject(new Error(`Download failed with code ${code}`));
        }
      });
    });
  }

  async downloadNoWatermark(videoId, downloadId) {
    return this.downloadVideo(videoId, { watermark: false, downloadId });
  }

  onProgress(downloadId, callback) {
    this.on('progress', (data) => {
      if (data.downloadId === downloadId) {
        callback(data);
      }
    });
  }
}

module.exports = new TikTokService();