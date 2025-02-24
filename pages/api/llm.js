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
    // 1) Filter out null or undefined items from the context array
    const cleanedContext = Array.isArray(context) ? context.filter(Boolean) : [];

    // 2) Initialize the Generative AI client
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // If you don't have access to Gemini, switch to "chat-bison-001"
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    // const model = genAI.getGenerativeModel({ model: "chat-bison-001" });

    // 3) Build the prompt with conversation context
    let prompt = "";
    if (cleanedContext.length > 0) {
      prompt += `Previous conversation (most recent ${cleanedContext.length} messages):\n`;
      cleanedContext.forEach((msg, index) => {
        prompt += `Message ${index + 1}: ${msg}\n`;
      });
      prompt += "\n";
    }

    prompt += `User: ${message}\n\n`;

    // 4) Refined instructions for an exact JSON structure
    prompt += `Instructions:
You must output valid JSON with exactly these keys:
{
  "acknowledgment": string,
  "question": string,
  "tasks": array,
  "tags": object,
  "scopeChange": boolean,
  "scopeDemarcation": string
}

Details for each key:
1. "acknowledgment": A short user-facing message summarizing your response.
2. "question": If you have a clarifying question for the user, put it here; otherwise "".
3. "tasks": An array of objects. Each object can have:
   - "title": string
   - "dueDate": string or null
   - "priority": string (e.g., "low", "medium", "high")
4. "tags": An object for any metadata or an empty object if not needed.
5. "scopeChange": A boolean (true or false).
6. "scopeDemarcation": A string (could be "" if not applicable).

Do not add any extra keys or text. Return only the JSON object.
Do not wrap the JSON in triple backticks or code fences.
`;

    // Log the final prompt for debugging
    console.log("Final prompt to LLM:\n", prompt);

    // 5) Call the model
    const result = await model.generateContent(prompt);

    // Log raw result
    console.log("Raw LLM result object:", result);

    // 6) Extract the text from the LLM response
    let responseText = await result.response.text();
    console.log("Raw response text from LLM:", responseText);

    // Remove only literal backticks, preserving the JSON content
    responseText = responseText.replace(/```/g, "");

    // 7) Attempt to parse the response as JSON
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
      // If parse fails, fallback to showing raw text in "acknowledgment"
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

    // 8) Return the JSON response
    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error("Error processing LLM request:", error);
    return res.status(500).json({ error: "LLM processing failed" });
  }
}
