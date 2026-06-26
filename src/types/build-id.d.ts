// Injected by Vite `define` in vite.config.ts. Identifies the deployed build so a
// stale tab can detect that a newer version has shipped. Present in both the
// client and server bundles.
declare const __KINO_BUILD_ID__: string

interface ImportMetaEnv {
  readonly VITE_POSTHOG_HOST?: string
  readonly VITE_POSTHOG_PROJECT_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
