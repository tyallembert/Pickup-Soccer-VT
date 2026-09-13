/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");

const SUB = {
  endpoint: "https://push.example.com/abc",
  p256dh: "p256dh-key",
  auth: "auth-secret",
};

function identity(userId: Id<"users">) {
  return { subject: userId, tokenIdentifier: userId };
}

async function scheduled(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) =>
    ctx.db.system.query("_scheduled_functions").collect(),
  );
}

test("savePushSubscription upserts by endpoint — same device twice is one row", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "a@x.com", role: "admin" }),
  );
  const asUser = t.withIdentity(identity(userId));

  await asUser.mutation(api.push.savePushSubscription, SUB);
  await asUser.mutation(api.push.savePushSubscription, {
    ...SUB,
    p256dh: "rotated-key",
  });

  const rows = await t.run((ctx) =>
    ctx.db.query("pushSubscriptions").collect(),
  );
  expect(rows).toHaveLength(1);
  expect(rows[0].p256dh).toBe("rotated-key");
});

test("savePushSubscription requires authentication", async () => {
  const t = convexTest(schema, modules);
  await expect(
    t.mutation(api.push.savePushSubscription, SUB),
  ).rejects.toThrow();
});

test("deletePushSubscription only removes your own device", async () => {
  const t = convexTest(schema, modules);
  const { mine, theirs } = await t.run(async (ctx) => ({
    mine: await ctx.db.insert("users", { email: "a@x.com", role: "admin" }),
    theirs: await ctx.db.insert("users", { email: "b@x.com", role: "admin" }),
  }));

  await t.withIdentity(identity(theirs)).mutation(
    api.push.savePushSubscription,
    SUB,
  );
  // Someone else's endpoint is left alone rather than deleted.
  await t
    .withIdentity(identity(mine))
    .mutation(api.push.deletePushSubscription, { endpoint: SUB.endpoint });
  expect(
    await t.run((ctx) => ctx.db.query("pushSubscriptions").collect()),
  ).toHaveLength(1);

  await t
    .withIdentity(identity(theirs))
    .mutation(api.push.deletePushSubscription, { endpoint: SUB.endpoint });
  expect(
    await t.run((ctx) => ctx.db.query("pushSubscriptions").collect()),
  ).toHaveLength(0);
});

test("mySubscriptionStatus reports this device only", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { email: "a@x.com", role: "admin" }),
  );
  const asUser = t.withIdentity(identity(userId));

  expect(
    await asUser.query(api.push.mySubscriptionStatus, { endpoint: SUB.endpoint }),
  ).toEqual({ subscribed: false });

  await asUser.mutation(api.push.savePushSubscription, SUB);

  expect(
    await asUser.query(api.push.mySubscriptionStatus, { endpoint: SUB.endpoint }),
  ).toEqual({ subscribed: true });
  // A different device on the same account is still unsubscribed.
  expect(
    await asUser.query(api.push.mySubscriptionStatus, {
      endpoint: "https://push.example.com/other",
    }),
  ).toEqual({ subscribed: false });
});

test("notifyAdmins pushes to subscribed admins and ignores non-admins", async () => {
  const t = convexTest(schema, modules);
  const { admin, plain } = await t.run(async (ctx) => ({
    admin: await ctx.db.insert("users", { email: "a@x.com", role: "admin" }),
    plain: await ctx.db.insert("users", { email: "u@x.com", role: "user" }),
  }));

  await t.run(async (ctx) => {
    await ctx.db.insert("pushSubscriptions", {
      userId: admin,
      endpoint: "https://push.example.com/admin",
      p256dh: "k",
      auth: "a",
      createdAt: Date.now(),
    });
    // A regular user with a subscription must not receive admin traffic.
    await ctx.db.insert("pushSubscriptions", {
      userId: plain,
      endpoint: "https://push.example.com/plain",
      p256dh: "k",
      auth: "a",
      createdAt: Date.now(),
    });
  });

  await t.mutation(internal.push.notifyAdmins, {
    event: { kind: "pendingDigest", pendingCount: 3 },
  });

  const jobs = await scheduled(t);
  expect(jobs).toHaveLength(1);
  const args = jobs[0].args[0] as {
    subscriptions: { endpoint: string }[];
    payload: { title: string; url: string };
  };
  expect(args.subscriptions.map((s) => s.endpoint)).toEqual([
    "https://push.example.com/admin",
  ]);
  expect(args.payload.url).toBe("/admin/queue");
});

test("notifyAdmins skips the acting user via excludeUserId", async () => {
  const t = convexTest(schema, modules);
  const admin = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { email: "a@x.com", role: "admin" });
    await ctx.db.insert("pushSubscriptions", {
      userId: id,
      endpoint: "https://push.example.com/admin",
      p256dh: "k",
      auth: "a",
      createdAt: Date.now(),
    });
    return id;
  });

  await t.mutation(internal.push.notifyAdmins, {
    event: { kind: "pendingDigest", pendingCount: 1 },
    excludeUserId: admin,
  });

  expect(await scheduled(t)).toHaveLength(0);
});

