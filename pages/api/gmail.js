// pages/api/gmail.js
import { getSession } from "next-auth/react";
import axios from "axios";

export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session || !session.accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const accessToken = session.accessToken;
  
  try {
    // Calculate date 15 days ago in ISO format
    const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
    
    // Fetch list of messages (up to 300) from the last 15 days
    const listResponse = await axios.get("https://gmail.googleapis.com/gmail/v1/users/me/messages", {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: {
        q: `after:${fifteenDaysAgo}`,
        maxResults: 300
      }
    });
    
    const messages = listResponse.data.messages || [];
    // Fetch details for each message concurrently
    const detailedMessages = await Promise.all(messages.map(async (msg) => {
      const detailResponse = await axios.get(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { format: "full" } // full format includes headers and body snippet
      });
      return detailResponse.data;
    }));
    
    // Return the fetched email details
    res.status(200).json({ emails: detailedMessages });
  } catch (error) {
    console.error("Error fetching Gmail messages:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to fetch emails" });
  }
}
