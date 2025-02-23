// pages/api/chat/save.js
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  const { messageText, role, llmResponse, tags } = req.body;
  
  if (!messageText || !role) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  try {
    // For simplicity, we assume the user is already authenticated
    // In a full implementation, you would get the user ID from the session
    const dummyUserId = 1; // TODO: Replace with actual session user ID
    await prisma.chatMessage.create({
      data: {
        userId: dummyUserId,
        messageText,
        llmResponse: llmResponse || null,
        // scopeId and tags can be updated later based on further context
        scopeId: null,
        tags: tags ? tags : {}
      }
    });
    res.status(200).json({ message: "Message saved" });
  } catch (error) {
    console.error("Error saving chat message:", error.message);
    res.status(500).json({ error: "Failed to save message" });
  }
}
