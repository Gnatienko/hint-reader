"use client";

import { Button, Tooltip } from "antd";
import {
  BookOutlined,
  FolderOpenOutlined,
  SettingOutlined,
} from "@ant-design/icons";

type Props = {
  onOpenSettings: () => void;
  onOpenTexts: () => void;
  onOpenKnownWords: () => void;
};

export function ReaderToolbar({
  onOpenSettings,
  onOpenTexts,
  onOpenKnownWords,
}: Props) {
  return (
    <div className="reader-toolbar">
      <Tooltip title="Settings">
        <Button
          type="text"
          shape="circle"
          icon={<SettingOutlined />}
          className="reader-toolbar-btn"
          aria-label="Settings"
          onClick={onOpenSettings}
        />
      </Tooltip>
      <Tooltip title="Texts">
        <Button
          type="text"
          shape="circle"
          icon={<FolderOpenOutlined />}
          className="reader-toolbar-btn"
          aria-label="Texts"
          onClick={onOpenTexts}
        />
      </Tooltip>
      <Tooltip title="Known words">
        <Button
          type="text"
          shape="circle"
          icon={<BookOutlined />}
          className="reader-toolbar-btn"
          aria-label="Known words"
          onClick={onOpenKnownWords}
        />
      </Tooltip>
    </div>
  );
}
