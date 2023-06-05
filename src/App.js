import "./App.css"
import { Input, Button, Card } from "antd"
import React, { useState } from "react"
const { TextArea } = Input

function App() {
  const [inputText, setInputText] = useState("")
  const [wordObjects, setWordObjects] = useState([])

  async function translateWord(word) {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=${encodeURIComponent(
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
      }}
    >
      <div
        style={{
          width: 1000,
          display: "flex",
          flexDirection: "column",
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
