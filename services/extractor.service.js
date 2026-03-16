class ExtractorService {
  // YouTube
  extractYoutubeId(url) {
    if (!url) throw new Error('URL is required');
    
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?#]+)/,
      /youtube\.com\/embed\/([^/?]+)/,
      /youtube\.com\/v\/([^/?]+)/,
      /youtube\.com\/shorts\/([^/?]+)/,
      /youtube\.com\/live\/([^/?]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1] && match[1].length >= 11) {
        return match[1];
      }
    }
    
    try {
      const urlObj = new URL(url);
      const videoId = urlObj.searchParams.get('v');
      if (videoId && videoId.length >= 11) {
        return videoId;
      }
    } catch (e) {}
    
    throw new Error('Invalid YouTube URL');
  }

  // TikTok
  extractTiktokId(url) {
    if (!url) throw new Error('URL is required');
    
    url = url.trim();
    
    const patterns = [
      /tiktok\.com\/@[\w.]+\/video\/(\d+)/,
      /tiktok\.com\/v\/(\d+)/,
      /m\.tiktok\.com\/v\/(\d+)/,
      /vm\.tiktok\.com\/([a-zA-Z0-9]+)/,
      /tiktok\.com\/@[\w.]+\/(\d+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      for (const part of pathParts) {
        if (/^\d+$/.test(part) && part.length >= 10) {
          return part;
        }
      }
    } catch (e) {}
    
    throw new Error('Invalid TikTok URL');
  }

  // Instagram
  extractInstagramId(url) {
    if (!url) throw new Error('URL is required');
    
    url = url.trim();
    
    const patterns = [
      /instagram\.com\/p\/([^/?]+)/,
      /instagram\.com\/reel\/([^/?]+)/,
      /instagram\.com\/tv\/([^/?]+)/,
      /instagr\.am\/p\/([^/?]+)/,
      /instagr\.am\/reel\/([^/?]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    throw new Error('Invalid Instagram URL');
  }

  extractInstagramStoryId(url) {
    if (!url) throw new Error('URL is required');
    
    const pattern = /instagram\.com\/stories\/([^/?]+)/;
    const match = url.match(pattern);
    
    if (match && match[1]) {
      return match[1];
    }
    
    throw new Error('Invalid Instagram Story URL');
  }

  extractInstagramReelId(url) {
    if (!url) throw new Error('URL is required');
    
    const pattern = /instagram\.com\/reel\/([^/?]+)/;
    const match = url.match(pattern);
    
    if (match && match[1]) {
      return match[1];
    }
    
    throw new Error('Invalid Instagram Reel URL');
  }

  getInstagramMediaType(url) {
    if (!url) return 'unknown';
    
    if (url.includes('/p/')) return 'post';
    if (url.includes('/reel/')) return 'reel';
    if (url.includes('/stories/')) return 'story';
    if (url.includes('/tv/')) return 'tv';
    
    return 'unknown';
  }

  // Facebook
  extractFacebookId(url) {
    if (!url) throw new Error('URL is required');
    
    url = url.trim();
    
    const patterns = [
      /facebook\.com\/watch\?v=(\d+)/,
      /facebook\.com\/video\.php\?v=(\d+)/,
      /fb\.watch\/([a-zA-Z0-9]+)/,
      /facebook\.com\/[^/]+\/videos\/(\d+)/,
      /facebook\.com\/watch\/live\/?\?v=(\d+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    if (url.includes('fb.watch')) {
      const match = url.match(/fb\.watch\/([^/?]+)/);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    throw new Error('Invalid Facebook URL');
  }

  extractFacebookId(url) {
  if (!url) throw new Error('URL is required');
  
  url = url.trim();
  
  // Handle various Facebook URL formats
  const patterns = [
    // Watch URLs with video ID
    /facebook\.com\/watch\?v=(\d+)/,
    // Video.php URLs
    /facebook\.com\/video\.php\?v=(\d+)/,
    // Short fb.watch URLs
    /fb\.watch\/([a-zA-Z0-9]+)/,
    // Profile video URLs
    /facebook\.com\/(?:[^\/]+)\/videos\/(\d+)/,
    // Watch live URLs
    /facebook\.com\/watch\/live\/?\?v=(\d+)/,
    // Permalink URLs
    /facebook\.com\/permalink\.php\?story_fbid=(\d+)/,
    // Photo/video URLs
    /facebook\.com\/photo\.php\?fbid=(\d+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  // Try to extract from any numeric ID in the URL
  try {
    const urlObj = new URL(url);
    // Check query parameters first
    const videoId = urlObj.searchParams.get('v');
    if (videoId) return videoId;
    
    const storyFbid = urlObj.searchParams.get('story_fbid');
    if (storyFbid) return storyFbid;
    
    const fbid = urlObj.searchParams.get('fbid');
    if (fbid) return fbid;
    
    // Look for numeric patterns in pathname
    const pathParts = urlObj.pathname.split('/');
    for (const part of pathParts) {
      if (/^\d+$/.test(part) && part.length >= 5) {
        return part;
      }
    }
  } catch (e) {
    // URL parsing failed
  }
  
  console.error('Invalid Facebook URL:', url);
  throw new Error('Invalid Facebook URL. Please provide a valid Facebook video URL.');
}

  // Platform detection
  isYoutubeUrl(url) {
    return /youtube\.com\/watch\?v=|youtu\.be\//.test(url);
  }

  isTiktokUrl(url) {
    return /tiktok\.com\/@[\w.]+\/video\/\d+|tiktok\.com\/v\/\d+|vm\.tiktok\.com/.test(url);
  }

  isInstagramUrl(url) {
    return /instagram\.com\/(p|reel|tv|stories)\//.test(url) || /instagr\.am\/(p|reel)\//.test(url);
  }

  isFacebookUrl(url) {
    return /facebook\.com\/watch|fb\.watch\//.test(url);
  }

  // Universal parser
  parse(url) {
    if (this.isYoutubeUrl(url)) {
      return { 
        platform: 'youtube', 
        id: this.extractYoutubeId(url), 
        url,
        type: 'video'
      };
    }
    if (this.isTiktokUrl(url)) {
      return { 
        platform: 'tiktok', 
        id: this.extractTiktokId(url), 
        url,
        type: 'video'
      };
    }
    if (this.isInstagramUrl(url)) {
      return { 
        platform: 'instagram', 
        id: this.extractInstagramId(url), 
        url,
        type: this.getInstagramMediaType(url)
      };
    }
    if (this.isFacebookUrl(url)) {
      return { 
        platform: 'facebook', 
        id: this.extractFacebookId(url), 
        url,
        type: this.getFacebookVideoType(url)
      };
    }
    throw new Error('Unsupported platform. Please provide a valid URL from YouTube, TikTok, Instagram, or Facebook.');
  }
}

module.exports = new ExtractorService();