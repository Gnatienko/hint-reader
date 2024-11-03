// App.js
import "./App.css"
import { Input, Divider } from "antd"
import React, { useState } from "react"
import ReadingArea from "./ReadingArea"
import Menu from "./Menu" // Import the Menu component

const { TextArea } = Input

function App() {
  const [inputText, setInputText] = useState("Enter text here")
  const [wordObjects, setWordObjects] = useState([])
  const [textSize, setTextSize] = useState(20)
  const [translationOpacity, setTranslationOpacity] = useState(10)
  const [language, setLanguage] = useState("uk")
  const [languageFrom, setLanguageFrom] = useState("auto")

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
        <Menu
          inputText={inputText}
          setInputText={setInputText}
          handleButtonClick={handleButtonClick}
          textSize={textSize}
          setTextSize={setTextSize}
          translationOpacity={translationOpacity}
          setTranslationOpacity={setTranslationOpacity}
          languageFrom={languageFrom}
          setLanguageFrom={setLanguageFrom}
          language={language}
          setLanguage={setLanguage}
        />
        <ReadingArea
          wordObjects={wordObjects}
          textSize={textSize}
          translationOpacity={translationOpacity}
        />
      </div>
      <a href="https://www.ispanskamova.com/ispanski-teksty-z-audio/">!</a>
    </div>
  )
}

export default App
