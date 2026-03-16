const path = require('path');
const fs = require('fs-extra');
const config = require('../config/server.config');

class DownloadController {
  async getStatus(req, res, next) {
    try {
      const { downloadId } = req.params;
      
      // Check if download exists and get status
      const downloadPath = path.join(config.downloadPath, downloadId);
      const exists = await fs.pathExists(downloadPath);
      
      if (exists) {
        // Find the actual file in the directory
        const files = await fs.readdir(downloadPath);
        if (files.length > 0) {
          const filename = files[0];
          const filePath = path.join(downloadPath, filename);
          
          res.json({
            success: true,
            data: {
              downloadId,
              exists: true,
              status: 'completed',
              file: filename,
              filePath
            }
          });
        } else {
          res.json({
            success: true,
            data: {
              downloadId,
              exists: false,
              status: 'processing'
            }
          });
        }
      } else {
        res.json({
          success: true,
          data: {
            downloadId,
            exists: false,
            status: 'processing'
          }
        });
      }
    } catch (error) {
      next(error);
    }
  }

  async getFile(req, res, next) {
    try {
      const { filename } = req.params;
      
      // Check multiple possible paths
      let filePath = path.join(config.downloadPath, filename);
      
      // If file not found, try to find it in subdirectories
      if (!await fs.pathExists(filePath)) {
        const dirs = await fs.readdir(config.downloadPath);
        for (const dir of dirs) {
          const dirPath = path.join(config.downloadPath, dir);
          const stat = await fs.stat(dirPath);
          if (stat.isDirectory()) {
            const files = await fs.readdir(dirPath);
            if (files.includes(filename)) {
              filePath = path.join(dirPath, filename);
              break;
            }
          }
        }
      }
      
      const exists = await fs.pathExists(filePath);
      if (!exists) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Set proper headers
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      
      // Stream the file
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      
      // Clean up after sending (optional - keep for 5 minutes)
      setTimeout(() => {
        fs.remove(filePath).catch(console.error);
        // Also remove parent directory if empty
        const parentDir = path.dirname(filePath);
        fs.readdir(parentDir).then(files => {
          if (files.length === 0) {
            fs.remove(parentDir).catch(console.error);
          }
        }).catch(console.error);
      }, 300000); // 5 minutes
    } catch (error) {
      next(error);
    }
  }

  async cancelDownload(req, res, next) {
    try {
      const { downloadId } = req.params;
      
      const downloadPath = path.join(config.downloadPath, downloadId);
      if (await fs.pathExists(downloadPath)) {
        await fs.remove(downloadPath);
      }
      
      res.json({
        success: true,
        message: 'Download cancelled'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DownloadController();