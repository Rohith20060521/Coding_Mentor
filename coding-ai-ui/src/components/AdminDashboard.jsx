import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaUserShield, FaUserGraduate } from "react-icons/fa";

function AdminDashboard({ user, token }) {
  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // If user is not authenticated or not Admin, redirect them immediately
  const currentUser = user || JSON.parse(localStorage.getItem("nextrus_user"));
  const currentToken = token || localStorage.getItem("nextrus_token");

  useEffect(() => {
    if (!currentUser || currentUser.role !== "Admin") {
      navigate("/chat");
      return;
    }

    const fetchUsers = async () => {
      try {
        const response = await fetch("http://127.0.0.1:8000/admin/users", {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Failed to fetch users");
        }

        setUsersList(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [currentUser, currentToken, navigate]);

  if (!currentUser || currentUser.role !== "Admin") {
    return null; // Don't render anything while redirecting
  }

  return (
    <div className="admin-container">
      <div className="admin-header-row">
        <div className="admin-title-area">
          <h1>Admin Command Center</h1>
          <p>Manage and monitor registered users and system authorization.</p>
        </div>
        <button className="back-btn" onClick={() => navigate("/chat")}>
          <FaArrowLeft />
          <span>Back to Chat</span>
        </button>
      </div>

      {loading && <div className="typing">🤖 Loading system users list...</div>}
      {error && <div className="error-message">{error}</div>}

      {!loading && !error && (
        <div className="admin-card-table">
          <table className="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Role</th>
                <th>Registration Date</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map((usr) => (
                <tr key={usr.id}>
                  <td>{usr.id}</td>
                  <td style={{ fontWeight: 600 }}>{usr.username}</td>
                  <td>{usr.email}</td>
                  <td>
                    <span
                      className={`role-badge ${
                        usr.role === "Admin" ? "role-admin" : "role-student"
                      }`}
                    >
                      {usr.role === "Admin" ? (
                        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <FaUserShield /> Admin
                        </span>
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <FaUserGraduate /> Student
                        </span>
                      )}
                    </span>
                  </td>
                  <td>{new Date(usr.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
