import type { AppData } from './types'

export {}

declare global {
  interface AurumInvoiceSavePayload {
    directoryPath: string
    fileName: string
    buffer: ArrayBuffer
  }

  interface AurumInvoiceSaveResult {
    filePath: string
  }

  interface Window {
    aurumDesktop?: {
      isDesktop: boolean
      platform: string
      data?: {
        load: () => Promise<AppData | null>
        save: (data: AppData) => Promise<void>
        path: () => Promise<string>
      }
      invoice?: {
        selectDirectory: (currentPath?: string) => Promise<string | null>
        savePdf: (payload: AurumInvoiceSavePayload) => Promise<AurumInvoiceSaveResult>
      }
    }
  }
}
