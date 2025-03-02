import prisma from '../../../lib/prisma';
import { getSession } from 'next-auth/react';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if this is an admin request with the correct secret
  const isAdminRequest = req.headers.authorization === `Bearer ${process.env.ADMIN_SECRET}`;
  
  if (!isAdminRequest) {
    // Check if the user is authenticated and has admin privileges
    const session = await getSession({ req });
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Here you could check if the user has admin privileges
    // For now, we'll just check if they're authenticated
  }

  try {
    // Mark all Google tokens as expired
    const result = await prisma.account.updateMany({
      where: {
        provider: 'google',
      },
      data: {
        expires_at: Math.floor(Date.now() / 1000) - 3600, // Set to 1 hour ago
      },
    });

    console.log(`Reset tokens for ${result.count} accounts`);
    
    return res.status(200).json({ 
      message: `Reset tokens for ${result.count} accounts. Users will need to re-authenticate.` 
    });
  } catch (error) {
    console.error('Error resetting tokens:', error);
    return res.status(500).json({ error: 'Failed to reset tokens' });
  }
} 