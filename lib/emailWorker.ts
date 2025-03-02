import prisma from './prisma';
import axios from 'axios';
import { refreshAccessToken } from './auth';

export async function syncEmails(accessToken: string, userId: number) {
  try {
    console.log(`Starting email sync for user ${userId}`);
    
    // Try to get a fresh token from the database
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: 'google',
      }
    });

    if (!account) {
      console.error(`No Google account found for user ${userId}`);
      throw new Error('No Google account found');
    }

    console.log(`Found account for user ${userId}, provider: ${account.provider}`);
    console.log(`Has refresh token: ${!!account.refresh_token}`);
    console.log(`Has access token: ${!!account.access_token}`);
    console.log(`Token expires at: ${account.expires_at ? new Date(account.expires_at * 1000).toISOString() : 'unknown'}`);

    // Use the fresh token from the database if available, or try to refresh it
    let token = accessToken;
    let tokenSource = 'original';

    // Check if token might be expired
    const now = Math.floor(Date.now() / 1000);
    const tokenExpiry = account.expires_at || 0;
    const isExpired = tokenExpiry < now;
    
    console.log(`Current time: ${now}, token expiry: ${tokenExpiry}, is expired: ${isExpired}`);

    if (isExpired && account.refresh_token) {
      console.log('Token is expired, attempting to refresh');
      // Try to refresh the token
      const refreshedToken = await refreshAccessToken(account.refresh_token);
      if (refreshedToken) {
        console.log('Successfully refreshed token');
        token = refreshedToken;
        tokenSource = 'refreshed';
      } else {
        console.log('Failed to refresh token, falling back to database token');
        // If refresh fails, try to use the most recent token from the database
        if (account.access_token) {
          token = account.access_token;
          tokenSource = 'database';
        }
      }
    } else if (account.access_token) {
      // Use the most recent token from the database if it's not expired
      console.log('Using most recent token from database');
      token = account.access_token;
      tokenSource = 'database';
    }

    console.log(`Using token from source: ${tokenSource}`);
    console.log(`Token starts with: ${token.substring(0, 5)}...`);

    const lastEmail = await prisma.email.findFirst({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    const after = lastEmail 
      ? new Date(lastEmail.date.getTime() + 1000).toISOString() 
      : new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15 minutes ago if no emails

    console.log(`Fetching emails after: ${after}`);

    try {
      const response = await axios.get("https://gmail.googleapis.com/gmail/v1/users/me/messages", {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          q: `after:${after}`,
          maxResults: 50
        }
      });

      console.log(`Gmail API response status: ${response.status}`);
      
      const messages = response.data.messages || [];
      console.log(`Found ${messages.length} messages`);
      
      if (messages.length === 0) return { newEmails: 0 };

      // Fetch full message details
      console.log('Fetching message details');
      const detailedMessages = await Promise.all(messages.map(async (msg) => {
        try {
          const detailResponse = await axios.get(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
            {
              headers: { Authorization: `Bearer ${token}` },
              params: { format: "full" }
            }
          );
          return detailResponse.data;
        } catch (detailError) {
          console.error(`Error fetching details for message ${msg.id}:`, detailError);
          return null;
        }
      }));

      // Filter out any null messages (failed fetches)
      const validMessages = detailedMessages.filter(msg => msg !== null);
      console.log(`Successfully fetched details for ${validMessages.length} out of ${messages.length} messages`);

      // Process messages by thread
      const threadMap = new Map();
      validMessages.forEach(msg => {
        if (!threadMap.has(msg.threadId)) {
          threadMap.set(msg.threadId, []);
        }
        threadMap.get(msg.threadId).push(msg);
      });

      console.log(`Processing ${threadMap.size} email threads`);

      // Update database in transaction
      await prisma.$transaction(async (tx) => {
        for (const [threadId, messages] of threadMap.entries()) {
          // Upsert thread
          const subject = messages[0].payload.headers.find(h => h.name === "Subject")?.value || '';
          const lastEmailAt = new Date(Math.max(...messages.map(m => parseInt(m.internalDate))));
          
          await tx.emailThread.upsert({
            where: { threadId },
            create: {
              threadId,
              userId,
              subject,
              lastEmailAt
            },
            update: {
              subject,
              lastEmailAt
            }
          });

          // Create emails
          for (const msg of messages) {
            await tx.email.create({
              data: {
                messageId: msg.id,
                userId,
                threadId: msg.threadId,
                snippet: msg.snippet || '',
                subject: msg.payload.headers.find(h => h.name === "Subject")?.value || '',
                from: msg.payload.headers.find(h => h.name === "From")?.value || '',
                to: msg.payload.headers.find(h => h.name === "To")?.value || '',
                date: new Date(parseInt(msg.internalDate)),
                labels: msg.labelIds || []
              }
            });
          }
        }
      });

      console.log(`Email sync completed successfully for user ${userId}`);
      return { newEmails: validMessages.length };
    } catch (apiError) {
      console.error('Gmail API error:');
      if (axios.isAxiosError(apiError)) {
        console.error(`Status: ${apiError.response?.status}`);
        console.error(`Error data: ${JSON.stringify(apiError.response?.data)}`);
        console.error(`Headers: ${JSON.stringify(apiError.response?.headers)}`);
        
        // If we get a 401 error, the token is invalid
        if (apiError.response?.status === 401) {
          console.error('Token is invalid, marking as expired in database');
          
          // Mark the token as expired in the database
          try {
            await prisma.account.update({
              where: { id: account.id },
              data: { expires_at: Math.floor(Date.now() / 1000) - 3600 } // Set to 1 hour ago
            });
          } catch (dbError) {
            console.error('Error updating token expiry:', dbError);
          }
        }
      } else {
        console.error(apiError);
      }
      throw apiError;
    }
  } catch (error) {
    console.error("Error syncing emails:", error);
    throw error;
  }
}
