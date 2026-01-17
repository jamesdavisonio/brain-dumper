/**
 * OAuth popup utility for handling OAuth flows in a popup window
 * @module lib/oauthPopup
 */

/**
 * Result of an OAuth popup flow
 */
export interface OAuthPopupResult {
  success: boolean
  error?: string
}

/**
 * Message sent from the OAuth callback page to the parent window
 */
export interface OAuthMessage {
  type: 'OAUTH_COMPLETE'
  success: boolean
  error?: string
}

/**
 * Default popup window options
 */
const DEFAULT_POPUP_OPTIONS = {
  width: 500,
  height: 600,
}

/**
 * Calculates the center position for a popup window
 * @param width - Width of the popup
 * @param height - Height of the popup
 * @returns Left and top positions for centering the popup
 */
function getCenterPosition(width: number, height: number): { left: number; top: number } {
  const left = window.screenX + (window.outerWidth - width) / 2
  const top = window.screenY + (window.outerHeight - height) / 2
  return { left, top }
}

/**
 * Opens an OAuth popup window and waits for the OAuth flow to complete
 * @param url - The OAuth authorization URL to open
 * @param options - Optional popup window dimensions
 * @returns Promise that resolves with the OAuth result
 */
export function openOAuthPopup(
  url: string,
  options: { width?: number; height?: number } = {}
): Promise<OAuthPopupResult> {
  const width = options.width ?? DEFAULT_POPUP_OPTIONS.width
  const height = options.height ?? DEFAULT_POPUP_OPTIONS.height
  const { left, top } = getCenterPosition(width, height)

  return new Promise((resolve) => {
    // Open the popup window
    const popup = window.open(
      url,
      'oauth_popup',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`
    )

    // Handle case where popup was blocked
    if (!popup) {
      resolve({
        success: false,
        error: 'Popup was blocked. Please allow popups for this site.',
      })
      return
    }

    // Variable to track if we've already resolved
    let resolved = false

    // Listen for message from popup
    const handleMessage = (event: MessageEvent<OAuthMessage>) => {
      // Only accept messages from the same origin
      if (event.origin !== window.location.origin) {
        return
      }

      // Check if this is an OAuth completion message
      if (event.data?.type === 'OAUTH_COMPLETE') {
        cleanup()
        resolve({
          success: event.data.success,
          error: event.data.error,
        })
      }
    }

    // Cleanup function to remove listeners and close popup
    const cleanup = () => {
      if (resolved) return
      resolved = true
      window.removeEventListener('message', handleMessage)
      clearInterval(checkClosedInterval)
      if (popup && !popup.closed) {
        popup.close()
      }
    }

    // Add message listener
    window.addEventListener('message', handleMessage)

    // Check if popup was closed without completing OAuth
    const checkClosedInterval = setInterval(() => {
      if (popup?.closed && !resolved) {
        cleanup()
        resolve({
          success: false,
          error: 'Authentication was cancelled',
        })
      }
    }, 500)

    // Set a timeout for the OAuth flow (5 minutes)
    setTimeout(() => {
      if (!resolved) {
        cleanup()
        resolve({
          success: false,
          error: 'Authentication timed out. Please try again.',
        })
      }
    }, 5 * 60 * 1000)
  })
}

/**
 * Posts the OAuth result to the parent window
 * This is called from the OAuth callback page
 * @param success - Whether the OAuth flow was successful
 * @param error - Optional error message if the flow failed
 */
export function postOAuthResult(success: boolean, error?: string): void {
  if (!window.opener) {
    console.warn('No parent window found to post OAuth result')
    return
  }

  const message: OAuthMessage = {
    type: 'OAUTH_COMPLETE',
    success,
    error,
  }

  window.opener.postMessage(message, window.location.origin)
}
