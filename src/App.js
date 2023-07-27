import React, { useState } from "react"
import "./App.css"
import { Input, Button, Card, Divider, Slider, Radio } from "antd"

const { TextArea } = Input

function App() {
  const [inputText, setInputText] = useState("Enter text here")
  const [wordObjects, setWordObjects] = useState([])
  const [textSize, setTextSize] = useState(20)
  const [language, setLanguage] = useState("en")

  async function translateWord(word) {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${language}&tl=uk&dt=t&q=${encodeURIComponent(
        word
      )}`
    )
    const data = await response.json()
    const translation = data[0][0][0]
    return translation
  }

  const handleButtonClick = async () => {
    const textArray = inputText.split(" ")
    const wordsWithIndex = await Promise.all(
      textArray.map(async (word) => ({
        word,
        index: await translateWord(word),
      }))
    )
    setWordObjects(wordsWithIndex)
  }

  return (
    <div className="App">
      <h1>Simple reader</h1>
      <div className="container">
        This application allows you to read English text even if you know only
        50% of words in the text. Simply take a look at the top of each word and
        you will see a translation. Also, since translation is not very
        convenient to read it will push you to read in English.{" "}
      </div>
      <Divider />
      <div className="input-container">
        <TextArea
          className="textarea"
          autoSize={{ minRows: 3, maxRows: 5 }}
          defaultValue="Enter text here"
          onChange={(e) => setInputText(e.target.value)}
        />
        <div className="button-container">
          <Button
            className="process-button"
            type="primary"
            onClick={handleButtonClick}
          >
            Process
          </Button>
          <div className="slider-container">
            Text size:
            <Slider
              min={15}
              max={50}
              onChange={(e) => setTextSize(e)}
              value={textSize}
            />
          </div>
          <Radio.Group
            className="translation-radio-group"
            value={language}
            buttonStyle="solid"
            onChange={(e) => {
              setLanguage(e.target.value)
            }}
          >
            <Radio.Button className="translation-radio-button" value="en">
              English
            </Radio.Button>
            <Radio.Button className="translation-radio-button" value="es">
              Español
            </Radio.Button>
          </Radio.Group>
        </div>
        <Card className="card" style={{ fontSize: textSize / 2 }}>
          {wordObjects.map((item, index) => (
            <div key={index} className="word">
              <span
                className="translation"
                style={{ fontSize: textSize / (5 / 2) }}
              >
                {item.index}
              </span>
              <span
                className="original"
                style={{
                  fontSize: textSize,
                  lineHeight: textSize / 2 + "px",
                }}
              >
                {item.word}&nbsp;
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

export default App
