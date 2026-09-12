import { describe, expect, test } from "vitest";
import { getVisibleEvidence } from "./knowledge-coverage";

describe("evidence progressive disclosure", () => {
  const items = Array.from({ length: 8 }, (_, index) => ({ id: index + 1 }));

  test("collapsed view shows the first five items", () => {
    expect(getVisibleEvidence(items, false)).toEqual(items.slice(0, 5));
  });

  test("expanded view returns every item", () => {
    expect(getVisibleEvidence(items, true)).toEqual(items);
  });

  test("small evidence sets are not truncated", () => {
    const small = items.slice(0, 4);
    expect(getVisibleEvidence(small, false)).toEqual(small);
  });
});
