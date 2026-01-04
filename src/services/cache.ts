import AsyncStorage from '@react-native-async-storage/async-storage';
import { MatchItem } from './chat';
import { IncomingLikeProfile } from './likes';

const CACHE_PREFIX = 'app_cache_';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedData<T> {
  data: T;
  timestamp: number;
}

// In-memory cache for faster access
const memoryCache = new Map<string, any>();

export const cacheService = {
  // Generic cache methods
  async set<T>(key: string, data: T): Promise<void> {
    const cached: CachedData<T> = {
      data,
      timestamp: Date.now(),
    };
    
    // Store in memory
    memoryCache.set(key, cached);
    
    // Store in AsyncStorage
    try {
      await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cached));
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  },

  async get<T>(key: string): Promise<T | null> {
    // Check memory first
    const memoryData = memoryCache.get(key) as CachedData<T> | undefined;
    if (memoryData) {
      const age = Date.now() - memoryData.timestamp;
      if (age < CACHE_TTL) {
        return memoryData.data;
      }
      // Expired, remove from memory
      memoryCache.delete(key);
    }

    // Check AsyncStorage
    try {
      const stored = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
      if (stored) {
        const cached: CachedData<T> = JSON.parse(stored);
        const age = Date.now() - cached.timestamp;
        
        if (age < CACHE_TTL) {
          // Still valid, restore to memory
          memoryCache.set(key, cached);
          return cached.data;
        } else {
          // Expired, remove
          await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
        }
      }
    } catch (error) {
      console.warn('Failed to read cache:', error);
    }

    return null;
  },

  async invalidate(key: string): Promise<void> {
    memoryCache.delete(key);
    try {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
    } catch (error) {
      console.warn('Failed to invalidate cache:', error);
    }
  },

  async clear(): Promise<void> {
    memoryCache.clear();
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter((key) => key.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  },

  // Specific cache methods
  async setMatches(userId: string, matches: MatchItem[]): Promise<void> {
    await this.set(`matches_${userId}`, matches);
  },

  async getMatches(userId: string): Promise<MatchItem[] | null> {
    return this.get<MatchItem[]>(`matches_${userId}`);
  },

  async setLikes(userId: string, likes: IncomingLikeProfile[]): Promise<void> {
    await this.set(`likes_${userId}`, likes);
  },

  async getLikes(userId: string): Promise<IncomingLikeProfile[] | null> {
    return this.get<IncomingLikeProfile[]>(`likes_${userId}`);
  },

  async setProfile(userId: string, profile: any): Promise<void> {
    await this.set(`profile_${userId}`, profile);
  },

  async getProfile(userId: string): Promise<any | null> {
    return this.get(`profile_${userId}`);
  },

  async setMessages(matchId: string, messages: any[]): Promise<void> {
    await this.set(`messages_${matchId}`, messages);
  },

  async getMessages(matchId: string): Promise<any[] | null> {
    return this.get<any[]>(`messages_${matchId}`);
  },

  async setSuggestions(userId: string, suggestions: any[]): Promise<void> {
    await this.set(`suggestions_${userId}`, suggestions);
  },

  async getSuggestions(userId: string): Promise<any[] | null> {
    return this.get<any[]>(`suggestions_${userId}`);
  },

  async setSuggestionIndex(userId: string, index: number): Promise<void> {
    await this.set(`suggestion_index_${userId}`, index);
  },

  async getSuggestionIndex(userId: string): Promise<number | null> {
    return this.get<number>(`suggestion_index_${userId}`);
  },
};

