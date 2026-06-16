"use client";

import { ConfigProvider, theme } from "antd";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export function ReaderThemeProvider({ children }: Props) {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#8b6914",
          borderRadius: 10,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
