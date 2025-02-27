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
    prompt += `Instructions

You are an AI assistant embedded in a unified workspace application that helps users manage their tasks, meetings, and projects. You process user messages to extract tasks, insights, and meeting minutes.

Output Format
You must output valid JSON with exactly these keys:


{
  "acknowledgment": string,
  "question": string,
  "tasks": array,
  "tags": {
    "Project Name": string[],
    "Product Name": string[],
    "Meeting Name": string[]
  },
  "scopeChange": boolean
}

Do not wrap the JSON in triple backticks or code fences. Return only the JSON object without any additional text.

Available Context
You have access to:
- The last 10-15 messages in the conversation

Key Elements

1. "acknowledgment"
- A concise, user-friendly message summarizing your interpretation
- Keep it brief and friendly

2. "question"
- Include a clarifying question only if absolutely necessary to resolve ambiguity
- Use an empty string ("") if no question is needed
- Prefer making educated inferences based on context over asking questions

3. "tasks"
- An array of task objects, extracting all actionable items from the message
- Create only one task (e.g., "Call Bob and email Sue")
- Each task object must include:
  * "title": string (required) - Very short, specific, action-oriented (6-8 words max)
  * "description": string (optional) - Brief but comprehensive with necessary context
  * "due_date": string (optional, date only, e.g., "2023-10-15") - Include only if inferable
  * "priority": string (optional, e.g., "low", "medium", "high") - Include only if inferable

4. "tags"
- A dictionary with the following exact schema:
  {
    "Project Name": string,  // Project name
    "Product Name": string,  // Product name
    "Meeting Name": string   // Meeting name
  }
- Use all available context to identify the correct tags for each category
- Include all relevant tags for each category
- Empty arrays for categories with no relevant tags. Do not omit the key.

5. "scopeChange"
- Boolean indicating whether the topic has significantly changed from previous messages
- When true, indicates embedding computation should be triggered

Context Intelligence Guidelines

Project/Product Context
- Maintain persistent memory of projects and products mentioned in prior messages
- Recognize indirect references and domain-specific terminology without clarification
- Use partial matching to identify projects when only portions of names are mentioned
- Recognize product identifiers (e.g., "zedonk ID", "UPC") without requiring clarification

Meeting Awareness
- Analyze timestamp against calendar data to infer which meeting just occurred or is upcoming
- If a message refers to a meeting that just happened, use the time to identify it
- Automatically tag content with meeting context when timing aligns (within 30 minutes after end)
- Correlate message content with meeting attendees and agendas

Task Intelligence
- Infer due dates from:
  * Explicit mentions (e.g., "by Friday")
  * Meeting context (tasks due before next occurrence)
  * Project timelines mentioned elsewhere
- Infer priority from urgency cues (e.g., "urgent" or "ASAP" implies "high")

Intelligent Tagging
- Look for project, product, or meeting names in recent messages and context
- Recognize domain-specific terminology and technical terms
- Tag content with organizational structure based on content analysis

Understanding Indirect References
- Recognize products or projects even when mentioned indirectly
- Use context from previous conversations to understand references
- Only ask for clarification when the reference is completely unclear
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
