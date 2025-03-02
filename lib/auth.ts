import axios from 'axios';
import prisma from './prisma';

/**
 * Refreshes an OAuth access token using the provided refresh token
 * @param refreshToken The refresh token to use
 * @returns The new access token if successful, null otherwise
 */
export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    // Get the Google OAuth credentials from environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Missing Google OAuth credentials in environment variables');
      return null;
    }

    // Make a request to the Google OAuth token endpoint
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      {
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { access_token, expires_in } = response.data;

    if (!access_token) {
      console.error('Failed to refresh token: No access token returned');
      return null;
    }

    // Calculate the expiry timestamp
    const expiresAt = Math.floor(Date.now() / 1000 + expires_in);

    // Update the token in the database
    await prisma.account.updateMany({
      where: {
        refresh_token: refreshToken,
      },
      data: {
        access_token,
        expires_at: expiresAt,
      },
    });

    return access_token;
  } catch (error) {
    console.error('Error refreshing access token:', error);
    return null;
  }
} 