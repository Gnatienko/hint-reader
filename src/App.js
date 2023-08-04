import "./App.css"
import { Input, Button, Card, Divider, Slider, Radio } from "antd"
import React, { useState } from "react"
const { TextArea } = Input
//вынести цсс
function App() {
  const [inputText, setInputText] = useState("Enter text here")
  const [wordObjects, setWordObjects] = useState([])
  const [textSize, setTextSize] = useState(20)
  const [translationOpacity, SetTranslationOpacity] = useState(10)

  const [language, setLanguage] = useState("en")
  const [languageFrom, setLanguageFrom] = useState("es")

  async function translateWord(word) {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${languageFrom}&tl=${language}&dt=t&q=${encodeURIComponent(
        word
      )}`
    )
    const data = await response.json()
    const translation = data[0][0][0]
    console.log(translation)

    return translation
  }

  const handleButtonClick = async () => {
    const textArray = inputText.split(" ")
    const wordsWithTranslation = await Promise.all(
      textArray.map(async (word) => ({
        word,
        translation: await translateWord(word),
      }))
    )
    setWordObjects(wordsWithTranslation)
  }

  return (
    <div className="app">
      <h1 style={{ alignSelf: "center", margin: 20 }}>Simple reader</h1>
      <div className="description">
        This application allows you to read English text even if you know only
        50% of words in the text. Simply take a look at the top of each word and
        you will see a translation. Also, since translation is not very
        convenient to read it will push you to read in English.
      </div>

      <Divider />
      <div className="input-container">
        <TextArea
          autoSize={{ minRows: 3, maxRows: 5 }}
          defaultValue="Enter text here"
          onChange={(e) => setInputText(e.target.value)}
        />
        <div className="button-container">
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
                onChange={(e) => setTextSize(e)}
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
                max={20}
                onChange={(e) => SetTranslationOpacity(e)}
                value={translationOpacity}
              />
            </div>
          </div>
          <Radio.Group
            style={{
              display: "flex",
              flexDirection: "row",
            }}
            value={languageFrom}
            buttonStyle="solid"
            onChange={(e) => {
              setLanguageFrom(e.target.value)
            }}
          >
            <Radio.Button value="en">English</Radio.Button>
            <Radio.Button value="es">Espanol</Radio.Button>
          </Radio.Group>{" "}
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

        <Card
          style={{ backgroundColor: "#EFF0F3", minHeight: 300, lineHeight: 1 }}
        >
          {wordObjects.map((item) => (
            <div class="word">
              <tr>
                <span
                  class="translation"
                  style={{
                    opacity: translationOpacity / 100,
                    fontSize: textSize / (5 / 2),
                  }}
                >
                  <td> {`${item.translation}`} </td>
                </span>
                <span
                  class="original"
                  style={{
                    fontSize: textSize,
                    lineHeight: textSize / 2 + "px",
                  }}
                >
                  <td>{`${item.word}`} &nbsp;</td>
                </span>
              </tr>
            </div>
          ))}
        </Card>
      </div>
      <a href="https://www.ispanskamova.com/ispanski-teksty-z-audio/">!</a>
    </div>
  )
}

export default App
