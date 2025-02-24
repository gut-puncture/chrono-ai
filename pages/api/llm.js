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
    // Filter out null or undefined items from the context array
    const cleanedContext = Array.isArray(context) ? context.filter(Boolean) : [];

    // Initialize the Generative AI client
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // If you don't have access to Gemini, switch to "chat-bison-001"
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    // const model = genAI.getGenerativeModel({ model: "chat-bison-001" });

    // Build prompt
    let prompt = "";
    if (cleanedContext.length > 0) {
      prompt += `Previous conversation (most recent ${cleanedContext.length} messages):\n`;
      cleanedContext.forEach((msg, index) => {
        prompt += `Message ${index + 1}: ${msg}\n`;
      });
      prompt += "\n";
    }

    prompt += `User: ${message}\n\n`;

    // Updated instructions:
    //   - We require two main fields: "acknowledgment" and "question".
    //   - "question" can be empty if there's no question to ask the user.
    //   - We also keep "tasks", "tags", etc. if you want them.
    prompt += `Instructions: 
1. Provide an "acknowledgment" string that the user will see.
2. If you have a clarifying question for the user, put it in "question" (string). Otherwise set "question" to "".
3. If there are tasks to create, return them in a "tasks" array (each task is an object with "title", "dueDate", and "priority").
4. You may include a "tags" object if needed.
5. Also return "scopeChange" (boolean) and "scopeDemarcation" (string) if needed.
6. The final JSON must have keys: "acknowledgment", "question", "tasks", "tags", "scopeChange", "scopeDemarcation".
7. Do not use triple backticks or code fences. Return only valid JSON. 
`;

    // Log the prompt in Vercel logs for debugging
    console.log("Final prompt to LLM:\n", prompt);

    // Call the model
    const result = await model.generateContent(prompt);

    // Check raw result
    console.log("Raw LLM result object:", result);

    let responseText = await result.response.text();
    console.log("Raw response text from LLM:", responseText);

    // Remove any triple-backtick fenced code blocks
    responseText = responseText.replace(/```[\s\S]*?```/g, "");

    // Attempt to parse as JSON
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseText);

      // Ensure all required keys are present, or fill defaults
      jsonResponse = {
        acknowledgment: jsonResponse.acknowledgment || "",
        question: jsonResponse.question || "",
        tasks: Array.isArray(jsonResponse.tasks) ? jsonResponse.tasks : [],
        tags: typeof jsonResponse.tags === "object" ? jsonResponse.tags : {},
        scopeChange: !!jsonResponse.scopeChange,
        scopeDemarcation: jsonResponse.scopeDemarcation || ""
      };
    } catch (e) {
      // If parse fails, fallback
      console.error("JSON parse error:", e);
      jsonResponse = {
        acknowledgment: responseText,
        question: "",
        tasks: [],
        tags: {},
        scopeChange: false,
        scopeDemarcation: ""
      };
    }

    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error("Error processing LLM request:", error);
    return res.status(500).json({ error: "LLM processing failed" });
  }
}
