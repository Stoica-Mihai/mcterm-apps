// Types for the runtime SDK loaded via <script src="/_sdk/mcterm.js">
interface McTermSDK {
  rpc<T = any>(method: string, params?: Record<string, unknown>): Promise<T>
  hasCaps(): boolean
  onState(fn: (state: any) => void): void
  onFocus(fn: () => void): void
  onBlur(fn: () => void): void
  onTermConfig(fn: (cfg: { fontFamily?: string; fontSize?: number; scrollback?: number }) => void): void
  onPreview(cb: (on: boolean) => void): void
  on(ev: string, fn: (data: any) => void): void
  saveState(state: unknown): void
  setTitle(title: string): void
  icon(name: string): string
}

declare const mcterm: McTermSDK

interface Window { mcterm: McTermSDK }
