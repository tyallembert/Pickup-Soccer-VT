import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Convex crons are UTC-only, so this is 8am EDT / 7am EST — it drifts an hour
// across the DST boundary. Accepted: a two-cron workaround is not worth it.
// The mutation is silent when the queue is empty.
crons.cron(
  "pending queue digest",
  "0 12 * * *",
  internal.push.sendPendingDigest,
  {},
);

export default crons;
