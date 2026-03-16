const redis = require('redis');
const { promisify } = require('util');

class RedisClient {
  constructor() {
    this.client = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    
    this.client.on('error', (err) => {
      console.error('Redis error:', err);
    });
    
    this.client.on('connect', () => {
      console.log('Connected to Redis');
    });
    
    // Promisify methods
    this.getAsync = promisify(this.client.get).bind(this.client);
    this.setAsync = promisify(this.client.set).bind(this.client);
    this.delAsync = promisify(this.client.del).bind(this.client);
  }

  async get(key) {
    try {
      const data = await this.getAsync(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key, value, ttl = 3600) {
    try {
      const stringValue = JSON.stringify(value);
      await this.setAsync(key, stringValue, 'EX', ttl);
      return true;
    } catch (error) {
      console.error('Redis set error:', error);
      return false;
    }
  }

  async del(key) {
    try {
      await this.delAsync(key);
      return true;
    } catch (error) {
      console.error('Redis del error:', error);
      return false;
    }
  }
}

module.exports = new RedisClient();