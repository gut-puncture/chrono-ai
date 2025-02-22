// pages/api/llm.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  const { message, context } = req.body;  // 'context' is an array of previous messages
  
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }
  
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Build prompt: include context if available
    let prompt = "";
    if (context && Array.isArray(context) && context.length > 0) {
      prompt += "Previous conversation:\n";
      context.forEach((msg, index) => {
        prompt += `Message ${index + 1}: ${msg}\n`;
      });
      prompt += "\n";
    }
    prompt += "User: " + message + "\n\n";
    prompt += "Analyze the above conversation. Acknowledge the user's message, extract any actionable tasks, ask any clarifying questions if needed, and tag the message appropriately with project/meeting/product tags. Return a JSON response with the keys: acknowledgment, tasks (array), clarifications (array), tags (object), scopeChange (boolean), and scopeDemarcation (string if applicable).";
    
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Try to parse JSON; if it fails, return plain acknowledgment.
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseText);
    } catch (e) {
      jsonResponse = { acknowledgment: responseText };
    }
    
    res.status(200).json(jsonResponse);
  } catch (error) {
    console.error("Error processing LLM request:", error.message);
    res.status(500).json({ error: "LLM processing failed" });
  }
}
