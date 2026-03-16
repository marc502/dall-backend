const instagramService = require('../services/instagram.service');
const extractorService = require('../services/extractor.service');
const videoFormatter = require('../utils/videoFormatter');
const { v4: uuidv4 } = require('uuid');

class InstagramController {
  async getInfo(req, res, next) {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ 
          success: false, 
          error: 'URL is required' 
        });
      }

      let mediaId;
      let mediaType;
      
      try {
        mediaId = extractorService.extractInstagramId(url);
        mediaType = extractorService.getInstagramMediaType(url);
      } catch (e) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid Instagram URL. Please provide a valid Instagram post, reel, or story URL.' 
        });
      }

      const mediaInfo = await instagramService.getMediaInfo(mediaId, mediaType);
      
      res.json({
        success: true,
        data: videoFormatter.formatVideoInfo(mediaInfo, 'instagram')
      });
    } catch (error) {
      console.error('Get Instagram info error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to get Instagram media information' 
      });
    }
  }

  async download(req, res, next) {
    try {
      const { url, type = 'post' } = req.body;
      
      if (!url) {
        return res.status(400).json({ 
          success: false, 
          error: 'URL is required' 
        });
      }

      let mediaId;
      try {
        mediaId = extractorService.extractInstagramId(url);
      } catch (e) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid Instagram URL' 
        });
      }

      const downloadId = uuidv4();
      
      const result = await instagramService.downloadMedia(mediaId, type, downloadId);
      
      res.json({
        success: true,
        downloadId,
        file: result
      });
    } catch (error) {
      console.error('Instagram download error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to download Instagram media' 
      });
    }
  }

  async downloadStory(req, res, next) {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ 
          success: false, 
          error: 'URL is required' 
        });
      }

      let storyId;
      try {
        storyId = extractorService.extractInstagramStoryId(url);
      } catch (e) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid Instagram Story URL' 
        });
      }

      const downloadId = uuidv4();
      
      const result = await instagramService.downloadStory(storyId, downloadId);
      
      res.json({
        success: true,
        downloadId,
        file: result
      });
    } catch (error) {
      console.error('Instagram story download error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to download Instagram story' 
      });
    }
  }

  async downloadReel(req, res, next) {
    try {
      const { url } = req.body;
      
      if (!url) {
        return res.status(400).json({ 
          success: false, 
          error: 'URL is required' 
        });
      }

      let reelId;
      try {
        reelId = extractorService.extractInstagramReelId(url);
      } catch (e) {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid Instagram Reel URL' 
        });
      }

      const downloadId = uuidv4();
      
      const result = await instagramService.downloadReel(reelId, downloadId);
      
      res.json({
        success: true,
        downloadId,
        file: result
      });
    } catch (error) {
      console.error('Instagram reel download error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to download Instagram reel' 
      });
    }
  }
}

module.exports = new InstagramController();