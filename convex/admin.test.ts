/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function seed(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const admin = await ctx.db.insert("users", {
      email: "admin@x.com",
      role: "admin",
    });
    const owner = await ctx.db.insert("users", {
      email: "owner@x.com",
      role: "user",
    });
    const helper = await ctx.db.insert("users", {
      email: "helper@x.com",
      role: "user",
    });
    const field = {
      town: "Burlington",
      address: "1 Main",
      lat: 44.5,
      lng: -73.2,
      details: "",
      ownerId: owner,
      submittedAt: Date.now(),
    };
    const leddy = await ctx.db.insert("locations", {
      ...field,
      name: "Leddy Park",
      status: "approved" as const,
      approvedAt: Date.now(),
    });
    const oakledge = await ctx.db.insert("locations", {
      ...field,
      name: "Oakledge",
      status: "approved" as const,
      approvedAt: Date.now(),
    });
    const newField = await ctx.db.insert("locations", {
      ...field,
      name: "New field",
      status: "pending" as const,
    });
    return { admin, owner, helper, leddy, oakledge, newField };
  });
}

const as = (t: ReturnType<typeof convexTest>, id: string) =>
  t.withIdentity({ subject: id, tokenIdentifier: id });

test("admins see pending co-maintainer requests with who and which field", async () => {
  const t = convexTest(schema, modules);
  const { admin, helper, leddy, oakledge } = await seed(t);

  await as(t, helper).mutation(api.maintainers.requestMaintainership, {
    locationId: leddy,
  });
  // An approved maintainer is not waiting on anyone.
  await t.run(async (ctx) => {
    await ctx.db.insert("locationMaintainers", {
      locationId: oakledge,
      userId: helper,
      status: "approved",
      requestedAt: Date.now(),
      approvedAt: Date.now(),
    });
  });

  const rows = await as(t, admin).query(
    api.admin.pendingMaintainerRequests,
    {},
  );
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    locationId: leddy,
    locationName: "Leddy Park",
    locationTown: "Burlington",
    userId: helper,
    email: "helper@x.com",
  });
});

test("the list is admin-only", async () => {
  const t = convexTest(schema, modules);
  const { owner } = await seed(t);
  await expect(
    as(t, owner).query(api.admin.pendingMaintainerRequests, {}),
  ).rejects.toThrow("Forbidden");
});

test("requests for a deleted field drop out of the list", async () => {
  const t = convexTest(schema, modules);
  const { admin, helper, leddy } = await seed(t);
  await as(t, helper).mutation(api.maintainers.requestMaintainership, {
    locationId: leddy,
  });
  // Simulate a field deleted out from under its request (deleteLocation also
  // clears requests, but data written before that existed may not be clean).
  await t.run(async (ctx) => ctx.db.delete(leddy));

  const rows = await as(t, admin).query(
    api.admin.pendingMaintainerRequests,
    {},
  );
  expect(rows).toEqual([]);
});

test("the nav badge counts new fields and co-maintainer requests together", async () => {
  const t = convexTest(schema, modules);
  const { admin, helper, leddy, oakledge } = await seed(t);
  expect(await as(t, admin).query(api.admin.pendingCount, {})).toBe(1);

  await as(t, helper).mutation(api.maintainers.requestMaintainership, {
    locationId: leddy,
  });
  await as(t, helper).mutation(api.maintainers.requestMaintainership, {
    locationId: oakledge,
  });
  expect(await as(t, admin).query(api.admin.pendingCount, {})).toBe(3);
});

test("an admin who doesn't own the field can approve a request from the list", async () => {
  const t = convexTest(schema, modules);
  const { admin, helper, leddy } = await seed(t);
  await as(t, helper).mutation(api.maintainers.requestMaintainership, {
    locationId: leddy,
  });
  const [row] = await as(t, admin).query(
    api.admin.pendingMaintainerRequests,
    {},
  );

  await as(t, admin).mutation(api.maintainers.approveMaintainer, {
    id: row._id,
  });

  expect(
    await as(t, admin).query(api.admin.pendingMaintainerRequests, {}),
  ).toEqual([]);
  const status = await as(t, helper).query(
    api.maintainers.getMyMaintainerStatus,
    { locationId: leddy },
  );
  expect(status).toEqual({ status: "approved" });
});

test("an admin can deny a request from the list", async () => {
  const t = convexTest(schema, modules);
  const { admin, helper, leddy } = await seed(t);
  await as(t, helper).mutation(api.maintainers.requestMaintainership, {
    locationId: leddy,
  });
  const [row] = await as(t, admin).query(
    api.admin.pendingMaintainerRequests,
    {},
  );

  await as(t, admin).mutation(api.maintainers.denyMaintainer, { id: row._id });

  const status = await as(t, helper).query(
    api.maintainers.getMyMaintainerStatus,
    { locationId: leddy },
  );
  expect(status).toEqual({ status: "none" });
});
