import "./App.css"
import { Input, Button, Card, Divider, Slider } from "antd"
import React, { useState } from "react"
const { TextArea } = Input

function App() {
  const [inputText, setInputText] = useState("")
  const [wordObjects, setWordObjects] = useState([])

  async function translateWord(word) {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=uk&dt=t&q=${encodeURIComponent(
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
    const wordsWithIndex = await Promise.all(
      textArray.map(async (word) => ({
        word,
        index: await translateWord(word),
      }))
    )
    setWordObjects(wordsWithIndex)
  }

  return (
    <div
      className="App"
      style={{
        display: "flex",
        "justify-content": "center",
        flexDirection: "column",
      }}
    >
      <h1>Simple reader</h1>
      <h3>
        This application allows you to read English text even if you know only
        50% of words in the text. Simply take a look at the top of each word and
        you will see a translation. Also, since translation is not very
        convenient to read it will push you to read in English.
      </h3>
      <Slider />
      <Divider />
      <div
        style={{
          maxWidth: 1000,
          width: "-webkit-fill-available",
          display: "flex",
          flexDirection: "column",
          alignSelf: "center",
        }}
      >
        <TextArea
          style={{ marginTop: 50 }}
          autoSize={{ minRows: 3, maxRows: 5 }}
          placeholder="Enter text here"
          onChange={(e) => setInputText(e.target.value)}
        />

        <Button
          type="primary"
          style={{ width: 100, alignSelf: "center", margin: 20 }}
          onClick={handleButtonClick}
        >
          Process
        </Button>

        <Card style={{ backgroundColor: "#EFF0F3", minHeight: 300 }}>
          {wordObjects.map((item) => (
            <div class="word">
              <tr>
                <span class="translation">
                  <td> {`${item.index}`} </td>
                </span>
                <span class="original">
                  <td>{`${item.word}`} &nbsp;</td>
                </span>
              </tr>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

export default App
