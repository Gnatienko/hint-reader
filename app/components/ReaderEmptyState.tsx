"use client";

import { Spin } from "antd";

export function ReaderEmptyState() {
  return (
    <div className="reader-empty">
      <Spin size="large" />
    </div>
  );
}
