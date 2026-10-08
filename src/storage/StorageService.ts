import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StorageServiceInterface {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

class AsyncStorageService implements StorageServiceInterface {
  async get<T>(key: string): Promise<T | null> {
    const item = await AsyncStorage.getItem(key);
    if (item === null) return null;
    try {
      return JSON.parse(item) as T;
    } catch (e) {
      throw new Error(`Storage data corrupted for key ${key}`);
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    const jsonValue = JSON.stringify(value);
    await AsyncStorage.setItem(key, jsonValue);
  }

  async remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    await AsyncStorage.clear();
  }
}

export const StorageService = new AsyncStorageService();
