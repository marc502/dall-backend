const tiktokService = require('../services/tiktok.service');
const extractorService = require('../services/extractor.service');
const videoFormatter = require('../utils/videoFormatter');
const { v4: uuidv4 } = require('uuid');

class TiktokController {
  async getInfo(req, res, next) {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ 
          success: false, 
          error: 'URL is required' 
        });
      }

      let videoId;
      try {
        videoId = extractorService.extractTiktokId(url);
      } catch (e) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid TikTok URL. Please provide a valid TikTok video URL.' 
        });
      }

      const videoInfo = await tiktokService.getVideoInfo(videoId);
      
      res.json({
        success: true,
        data: videoFormatter.formatVideoInfo(videoInfo, 'tiktok')
      });
    } catch (error) {
      console.error('Get TikTok info error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to get TikTok video information' 
      });
    }
  }

  async download(req, res, next) {
    try {
      const { url, watermark = true } = req.body;
      
      if (!url) {
        return res.status(400).json({ 
          success: false, 
          error: 'URL is required' 
        });
      }

      let videoId;
      try {
        videoId = extractorService.extractTiktokId(url);
      } catch (e) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid TikTok URL' 
        });
      }

      const downloadId = uuidv4();
      
      // Set up progress tracking (optional, can remove if not needed)
      tiktokService.onProgress(downloadId, (progress) => {
        console.log(`Download ${downloadId}: ${progress.percentage}%`);
      });
      
      const result = await tiktokService.downloadVideo(videoId, { 
        watermark, 
        downloadId 
      });
      
      res.json({
        success: true,
        downloadId,
        file: result
      });
    } catch (error) {
      console.error('TikTok download error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to download TikTok video' 
      });
    }
  }

  async downloadNoWatermark(req, res, next) {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ 
          success: false, 
          error: 'URL is required' 
        });
      }

      let videoId;
      try {
        videoId = extractorService.extractTiktokId(url);
      } catch (e) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid TikTok URL' 
        });
      }

      const downloadId = uuidv4();
      
      const result = await tiktokService.downloadNoWatermark(videoId, downloadId);
      
      res.json({
        success: true,
        downloadId,
        file: result
      });
    } catch (error) {
      console.error('TikTok no watermark error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to download TikTok video without watermark' 
      });
    }
  }
}

module.exports = new TiktokController();