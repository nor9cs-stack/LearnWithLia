import { describe, expect, it } from "vitest";
import { createTextAnchor, removeTextAnchor, resolveTextAnchor } from "@/lib/unknown-words/anchor";

describe("unknown word text anchors", () => {
  it("saves exact text with prefix, suffix and occurrence", () => {
    const text = "Read the bright star, then draw the bright star.";
    const start = text.lastIndexOf("bright star");
    const anchor = createTextAnchor(text, start, start + "bright star".length);
    expect(anchor.exactText).toBe("bright star");
    expect(anchor.occurrence).toBe(1);
    expect(resolveTextAnchor(text, anchor)).toEqual({ start, end: start + 11 });
  });

  it("restores after unrelated content is inserted elsewhere", () => {
    const before = "A learner should explore ideas with care.";
    const start = before.indexOf("explore");
    const anchor = createTextAnchor(before, start, start + 7);
    const after = `Introduction. ${before}`;
    expect(resolveTextAnchor(after, anchor)).toEqual({ start: start + 14, end: start + 21 });
  });

  it("rejects empty, oversized and invalid selections", () => {
    expect(() => createTextAnchor("abc", 1, 1)).toThrow("INVALID_SELECTION");
    expect(() => createTextAnchor("x".repeat(200), 0, 200)).toThrow("INVALID_SELECTION_LENGTH");
  });
});

it("removes only the selected saved anchor", () => {
  expect(removeTextAnchor([{ id: "one" }, { id: "two" }], "one")).toEqual([{ id: "two" }]);
});
