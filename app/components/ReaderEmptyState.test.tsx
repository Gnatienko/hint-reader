import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReaderEmptyState } from "./ReaderEmptyState";

describe("ReaderEmptyState", () => {
  it("renders the empty-state spinner shell", () => {
    const { container } = render(<ReaderEmptyState />);

    expect(container.querySelector(".reader-empty")).toBeTruthy();
    expect(container.querySelector(".ant-spin")).toBeTruthy();
  });
});
