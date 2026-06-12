import { useState } from "react";

import { FaPaperPlane } from "react-icons/fa";

function ChatInput({ sendMessage }) {

  const [text, setText] = useState("");

  const submit = () => {

    if (!text.trim()) return;

    sendMessage(text);
    setText("");
  };

  return (

    <div className="input-wrapper">

      <div className="input-area">

        <input
          value={text}
          placeholder="Ask Nextrus AI anything..."
          onChange={(e) =>
            setText(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              submit();
            }
          }}
        />

        <button
          onClick={submit}
          className="send-btn"
        >
          <FaPaperPlane />
        </button>

      </div>

    </div>
  );
}

export default ChatInput;