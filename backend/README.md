# Jelly Shops backend

The production Stripe Connect deployment and verification procedure is documented in [docs/stripe-connect-deployment.md](docs/stripe-connect-deployment.md).

Run `npm run typecheck`, `npm run build`, and `npm test` before deployment. Apply SQL migrations in order and run the reservation sweeper every minute with `SCHEDULER_SECRET`.
