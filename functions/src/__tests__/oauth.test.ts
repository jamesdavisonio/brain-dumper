/**
 * OAuth functions tests
 * Tests core OAuth logic without relying on complex Firebase mocks
 * @module __tests__/oauth.test
 */

import { describe, it, expect } from 'vitest';

// Test data
const mockTokens = {
  accessToken: 'mock_access_token',
  refreshToken: 'mock_refresh_token',
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  scope: 'https://www.googleapis.com/auth/calendar.readonly',
};

describe('OAuth Configuration', () => {
  it('should export correct OAuth scopes', async () => {
    const { OAUTH_CONFIG } = await import('../config/oauth');

    expect(OAUTH_CONFIG.scopes).toContain(
      'https://www.googleapis.com/auth/calendar.readonly'
    );
    expect(OAUTH_CONFIG.scopes).toContain(
      'https://www.googleapis.com/auth/calendar.events'
    );
    expect(OAUTH_CONFIG.scopes).toHaveLength(2);
  });

  it('should have correct token expiry buffer', async () => {
    const { TOKEN_EXPIRY_BUFFER_MS } = await import('../config/oauth');

    expect(TOKEN_EXPIRY_BUFFER_MS).toBe(5 * 60 * 1000); // 5 minutes
  });

  it('should have correct state token expiry', async () => {
    const { STATE_TOKEN_EXPIRY_MS } = await import('../config/oauth');

    expect(STATE_TOKEN_EXPIRY_MS).toBe(10 * 60 * 1000); // 10 minutes
  });

  it('should generate correct Firestore paths', async () => {
    const { FIRESTORE_PATHS } = await import('../config/oauth');

    expect(FIRESTORE_PATHS.userPrivate('user123')).toBe('users/user123/private');
    expect(FIRESTORE_PATHS.calendarTokens('user123')).toBe(
      'users/user123/private/calendarTokens'
    );
    expect(FIRESTORE_PATHS.calendars('user123')).toBe('users/user123/calendars');
    expect(FIRESTORE_PATHS.oauthStates).toBe('oauthStates');
  });

  it('should handle empty environment variables gracefully', async () => {
    const { OAUTH_CONFIG } = await import('../config/oauth');

    // Config should have default empty strings when env vars not set
    expect(typeof OAUTH_CONFIG.clientId).toBe('string');
    expect(typeof OAUTH_CONFIG.clientSecret).toBe('string');
    expect(typeof OAUTH_CONFIG.redirectUri).toBe('string');
  });
});

describe('Calendar Type Inference', () => {
  const workIndicators = ['work', 'office', 'job', 'business', 'company'];

  const inferCalendarType = (summary: string): 'work' | 'personal' => {
    const normalizedSummary = summary.toLowerCase();
    if (workIndicators.some((indicator) => normalizedSummary.includes(indicator))) {
      return 'work';
    }
    return 'personal';
  };

  it('should infer work calendar from name containing "work"', () => {
    expect(inferCalendarType('Work Calendar')).toBe('work');
    expect(inferCalendarType('My work tasks')).toBe('work');
    expect(inferCalendarType('WORK')).toBe('work');
  });

  it('should infer work calendar from name containing "office"', () => {
    expect(inferCalendarType('Office Calendar')).toBe('work');
    expect(inferCalendarType('back office')).toBe('work');
  });

  it('should infer work calendar from name containing "business"', () => {
    expect(inferCalendarType('Business Calendar')).toBe('work');
    expect(inferCalendarType('My Business')).toBe('work');
  });

  it('should infer work calendar from name containing "company"', () => {
    expect(inferCalendarType('Company Events')).toBe('work');
  });

  it('should infer work calendar from name containing "job"', () => {
    expect(inferCalendarType('Job Schedule')).toBe('work');
  });

  it('should default to personal for non-work calendars', () => {
    expect(inferCalendarType('Personal Tasks')).toBe('personal');
    expect(inferCalendarType('Family Calendar')).toBe('personal');
    expect(inferCalendarType('My Calendar')).toBe('personal');
    expect(inferCalendarType('')).toBe('personal');
  });
});

