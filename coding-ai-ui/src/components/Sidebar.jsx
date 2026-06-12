import { useState } from "react";
import {
  FaPlus,
  FaTrash,
  FaHistory,
  FaSignOutAlt,
  FaShieldAlt
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

function Sidebar({
  chats,
  currentChatId,
  setCurrentChatId,
  createChat,
  deleteChat,
  user,
  onLogout,
  searchQuery,
  setSearchQuery,
  documents,
  onUploadDocument,
  onDeleteDocument
}) {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    setUploadError("");
    try {
      await onUploadDocument(file);
    } catch (err) {
      setUploadError(err.message || "Failed to index PDF");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="sidebar">
      <div>
        <div className="logo">
          <span className="logo-icon">🤖</span>
          <span>Nextrus AI</span>
        </div>

        <button
          className="new-chat-btn"
          onClick={createChat}
        >
          <FaPlus />
          <span>New Chat</span>
        </button>

        {/* Search Bar */}
        <div className="search-wrapper" style={{ marginTop: "16px", marginBottom: "8px" }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search chat history..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", fontSize: "13.5px" }}
          />
        </div>

        <div className="chat-list">
          {chats.length === 0 && (
            <div className="empty-history">
              No chats found
            </div>
          )}

          {chats.map((chat) => (
            <div
              key={chat.id}
              className={
                currentChatId === chat.id
                  ? "chat-item active"
                  : "chat-item"
              }
            >
              <div
                className="chat-title"
                onClick={() =>
                  setCurrentChatId(chat.id)
                }
                style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "4px" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                  <FaHistory style={{ flexShrink: 0 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {chat.title}
                  </span>
                </div>
                {chat.updated_at && (
                  <span style={{ fontSize: "11px", color: "var(--text-secondary)", marginLeft: "22px" }}>
                    {new Date(chat.updated_at).toLocaleDateString()} {new Date(chat.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              <FaTrash
                className="delete-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChat(chat.id);
                }}
              />
            </div>
          ))}
        </div>

        {/* RAG Knowledge Base PDF Section */}
        <div className="knowledge-base" style={{ marginTop: "20px", borderTop: "1px solid var(--border-color)", paddingTop: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-primary)" }}>Knowledge Base (PDF)</span>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <span 
                style={{ cursor: "pointer", color: "#a5b4fc", fontSize: "12.5px", fontWeight: 500 }}
                onClick={() => navigate("/documents")}
              >
                Manage
              </span>
              <label style={{ cursor: "pointer", color: "#818cf8", fontSize: "12.5px", display: "flex", alignItems: "center", gap: "3px", fontWeight: 500 }}>
                <FaPlus /> Upload
                <input
                  type="file"
                  accept=".pdf"
                  style={{ display: "none" }}
                  onChange={handlePdfUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
          
          {uploading && (
            <div style={{ fontSize: "11.5px", color: "#a5b4fc", margin: "6px 0", animation: "pulse 1.5s infinite" }}>
              🤖 Indexing PDF chunks & vectors...
            </div>
          )}
          {uploadError && (
            <div style={{ fontSize: "11px", color: "#fca5a5", margin: "4px 0" }}>
              ⚠️ {uploadError}
            </div>
          )}

          <div style={{ maxHeight: "110px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", paddingRight: "4px" }}>
            {documents.length === 0 && !uploading && (
              <div style={{ color: "var(--text-secondary)", fontSize: "12px", fontStyle: "italic", padding: "4px 0" }}>
                No PDF documents indexed.
              </div>
            )}
            {documents.map((doc) => (
              <div 
                key={doc.id} 
                style={{ 
                  display: "flex", 
                  justifyContent: "space-between", 
                  alignItems: "center", 
                  background: "rgba(255, 255, 255, 0.03)", 
                  padding: "8px 10px", 
                  border: "1px solid var(--glass-border)",
                  borderRadius: "8px",
                  fontSize: "12px"
                }}
              >
                <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap", maxWidth: "160px" }} title={doc.filename}>
                  📄 {doc.filename}
                </span>
                <FaTrash 
                  style={{ color: "#ef4444", cursor: "pointer", fontSize: "11px", opacity: 0.7 }}
                  onClick={() => onDeleteDocument(doc.id)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sidebar-footer">
        {user && (
          <div className="user-profile">
            <div className="user-avatar">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{user.username}</span>
              <span
                className={`user-role-badge ${
                  user.role === "Admin" ? "role-admin" : "role-student"
                }`}
              >
                {user.role}
              </span>
            </div>
          </div>
        )}

        {user?.role === "Admin" && (
          <button
            className="sidebar-action-btn admin-btn"
            onClick={() => navigate("/admin")}
          >
            <FaShieldAlt />
            <span>Admin Panel</span>
          </button>
        )}

        <button
          className="sidebar-action-btn logout-btn"
          onClick={onLogout}
        >
          <FaSignOutAlt />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;