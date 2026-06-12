import ReactMarkdown from "react-markdown";
import {
  FaRobot,
  FaUser,
  FaCopy
} from "react-icons/fa";

function Message({ message }) {
  const copyText = () => {
    navigator.clipboard.writeText(message.text);
  };

  return (
    <div
      className={
        message.sender === "user"
          ? "message user"
          : "message ai"
      }
    >
      <div className="message-header">
        <div className="sender">
          <div className="avatar">
            {message.sender === "user" ? (
              <FaUser />
            ) : (
              <FaRobot />
            )}
          </div>
          <strong>
            {message.sender === "user"
              ? "You"
              : "Nextrus AI"}
          </strong>
        </div>

        <FaCopy
          className="copy-btn"
          onClick={copyText}
          title="Copy message"
        />
      </div>

      <div className="message-content">
        {message.sender === "ai" ? (
          <ReactMarkdown>
            {message.text}
          </ReactMarkdown>
        ) : (
          message.text
        )}
      </div>

      {/* RAG PDF Sources */}
      {message.sender === "ai" && message.sources && message.sources.length > 0 && (
        <div className="message-sources" style={{ marginTop: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.05)", paddingTop: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)" }}>
              Sources Used:
            </span>
            {message.confidence_score > 0 && (
              <span 
                style={{ 
                  fontSize: "10.5px", 
                  fontWeight: "700", 
                  background: "rgba(16, 185, 129, 0.15)", 
                  color: "#34d399", 
                  padding: "2px 6px", 
                  borderRadius: "4px",
                  textTransform: "uppercase"
                }}
              >
                Match Confidence: {message.confidence_score}%
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {message.sources.map((src, idx) => (
              <span 
                key={idx} 
                style={{ 
                  fontSize: "11px", 
                  background: "rgba(99, 102, 241, 0.1)", 
                  color: "#a5b4fc", 
                  border: "1px solid rgba(99, 102, 241, 0.2)", 
                  padding: "2px 6px", 
                  borderRadius: "6px",
                  display: "inline-flex",
                  alignItems: "center"
                }}
                title={src.content_snippet}
              >
                📄 {src.filename} (Pg. {src.page})
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="message-footer">
        {message.time}
      </div>
    </div>
  );
}

export default Message;