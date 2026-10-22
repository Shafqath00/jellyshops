import type { Express } from "express";
import { createSweeperRouter } from "../../commerce/sweeper-routes.js";
import type { AppContext } from "../types.js";

export function mountInternalRoutes(app: Express, context: AppContext): void {
  const { routeDependencies: deps, config } = context;

  if (
    deps.reservationSweeper &&
    config.stripe?.schedulerSecret
  ) {
    app.use(
      "/internal/commerce/reservations/sweep",
      createSweeperRouter(
        deps.reservationSweeper,
        config.stripe.schedulerSecret,
      ),
    );
  }

  app.get(
    "/health",
    (_request, response) => {
      response.json({
        ok: true,
      });
    },
  );
}