test("notifyAdmins schedules nothing when no admin is subscribed", async () => {
  const t = convexTest(schema, modules);
  await t.run((ctx) =>
    ctx.db.insert("users", { email: "a@x.com", role: "admin" }),
  );

  await t.mutation(internal.push.notifyAdmins, {
    event: { kind: "pendingDigest", pendingCount: 2 },
  });

  expect(await scheduled(t)).toHaveLength(0);
});

test("applyDeliveryResults drops gone endpoints and records the rest", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "a@x.com",
      role: "admin",
    });
    for (const [endpoint, failureCount] of [
      ["https://push.example.com/gone", 0],
      ["https://push.example.com/ok", 3],
      ["https://push.example.com/flaky", 1],
    ] as const) {
      await ctx.db.insert("pushSubscriptions", {
        userId,
        endpoint,
        p256dh: "k",
        auth: "a",
        createdAt: Date.now(),
        failureCount,
      });
    }
  });

  await t.mutation(internal.push.applyDeliveryResults, {
    results: [
      { endpoint: "https://push.example.com/gone", status: "gone" },
      { endpoint: "https://push.example.com/ok", status: "ok" },
      { endpoint: "https://push.example.com/flaky", status: "failed" },
      // An endpoint deleted mid-flight must not blow up the batch.
      { endpoint: "https://push.example.com/vanished", status: "ok" },
    ],
  });

  const rows = await t.run((ctx) =>
    ctx.db.query("pushSubscriptions").collect(),
  );
  expect(rows.map((r) => r.endpoint).sort()).toEqual([
    "https://push.example.com/flaky",
    "https://push.example.com/ok",
  ]);
  const ok = rows.find((r) => r.endpoint.endsWith("/ok"))!;
  expect(ok.failureCount).toBe(0);
  expect(ok.lastSuccessAt).toBeTypeOf("number");
  expect(rows.find((r) => r.endpoint.endsWith("/flaky"))!.failureCount).toBe(2);
});

test("sendPendingDigest is silent when the queue is empty", async () => {
  const t = convexTest(schema, modules);
  await t.mutation(internal.push.sendPendingDigest, {});
  expect(await scheduled(t)).toHaveLength(0);
});

test("sendPendingDigest counts only pending locations", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const owner = await ctx.db.insert("users", {
      email: "o@x.com",
      role: "user",
    });
    const base = {
      town: "Burlington",
      address: "1 Main",
      lat: 44.5,
      lng: -73.2,
      details: "",
      ownerId: owner,
      submittedAt: Date.now(),
    };
    await ctx.db.insert("locations", { ...base, name: "A", status: "pending" });
    await ctx.db.insert("locations", { ...base, name: "B", status: "pending" });
    await ctx.db.insert("locations", { ...base, name: "C", status: "approved" });
  });

  await t.mutation(internal.push.sendPendingDigest, {});

  const jobs = await scheduled(t);
  expect(jobs).toHaveLength(1);
  expect((jobs[0].args[0] as { event: { pendingCount: number } }).event)
    .toEqual({ kind: "pendingDigest", pendingCount: 2 });
});

test("notifyAdmins reaches every admin's every device", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    const alice = await ctx.db.insert("users", {
      email: "alice@x.com",
      role: "admin",
    });
    const bob = await ctx.db.insert("users", {
      email: "bob@x.com",
      role: "admin",
    });
    const player = await ctx.db.insert("users", {
      email: "player@x.com",
      role: "user",
    });

    const device = (userId: Id<"users">, endpoint: string) =>
      ctx.db.insert("pushSubscriptions", {
        userId,
        endpoint,
        p256dh: "k",
        auth: "a",
        createdAt: Date.now(),
      });

    // Alice on phone + laptop, Bob on one phone, and a regular user who must
    // not be swept in.
    await device(alice, "https://push.example.com/alice-phone");
    await device(alice, "https://push.example.com/alice-laptop");
    await device(bob, "https://push.example.com/bob-phone");
    await device(player, "https://push.example.com/player-phone");
  });

  await t.mutation(internal.push.notifyAdmins, {
    event: { kind: "pendingDigest", pendingCount: 1 },
  });

  const jobs = await scheduled(t);
  expect(jobs).toHaveLength(1);
  const { subscriptions } = jobs[0].args[0] as {
    subscriptions: { endpoint: string }[];
  };
  expect(subscriptions.map((s) => s.endpoint).sort()).toEqual([
    "https://push.example.com/alice-laptop",
    "https://push.example.com/alice-phone",
    "https://push.example.com/bob-phone",
  ]);
});
