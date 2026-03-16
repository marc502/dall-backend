const fs = require('fs-extra');
const path = require('path');
const config = require('../config/server.config');

class StreamHandler {
  async createReadStream(filePath) {
    try {
      const exists = await fs.pathExists(filePath);
      if (!exists) {
        throw new Error('File not found');
      }
      
      return fs.createReadStream(filePath);
    } catch (error) {
      throw new Error(`Failed to create stream: ${error.message}`);
    }
  }

  async getFileInfo(filePath) {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        name: path.basename(filePath)
      };
    } catch (error) {
      throw new Error(`Failed to get file info: ${error.message}`);
    }
  }

  async streamToResponse(filePath, res, options = {}) {
    const { start, end } = options;
    
    try {
      const stat = await fs.stat(filePath);
      const fileSize = stat.size;
      
      if (start !== undefined && end !== undefined) {
        const stream = fs.createReadStream(filePath, { start, end });
        stream.pipe(res);
      } else {
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
      }
      
      return true;
    } catch (error) {
      throw new Error(`Failed to stream file: ${error.message}`);
    }
  }

  async cleanupOldFiles(maxAge = 3600000) { // 1 hour default
    try {
      const files = await fs.readdir(config.downloadPath);
      const now = Date.now();
      
      for (const file of files) {
        const filePath = path.join(config.downloadPath, file);
        const stat = await fs.stat(filePath);
        
        if (now - stat.mtimeMs > maxAge) {
          await fs.remove(filePath);
          console.log(`Cleaned up old file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

module.exports = new StreamHandler();