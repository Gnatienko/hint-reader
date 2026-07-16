import { render, screen } from "@testing-library/react";
import { App } from "antd";
import { describe, expect, it } from "vitest";
import { ReaderThemeProvider } from "./ReaderThemeProvider";

describe("ReaderThemeProvider", () => {
  it("wraps children in Ant Design App/theme context", () => {
    function Probe() {
      App.useApp();
      return <span>inside theme</span>;
    }

    render(
      <ReaderThemeProvider>
        <Probe />
      </ReaderThemeProvider>,
    );

    expect(screen.getByText("inside theme")).toBeTruthy();
  });
});
