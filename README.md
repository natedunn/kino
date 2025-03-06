# Next Kit

A starter kit for Next.js by @natedunn.

### Whats in the stack?

- Next.js
- TypeScript
- Tailwind CSS

### Libraries and integrations

- tRPC — API
- Better Auth — authentication
- Drizzle ORM (default driver w/ Neon DB) — Database ORM
- Nuqs — search params
- T3 Env — type-safe ENV variables
- Shadcn ready — components

### Features

- Authentication
- Type-safe API procedures
- Basic authorization w/ API middleware
- Admin roles (w/ authorization)
- Type-safe search params
- A few small things that I really hate setting up every time for new projects but feel kind of important to do.

### Instructions

#### Required

- Enable auth by adding Github client info to .env file.
- The Neon DB driver is pre-configured. If this is not your preferred DB provider, you will need to change the different driver.

#### Optional

- Add better-auth plugins before running pnpm db:auth to update schema.
