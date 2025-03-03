import { getSession } from "next-auth/react";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the user's session
    const session = await getSession({ req });
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`Revoking Google connection for user: ${session.user.email}`);

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete the Google account connection
    const result = await prisma.account.deleteMany({
      where: {
        userId: user.id,
        provider: 'google'
      }
    });

    console.log(`Deleted ${result.count} Google account connections`);

    return res.status(200).json({ 
      message: 'Google connection revoked. Please sign in again to reconnect.',
      success: true
    });
  } catch (error) {
    console.error('Error revoking Google connection:', error);
    return res.status(500).json({ error: 'Failed to revoke Google connection' });
  }
} 