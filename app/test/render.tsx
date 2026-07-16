import { render, type RenderOptions } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { ReaderThemeProvider } from "../components/ReaderThemeProvider";

function Wrapper({ children }: { children: ReactNode }) {
  return <ReaderThemeProvider>{children}</ReaderThemeProvider>;
}

/** Renders UI under the same Ant Design App/theme shell the reader uses. */
export function renderWithApp(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: Wrapper, ...options });
}
