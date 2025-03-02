// pages/api/gmail.js
import { getSession } from "next-auth/react";
import { syncEmails } from '../../lib/emailWorker';

export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session || !session.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Do initial sync when user first connects
    await syncEmails(session.accessToken, session.user.id);
    res.status(200).json({ message: "Initial email sync complete" });
  } catch (error) {
    console.error("Error in Gmail handler:", error);
    res.status(500).json({ error: "Failed to sync emails" });
  }
}
