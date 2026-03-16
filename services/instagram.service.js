const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs-extra');
const EventEmitter = require('events');
const config = require('../config/server.config');

const execPromise = util.promisify(exec);

class InstagramService extends EventEmitter {
  constructor() {
    super();
    this.downloads = new Map();
  }

  _escapeArg(arg) {
    return `"${arg.replace(/"/g, '\\"')}"`;
  }

  async getMediaInfo(mediaId, mediaType) {
    try {
      let url;
      if (mediaType === 'post') {
        url = `https://www.instagram.com/p/${mediaId}`;
      } else if (mediaType === 'reel') {
        url = `https://www.instagram.com/reel/${mediaId}`;
      } else if (mediaType === 'story') {
        url = `https://www.instagram.com/stories/${mediaId}`;
      } else {
        url = `https://www.instagram.com/p/${mediaId}`;
      }
      
      const command = `python -m yt_dlp ${this._escapeArg(url)} --dump-json --no-playlist`;
      console.log('Executing Instagram info command:', command);

      const { stdout, stderr } = await execPromise(command, { maxBuffer: 10 * 1024 * 1024 });
      if (stderr) console.error('yt-dlp stderr:', stderr);

      return JSON.parse(stdout);
    } catch (error) {
      console.error('Get Instagram info error:', error);
      throw new Error(`Failed to get Instagram media info: ${error.message}`);
    }
  }

  async downloadMedia(mediaId, type, downloadId) {
    const downloadDir = path.join(config.downloadPath, downloadId);
    await fs.ensureDir(downloadDir);
    
    let url;
    if (type === 'post') {
      url = `https://www.instagram.com/p/${mediaId}`;
    } else if (type === 'reel') {
      url = `https://www.instagram.com/reel/${mediaId}`;
    } else {
      url = `https://www.instagram.com/p/${mediaId}`;
    }
    
    const outputTemplate = path.join(downloadDir, '%(title)s.%(ext)s');
    const command = `python -m yt_dlp ${this._escapeArg(url)} -o ${this._escapeArg(outputTemplate)} --no-playlist --newline --progress`;

    console.log('Executing Instagram download command:', command);

    return new Promise((resolve, reject) => {
      const process = exec(command, { maxBuffer: 50 * 1024 * 1024 });
      let filePath = '';

      process.stdout.on('data', (data) => {
        const output = data.toString();
        console.log('Download progress:', output);
        
        const destMatch = output.match(/Destination: (.+)/);
        if (destMatch) {
          filePath = destMatch[1];
        }
        
        const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/);
        if (progressMatch) {
          const percentage = parseFloat(progressMatch[1]);
          this.emit('progress', { downloadId, percentage });
        }
      });

      process.stderr.on('data', (data) => {
        console.error('yt-dlp error:', data.toString());
      });

      process.on('close', (code) => {
        if (code === 0) {
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

  async downloadStory(storyId, downloadId) {
    const downloadDir = path.join(config.downloadPath, downloadId);
    await fs.ensureDir(downloadDir);
    
    const url = `https://www.instagram.com/stories/${storyId}`;
    const outputTemplate = path.join(downloadDir, '%(title)s.%(ext)s');
    const command = `python -m yt_dlp ${this._escapeArg(url)} -o ${this._escapeArg(outputTemplate)} --no-playlist --newline --progress`;

    console.log('Executing Instagram story download command:', command);

    return new Promise((resolve, reject) => {
      const process = exec(command, { maxBuffer: 50 * 1024 * 1024 });
      let filePath = '';

      process.stdout.on('data', (data) => {
        const output = data.toString();
        const destMatch = output.match(/Destination: (.+)/);
        if (destMatch) filePath = destMatch[1];
      });

      process.stderr.on('data', (data) => {
        console.error('yt-dlp error:', data.toString());
      });

      process.on('close', (code) => {
        if (code === 0) {
          if (!filePath || !fs.existsSync(filePath)) {
            const files = fs.readdirSync(downloadDir);
            if (files.length > 0) {
              filePath = path.join(downloadDir, files[0]);
            }
          }
          resolve({
            downloadId,
            filePath,
            filename: path.basename(filePath)
          });
        } else {
          reject(new Error(`Download failed with code ${code}`));
        }
      });
    });
  }

  async downloadReel(reelId, downloadId) {
    return this.downloadMedia(reelId, 'reel', downloadId);
  }

  onProgress(downloadId, callback) {
    this.on('progress', (data) => {
      if (data.downloadId === downloadId) {
        callback(data);
      }
    });
  }
}

module.exports = new InstagramService();