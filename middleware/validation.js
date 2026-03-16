class Validation {
  validateSearch(req, res, next) {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    if (query.length < 3) {
      return res.status(400).json({ error: 'Search query must be at least 3 characters' });
    }
    
    next();
  }

  validateUrl(req, res, next) {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const urlPattern = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
    
    if (!urlPattern.test(url)) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }
    
    next();
  }

  validateDownload(req, res, next) {
    const { url, format, quality } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const validFormats = ['mp4', 'mp3', 'webm', 'mkv'];
    if (format && !validFormats.includes(format)) {
      return res.status(400).json({ error: 'Invalid format' });
    }
    
    const validQualities = ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'];
    if (quality && !validQualities.includes(quality)) {
      return res.status(400).json({ error: 'Invalid quality' });
    }
    
    next();
  }
}

module.exports = new Validation();