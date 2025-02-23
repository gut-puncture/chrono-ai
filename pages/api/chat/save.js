// pages/api/chat/save.js
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/authOptions";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userEmail = session.user.email;
    const user = await prisma.user.findUnique({ 
      where: { email: userEmail } 
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { messageText, role, llmResponse, tags } = req.body;

    if (!role) {
      return res.status(400).json({ 
        error: "Role is required (e.g., 'user' or 'llm')" 
      });
    }

    const savedMessage = await prisma.chatMessage.create({
      data: {
        userId: user.id,
        role,
        messageText: messageText || "",
        llmResponse: llmResponse || null,
        tags: tags || {}
      }
    });

    res.status(200).json({ 
      message: "Message saved",
      savedMessage 
    });

  } catch (error) {
    console.error("Error saving chat message:", error);
    res.status(500).json({ 
      error: "Failed to save message",
      details: error.message 
    });
  }
}
