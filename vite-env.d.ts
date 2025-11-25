/// <reference types="vite/client" />

declare module 'vite/client' {
  interface ImportMetaEnv {
    readonly MODE: string
    readonly DEV: boolean
    readonly PROD: boolean
    readonly SSR: boolean
    readonly VITE_API_URL?: string
    readonly VITE_ROLLOUT_SERVICE_URL?: string
    readonly VITE_TRAINING_SERVICE_URL?: string
    readonly VITE_CONVEX_URL?: string
    readonly VITE_SENTRY_DSN?: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

