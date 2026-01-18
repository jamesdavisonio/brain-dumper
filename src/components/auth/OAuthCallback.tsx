import { useEffect, useState } from 'react'

/**
 * OAuth callback page that receives the redirect from Google OAuth
 * This page is loaded in the popup after the Cloud Function completes the OAuth flow.
 * It shows a status message and automatically closes the popup.
 *
 * Note: Due to Cross-Origin-Opener-Policy (COOP) restrictions, we can't use
 * postMessage to communicate with the parent window. Instead, the OAuth callback
 * Cloud Function writes to Firestore, and the parent window's CalendarContext
 * subscription detects the connection change.
 */
export function OAuthCallback() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Completing connection...')

  useEffect(() => {
    // Extract parameters from URL
    const params = new URLSearchParams(window.location.search)
    const calendarConnected = params.get('calendar') === 'connected'
    const success = params.get('success') === 'true' || calendarConnected
    const error = params.get('error')

    if (success) {
      setStatus('success')
      setMessage('Calendar connected successfully!')
    } else if (error) {
      setStatus('error')
      setMessage(error)
    } else {
      // If no clear indicator, assume it's processing or completed
      setStatus('success')
      setMessage('Connection complete!')
    }

    // Close popup after short delay to show status message
    const closeTimeout = setTimeout(() => {
      window.close()
    }, 1500)

    return () => clearTimeout(closeTimeout)
  }, [])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '24px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        backgroundColor: '#f9fafb',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '32px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          textAlign: 'center',
          maxWidth: '400px',
          width: '100%',
        }}
      >
        {status === 'processing' && (
          <div
            style={{
              width: '48px',
              height: '48px',
              border: '4px solid #e5e7eb',
              borderTopColor: '#3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }}
          />
        )}
        {status === 'success' && (
          <div
            style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#10b981',
              borderRadius: '50%',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
        {status === 'error' && (
          <div
            style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#ef4444',
              borderRadius: '50%',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
        )}
        <p
          style={{
            fontSize: '16px',
            color: status === 'error' ? '#dc2626' : '#374151',
            margin: 0,
          }}
        >
          {message}
        </p>
        <p
          style={{
            fontSize: '14px',
            color: '#6b7280',
            marginTop: '8px',
          }}
        >
          This window will close automatically.
        </p>
      </div>
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}
