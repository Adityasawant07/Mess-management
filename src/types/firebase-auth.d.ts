declare module "@firebase/auth/dist/rn/index.js" {
  import type { Persistence } from "firebase/auth";

  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
    setItem(key: string, value: string): Promise<void>;
  }): Persistence;
}
