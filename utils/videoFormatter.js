class VideoFormatter {
  formatSearchResult(video, platform) {
    const base = {
      id: video.id,
      title: video.title,
      thumbnail: video.thumbnail,
      duration: this.formatDuration(video.duration),
      platform
    };
    
    if (platform === 'youtube') {
      return {
        ...base,
        views: this.formatNumber(video.view_count),
        uploader: video.uploader,
        uploadDate: video.upload_date
      };
    }
    
    return base;
  }

  formatVideoInfo(video, platform) {
    const base = {
      id: video.id,
      title: video.title,
      thumbnail: video.thumbnail,
      duration: this.formatDuration(video.duration),
      platform,
      description: video.description
    };
    
    if (platform === 'youtube') {
      return {
        ...base,
        views: this.formatNumber(video.view_count),
        likes: this.formatNumber(video.like_count),
        uploader: video.uploader,
        uploaderUrl: video.uploader_url,
        uploadDate: video.upload_date,
        tags: video.tags
      };
    }
    
    if (platform === 'tiktok') {
      return {
        ...base,
        views: this.formatNumber(video.view_count),
        likes: this.formatNumber(video.like_count),
        shares: this.formatNumber(video.share_count),
        comments: this.formatNumber(video.comment_count),
        uploader: video.uploader,
        music: video.music
      };
    }
    
    if (platform === 'instagram') {
      return {
        ...base,
        views: this.formatNumber(video.view_count),
        likes: this.formatNumber(video.like_count),
        comments: this.formatNumber(video.comment_count),
        uploader: video.uploader,
        isReel: video.is_reel || false,
        isStory: video.is_story || false
      };
    }
    
    // FACEBOOK FORMATTING
    if (platform === 'facebook') {
      return {
        ...base,
        views: this.formatNumber(video.view_count),
        likes: this.formatNumber(video.like_count),
        shares: this.formatNumber(video.share_count),
        comments: this.formatNumber(video.comment_count),
        uploader: video.uploader || video.channel,
        uploaderUrl: video.uploader_url,
        uploadDate: video.upload_date,
        videoType: this.getFacebookVideoType(video),
        isLive: video.is_live || false,
        isHD: video.height >= 720,
        quality: this.getVideoQuality(video.height)
      };
    }
    
    return base;
  }

  formatFormats(formats) {
    return formats.map(format => ({
      id: format.id,
      extension: format.ext,
      resolution: format.resolution || 'audio',
      filesize: this.formatBytes(format.filesize),
      format: format.format,
      quality: format.quality || 'unknown',
      hasVideo: format.vcodec !== 'none',
      hasAudio: format.acodec !== 'none'
    }));
  }

  formatDuration(seconds) {
    if (!seconds) return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }

  formatBytes(bytes) {
    if (!bytes) return 'Unknown';
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // FACEBOOK SPECIFIC METHODS
  getFacebookVideoType(video) {
    if (video.is_live) return 'live';
    if (video.title?.toLowerCase().includes('reel')) return 'reel';
    if (video.title?.toLowerCase().includes('watch')) return 'watch';
    return 'regular';
  }

  getVideoQuality(height) {
    if (!height) return 'unknown';
    if (height >= 2160) return '4K';
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    if (height >= 360) return '360p';
    return '240p';
  }
}

module.exports = new VideoFormatter();