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
    this.visitorData = process.env.YOUTUBE_VISITOR_DATA || '';
    this.cookiesPath = null;
    
    // Path to bundled yt-dlp executable
    this.ytDlpPath = path.join(__dirname, '../bin/yt-dlp');
    
    // Check if we're on Windows (for development)
    if (process.platform === 'win32') {
      this.ytDlpPath = path.join(__dirname, '../bin/yt-dlp.exe');
    }
    
    // Initialize everything
    this._initialize();
  }

  async _initialize() {
    await this._ensureExecutablePermissions();
    await this._findCookiesFile();
    await this._verifyYtDlp();
  }

  async _findCookiesFile() {
    console.log('🔍 Searching for cookies.txt...');
    
    // Log current environment for debugging
    console.log('Current directory:', process.cwd());
    console.log('__dirname:', __dirname);
    
    const possiblePaths = [
      // Absolute paths for Render
      '/opt/render/project/src/cookies.txt',
      '/opt/render/project/src/backend/cookies.txt',
      '/opt/render/project/src/src/cookies.txt',
      
      // Relative paths from various locations
      path.join(__dirname, '../cookies.txt'),           // backend/cookies.txt
      path.join(__dirname, 'cookies.txt'),              // backend/services/cookies.txt
      path.join(process.cwd(), 'cookies.txt'),          // root/cookies.txt
      path.join(process.cwd(), 'backend/cookies.txt'),  // root/backend/cookies.txt
      path.join(__dirname, '../../cookies.txt'),        // one level up from backend
      
      // Development paths
      path.join('D:', 'dall', 'backend', 'cookies.txt'),
      path.join('D:', 'dall', 'backend', 'services', 'cookies.txt')
    ];
    
    for (const testPath of possiblePaths) {
      try {
        console.log(`Checking: ${testPath}`);
        const exists = await fs.pathExists(testPath);
        
        if (exists) {
          const stats = await fs.stat(testPath);
          console.log(`✅ FOUND COOKIES at: ${testPath}`);
          console.log(`📁 Size: ${stats.size} bytes`);
          
          // Read first line to verify format
          const fileContent = await fs.readFile(testPath, 'utf8');
          const firstLine = fileContent.split('\n')[0];
          if (firstLine.includes('# Netscape')) {
            console.log('✅ Cookies format is correct');
          } else {
            console.warn('⚠️ Cookies may have incorrect format');
            console.log('First line:', firstLine);
          }
          
          this.cookiesPath = testPath;
          return true;
        }
      } catch (err) {
        console.log(`Error checking ${testPath}:`, err.message);
      }
    }
    
    console.warn('❌ NO COOKIES FILE FOUND ANYWHERE');
    console.log('Files in current directory:', await fs.readdir(process.cwd()).catch(() => 'Cannot read'));
    
    // Try to list files in parent directories
    try {
      const parentDir = path.join(__dirname, '..');
      console.log(`Files in ${parentDir}:`, await fs.readdir(parentDir));
    } catch (err) {
      console.log('Cannot read parent directory');
    }
    
    return false;
  }

  async _ensureExecutablePermissions() {
    try {
      if (process.platform !== 'win32') {
        const exists = await fs.pathExists(this.ytDlpPath);
        if (exists) {
          await fs.chmod(this.ytDlpPath, 0o755);
          console.log('✅ Set executable permissions on yt-dlp');
        } else {
          console.warn('⚠️ yt-dlp not found at:', this.ytDlpPath);
        }
      }
    } catch (error) {
      console.warn('⚠️ Could not set permissions:', error.message);
    }
  }

  async _verifyYtDlp() {
    try {
      const exists = await fs.pathExists(this.ytDlpPath);
      if (exists) {
        const { stdout } = await execPromise(`"${this.ytDlpPath}" --version`).catch(() => ({ stdout: 'unknown' }));
        console.log(`✅ yt-dlp version: ${stdout.trim()}`);
      }
    } catch (error) {
      console.warn('⚠️ Could not verify yt-dlp:', error.message);
    }
  }

  _escapeArg(arg) {
    return `"${arg.replace(/"/g, '\\"')}"`;
  }

  async _getYtDlpCommand() {
    const exists = await fs.pathExists(this.ytDlpPath);
    if (exists) {
      return this.ytDlpPath;
    }
    console.warn('⚠️ Falling back to python module');
    return 'python -m yt_dlp';
  }

  async _getAuthOptions() {
    const options = [];
    
    // Try cookies first
    if (this.cookiesPath) {
      try {
        const exists = await fs.pathExists(this.cookiesPath);
        if (exists) {
          options.push(`--cookies ${this._escapeArg(this.cookiesPath)}`);
          console.log('🔑 Using cookies for authentication');
        } else {
          console.log('❌ Cookies file missing, trying to find again...');
          await this._findCookiesFile();
          if (this.cookiesPath) {
            options.push(`--cookies ${this._escapeArg(this.cookiesPath)}`);
            console.log('🔑 Found and using cookies');
          }
        }
      } catch (error) {
        console.warn('⚠️ Error checking cookies:', error.message);
      }
    }
    
    // Fall back to visitor data if no cookies
    if (options.length === 0 && this.visitorData) {
      const extractorArgs = `youtubetab:skip=webpage;youtube:player_skip=webpage,configs;visitor_data=${this.visitorData}`;
      options.push(`--extractor-args ${this._escapeArg(extractorArgs)}`);
      console.log('🔑 Using visitor data for authentication');
    }
    
    if (options.length === 0) {
      console.log('⚠️ No authentication method available');
    }
    
    return options.join(' ');
  }

  async searchVideos(query, maxResults = 10) {
    try {
      const escapedQuery = query.replace(/"/g, '\\"');
      const authOptions = await this._getAuthOptions();
      const ytDlpCmd = await this._getYtDlpCommand();
      
      const command = `${ytDlpCmd} ${authOptions} "ytsearch${maxResults}:${escapedQuery}" --dump-json --no-playlist --skip-download`;
      
      console.log('🔍 Executing search command');

      const { stdout, stderr } = await execPromise(command, { maxBuffer: 50 * 1024 * 1024 });

      if (stderr && !stderr.includes('WARNING')) {
        console.error('yt-dlp stderr:', stderr);
      }

      if (!stdout || stdout.trim() === '') {
        console.warn('⚠️ No results returned from yt-dlp');
        return [];
      }

      const lines = stdout.trim().split('\n').filter(line => line.trim());
      return lines.map(line => JSON.parse(line));
    } catch (error) {
      console.error('❌ YouTube search error:', error);
      throw new Error(`YouTube search failed: ${error.message}`);
    }
  }

  async getVideoInfo(videoId) {
    try {
      const authOptions = await this._getAuthOptions();
      const ytDlpCmd = await this._getYtDlpCommand();
      const url = `https://youtube.com/watch?v=${videoId}`;
      
      const command = `${ytDlpCmd} ${authOptions} ${this._escapeArg(url)} --dump-json --no-playlist --no-warnings`;
      
      console.log('📹 Getting video info for:', videoId);

      const { stdout, stderr } = await execPromise(command, { maxBuffer: 10 * 1024 * 1024 });

      if (stderr && !stderr.includes('WARNING')) {
        console.error('❌ yt-dlp error:', stderr);
      }

      if (!stdout || stdout.trim() === '') {
        console.error('❌ Empty response from yt-dlp');
        throw new Error('No video information returned');
      }

      try {
        const videoInfo = JSON.parse(stdout);
        console.log('✅ Successfully retrieved video info for:', videoInfo.title || videoId);
        return videoInfo;
      } catch (parseError) {
        console.error('❌ Failed to parse yt-dlp output as JSON');
        console.error('First 500 chars of output:', stdout.substring(0, 500));
        throw new Error('Invalid JSON response from yt-dlp');
      }
    } catch (error) {
      console.error('❌ Get video info error:', error);
      throw new Error(`Failed to get video info: ${error.message}`);
    }
  }

  async getAvailableFormats(videoId) {
    try {
      const authOptions = await this._getAuthOptions();
      const ytDlpCmd = await this._getYtDlpCommand();
      const url = `https://youtube.com/watch?v=${videoId}`;
      
      const command = `${ytDlpCmd} ${authOptions} ${this._escapeArg(url)} --list-formats --no-playlist --no-warnings`;
      
      console.log('📋 Getting available formats for:', videoId);

      const { stdout, stderr } = await execPromise(command, { maxBuffer: 10 * 1024 * 1024 });

      if (stderr && !stderr.includes('WARNING')) {
        console.error('yt-dlp error:', stderr);
      }

      return this.parseFormats(stdout);
    } catch (error) {
      console.error('❌ Get formats error:', error);
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

    const command = `${ytDlpCmd} ${authOptions} ${this._escapeArg(url)} -f ${this._escapeArg(formatSpec)} -o ${this._escapeArg(outputTemplate)} --no-playlist --newline --progress --console-title --no-warnings`;
    
    console.log('⬇️ Downloading video:', videoId);

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
            console.log('✅ Download complete:', path.basename(filePath));
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