const facebookService = require('../services/facebook.service');
const extractorService = require('../services/extractor.service');
const videoFormatter = require('../utils/videoFormatter');
const { v4: uuidv4 } = require('uuid');

class FacebookController {
  /**
   * Get Facebook video information
   * @route POST /api/facebook/info
   */
  async getInfo(req, res, next) {
    try {
      const { url } = req.body;
      
      // Validate URL presence
      if (!url) {
        return res.status(400).json({ 
          success: false, 
          error: 'URL is required' 
        });
      }

      // Extract video ID
      let videoId;
      try {
        videoId = extractorService.extractFacebookId(url);
      } catch (e) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid Facebook URL. Please provide a valid Facebook video URL (e.g., facebook.com/watch?v=123456789, fb.watch/abc123/, facebook.com/username/videos/123456789)' 
        });
      }

      // Get video info from service
      const videoInfo = await facebookService.getVideoInfo(videoId);
      
      // Format and return response
      res.json({
        success: true,
        data: videoFormatter.formatVideoInfo(videoInfo, 'facebook')
      });
    } catch (error) {
      console.error('Get Facebook info error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to get Facebook video information' 
      });
    }
  }

  /**
   * Download Facebook video
   * @route POST /api/facebook/download
   */
  async download(req, res, next) {
    try {
      const { url, quality = 'best', audioOnly = false } = req.body;
      
      // Validate URL presence
      if (!url) {
        return res.status(400).json({ 
          success: false, 
          error: 'URL is required' 
        });
      }

      // Extract video ID
      let videoId;
      try {
        videoId = extractorService.extractFacebookId(url);
      } catch (e) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid Facebook URL' 
        });
      }

      // Generate unique download ID
      const downloadId = uuidv4();
      
      // Set up progress tracking (optional)
      facebookService.onProgress(downloadId, (progress) => {
        console.log(`Facebook Download ${downloadId}: ${progress.percentage}%`);
      });
      
      // Download video
      const result = await facebookService.downloadVideo(videoId, {
        quality,
        audioOnly,
        downloadId
      });
      
      // Return download info
      res.json({
        success: true,
        downloadId,
        file: result
      });
    } catch (error) {
      console.error('Facebook download error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to download Facebook video' 
      });
    }
  }

  /**
   * Download Facebook video only (no audio extraction option)
   * @route POST /api/facebook/video
   */
  async downloadVideo(req, res, next) {
    try {
      const { url, quality = 'best' } = req.body;
      
      // Validate URL presence
      if (!url) {
        return res.status(400).json({ 
          success: false, 
          error: 'URL is required' 
        });
      }

      // Extract video ID
      let videoId;
      try {
        videoId = extractorService.extractFacebookId(url);
      } catch (e) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid Facebook URL' 
        });
      }

      // Generate unique download ID
      const downloadId = uuidv4();
      
      // Download video (no audio only)
      const result = await facebookService.downloadVideo(videoId, {
        quality,
        audioOnly: false,
        downloadId
      });
      
      // Return download info
      res.json({
        success: true,
        downloadId,
        file: result
      });
    } catch (error) {
      console.error('Facebook video download error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to download Facebook video' 
      });
    }
  }

  /**
   * Get available formats for a Facebook video
   * @route GET /api/facebook/formats/:videoId
   */
  async getFormats(req, res, next) {
    try {
      const { videoId } = req.params;
      
      // Validate video ID
      if (!videoId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Video ID is required' 
        });
      }

      // Get formats from service
      const formats = await facebookService.getAvailableFormats(videoId);
      
      // Return formatted formats
      res.json({ 
        success: true, 
        data: videoFormatter.formatFormats(formats) 
      });
    } catch (error) {
      console.error('Get Facebook formats error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to get formats' 
      });
    }
  }

  /**
   * Download Facebook Live video (special handling for live streams)
   * @route POST /api/facebook/live
   */
  async downloadLive(req, res, next) {
    try {
      const { url, quality = 'best' } = req.body;
      
      // Validate URL presence
      if (!url) {
        return res.status(400).json({ 
          success: false, 
          error: 'URL is required' 
        });
      }

      // Check if it's a live URL
      if (!url.includes('/watch/live/') && !url.includes('live_video')) {
        return res.status(400).json({ 
          success: false, 
          error: 'This endpoint is for Facebook Live videos only. Use /download for regular videos.' 
        });
      }

      // Extract video ID
      let videoId;
      try {
        videoId = extractorService.extractFacebookId(url);
      } catch (e) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid Facebook Live URL' 
        });
      }

      // Generate unique download ID
      const downloadId = uuidv4();
      
      // Download live video (with special handling in service)
      const result = await facebookService.downloadLiveVideo(videoId, {
        quality,
        downloadId
      });
      
      // Return download info
      res.json({
        success: true,
        downloadId,
        file: result
      });
    } catch (error) {
      console.error('Facebook live download error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to download Facebook Live video' 
      });
    }
  }

  /**
   * Cancel an ongoing download
   * @route DELETE /api/facebook/cancel/:downloadId
   */
  async cancelDownload(req, res, next) {
    try {
      const { downloadId } = req.params;
      
      if (!downloadId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Download ID is required' 
        });
      }

      // Cancel download in service
      const cancelled = await facebookService.cancelDownload(downloadId);
      
      if (cancelled) {
        res.json({
          success: true,
          message: 'Download cancelled successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Download not found or already completed'
        });
      }
    } catch (error) {
      console.error('Cancel download error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to cancel download' 
      });
    }
  }

  /**
   * Get download status
   * @route GET /api/facebook/status/:downloadId
   */
  async getDownloadStatus(req, res, next) {
    try {
      const { downloadId } = req.params;
      
      if (!downloadId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Download ID is required' 
        });
      }

      const status = await facebookService.getDownloadStatus(downloadId);
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Get download status error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to get download status' 
      });
    }
  }
}

module.exports = new FacebookController();