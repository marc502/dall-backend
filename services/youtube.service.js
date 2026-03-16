const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs-extra');
const EventEmitter = require('events');
const config = require('../config/server.config');

const execPromise = util.promisify(exec);

class YouTubeService extends EventEmitter {
  constructor() {
    super();
    this.downloads = new Map();
  }

  _escapeArg(arg) {
    return `"${arg.replace(/"/g, '\\"')}"`;
  }

  async searchVideos(query, maxResults = 10) {
    try {
      const escapedQuery = query.replace(/"/g, '\\"');
      // Remove --flat-playlist to get full metadata, increase buffer to 50MB
      const command = `python -m yt_dlp "ytsearch${maxResults}:${escapedQuery}" --dump-json --no-playlist --skip-download`;
      
      console.log('Executing search command:', command);

      const { stdout, stderr } = await execPromise(command, { maxBuffer: 50 * 1024 * 1024 });

      if (stderr) {
        console.error('yt-dlp stderr:', stderr);
      }

      const lines = stdout.trim().split('\n').filter(line => line.trim());
      return lines.map(line => JSON.parse(line));
    } catch (error) {
      console.error('YouTube search error:', error);
      throw new Error(`YouTube search failed: ${error.message}`);
    }
  }

  async getVideoInfo(videoId) {
    try {
      const url = `https://youtube.com/watch?v=${videoId}`;
      const command = `python -m yt_dlp ${this._escapeArg(url)} --dump-json --no-playlist`;
      const { stdout } = await execPromise(command, { maxBuffer: 10 * 1024 * 1024 });
      return JSON.parse(stdout);
    } catch (error) {
      console.error('Get video info error:', error);
      throw new Error(`Failed to get video info: ${error.message}`);
    }
  }

  async getAvailableFormats(videoId) {
    try {
      const url = `https://youtube.com/watch?v=${videoId}`;
      const command = `python -m yt_dlp ${this._escapeArg(url)} --list-formats --no-playlist`;
      const { stdout } = await execPromise(command, { maxBuffer: 10 * 1024 * 1024 });
      return this.parseFormats(stdout);
    } catch (error) {
      console.error('Get formats error:', error);
      throw new Error(`Failed to get formats: ${error.message}`);
    }
  }

  async downloadVideo(videoId, options) {
    const { format, quality, audioOnly, downloadId } = options;
    const downloadDir = path.join(config.downloadPath, downloadId);
    await fs.ensureDir(downloadDir);

    const url = `https://youtube.com/watch?v=${videoId}`;
    const outputTemplate = path.join(downloadDir, '%(title)s.%(ext)s');
    const formatSpec = this.getFormatSpec(format, quality, audioOnly);

    const command = `python -m yt_dlp ${this._escapeArg(url)} -f ${this._escapeArg(formatSpec)} -o ${this._escapeArg(outputTemplate)} --no-playlist --newline --progress --console-title`;
    console.log('Executing download command:', command);

    return new Promise((resolve, reject) => {
      const process = exec(command, { maxBuffer: 10 * 1024 * 1024 });
      let filePath = '';

      process.stdout.on('data', (data) => {
        const progress = this.parseProgress(data.toString());
        if (progress) this.emit('progress', { downloadId, ...progress });

        const match = data.toString().match(/Destination: (.+)/);
        if (match) filePath = match[1];
      });

      process.stderr.on('data', (data) => {
        console.error('yt-dlp error:', data.toString());
      });

      process.on('close', (code) => {
        if (code === 0) {
          if (!filePath) {
            const files = fs.readdirSync(downloadDir);
            if (files.length > 0) filePath = path.join(downloadDir, files[0]);
          }
          resolve({ downloadId, filePath, filename: path.basename(filePath) });
        } else {
          reject(new Error(`Download failed with code ${code}`));
        }
      });
    });
  }

  getFormatSpec(format, quality, audioOnly) {
    if (audioOnly) return 'bestaudio/best';

    const qualityMap = {
      '144p': 'worst[height<=144]',
      '240p': 'best[height<=240]',
      '360p': 'best[height<=360]',
      '480p': 'best[height<=480]',
      '720p': 'best[height<=720]',
      '1080p': 'best[height<=1080]',
      '1440p': 'best[height<=1440]',
      '2160p': 'best[height<=2160]'
    };
    const qualitySpec = qualityMap[quality] || 'best';
    if (format === 'mp4') return `${qualitySpec}[ext=mp4]`;
    return qualitySpec;
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

  parseProgress(data) {
    const match = data.match(/(\d+\.?\d*)%/);
    if (match) return { type: 'progress', percentage: parseFloat(match[1]), data: data.trim() };
    return null;
  }

  onProgress(downloadId, callback) {
    this.on('progress', (data) => {
      if (data.downloadId === downloadId) callback(data);
    });
  }
}

module.exports = new YouTubeService();