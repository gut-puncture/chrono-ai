import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { syncEmails } from '../../../lib/emailWorker';
import { getSession } from 'next-auth/react';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Check if this is a cron job request or a client request
  const isCronRequest = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  
  // For client requests, verify the user is authenticated
  let session;
  if (!isCronRequest) {
    session = await getSession({ req });
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  try {
    // For cron job, sync all users
    if (isCronRequest) {
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

      // Sync emails for each user
      const results = await Promise.allSettled(
        users.map(account => 
          syncEmails(account.access_token!, account.user.id)
        )
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      return res.status(200).json({ 
        message: `Synced emails for ${succeeded} users, ${failed} failed` 
      });
    } 
    // For client requests, only sync the current user's emails
    else {
      const userEmail = session.user.email;
      const user = await prisma.user.findUnique({ 
        where: { email: userEmail } 
      });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get the user's Google account
      const account = await prisma.account.findFirst({
        where: {
          userId: user.id,
          provider: 'google',
          access_token: { not: null }
        }
      });

      if (!account) {
        return res.status(404).json({ error: 'Google account not found or not connected' });
      }

      // Sync just this user's emails
      try {
        const result = await syncEmails(account.access_token, user.id);
        return res.status(200).json({ 
          message: 'Email sync completed successfully',
          timestamp: Date.now(),
          newEmails: typeof result === 'object' && result.newEmails ? result.newEmails : 0
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
