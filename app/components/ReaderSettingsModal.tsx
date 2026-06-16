"use client";

import { Flex, Modal, Radio, Slider, Space, Typography } from "antd";
import type { Language, LanguageFrom } from "../types";

const { Text } = Typography;

type Props = {
  open: boolean;
  onClose: () => void;
  languageFrom: LanguageFrom;
  onLanguageFromChange: (value: LanguageFrom) => void;
  language: Language;
  onLanguageChange: (value: Language) => void;
  textSize: number;
  onTextSizeChange: (value: number) => void;
  translationOpacity: number;
  onTranslationOpacityChange: (value: number) => void;
};

export function ReaderSettingsModal({
  open,
  onClose,
  languageFrom,
  onLanguageFromChange,
  language,
  onLanguageChange,
  textSize,
  onTextSizeChange,
  translationOpacity,
  onTranslationOpacityChange,
}: Props) {
  return (
    <Modal
      title="Settings"
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnHidden
    >
      <Space orientation="vertical" size="large" style={{ width: "100%" }}>
        <Flex gap={24} wrap>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Text strong>Original language</Text>
            <Radio.Group
              style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}
              value={languageFrom}
              onChange={(e) => onLanguageFromChange(e.target.value)}
            >
              <Radio.Button value="auto">Auto-detect</Radio.Button>
              <Radio.Button value="en">English</Radio.Button>
              <Radio.Button value="es">Español</Radio.Button>
              <Radio.Button value="bg">Bulgarian</Radio.Button>
            </Radio.Group>
          </div>

          <div style={{ flex: 1, minWidth: 240 }}>
            <Text strong>Translation language</Text>
            <Radio.Group
              style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
            >
              <Radio.Button value="en">English</Radio.Button>
              <Radio.Button value="uk">Українська</Radio.Button>
            </Radio.Group>
          </div>
        </Flex>

        <Flex gap={24} wrap>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Text strong>Text size</Text>
            <Slider
              style={{ marginTop: 8 }}
              min={15}
              max={50}
              value={textSize}
              onChange={(value) => onTextSizeChange(value as number)}
            />
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Text strong>Translation opacity</Text>
            <Slider
              style={{ marginTop: 8 }}
              min={1}
              max={30}
              value={translationOpacity}
              onChange={(value) => onTranslationOpacityChange(value as number)}
            />
          </div>
        </Flex>
      </Space>
    </Modal>
  );
}
