import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaTrash, FaCloudUploadAlt, FaEdit, FaCheck } from "react-icons/fa";

function DocumentDashboard({ 
  token, 
  documents, 
  onUploadDocument, 
  onDeleteDocument, 
  onUpdateCategory, 
  fetchDocuments 
}) {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({
    total_files: 0,
    total_chunks: 0,
    total_size: 0,
    total_hits: 0,
  });
  
  const [uploadCategory, setUploadCategory] = useState("Uncategorized");
  const [customCategory, setCustomCategory] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [editDocId, setEditDocId] = useState(null);
  const [editCategoryVal, setEditCategoryVal] = useState("");

  const currentToken = token || localStorage.getItem("nextrus_token");
  const currentUser = JSON.parse(localStorage.getItem("nextrus_user"));

  // Fetch metrics statistics
  const fetchMetrics = async () => {
    if (!currentToken) return;
    try {
      const res = await fetch("http://127.0.0.1:8000/documents/stats", {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        setMetrics(data);
      }
    } catch (err) {
      console.error("Failed to fetch document stats:", err);
    }
  };

  useEffect(() => {
    if (!currentToken) {
      navigate("/login");
      return;
    }
    fetchDocuments();
    fetchMetrics();
  }, [currentToken, navigate]);

  // Format bytes
  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Upload handler for multiple files
  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setUploadStatus(`Indexing ${files.length} document(s)...`);

    const finalCategory = customCategory.trim() || uploadCategory;

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      try {
        setUploadStatus(`Processing (${i + 1}/${files.length}): ${files[i].name}...`);
        await onUploadDocument(files[i], finalCategory);
        successCount++;
      } catch (err) {
        console.error("Failed to upload file:", files[i].name, err);
        failCount++;
      }
    }

    setUploading(false);
    setUploadStatus(
      `Finished! Successfully indexed ${successCount} file(s).` +
      (failCount > 0 ? ` Failed ${failCount} file(s).` : "")
    );
    setCustomCategory("");
    
    // Refresh stats & document lists
    fetchDocuments();
    fetchMetrics();
  };

  // Start inline editing of category
  const startEditCategory = (doc) => {
    setEditDocId(doc.id);
    setEditCategoryVal(doc.category || "Uncategorized");
  };

  // Save inline category update
  const saveCategory = async (docId) => {
    if (!editCategoryVal.trim()) return;
    try {
      await onUpdateCategory(docId, editCategoryVal.trim());
      setEditDocId(null);
      fetchMetrics(); // reload category distribution metrics
    } catch (err) {
      console.error("Failed to update category:", err);
    }
  };

  const handleDelete = async (docId) => {
    if (window.confirm("Are you sure you want to delete this document? All embedded chunks will be permanently removed.")) {
      await onDeleteDocument(docId);
      fetchMetrics();
    }
  };

  return (
    <div className="admin-container">
      <div className="admin-header-row">
        <div className="admin-title-area">
          <h1>Document & Knowledge Dashboard</h1>
          <p>Index, categorize, and track usage statistics for your vector documents.</p>
        </div>
        <button className="back-btn" onClick={() => navigate("/chat")}>
          <FaArrowLeft />
          <span>Back to Chat</span>
        </button>
      </div>

      {/* Metrics Section */}
      <div className="dashboard-metrics">
        <div className="metric-card">
          <span className="metric-label">Total Documents</span>
          <span className="metric-value">{metrics.total_files}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Vector Chunks</span>
          <span className="metric-value">{metrics.total_chunks}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Total Storage Size</span>
          <span className="metric-value">{formatBytes(metrics.total_size)}</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Total Retrieval Hits</span>
          <span className="metric-value">{metrics.total_hits}</span>
        </div>
      </div>

      {/* Upload Widget */}
      <div className="upload-section-card">
        <h3 style={{ margin: "0 0 16px 0", fontSize: "18px", color: "var(--text-primary)" }}>
          Index Technical PDF Documents
        </h3>
        
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "20px" }}>
          <div className="form-group" style={{ flex: 1, minWidth: "200px" }}>
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              disabled={uploading}
            >
              <option value="Uncategorized">Uncategorized</option>
              <option value="Math">Mathematics</option>
              <option value="Computer Science">Computer Science</option>
              <option value="DSA">Data Structures & Algorithms</option>
              <option value="React">React Framework</option>
              <option value="AI/ML">Artificial Intelligence / ML</option>
              <option value="Database">Database Management</option>
            </select>
          </div>

          <div className="form-group" style={{ flex: 1, minWidth: "200px" }}>
            <label className="form-label">Or Custom Category</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Physics, Chemistry"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              disabled={uploading}
            />
          </div>
        </div>

        <label className="upload-drag-area" style={{ display: "block", opacity: uploading ? 0.7 : 1 }}>
          <FaCloudUploadAlt style={{ fontSize: "48px", color: "var(--accent-color)", marginBottom: "10px" }} />
          <p style={{ margin: "0 0 6px 0", fontWeight: "600", fontSize: "15px" }}>
            {uploading ? "Model is chunking & embedding..." : "Click or Drag PDFs to Upload & Index"}
          </p>
          <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
            Select multiple PDF files at once
          </span>
          <input
            type="file"
            accept=".pdf"
            multiple
            style={{ display: "none" }}
            onChange={handleFileUpload}
            disabled={uploading}
          />
        </label>

        {uploadStatus && (
          <div 
            style={{ 
              marginTop: "16px", 
              padding: "12px", 
              borderRadius: "10px", 
              background: "rgba(99, 102, 241, 0.08)",
              color: "#a5b4fc",
              fontSize: "14px",
              textAlign: "center"
            }}
          >
            {uploadStatus}
          </div>
        )}
      </div>

      {/* Documents Table */}
      <h3 style={{ margin: "20px 0 12px 0", fontSize: "20px", color: "var(--text-primary)" }}>
        Manage Documents Database
      </h3>

      <div className="admin-card-table">
        <table className="users-table">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Category</th>
              <th>File Size</th>
              <th>Vector Chunks</th>
              <th>Retrieval Hits</th>
              <th>Date Indexed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", color: "var(--text-secondary)", fontStyle: "italic", padding: "20px" }}>
                  No indexed PDF documents found. Upload files above to build your vector knowledge base.
                </td>
              </tr>
            )}
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td style={{ fontWeight: 500 }}>📄 {doc.filename}</td>
                <td>
                  {editDocId === doc.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <input
                        type="text"
                        className="category-input"
                        value={editCategoryVal}
                        onChange={(e) => setEditCategoryVal(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveCategory(doc.id);
                          if (e.key === "Escape") setEditDocId(null);
                        }}
                        autoFocus
                      />
                      <FaCheck 
                        style={{ color: "#10b981", cursor: "pointer", fontSize: "12px" }}
                        onClick={() => saveCategory(doc.id)}
                      />
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="editable-category" onClick={() => startEditCategory(doc)}>
                        {doc.category || "Uncategorized"}
                      </span>
                      <FaEdit 
                        style={{ color: "var(--text-secondary)", cursor: "pointer", fontSize: "11px", opacity: 0.5 }}
                        onClick={() => startEditCategory(doc)}
                      />
                    </div>
                  )}
                </td>
                <td>{formatBytes(doc.file_size)}</td>
                <td>{doc.chunk_count} chunks</td>
                <td>
                  <span style={{ 
                    background: doc.hit_count > 0 ? "rgba(16, 185, 129, 0.12)" : "rgba(255,255,255,0.03)",
                    color: doc.hit_count > 0 ? "#34d399" : "var(--text-secondary)",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    fontWeight: "600",
                    fontSize: "12px"
                  }}>
                    {doc.hit_count} hits
                  </span>
                </td>
                <td>{new Date(doc.uploaded_at).toLocaleDateString()}</td>
                <td>
                  <button 
                    style={{ 
                      background: "transparent", 
                      border: "none", 
                      color: "#ef4444", 
                      cursor: "pointer",
                      padding: "6px",
                      borderRadius: "6px"
                    }}
                    onClick={() => handleDelete(doc.id)}
                    title="Delete document"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DocumentDashboard;
