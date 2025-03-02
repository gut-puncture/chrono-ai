We are using cursor locally. We make the changes to the code here and then push the code to github which triggers the vercel deployment.
We never deploy locally, only using vercel. If you want to make any changes, they should either work with the vercel deployment or any one-time changes can be made by writing terminal commands (like updating the heroku db).

chrono-ai folder is actually the github repo and not the root folder, chrono-ai-root.

We are using Heroku to with postgres to store data.


History (in chronological order):
- We were trying to fix an error in the UI where when I sent a message to the UI, the reply said "Sorry, there was an error processing your message."
We purged out db just before this and the user had signed up earlier. this might be the cause.
This was solved.

Current state:
- when the status of a task is update on the UI, it is not updated in the heroku db. We tried to do this using a cron job that runs more than once per day, but since free vercel users cannot run cron jobs more than once a day, the deployment failed. We added server side polling to update the tasks but the same cron job error is still showing. The error was showing due to us fetching emails from gmail every 15 minutes. we pushed that to client side but that resulted in a small error in deployment. We're getting a bunch of errors now trying to get the changes deployed.