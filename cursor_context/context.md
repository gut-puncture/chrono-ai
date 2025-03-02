We are using cursor locally. We make the changes to the code here and then push the code to github which triggers the vercel deployment.

We are using Heroku to with postgres to store data.


Current state:
We're trying to fix an error in the UI where when I send a message to the UI, the reply says "Sorry, there was an error processing your message."
We purged out db just before this and the user had signed up earlier. this might be the cause.