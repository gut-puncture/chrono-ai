import axios from 'axios';
import prisma from './prisma';
import querystring from 'querystring';

/**
 * Refreshes an OAuth access token using the provided refresh token
 * @param refreshToken The refresh token to use
 * @returns The new access token if successful, null otherwise
 */
export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    console.log('Attempting to refresh token...');
    
    // Get the Google OAuth credentials from environment variables
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Missing Google OAuth credentials in environment variables');
      return null;
    }

    console.log('Refresh token being used:', refreshToken.substring(0, 5) + '...');

    // Make a request to the Google OAuth token endpoint
    const tokenData = querystring.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    console.log('Making request to Google OAuth token endpoint...');
    
    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      tokenData,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    console.log('Token refresh response status:', response.status);
    
    const { access_token, expires_in } = response.data;

    if (!access_token) {
      console.error('Failed to refresh token: No access token returned');
      console.error('Response data:', JSON.stringify(response.data));
      return null;
    }

    console.log('Successfully obtained new access token');
    console.log('New token starts with:', access_token.substring(0, 5) + '...');
    console.log('Token expires in:', expires_in, 'seconds');

    // Calculate the expiry timestamp
    const expiresAt = Math.floor(Date.now() / 1000 + expires_in);

    // Update the token in the database
    try {
      const updateResult = await prisma.account.updateMany({
        where: {
          refresh_token: refreshToken,
        },
        data: {
          access_token,
          expires_at: expiresAt,
        },
      });
      
      console.log('Database update result:', updateResult);
    } catch (dbError) {
      console.error('Error updating token in database:', dbError);
      // Still return the token even if DB update fails
    }

    return access_token;
  } catch (error) {
    console.error('Error refreshing access token:');
    if (axios.isAxiosError(error)) {
      console.error('Axios error status:', error.response?.status);
      console.error('Axios error data:', JSON.stringify(error.response?.data));
      console.error('Axios error config:', JSON.stringify({
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
      }));
    } else {
      console.error(error);
    }
    return null;
  }
} 