import type { Express } from "express";
import type { Server } from "http";
import { isAdmin, requireClubManager, requireEventManager, requireRole } from "../middleware";
import { registerClubRoutes } from "./clubs";
import { registerEventRoutes } from "./events";
import { registerOrganizerRoutes } from "./organizer";
import { registerAdminRoutes } from "./admin";
import { registerUserRoutes } from "./users";
import { registerPaymentRoutes } from "./payments";

export function registerAllRoutes(app: Express, httpServer: Server): Server {
  registerClubRoutes(app, isAdmin, requireRole, requireClubManager);
  registerEventRoutes(app, requireRole, requireEventManager);
  registerOrganizerRoutes(app, requireRole, requireClubManager, requireEventManager);
  registerAdminRoutes(app, isAdmin);
  registerUserRoutes(app);
  registerPaymentRoutes(app, isAdmin, requireClubManager);
  return httpServer;
}
