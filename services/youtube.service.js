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
    this.cookiesPath = path.join(__dirname, '../cookies.txt');
    this.visitorData = process.env.YOUTUBE_VISITOR_DATA || '';
    
    // Path to bundled yt-dlp executable
    this.ytDlpPath = path.join(__dirname, '../bin/yt-dlp');
    
    // Check if we're on Windows (for development)
    if (process.platform === 'win32') {
      this.ytDlpPath = path.join(__dirname, '../bin/yt-dlp.exe');
    }
    
    // Ensure executable permissions on Linux/Mac
    this._ensureExecutablePermissions();
  }

  async _ensureExecutablePermissions() {
    try {
      // Only needed on non-Windows platforms
      if (process.platform !== 'win32') {
        const exists = await fs.pathExists(this.ytDlpPath);
        if (exists) {
          await fs.chmod(this.ytDlpPath, 0o755); // rwxr-xr-x permissions
          console.log('✅ Set executable permissions on yt-dlp');
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not set executable permissions:', error.message);
    }
  }

  _escapeArg(arg) {
    return `"${arg.replace(/"/g, '\\"')}"`;
  }

  async _getYtDlpCommand() {
    // Check if bundled executable exists
    try {
      const exists = await fs.pathExists(this.ytDlpPath);
      if (exists) {
        console.log('Using bundled yt-dlp executable');
        return this.ytDlpPath;
      }
    } catch (error) {
      console.warn('Error checking for bundled yt-dlp:', error.message);
    }
    
    // Fall back to python module if bundled executable not found
    console.log('Falling back to python module');
    return 'python -m yt_dlp';
  }

  async _getAuthOptions() {
    const options = [];
    
    try {
      const cookiesExist = await fs.pathExists(this.cookiesPath);
      if (cookiesExist) {
        options.push(`--cookies ${this._escapeArg(this.cookiesPath)}`);
        console.log('Using cookies for authentication');
      } else if (this.visitorData) {
        const extractorArgs = `youtubetab:skip=webpage;youtube:player_skip=webpage,configs;visitor_data=${this.visitorData}`;
        options.push(`--extractor-args ${this._escapeArg(extractorArgs)}`);
        console.log('Using visitor data for authentication');
      } else {
        console.log('No authentication method available');
      }
    } catch (error) {
      console.warn('Error checking cookies:', error.message);
    }
    
    return options.join(' ');
  }

  async searchVideos(query, maxResults = 10) {
    try {
      const escapedQuery = query.replace(/"/g, '\\"');
      const authOptions = await this._getAuthOptions();
      const ytDlpCmd = await this._getYtDlpCommand();
      
      const command = `${ytDlpCmd} ${authOptions} "ytsearch${maxResults}:${escapedQuery}" --dump-json --no-playlist --skip-download`;
      
      console.log('Executing search command:', command);

      const { stdout, stderr } = await execPromise(command, { maxBuffer: 50 * 1024 * 1024 });

      if (stderr) {
        // Log warnings but don't treat as errors
        if (!stderr.includes('WARNING')) {
          console.error('yt-dlp stderr:', stderr);
        }
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
      const authOptions = await this._getAuthOptions();
      const ytDlpCmd = await this._getYtDlpCommand();
      const url = `https://youtube.com/watch?v=${videoId}`;
      
      const command = `${ytDlpCmd} ${authOptions} ${this._escapeArg(url)} --dump-json --no-playlist`;
      
      console.log('Executing info command');
      const { stdout } = await execPromise(command, { maxBuffer: 10 * 1024 * 1024 });
      return JSON.parse(stdout);
    } catch (error) {
      console.error('Get video info error:', error);
      throw new Error(`Failed to get video info: ${error.message}`);
    }
  }

  async getAvailableFormats(videoId) {
    try {
      const authOptions = await this._getAuthOptions();
      const ytDlpCmd = await this._getYtDlpCommand();
      const url = `https://youtube.com/watch?v=${videoId}`;
      
      const command = `${ytDlpCmd} ${authOptions} ${this._escapeArg(url)} --list-formats --no-playlist`;
      
      console.log('Executing formats command');
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

    const authOptions = await this._getAuthOptions();
    const ytDlpCmd = await this._getYtDlpCommand();
    const url = `https://youtube.com/watch?v=${videoId}`;
    const outputTemplate = path.join(downloadDir, '%(title)s.%(ext)s');
    const formatSpec = this.getFormatSpec(format, quality, audioOnly);

    const command = `${ytDlpCmd} ${authOptions} ${this._escapeArg(url)} -f ${this._escapeArg(formatSpec)} -o ${this._escapeArg(outputTemplate)} --no-playlist --newline --progress --console-title`;
    
    console.log('Executing download command');

    return new Promise((resolve, reject) => {
      const process = exec(command, { maxBuffer: 50 * 1024 * 1024 });
      let filePath = '';

      process.stdout.on('data', (data) => {
        const output = data.toString();
        const progress = this.parseProgress(output);
        if (progress) this.emit('progress', { downloadId, ...progress });

        const match = output.match(/Destination: (.+)/);
        if (match) filePath = match[1];
      });

      process.stderr.on('data', (data) => {
        const error = data.toString();
        if (!error.includes('WARNING')) {
          console.error('yt-dlp error:', error);
        }
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
              console.error('Error finding downloaded file:', err);
            }
          }
          
          if (filePath && fs.existsSync(filePath)) {
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