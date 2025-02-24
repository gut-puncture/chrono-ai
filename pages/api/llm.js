// pages/api/llm.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, context } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    // 1) Filter out null/undefined items from context
    const cleanedContext = Array.isArray(context) ? context.filter(Boolean) : [];

    // 2) Initialize the Generative AI client
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // If you don't have Gemini access, swap to "chat-bison-001"
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    // const model = genAI.getGenerativeModel({ model: "chat-bison-001" });

    // 3) Build prompt
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
3. "tasks": An array of objects. Each task object can have:
   - "title": string (required)
   - "description": string (optional)
   - "due_date" or "dueDate" or "inferred_due_date": string (optional, ISO format date)
   - "priority": string (e.g., "low", "medium", "high")
4. "tags": An object for any metadata or an empty object if not needed.
5. "scopeChange": A boolean (true or false).
6. "scopeDemarcation": A string (could be "" if not applicable).

Do not add any extra keys or text. Return only the JSON object.
Do not wrap the JSON in triple backticks or code fences.
`;

    console.log("Final prompt to LLM:\n", prompt);

    // 5) Call the model
    const result = await model.generateContent(prompt);
    console.log("Raw LLM result object:", result);

    // 6) Get raw text
    let responseText = await result.response.text();
    console.log("Raw response text from LLM:", responseText);

    // 7) Remove triple backticks and any language spec like "```json"
    //    This handles cases where the model still wraps the JSON.
    responseText = responseText.replace(/```[a-zA-Z]*\n?/g, ""); // remove ```json or ```js, etc.
    responseText = responseText.replace(/```/g, "");            // remove any remaining triple backticks

    // 8) Parse the JSON
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseText);
      // Ensure all required keys are present
      jsonResponse = {
        acknowledgment: jsonResponse.acknowledgment || "",
        question: jsonResponse.question || "",
        tasks: Array.isArray(jsonResponse.tasks) ? jsonResponse.tasks.map(task => {
          // Ensure each task has a title
          if (!task.title || typeof task.title !== 'string') {
            console.warn("Task missing title or title not a string:", task);
            task.title = "New Task";
          }
          
          console.log("Task from LLM:", task);
          return task;
        }) : [],
        tags: typeof jsonResponse.tags === "object" ? jsonResponse.tags : {},
        scopeChange: !!jsonResponse.scopeChange,
        scopeDemarcation: jsonResponse.scopeDemarcation || ""
      };
    } catch (e) {
      console.error("JSON parse error:", e);
      // If parsing fails, put the raw text in acknowledgment so user sees something
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
