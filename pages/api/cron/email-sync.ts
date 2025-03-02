import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { syncEmails } from '../../../lib/emailWorker';
import { getSession } from 'next-auth/react';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Email sync API called');
  
  // Check if this is a cron job request or a client request
  const isCronRequest = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  console.log(`Request type: ${isCronRequest ? 'cron' : 'client'}`);
  
  // For client requests, verify the user is authenticated
  let session;
  if (!isCronRequest) {
    session = await getSession({ req });
    if (!session) {
      console.log('Unauthorized client request - no session');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    console.log(`Authenticated user: ${session.user.email}`);
  }

  try {
    // For cron job, sync all users
    if (isCronRequest) {
      console.log('Processing cron job request');
      
      // Get all users with valid Google accounts
      const users = await prisma.account.findMany({
        where: {
          provider: 'google',
          access_token: { not: null }
        },
        include: {
          user: true
        }
      });

      console.log(`Found ${users.length} Google accounts to sync`);
      
      if (users.length === 0) {
        return res.status(200).json({ 
          message: 'No users to sync',
          newEmails: 0
        });
      }

      // Sync emails for each user
      console.log('Starting batch email sync');
      const results = await Promise.allSettled(
        users.map(account => 
          syncEmails(account.access_token!, account.user.id)
        )
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      // Count total new emails
      const totalNewEmails = results
        .filter(r => r.status === 'fulfilled')
        .reduce((sum, r) => {
          const result = (r as PromiseFulfilledResult<any>).value;
          return sum + (result && typeof result === 'object' && 'newEmails' in result ? result.newEmails : 0);
        }, 0);

      // Log any failures
      results
        .filter(r => r.status === 'rejected')
        .forEach((r, i) => {
          const error = (r as PromiseRejectedResult).reason;
          console.error(`Error syncing emails for user ${i}:`, error);
        });

      console.log(`Batch sync complete: ${succeeded} succeeded, ${failed} failed, ${totalNewEmails} new emails`);
      
      return res.status(200).json({ 
        message: `Synced emails for ${succeeded} users, ${failed} failed`,
        newEmails: totalNewEmails
      });
    } 
    // For client requests, only sync the current user's emails
    else {
      console.log('Processing client request');
      
      const userEmail = session!.user.email;
      console.log(`Looking up user with email: ${userEmail}`);
      
      const user = await prisma.user.findUnique({ 
        where: { email: userEmail } 
      });
      
      if (!user) {
        console.log('User not found in database');
        return res.status(404).json({ error: 'User not found' });
      }

      console.log(`Found user with ID: ${user.id}`);

      // Get the user's Google account
      const account = await prisma.account.findFirst({
        where: {
          userId: user.id,
          provider: 'google',
          access_token: { not: null }
        }
      });

      if (!account) {
        console.log('Google account not found or not connected');
        return res.status(404).json({ error: 'Google account not found or not connected' });
      }

      console.log(`Found Google account for user, access token exists: ${!!account.access_token}`);
      console.log(`Access token starts with: ${account.access_token?.substring(0, 5)}...`);
      console.log(`Refresh token exists: ${!!account.refresh_token}`);

      // Check if we have a refresh token
      if (!account.refresh_token) {
        console.log('No refresh token found for user, marking token as expired');
        
        // Mark the token as expired to force re-auth on next login
        try {
          await prisma.account.update({
            where: { id: account.id },
            data: { expires_at: Math.floor(Date.now() / 1000) - 3600 } // Set to 1 hour ago
          });
          
          return res.status(401).json({ 
            error: 'No refresh token available. User needs to re-authenticate.',
            needsReauth: true
          });
        } catch (dbError) {
          console.error('Error updating token expiry:', dbError);
        }
      }

      // Sync just this user's emails
      try {
        console.log('Starting email sync for user');
        const result = await syncEmails(account.access_token, user.id);
        console.log('Email sync completed successfully');
        
        return res.status(200).json({ 
          message: 'Email sync completed successfully',
          timestamp: Date.now(),
          newEmails: result && typeof result === 'object' && 'newEmails' in result ? result.newEmails : 0
        });
      } catch (syncError) {
        console.error('Error syncing emails for user:', syncError);
        return res.status(500).json({ error: 'Failed to sync emails for user' });
      }
    }
  } catch (error) {
    console.error('Email sync failed:', error);
    res.status(500).json({ error: 'Failed to sync emails' });
  }
}
