const youtubeService = require('../services/youtube.service');
const extractorService = require('../services/extractor.service');
const videoFormatter = require('../utils/videoFormatter');
const { v4: uuidv4 } = require('uuid');

class YoutubeController {
  async search(req, res, next) {
    try {
      const { query, maxResults = 10 } = req.body;
      if (!query) return res.status(400).json({ error: 'Search query is required' });

      const results = await youtubeService.searchVideos(query, maxResults);
      const formattedResults = results.map(video => videoFormatter.formatSearchResult(video, 'youtube'));
      res.json({ success: true, data: formattedResults, total: formattedResults.length });
    } catch (error) {
      next(error);
    }
  }

  async getInfo(req, res, next) {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: 'URL is required' });

      const videoId = extractorService.extractYoutubeId(url);
      const videoInfo = await youtubeService.getVideoInfo(videoId);
      const formats = await youtubeService.getAvailableFormats(videoId);

      res.json({
        success: true,
        data: {
          ...videoFormatter.formatVideoInfo(videoInfo, 'youtube'),
          formats: videoFormatter.formatFormats(formats)
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async download(req, res, next) {
    try {
      const { url, format, quality, audioOnly = false } = req.body;

      if (!url) return res.status(400).json({ error: 'URL is required' });
      if (!format) return res.status(400).json({ error: 'Format is required' });
      if (!quality) return res.status(400).json({ error: 'Quality is required' });

      let videoId;
      try {
        videoId = extractorService.extractYoutubeId(url);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
      }

      const downloadId = uuidv4();

      // Start download in background without SSE
      const result = await youtubeService.downloadVideo(videoId, {
        format,
        quality,
        audioOnly,
        downloadId
      });

      // Return JSON response with download info
      res.json({
        success: true,
        downloadId,
        file: result
      });
    } catch (error) {
      console.error('Download controller error:', error);
      res.status(500).json({ error: error.message });
    }
  }

  async getFormats(req, res, next) {
    try {
      const { videoId } = req.params;
      if (!videoId) return res.status(400).json({ error: 'Video ID is required' });

      const formats = await youtubeService.getAvailableFormats(videoId);
      res.json({ success: true, data: videoFormatter.formatFormats(formats) });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new YoutubeController();