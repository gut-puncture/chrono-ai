# Product Requirements Document (PRD)

## 1. Overview

**Objective:**  
Build a unified web desktop app that aggregates Gmail, Google Calendar, and chat inputs into a structured, searchable workspace. The app’s core purpose is to collect emails, calendar events, and user inputs (notes, tasks, meeting minutes, insights, etc.), process them via an LLM, and display them in structured documents (by meeting and by organization—with breakdowns by product and project) along with a prioritized task list.

**Key Features (MVP Must-Haves):**  
- **Chat Interface:** Single-threaded text-only chat where every message is processed for potential task extraction, insights, or note-taking.  
- **Gmail Integration:** Import all emails (including spam) via OAuth with necessary scopes.  
- **Google Calendar Integration:** Import all events (including recurring events and exceptions) for at least the next 3–4 weeks.  
- **Contextual Search:** High-quality, text-based contextual search across chat messages and collated documents.  
- **Structured Collation:** Generate “Google Docs–style” collated documents (for meetings and organization) that users can open on demand from a sidebar.  
- **Task Management:** Extract actionable tasks from emails, calendar events, and chat messages into a table with inline editing and smart reordering.

**Nice-to-Have for Later:**  
- File upload support for DOCX, TXT, and code files (parsing text only).

---

## 2. User Interface & Experience

### Layout & Navigation
- **Side Navigation:**  
  - Contains the search bar and a list of collated documents.  
  - When a user selects a document from the sidebar (e.g., “By Meeting” or “By Organization”), it opens in a separate view while leaving the chat and task list visible.
- **Central Area:**  
  - Always displays the chat interface along with the task list.  
  - Chat and task list remain visible; collated documents appear only when explicitly opened.
- **Chat Input Area:**  
  - A prominent text entry section for user messages.  
  - The chat window is infinite, but only the last 10–15 messages are sent as context to the LLM (with historical context provided via collated documents).

### Chat Interface Details
- **Message Layout:**  
  - User messages appear on the right; LLM responses (acknowledgments and clarifying questions) appear on the left.  
  - The LLM should ask follow-up questions as needed to clarify context (e.g., “Which project is this for?” or “What is the scope of this task?”) and these questions must be derived from an exhaustive framework (see AI Framework below).
- **Processing:**  
  - Every message is automatically analyzed for task extraction, insights, meeting minutes, etc.
  - The system automatically determines if a message implies an actionable task, an insight, or simply a note.

### Task Management Interface
- **Task Table:**  
  - Displays columns: Task description, Detailed description, Due Date, Status (e.g., Yet to Begin, In Progress, Done), and a Numeric Priority.
  - **Editing:**  
    - Inline editing directly within the table (similar to Google Sheets or Notion tables).
    - When a user adjusts a task’s numeric priority (for example, changing a task’s priority from 6 to 9), the system automatically repositions that task:
      - The task originally at 9 becomes 10, 10 becomes 11, and so on—mimicking the “slide” behavior seen in intuitive to-do apps.
- **Refresh Control:**  
  - A single refresh button updates the task list, collated documents, and search results.
  - UI feedback includes a loading indicator, a playful message indicating that the refresh might take time due to free hosting, and a “last updated” timestamp.

### Design Guidelines
- **Material Design:**  
  - Follow Google’s Material Design principles using Angular with Angular Material (or a similar setup if using plain HTML).
  - Prioritize the quintessential Google look—clean, minimal, and responsive.
- **Loading & Error States:**  
  - Implement loading indicators (especially when collating data).
  - Display concise error messages when needed; given the MVP status, focus on core functionalities first.

---

## 3. Integration & Data Flow

### Gmail & Calendar Integration
- **Gmail:**  
  - Import all emails, including spam.
  - Use OAuth scopes as needed to ensure smooth integration.
- **Google Calendar:**  
  - Import all events (with agenda details, attendees, times, etc.) for the next 3–4 weeks.
  - **Recurring Events:**  
    - Store recurring events as a series with annotations.
    - Allow tracking of tasks that need to occur before a specific instance (e.g., “before next week’s recurring meeting”)—this may involve splitting or flagging a particular instance.
- **Sync Mechanism:**  
  - For the MVP, rely on a manual refresh button to trigger updates across emails, calendar events, and chat inputs.
  - Ensure the refresh action re-processes data and updates the task list, collated documents, and search index.

### Data Flow Summary
1. **Data Ingestion:**  
   - Emails and calendar events are pulled via OAuth.
   - Chat messages are stored as they’re entered.
2. **LLM Processing:**  
   - Each incoming chat message (and new email/calendar event) is immediately processed for:
     - Task extraction.
     - Insight categorization.
     - Note-taking.
   - Only the last 10–15 messages are sent as context to the LLM for efficiency, with older context being referenced from stored collated documents.
3. **Collation & Storage:**  
   - Processed information is stored with minimal yet strategic metadata (see next section).
   - Collated documents are generated dynamically (in a Google Docs–like style) and are accessible from the sidebar.

---

## 4. AI & Task Extraction Framework

### Core Requirements
- **Universal Processing:**  
  - Every chat message is analyzed automatically to determine if it contains:
    - An actionable task.
    - An insight or note.
    - Meeting minutes or related data.
- **Context & Clarification:**  
  - The LLM must ask follow-up questions to clarify:
    - Which project or meeting the message is related to.
    - The scope of a task (e.g., deadlines, priorities).
    - The relevant product or department if the message is ambiguous.
