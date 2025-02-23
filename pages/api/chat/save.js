// pages/api/chat/save.js
import prisma from "../../../lib/prisma";
import { getSession } from "next-auth/react";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getSession({ req });
    if (!session) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userEmail = session.user.email;
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { messageText, role, llmResponse, tags } = req.body;
    if (!messageText || !role) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await prisma.chatMessage.create({
      data: {
        userId: user.id,
        messageText,
        llmResponse: llmResponse || null,
        scopeId: null,
        tags: tags || {}
      }
    });

    res.status(200).json({ message: "Message saved" });
  } catch (error) {
    console.error("Error saving chat message:", error.message);
    res.status(500).json({ error: "Failed to save message" });
  }
}
