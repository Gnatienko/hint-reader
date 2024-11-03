import React from "react"
import { Button, Slider, Radio, TreeSelect } from "antd"
import "./Menu.css"

const Menu = ({
  inputText,
  setInputText,
  handleButtonClick,
  textSize,
  setTextSize,
  translationOpacity,
  setTranslationOpacity,
  languageFrom,
  setLanguageFrom,
  language,
  setLanguage,
}) => {
  return (
    <div className="menu">
      <Button
        type="primary"
        style={{ width: 100, alignSelf: "center" }}
        onClick={handleButtonClick}
      >
        Process
      </Button>
      <div
        style={{
          alignSelf: "center",
          display: "flex",
        }}
      >
        <div
          style={{
            width: 200,
            margin: 20,
          }}
        >
          Text size:
          <Slider
            min={15}
            max={50}
            onChange={(value) => setTextSize(value)}
            value={textSize}
          />
        </div>
        <div
          style={{
            width: 200,
            margin: 20,
          }}
        >
          Translation opacity:
          <Slider
            min={1}
            max={30}
            onChange={(value) => setTranslationOpacity(value)}
            value={translationOpacity}
          />
        </div>
      </div>
      <TreeSelect
        showSearch
        style={{ width: "100%" }}
        value={languageFrom}
        dropdownStyle={{ maxHeight: 400, overflow: "auto" }}
        placeholder="Please select"
        allowClear
        treeDefaultExpandAll
        onChange={setLanguageFrom}
        treeData={[
          {
            value: "auto",
            title: "auto",
          },
          {
            value: "es",
            title: "es",
          },
          {
            value: "en",
            title: "en",
          },
          {
            value: "bg",
            title: "bg",
          },
        ]}
      />
      &nbsp; &rarr; &nbsp;
      <Radio.Group
        style={{
          display: "flex",
          flexDirection: "row",
        }}
        value={language}
        buttonStyle="solid"
        onChange={(e) => {
          setLanguage(e.target.value)
        }}
      >
        <Radio.Button value="en">English</Radio.Button>
        <Radio.Button value="uk">Українська</Radio.Button>
      </Radio.Group>
    </div>
  )
}

export default Menu
