import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";

import Sidebar from "./components/Sidebar";
import Message from "./components/Message";
import ChatInput from "./components/ChatInput";
import Login from "./components/Login";
import Register from "./components/Register";
import AdminDashboard from "./components/AdminDashboard";
import DocumentDashboard from "./components/DocumentDashboard";

import "./App.css";

function AppContent() {
  const navigate = useNavigate();

  // Authentication State
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("nextrus_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });
  
  const [token, setToken] = useState(() => {
    return localStorage.getItem("nextrus_token") || null;
  });

  // Chat/Conversation States
  const [chats, setChats] = useState([]); // holds conversation list
  const [currentChatId, setCurrentChatId] = useState(null);
  const [activeMessages, setActiveMessages] = useState([]); // holds messages for selected chat
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  // RAG Document State
  const [documents, setDocuments] = useState([]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });
  }, [activeMessages, loading]);

  // Fetch all conversations for the authenticated user
  const fetchConversations = async (search = "") => {
    if (!token) return;
    try {
      const url = search 
        ? `http://127.0.0.1:8000/conversations?search=${encodeURIComponent(search)}`
        : `http://127.0.0.1:8000/conversations`;
        
      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (res.status === 401) {
        handleLogout();
        return;
      }
      
      const data = await res.json();
      if (res.ok) {
        setChats(data);
      }
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    }
  };

  // Fetch uploaded documents
  const fetchDocuments = async () => {
    if (!token) return;
    try {
      const res = await fetch("http://127.0.0.1:8000/documents", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setDocuments(data);
      }
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    }
  };

  // Trigger search with debouncing when searchQuery changes
  useEffect(() => {
    if (token) {
      const delayDebounce = setTimeout(() => {
        fetchConversations(searchQuery);
      }, 300);
      return () => clearTimeout(delayDebounce);
    }
  }, [searchQuery, token]);

  // Initial load when logged in
  useEffect(() => {
    if (token) {
      fetchConversations("");
      fetchDocuments();
    }
  }, [token]);

  // Fetch messages when a different conversation is selected
  useEffect(() => {
    const fetchMessages = async () => {
      if (!token || !currentChatId) {
        setActiveMessages([]);
        return;
      }
      try {
        const res = await fetch(`http://127.0.0.1:8000/conversations/${currentChatId}/messages`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        
        if (res.status === 401) {
          handleLogout();
          return;
        }
        
        const data = await res.json();
        if (res.ok) {
          setActiveMessages(data);
        }
      } catch (err) {
        console.error("Failed to fetch message history:", err);
      }
    };

    fetchMessages();
  }, [currentChatId, token]);

  const handleLoginSuccess = (loggedInUser, userToken) => {
    setUser(loggedInUser);
    setToken(userToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("nextrus_token");
    localStorage.removeItem("nextrus_user");
    setUser(null);
    setToken(null);
    setChats([]);
    setDocuments([]);
    setCurrentChatId(null);
    setActiveMessages([]);
    setSearchQuery("");
    navigate("/login");
  };

  const createChat = async () => {
    if (!token) return;
    const newId = uuidv4();
    try {
      const res = await fetch("http://127.0.0.1:8000/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          id: newId,
          title: "New Chat"
        })
      });
      
      const data = await res.json();
      if (res.ok) {
        setChats(prev => [data, ...prev]);
        setCurrentChatId(newId);
      }
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
  };

  const deleteChat = async (id) => {
    if (!token) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/conversations/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const updated = chats.filter(chat => chat.id !== id);
        setChats(updated);
        if (currentChatId === id) {
          setCurrentChatId(updated.length ? updated[0].id : null);
        }
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  // RAG Document Actions
  const uploadDocument = async (file, category = "Uncategorized") => {
    if (!token) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    const res = await fetch("http://127.0.0.1:8000/documents/upload", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Upload failed");
    }

    setDocuments(prev => [data.document, ...prev]);
  };

  const updateDocumentCategory = async (id, category) => {
    if (!token) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/documents/${id}/category`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ category })
      });
      
      if (res.ok) {
        setDocuments(prev => prev.map(d => d.id === id ? { ...d, category } : d));
      }
    } catch (err) {
      console.error("Failed to update category:", err);
    }
  };

  const deleteDocument = async (id) => {
    if (!token) return;
    try {
      const res = await fetch(`http://127.0.0.1:8000/documents/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (res.ok) {
        setDocuments(prev => prev.filter(d => d.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const sendMessage = async (text) => {
    if (!currentChatId || !token) return;

    // Show user message immediately in state
    setActiveMessages(prev => [
      ...prev,
      {
        sender: "user",
        text,
        time: new Date().toLocaleTimeString()
      }
    ]);
    
    setLoading(true);

    try {
      const res = await fetch("http://127.0.0.1:8000/ask", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: text,
          conversation_id: currentChatId
        })
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Request failed");
      }

      // Add AI response to messages state with citations and confidence
      setActiveMessages(prev => [
        ...prev,
        {
          sender: "ai",
          text: data.response,
          sources: data.sources || [],
          confidence_score: data.confidence_score || 0,
          time: new Date().toLocaleTimeString()
        }
      ]);

      // Refresh list to show updated conversation titles and timestamps
      fetchConversations(searchQuery);
    } catch (err) {
      setActiveMessages(prev => [
        ...prev,
        {
          sender: "ai",
          text: `Error: ${err.message || "Unable to connect to backend."}`,
          time: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Routes>
      {/* Public Authentication Routes */}
      <Route
        path="/login"
        element={
          token ? <Navigate to="/chat" replace /> : <Login onLoginSuccess={handleLoginSuccess} />
        }
      />
      <Route
        path="/register"
        element={
          token ? <Navigate to="/chat" replace /> : <Register />
        }
      />

      {/* Protected Main Chat Application */}
      <Route
        path="/chat"
        element={
          token ? (
            <div className="container">
              <Sidebar
                chats={chats}
                currentChatId={currentChatId}
                setCurrentChatId={setCurrentChatId}
                createChat={createChat}
                deleteChat={deleteChat}
                user={user}
                onLogout={handleLogout}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                documents={documents}
                onUploadDocument={uploadDocument}
                onDeleteDocument={deleteDocument}
              />

              <div className="chat-area">
                <div className="header">
                  <div>
                    <h2>Nextrus AI</h2>
                    <p>Coding Mentor</p>
                  </div>
                  <div className="online-status">
                    <div className="dot"></div>
                    Online
                  </div>
                </div>

                <div className="messages">
                  {!currentChatId && (
                    <div className="welcome">
                      <h1>Welcome to Nextrus AI</h1>
                      <p>
                        Ask Python, DSA, AI, ML or React questions. Logged in as{" "}
                        <strong style={{ color: "#6366f1" }}>{user?.username}</strong> ({user?.role}).
                      </p>
                      <button className="welcome-btn" onClick={createChat}>
                        Start New Chat
                      </button>
                    </div>
                  )}

                  {currentChatId && activeMessages.map((msg, i) => (
                    <Message key={i} message={msg} />
                  ))}

                  {loading && (
                    <div className="typing">
                      🤖 Nextrus AI is thinking...
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {currentChatId && (
                  <ChatInput sendMessage={sendMessage} />
                )}
              </div>
            </div>
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Protected Admin Dashboard Route */}
      <Route
        path="/admin"
        element={
          token ? (
            user?.role === "Admin" ? (
              <AdminDashboard user={user} token={token} />
            ) : (
              <Navigate to="/chat" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Protected Document Management Dashboard Route */}
      <Route
        path="/documents"
        element={
          token ? (
            <DocumentDashboard 
              token={token} 
              documents={documents} 
              onUploadDocument={uploadDocument} 
              onDeleteDocument={deleteDocument} 
              onUpdateCategory={updateDocumentCategory}
              fetchDocuments={fetchDocuments}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Default Catch-all Route */}
      <Route
        path="*"
        element={<Navigate to={token ? "/chat" : "/login"} replace />}
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;