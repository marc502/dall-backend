module.exports = {
  port: process.env.PORT || 5000,
  env: process.env.NODE_ENV || 'development',
  downloadPath: process.env.DOWNLOAD_PATH || './temp/downloads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 1073741824, // 1GB
  supportedPlatforms: ['youtube', 'tiktok', 'instagram', 'facebook'],
  
  // Video quality options
  qualities: {
    youtube: ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'],
    tiktok: ['360p', '480p', '720p'],
    instagram: ['360p', '480p', '720p'],
    facebook: ['360p', '480p', '720p', '1080p']
  },
  
  // Format options
  formats: {
    video: ['mp4', 'webm', 'mkv'],
    audio: ['mp3', 'm4a', 'aac']
  }
};