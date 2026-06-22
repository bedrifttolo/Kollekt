You need to know — 3 things before this ships
Email isn't actually sent yet. PasswordResetMailer logs the reset link (dev-safe, needs no secrets). To deliver real email, add spring-boot-starter-mail + spring.mail.* config and send from sendResetLink. I couldn't do this autonomously — it needs your SMTP provider + credentials.
Native deep-linking: the reset link points at the web route; an external email client opening the installed app needs universal-links/custom-scheme config.
"terms" is presentational — there's no /terms page yet.
I matched the screenshots structurally but did not run the app live (that needs the backend + Postgres). Want me to spin up the dev server to eyeball it, or wire up the SMTP sending next?