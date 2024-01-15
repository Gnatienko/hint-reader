import React from "react"
import { Card } from "antd"

const ReadingArea = ({ wordObjects, textSize, translationOpacity }) => (
  <Card style={{ backgroundColor: "#EFF0F3", minHeight: 300, lineHeight: 1 }}>
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
)

export default ReadingArea
