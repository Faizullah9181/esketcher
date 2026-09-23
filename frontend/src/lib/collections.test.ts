import { expect, it } from "vitest";

import { groupBy } from "./collections";

it("groups preserving first-seen order", () => {
  expect(groupBy(["petal", "leaf", "petal"], (x) => x)).toEqual([
    ["petal", ["petal", "petal"]],
    ["leaf", ["leaf"]],
  ]);
});
