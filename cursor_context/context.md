We are using cursor locally. We make the changes to the code here and then push the code to github which triggers the vercel deployment.
We never deploy locally, only using vercel. Any changes to heroku or other toold must happen while deployment is running on vercel. Some small changes like updating table schema, or deleting data in heroku etc. should be done locally using cursor terminal. Commands for these should be provided.

If you want to make any changes, they should either work with the vercel deployment or any one-time changes can be made by writing terminal commands (like updating the heroku db).

chrono-ai folder is actually the github repo and not the root folder, chrono-ai-root.

We are using Heroku to with postgres to store data.


History (in chronological order):
- We were trying to fix an error in the UI where when I sent a message to the UI, the reply said "Sorry, there was an error processing your message."
We purged out db just before this and the user had signed up earlier. this might be the cause.
This was solved.
- We added a feature to update the heroku db whenever a task is updated in the UI, it is updated in the heroku db.

Current state:
- the tasks api is being called more than once every second. we're trying to reduce it's firing rate.