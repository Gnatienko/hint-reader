import { fireEvent, screen } from "@testing-library/react";
import type { ComponentProps, CSSProperties } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithApp } from "../test/render";
import { ReaderThemeProvider } from "./ReaderThemeProvider";

vi.mock("antd", async (importOriginal) => {
  const antd = await importOriginal<typeof import("antd")>();
  return {
    ...antd,
    Slider: ({
      value,
      min,
      max,
      onChange,
      style,
    }: {
      value?: number;
      min?: number;
      max?: number;
      onChange?: (value: number) => void;
      style?: CSSProperties;
    }) => (
      <input
        type="range"
        role="slider"
        style={style}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        value={value}
        onChange={(event) => onChange?.(Number(event.target.value))}
      />
    ),
  };
});

import { ReaderSettingsModal } from "./ReaderSettingsModal";

function renderModal(
  overrides: Partial<ComponentProps<typeof ReaderSettingsModal>> = {},
) {
  const props = {
    open: true,
    onClose: vi.fn(),
    languageFrom: "auto" as const,
    onLanguageFromChange: vi.fn(),
    language: "uk" as const,
    onLanguageChange: vi.fn(),
    textSize: 24,
    onTextSizeChange: vi.fn(),
    translationOpacity: 18,
    onTranslationOpacityChange: vi.fn(),
    ...overrides,
  };
  const view = renderWithApp(<ReaderSettingsModal {...props} />);
  return { ...view, props };
}

function isChecked(name: string) {
  return (screen.getByRole("radio", { name }) as HTMLInputElement).checked;
}

describe("ReaderSettingsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders language and slider controls when open", () => {
    renderModal();

    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.getByText("Original language")).toBeTruthy();
    expect(screen.getByText("Translation language")).toBeTruthy();
    expect(screen.getByText("Text size")).toBeTruthy();
    expect(screen.getByText("Translation opacity")).toBeTruthy();
    expect(isChecked("Auto-detect")).toBe(true);
    expect(isChecked("Українська")).toBe(true);

    const sliders = screen.getAllByRole("slider");
    expect(sliders[0].getAttribute("aria-valuenow")).toBe("24");
    expect(sliders[0].getAttribute("aria-valuemin")).toBe("15");
    expect(sliders[0].getAttribute("aria-valuemax")).toBe("50");
    expect(sliders[1].getAttribute("aria-valuenow")).toBe("18");
    expect(sliders[1].getAttribute("aria-valuemin")).toBe("1");
    expect(sliders[1].getAttribute("aria-valuemax")).toBe("30");
  });

  it("forwards original and translation language changes", () => {
    const { props } = renderModal();

    fireEvent.click(screen.getByRole("radio", { name: "Español" }));
    expect(props.onLanguageFromChange).toHaveBeenCalledWith("es");

    const englishRadios = screen.getAllByRole("radio", { name: "English" });
    fireEvent.click(englishRadios[1]);
    expect(props.onLanguageChange).toHaveBeenCalledWith("en");
  });

  it("forwards text size and opacity slider changes", () => {
    const { props } = renderModal();
    const sliders = screen.getAllByRole("slider");

    fireEvent.change(sliders[0], { target: { value: "30" } });
    fireEvent.change(sliders[1], { target: { value: "12" } });

    expect(props.onTextSizeChange).toHaveBeenCalledWith(30);
    expect(props.onTranslationOpacityChange).toHaveBeenCalledWith(12);
  });

  it("reflects updated text size and opacity on the sliders", () => {
    const { props, rerender } = renderModal();

    rerender(
      <ReaderThemeProvider>
        <ReaderSettingsModal
          {...props}
          textSize={40}
          translationOpacity={10}
        />
      </ReaderThemeProvider>,
    );

    const sliders = screen.getAllByRole("slider");
    expect(sliders[0].getAttribute("aria-valuenow")).toBe("40");
    expect(sliders[1].getAttribute("aria-valuenow")).toBe("10");
  });

  it("calls onClose when cancelled", () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(props.onClose).toHaveBeenCalled();
  });
});