- **Exhaustive Framework:**  
  - **Step 1:** When a message is received, the LLM classifies it into categories (task, insight, note, meeting minute).
  - **Step 2:** If classified as a task:
    - Analyze textual cues for urgency (e.g., “urgent,” “ASAP,” specific dates).
    - Determine end dates:
      - Directly if mentioned (e.g., “due by tomorrow”).
      - By association (e.g., “before next meeting” uses the next calendar event).
    - Assign a numeric priority:
      - Higher priority for urgent items.
      - Use relative scaling based on deadlines and importance.
  - **Step 3:** If context is ambiguous (e.g., missing project or product tags):
    - The LLM generates a clarifying question (e.g., “Is this task related to Project X or Product Y?”).
    - For the MVP, the system will not wait for a user answer but will store the task with blank fields for later manual edit.
  - **Step 4:** Integration with metadata:
    - Each task and note is tagged with minimal metadata (timestamp, source type, and fundamental tags—see Metadata section below).
  - **Step 5:** Immediate processing for chunking and embedding:
    - After every message, text is chunked into topic-specific sections.
    - Each chunk is embedded immediately so that the vector search (hosted in Elasticsearch) is up-to-date.

### Clarifying Questions Protocol
- The LLM must follow a concise set of questions tailored to the content type:
  - **For Tasks:**  
    - “What is the due date for this task?”
    - “Which project or meeting does this task relate to?”
    - “Is this task of high urgency or a lower priority?”
  - **For Insights/Notes:**  
    - “Could you specify which product or department this insight relates to?”
    - “Do you need a follow-up action on this note?”
  - **For Meeting Minutes:**  
    - “Which meeting does this minute belong to?”
    - “Is there any follow-up required from this meeting?”

All these clarifying questions are to be generated only when necessary and must be succinct to avoid disrupting the user’s flow while ensuring high-quality, contextual task extraction.

---

## 5. Data Storage & Search

### Metadata & Tagging Framework
- **Essential Metadata Fields:**  
  - **Timestamp:** When the message/event occurred.
  - **Source Type:** Indicates if the entry is from Gmail, Calendar, or Chat.
  - **Fundamental Tags:**  
    - **Product**
    - **Project**
    - **Meeting**
  - **Additional Considerations:**  
    - The system should allow for further tags as needed in the future while keeping the initial set minimal.
    - The metadata framework must be scalable and designed to support future organizational retrieval use cases without being over-engineered.
- **Storage & Indexing:**  
  - Use a vector search engine with embeddings stored in Elasticsearch.
  - **Chunking:**  
    - Automatically isolate chunks so that each chunk covers one topic.
    - A single topic may be split into multiple chunks if necessary.
  - Embedding creation and chunking must occur immediately after message receipt to keep refresh times minimal.

### Search Functionality
- **Contextual Text-Based Search:**  
  - Searches will span both individual chat messages and collated documents.
  - Results will appear similar to Slack’s interface—showing context snippets that users can click to view full details.
- **User Feedback:**  
  - Display status indicators and “last updated” timestamps on the refresh action.

---

## 6. Technical Architecture & Deployment

### Frontend
- **Technology Stack:**  
  - Angular with Angular Material (or equivalent if using plain HTML) to achieve a Google-like look and feel.
- **Design Considerations:**  
  - Responsive design (desktop-first since mobile/offline isn’t required for the MVP).
  - Minimal and intuitive layout following Material Design guidelines.
- **User Interactions:**  
  - In-line editing in task tables.
  - A unified refresh control that updates tasks, collated docs, and search results.

### Backend
- **API & Language:**  
  - A RESTful API is preferred for simplicity. The choice of backend language is flexible (Go, Python, etc.) based on developer proficiency.
- **Data Ingestion:**  
  - Endpoints to pull data from Gmail and Calendar using OAuth.
  - Real-time processing triggered by user actions (with a manual refresh as a backup).
- **Vector Search:**  
  - Elasticsearch is used for storing embeddings. Recommendations for hosting include exploring Elastic Cloud’s free trial if it meets the free-tier limits for robustness.
- **Task Processing Pipeline:**  
  - Immediate chunking, embedding, and metadata tagging as soon as a chat message is received.

### Deployment & Hosting
- **Demo Environment:**  
  - The MVP is a demo, hosted on free/low-cost services.
  - CI/CD and cloud deployment practices are minimal; the focus is on a stable demo rather than production-grade scalability.
- **Database & Hosting:**  
  - Use free-tier managed databases or local solutions as appropriate, prioritizing ease-of-use and cost efficiency.

---

## 7. Security & Data Privacy

- **OAuth & Data Isolation:**  
  - Use industry best practices for OAuth to ensure that user email and calendar data are not exposed.
  - For the demo, basic multi-user support is implemented so that user data is isolated and not mixed.
- **Simplicity Over Complexity:**  
  - While advanced security measures are not the focus for the MVP, the design should follow secure coding practices and ensure that data is stored safely with minimal exposure.

---

## 8. Future Considerations (Post-MVP)

- **Auto-Sync:**  
  - Introduce periodic auto-sync once the MVP is stable.
- **Enhanced Metadata:**  
  - Refine and expand the metadata framework as additional organizational retrieval use cases are identified.
- **File Upload Improvements:**  
  - Extend the file upload capability (with potential drag-and-drop UI) and add parsing for additional file types.
- **Advanced Collaboration:**  
  - Although not needed for the demo, future iterations could support multi-user collaboration features.
- **Enhanced Error Handling & Notifications:**  
  - Refine error states, loading indicators, and user notifications beyond the MVP’s playful loading messages.

---

# Final Considerations

This PRD is designed to ensure that the MVP delivers an intuitive, Google-like user experience with a heavy emphasis on the AI-driven extraction of tasks and contextual insights. The “magic” of the app lies in the exhaustive, well-documented framework for task extraction and the minimal yet robust metadata tagging system—both designed to scale into broader organizational use cases.

Please review the above draft and provide any additional comments or adjustments. Once approved, we can move forward with using this document to generate the code for the MVP.