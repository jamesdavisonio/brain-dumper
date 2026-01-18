/**
 * OAuth popup utility for handling OAuth flows in a popup window
 *
 * This implementation does NOT rely on postMessage or checking popup.closed,
 * which are blocked by Cross-Origin-Opener-Policy (COOP) when the popup
 * navigates to different origins (e.g., Google OAuth servers).
 *
 * Instead, it simply opens the popup and returns immediately. The OAuth
 * callback will write to Firestore, and the CalendarContext's subscription
 * will detect the connection change.
 *
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
 * Opens an OAuth popup window for the authorization flow
 *
 * Due to Cross-Origin-Opener-Policy (COOP) restrictions, we cannot:
 * - Check if the popup was closed (popup.closed is blocked)
 * - Receive postMessage from the popup (different origin)
 *
 * Instead, the OAuth callback writes to Firestore, and the parent window's
 * CalendarContext subscription detects the connection change automatically.
 *
 * @param url - The OAuth authorization URL to open
 * @param options - Optional popup window dimensions
 * @returns Promise that resolves immediately after opening the popup
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

    // Due to COOP restrictions, we cannot reliably detect when the popup
    // closes or receive messages from it. Instead, we resolve immediately
    // and let the Firestore subscription handle the connection status update.
    //
    // The user will see the "Connecting..." state while the popup is open,
    // and when the OAuth flow completes, the callback writes to Firestore,
    // which triggers the subscription and updates the UI.
    resolve({ success: true })
  })
}