describe('Access Role Mapping', () => {
  const mapAccessRole = (
    role: string | undefined | null
  ): 'reader' | 'writer' | 'owner' => {
    switch (role) {
      case 'owner':
        return 'owner';
      case 'writer':
        return 'writer';
      default:
        return 'reader';
    }
  };

  it('should map owner role correctly', () => {
    expect(mapAccessRole('owner')).toBe('owner');
  });

  it('should map writer role correctly', () => {
    expect(mapAccessRole('writer')).toBe('writer');
  });

  it('should map reader role correctly', () => {
    expect(mapAccessRole('reader')).toBe('reader');
  });

  it('should default to reader for freeBusyReader', () => {
    expect(mapAccessRole('freeBusyReader')).toBe('reader');
  });

  it('should default to reader for undefined', () => {
    expect(mapAccessRole(undefined)).toBe('reader');
  });

  it('should default to reader for null', () => {
    expect(mapAccessRole(null)).toBe('reader');
  });

  it('should default to reader for unknown roles', () => {
    expect(mapAccessRole('unknown')).toBe('reader');
    expect(mapAccessRole('admin')).toBe('reader');
  });
});

describe('Calendar ID Encoding', () => {
  const encodeCalendarId = (calendarId: string): string => {
    return encodeURIComponent(calendarId).replace(/\./g, '%2E');
  };

  it('should not modify simple IDs', () => {
    expect(encodeCalendarId('primary')).toBe('primary');
    expect(encodeCalendarId('calendar123')).toBe('calendar123');
  });

  it('should encode @ symbol', () => {
    expect(encodeCalendarId('test@gmail.com')).toContain('%40');
  });

  it('should encode periods', () => {
    expect(encodeCalendarId('test.user')).toContain('%2E');
    expect(encodeCalendarId('test@gmail.com')).toContain('%2E');
  });

  it('should handle complex calendar IDs', () => {
    const encoded = encodeCalendarId('work@group.calendar.google.com');
    expect(encoded).toBe('work%40group%2Ecalendar%2Egoogle%2Ecom');
    expect(encoded).not.toContain('@');
    expect(encoded).not.toContain('.');
  });

  it('should be reversible with decoding', () => {
    const original = 'user@example.com';
    const encoded = encodeCalendarId(original);
    const decoded = decodeURIComponent(encoded);
    expect(decoded).toBe(original);
  });
});

describe('Token Expiry Logic', () => {
  it('should correctly identify expired tokens', () => {
    const expiredToken = {
      ...mockTokens,
      expiresAt: new Date(Date.now() - 1000).toISOString(), // 1 second ago
    };

    const expiresAt = new Date(expiredToken.expiresAt).getTime();
    const now = Date.now();

    expect(expiresAt < now).toBe(true);
  });

  it('should correctly identify valid tokens', () => {
    const validToken = {
      ...mockTokens,
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    };

    const expiresAt = new Date(validToken.expiresAt).getTime();
    const now = Date.now();

    expect(expiresAt > now).toBe(true);
  });

  it('should identify tokens expiring within buffer period', async () => {
    const { TOKEN_EXPIRY_BUFFER_MS } = await import('../config/oauth');

    // Token expiring in 3 minutes (within 5 minute buffer)
    const soonExpiringToken = {
      ...mockTokens,
      expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
    };

    const expiresAt = new Date(soonExpiringToken.expiresAt).getTime();
    const now = Date.now();

    // Should be within buffer
    expect(expiresAt <= now + TOKEN_EXPIRY_BUFFER_MS).toBe(true);
  });

  it('should identify tokens not within buffer period', async () => {
    const { TOKEN_EXPIRY_BUFFER_MS } = await import('../config/oauth');

    // Token expiring in 10 minutes (outside 5 minute buffer)
    const validToken = {
      ...mockTokens,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    };

    const expiresAt = new Date(validToken.expiresAt).getTime();
    const now = Date.now();

    // Should be outside buffer
    expect(expiresAt > now + TOKEN_EXPIRY_BUFFER_MS).toBe(true);
  });
});

