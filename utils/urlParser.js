class UrlParser {
  parse(url) {
    const platforms = {
      youtube: this.isYoutubeUrl,
      tiktok: this.isTiktokUrl,
      instagram: this.isInstagramUrl,
      facebook: this.isFacebookUrl
    };
    
    for (const [platform, checker] of Object.entries(platforms)) {
      if (checker(url)) {
        return {
          platform,
          id: this.extractId(url, platform),
          url
        };
      }
    }
    
    throw new Error('Unsupported platform or invalid URL');
  }

  isYoutubeUrl(url) {
    const patterns = [
      /youtube\.com\/watch\?v=/,
      /youtu\.be\//,
      /youtube\.com\/embed\//,
      /youtube\.com\/v\//
    ];
    return patterns.some(pattern => pattern.test(url));
  }

  isTiktokUrl(url) {
    return /tiktok\.com\/@[\w.]+\/video\/\d+/.test(url);
  }

  isInstagramUrl(url) {
    const patterns = [
      /instagram\.com\/p\//,
      /instagram\.com\/reel\//,
      /instagram\.com\/stories\//,
      /instagram\.com\/tv\//
    ];
    return patterns.some(pattern => pattern.test(url));
  }

  isFacebookUrl(url) {
    const patterns = [
      /facebook\.com\/watch\?v=/,
      /fb\.watch\//,
      /facebook\.com\/[^/]+\/videos\//
    ];
    return patterns.some(pattern => pattern.test(url));
  }

  extractId(url, platform) {
    switch (platform) {
      case 'youtube':
        return this.extractYoutubeId(url);
      case 'tiktok':
        return this.extractTiktokId(url);
      case 'instagram':
        return this.extractInstagramId(url);
      case 'facebook':
        return this.extractFacebookId(url);
      default:
        throw new Error('Platform not supported');
    }
  }

  extractYoutubeId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?#]+)/,
      /youtube\.com\/embed\/([^/?]+)/,
      /youtube\.com\/v\/([^/?]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  }

  extractTiktokId(url) {
    const match = url.match(/video\/(\d+)/);
    return match ? match[1] : null;
  }

  extractInstagramId(url) {
    const match = url.match(/\/(p|reel|tv|stories)\/([^/?]+)/);
    return match ? match[2] : null;
  }

  extractFacebookId(url) {
    const match = url.match(/videos\/(\d+)|watch\?v=(\d+)/);
    return match ? (match[1] || match[2]) : null;
  }
}

module.exports = new UrlParser();