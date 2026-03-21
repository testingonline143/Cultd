import type { IStorage } from "../storage";
import { clubsStorage } from "./clubs";
import { eventsStorage } from "./events";
import { usersStorage } from "./users";
import { adminStorage } from "./admin";
import { paymentsStorage } from "./payments";

export const storage: IStorage = {
  ...clubsStorage,
  ...eventsStorage,
  ...usersStorage,
  ...adminStorage,
  ...paymentsStorage,
};

export { IStorage };
export { clubsStorage } from "./clubs";
export { eventsStorage } from "./events";
export { usersStorage } from "./users";
export { adminStorage } from "./admin";
export { paymentsStorage } from "./payments";
