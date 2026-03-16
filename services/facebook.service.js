const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs-extra');
const EventEmitter = require('events');
const config = require('../config/server.config');

const execPromise = util.promisify(exec);

class FacebookService extends EventEmitter {
  constructor() {
    super();
    this.downloads = new Map();
  }

  _escapeArg(arg) {
    return `"${arg.replace(/"/g, '\\"')}"`;
  }

  async getVideoInfo(videoId) {
    try {
      const urls = [
        `https://www.facebook.com/watch/?v=${videoId}`,
        `https://www.facebook.com/video.php?v=${videoId}`,
        `https://fb.watch/${videoId}`
      ];
      
      let lastError;
      for (const url of urls) {
        try {
          const command = `python -m yt_dlp ${this._escapeArg(url)} --dump-json --no-playlist`;
          console.log('Executing Facebook info command:', command);
          
          const { stdout, stderr } = await execPromise(command, { maxBuffer: 10 * 1024 * 1024 });
          if (stderr) console.error('yt-dlp stderr:', stderr);
          
          return JSON.parse(stdout);
        } catch (e) {
          lastError = e;
          continue;
        }
      }
      throw lastError || new Error('Failed to get Facebook video info');
    } catch (error) {
      console.error('Get Facebook info error:', error);
      throw new Error(`Failed to get Facebook video info: ${error.message}`);
    }
  }

  async getAvailableFormats(videoId) {
    try {
      const url = `https://www.facebook.com/watch/?v=${videoId}`;
      const command = `python -m yt_dlp ${this._escapeArg(url)} --list-formats --no-playlist`;
      
      const { stdout } = await execPromise(command, { maxBuffer: 10 * 1024 * 1024 });
      return this.parseFormats(stdout);
    } catch (error) {
      console.error('Get Facebook formats error:', error);
      throw new Error(`Failed to get formats: ${error.message}`);
    }
  }

  async downloadVideo(videoId, options) {
    const { quality, audioOnly, downloadId } = options;
    const downloadDir = path.join(config.downloadPath, downloadId);
    
    await fs.ensureDir(downloadDir);
    
    const url = `https://www.facebook.com/watch/?v=${videoId}`;
    const outputTemplate = path.join(downloadDir, '%(title)s.%(ext)s');
    
    let formatSpec = this.getFormatSpec(quality, audioOnly);
    
    const command = `python -m yt_dlp ${this._escapeArg(url)} \
      -f ${this._escapeArg(formatSpec)} \
      -o ${this._escapeArg(outputTemplate)} \
      --no-playlist \
      --newline \
      --progress`;

    console.log('Executing Facebook download command:', command);

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

  getFormatSpec(quality, audioOnly) {
    if (audioOnly) {
      return 'bestaudio/best';
    }
    
    const qualityMap = {
      'sd': 'best[height<=480]',
      'hd': 'best[height<=720]',
      'fullhd': 'best[height<=1080]',
      'best': 'best'
    };
    
    return qualityMap[quality] || 'best';
  }

  parseFormats(output) {
    const lines = output.split('\n');
    const formats = [];
    let parsing = false;
    
    for (const line of lines) {
      if (line.includes('ID  EXT')) {
        parsing = true;
        continue;
      }
      
      if (parsing && line.trim() && !line.includes('-----')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 7) {
          formats.push({
            id: parts[0],
            ext: parts[1],
            resolution: parts[2],
            filesize: parts[5] || 'N/A',
            format: parts[6]
          });
        }
      }
    }
    
    return formats;
  }

  onProgress(downloadId, callback) {
    this.on('progress', (data) => {
      if (data.downloadId === downloadId) {
        callback(data);
      }
    });
  }
}

module.exports = new FacebookService();