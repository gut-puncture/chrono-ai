import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { syncEmails } from '@/lib/emailWorker';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify the request is from Vercel Cron
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
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

    res.status(200).json({ 
      message: `Synced emails for ${succeeded} users, ${failed} failed` 
    });
  } catch (error) {
    console.error('Cron job failed:', error);
    res.status(500).json({ error: 'Failed to sync emails' });
  }
}
