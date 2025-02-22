# Chrono.ai MVP

This repository contains the production-ready code for the Unified Workspace MVP—a web app that aggregates Gmail, Calendar, and chat data with AI processing.

## Technologies Used

- **Frontend:** Next.js, React, Material UI, SWR
- **Authentication:** NextAuth.js (Google OAuth for Gmail & Calendar)
- **Backend:** Next.js API routes running on Node.js
- **LLM Processing:** Google Gemini Model API via @google/generative-ai
- **Data Storage:** Heroku Postgres (via Prisma) for persistent data; Pinecone for vector embeddings (setup in future phases)
- **Deployment:** GitHub repository connected to Vercel for automatic deployments

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <github-repo-url>
cd mvp-unified-workspace
