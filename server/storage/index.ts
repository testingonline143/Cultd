import type { IStorage } from "./interface";
import { clubsStorage } from "./clubs";
import { eventsStorage } from "./events";
import { usersStorage } from "./users";
import { adminStorage } from "./admin";
import { paymentsStorage } from "./payments";
import { contentStorage } from "./content";
import { organizerStorage } from "./organizer";

export const storage: IStorage = {
  ...clubsStorage,
  ...eventsStorage,
  ...usersStorage,
  ...adminStorage,
  ...paymentsStorage,
  ...contentStorage,
  ...organizerStorage,
};

export { IStorage };
export { clubsStorage } from "./clubs";
export { eventsStorage } from "./events";
export { usersStorage } from "./users";
export { adminStorage } from "./admin";
export { paymentsStorage } from "./payments";
export { contentStorage } from "./content";
export { organizerStorage } from "./organizer";
