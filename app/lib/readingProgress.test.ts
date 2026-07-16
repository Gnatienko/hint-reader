import { describe, expect, it } from "vitest";
import {
  calculateReadingProgress,
  formatProgressDisplay,
  pageFromProgress,
} from "./readingProgress";

describe("calculateReadingProgress", () => {
  it("calculates progress from the one-based position of the current page", () => {
    expect(calculateReadingProgress(0, 8)).toBe(12.5);
    expect(calculateReadingProgress(2, 8)).toBe(37.5);
    expect(calculateReadingProgress(7, 8)).toBe(100);
  });

  it("returns zero when there are no pages", () => {
    expect(calculateReadingProgress(0, 0)).toBe(0);
    expect(calculateReadingProgress(0, -1)).toBe(0);
  });

  it("rounds percentages to two decimal places", () => {
    expect(calculateReadingProgress(0, 3)).toBe(33.33);
  });
});

describe("pageFromProgress", () => {
  it("restores the page represented by a saved percentage", () => {
    expect(pageFromProgress(12.5, 8)).toBe(0);
    expect(pageFromProgress(37.5, 8)).toBe(2);
    expect(pageFromProgress(100, 8)).toBe(7);
  });

  it("clamps progress to the available page range", () => {
    expect(pageFromProgress(-10, 8)).toBe(0);
    expect(pageFromProgress(150, 8)).toBe(7);
    expect(pageFromProgress(50, 0)).toBe(0);
  });
});

describe("formatProgressDisplay", () => {
  it("always displays two decimal places", () => {
    expect(formatProgressDisplay(37.5)).toBe("37.50");
  });
});
