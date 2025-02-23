// pages/api/llm.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  
  const { message, context } = req.body; // 'context' is an array of previous message texts
  
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }
  
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Build prompt with extended instructions:
    let prompt = "";
    if (context && Array.isArray(context) && context.length > 0) {
      prompt += "Previous conversation (most recent 10-15 messages):\n";
      context.forEach((msg, index) => {
        prompt += `Message ${index + 1}: ${msg}\n`;
      });
      prompt += "\n";
    }
    prompt += "User: " + message + "\n\n";
    prompt += "Instructions: " +
      "1. Acknowledge the user’s message succinctly. " +
      "2. Extract any actionable tasks from the message and list them as an array (each task with a title, inferred due date if any, and priority). " +
      "3. Identify if the message contains ambiguous references (e.g., unclear project or meeting context) and generate clarifying questions if needed. " +
      "4. Detect if there is a scope change in the conversation; if so, return a boolean 'scopeChange' as true and a 'scopeDemarcation' string that indicates the boundary (e.g. the message ID that needs retroactive tagging update). " +
      "5. Do not include internal tags or scope demarcation details in the user-facing acknowledgment. " +
      "6. Return a JSON object with keys: acknowledgment (string), tasks (array), clarifications (array), tags (object), scopeChange (boolean), scopeDemarcation (string). " +
      "7. If additional context is provided later, indicate which message IDs need retroactive tag updates (this may be part of the scopeDemarcation info)." +
      "8. Please return valid JSON without triple backticks or code fences.";
    
    // Send prompt to Gemini API
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Attempt to parse the response as JSON
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseText);
      // Ensure all required keys are present (fill defaults if missing)
      jsonResponse = {
        acknowledgment: jsonResponse.acknowledgment || "",
        tasks: Array.isArray(jsonResponse.tasks) ? jsonResponse.tasks : [],
        clarifications: Array.isArray(jsonResponse.clarifications) ? jsonResponse.clarifications : [],
        tags: typeof jsonResponse.tags === "object" ? jsonResponse.tags : {},
        scopeChange: !!jsonResponse.scopeChange,
        scopeDemarcation: jsonResponse.scopeDemarcation || ""
      };
    } catch (e) {
      // If parsing fails, fallback to plain acknowledgment and empty values
      jsonResponse = {
        acknowledgment: responseText,
        tasks: [],
        clarifications: [],
        tags: {},
        scopeChange: false,
        scopeDemarcation: ""
      };
    }
    
    res.status(200).json(jsonResponse);
  } catch (error) {
    console.error("Error processing LLM request:", error.message);
    res.status(500).json({ error: "LLM processing failed" });
  }
}
