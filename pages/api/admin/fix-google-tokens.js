import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if this is an admin request with the correct secret
  const isAdminRequest = req.headers.authorization === `Bearer ${process.env.ADMIN_SECRET}`;
  
  if (!isAdminRequest) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get all Google accounts
    const accounts = await prisma.account.findMany({
      where: {
        provider: 'google',
      },
      include: {
        user: true,
      },
    });
    
    console.log(`Found ${accounts.length} Google accounts`);
    
    const results = {
      total: accounts.length,
      withRefreshToken: 0,
      withoutRefreshToken: 0,
      deleted: 0,
      details: []
    };
    
    // Check each account
    for (const account of accounts) {
      const accountInfo = {
        userId: account.userId,
        email: account.user?.email || 'Unknown',
        hasAccessToken: !!account.access_token,
        hasRefreshToken: !!account.refresh_token,
        expiresAt: account.expires_at ? new Date(account.expires_at * 1000).toISOString() : 'Not set',
        action: 'none'
      };
      
      if (account.refresh_token) {
        results.withRefreshToken++;
      } else {
        results.withoutRefreshToken++;
        
        // If requested, delete accounts without refresh tokens
        if (req.body.deleteWithoutRefreshToken) {
          await prisma.account.delete({
            where: {
              id: account.id,
            },
          });
          
          accountInfo.action = 'deleted';
          results.deleted++;
        } else {
          // Mark the token as expired
          await prisma.account.update({
            where: {
              id: account.id,
            },
            data: {
              expires_at: Math.floor(Date.now() / 1000) - 3600, // Set to 1 hour ago
            },
          });
          
          accountInfo.action = 'marked-expired';
        }
      }
      
      results.details.push(accountInfo);
    }
    
    return res.status(200).json(results);
  } catch (error) {
    console.error('Error fixing Google tokens:', error);
    return res.status(500).json({ error: 'Failed to fix Google tokens' });
  }
} 