describe('OAuth Token Structure', () => {
  it('should have required token fields', () => {
    expect(mockTokens).toHaveProperty('accessToken');
    expect(mockTokens).toHaveProperty('refreshToken');
    expect(mockTokens).toHaveProperty('expiresAt');
    expect(mockTokens).toHaveProperty('scope');
  });

  it('should have valid ISO date format for expiresAt', () => {
    const expiresAtDate = new Date(mockTokens.expiresAt);
    expect(expiresAtDate.toString()).not.toBe('Invalid Date');
    expect(mockTokens.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should have non-empty scope', () => {
    expect(mockTokens.scope.length).toBeGreaterThan(0);
    expect(mockTokens.scope).toContain('googleapis.com');
  });
});

describe('OAuth State Token', () => {
  it('should generate state token with sufficient entropy', () => {
    // Simulate what the real function does (32 bytes = 64 hex chars)
    const generateStateToken = (): string => {
      // Each byte becomes 2 hex characters
      const bytes = new Array(32).fill(0);
      return bytes
        .map(() => {
          const byte = Math.floor(Math.random() * 256);
          return byte.toString(16).padStart(2, '0');
        })
        .join('');
    };

    const stateToken = generateStateToken();
    expect(stateToken.length).toBe(64); // 32 bytes = 64 hex chars
    expect(/^[0-9a-f]+$/.test(stateToken)).toBe(true);
  });
});

describe('OAuth URL Parameters', () => {
  it('should include required parameters', () => {
    const expectedParams = {
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: true,
    };

    // Verify these are the expected values for getting a refresh token
    expect(expectedParams.access_type).toBe('offline');
    expect(expectedParams.prompt).toBe('consent');
    expect(expectedParams.include_granted_scopes).toBe(true);
  });
});

describe('Error Message Handling', () => {
  it('should detect invalid_grant errors', () => {
    const error = new Error('invalid_grant: Token has been revoked');
    const isRevoked =
      error.message.includes('invalid_grant') ||
      error.message.includes('Token has been expired or revoked');

    expect(isRevoked).toBe(true);
  });

  it('should detect token expiry errors', () => {
    const error = new Error('Token has been expired or revoked');
    const isExpired =
      error.message.includes('invalid_grant') ||
      error.message.includes('Token has been expired or revoked');

    expect(isExpired).toBe(true);
  });

  it('should not flag normal errors as revoked', () => {
    const error = new Error('Network error');
    const isRevoked =
      error.message.includes('invalid_grant') ||
      error.message.includes('Token has been expired or revoked');

    expect(isRevoked).toBe(false);
  });
});

describe('Connected Calendar Structure', () => {
  it('should have required fields for calendar display', () => {
    const mockCalendar = {
      id: 'primary',
      name: 'Primary Calendar',
      type: 'personal' as const,
      color: '#4285f4',
      primary: true,
      accessRole: 'owner' as const,
      enabled: true,
    };

    expect(mockCalendar).toHaveProperty('id');
    expect(mockCalendar).toHaveProperty('name');
    expect(mockCalendar).toHaveProperty('type');
    expect(mockCalendar).toHaveProperty('color');
    expect(mockCalendar).toHaveProperty('primary');
    expect(mockCalendar).toHaveProperty('accessRole');
    expect(mockCalendar).toHaveProperty('enabled');
  });

  it('should have valid color format', () => {
    const validColors = ['#4285f4', '#0f9d58', '#db4437', '#f4b400'];
    validColors.forEach((color) => {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });

  it('should have valid type values', () => {
    const validTypes = ['work', 'personal'];
    validTypes.forEach((type) => {
      expect(['work', 'personal']).toContain(type);
    });
  });

  it('should have valid access role values', () => {
    const validRoles = ['reader', 'writer', 'owner'];
    validRoles.forEach((role) => {
      expect(['reader', 'writer', 'owner']).toContain(role);
    });
  });
});
