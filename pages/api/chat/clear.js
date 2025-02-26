// pages/api/chat/clear.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/authOptions";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Delete all chat messages but leave other tables intact
    await prisma.chatMessage.deleteMany({});

    res.status(200).json({ 
      message: "All chat messages deleted"
    });

  } catch (error) {
    console.error("Error deleting chat messages:", error);
    res.status(500).json({ 
      error: "Failed to delete messages",
      details: error.message 
    });
  }
}