import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const DEFAULT_CATEGORIES = [
  'Health & Medicine',
  'Pharmacy Inventory',
  'Store Operation',
  'Compliance',
  'Equipment',
  'General'
];

function App() {
  // Theme state
  const [theme, setTheme] = useState(() => localStorage.getItem('taskflow_theme') || 'dark');

  // Application data state
  const [todos, setTodos] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, high_priority: 0, categories: [] });
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [statusFilter, setStatusFilter] = useState('all'); // all, active, completed, high
  const [sortBy, setSortBy] = useState('-created_at');

  // Create Form State
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('Health & Medicine');
  const [newPriority, setNewPriority] = useState('medium');
  const [newDueDate, setNewDueDate] = useState('');

  // Modals & Popups
  const [editingTodo, setEditingTodo] = useState(null);
  const [deletingTodo, setDeletingTodo] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Toast Notification Trigger
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  // Sync theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('taskflow_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Fetch Database & Health Info
  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health/`);
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      } else {
        setHealth({ db_connected: false, error: 'Health check failed' });
      }
    } catch (err) {
      setHealth({ db_connected: false, error: err.message });
    }
  }, []);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stats/`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  }, []);

  // Fetch Todos with query filters
  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (selectedCategory !== 'All') params.append('category', selectedCategory);
      if (statusFilter === 'active') params.append('completed', 'false');
      if (statusFilter === 'completed') params.append('completed', 'true');
      if (statusFilter === 'high') params.append('priority', 'high');
      if (sortBy) params.append('ordering', sortBy);

      const res = await fetch(`${API_BASE}/api/todos/?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      setTodos(data);
    } catch (err) {
      console.error('Failed to load todos', err);
      addToast(`Could not fetch tasks: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, statusFilter, sortBy, addToast]);

  // Initial Load
  useEffect(() => {
    fetchHealth();
    fetchStats();
    fetchTodos();
  }, [fetchHealth, fetchStats, fetchTodos]);

  // CREATE Todo
  const handleCreateTodo = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      addToast('Please enter a task title', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: newTitle.trim(),
        description: newDescription.trim(),
        category: newCategory,
        priority: newPriority,
        due_date: newDueDate || null,
        completed: false,
      };

      const res = await fetch(`${API_BASE}/api/todos/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create task');
      }

      const created = await res.json();
      setTodos((prev) => [created, ...prev]);
      setNewTitle('');
      setNewDescription('');
      setNewDueDate('');
      addToast('Task added to PostgreSQL successfully! 🎉', 'success');
      fetchStats();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // TOGGLE Complete (PATCH)
  const handleToggleComplete = async (todo) => {
    try {
      const updatedStatus = !todo.completed;
      // Optimistic update
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, completed: updatedStatus } : t))
      );

      const res = await fetch(`${API_BASE}/api/todos/${todo.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: updatedStatus }),
      });

      if (!res.ok) throw new Error('Failed to update task status');
      const updated = await res.json();
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? updated : t)));
      addToast(
        updatedStatus ? 'Marked task as completed ✅' : 'Marked task as active 🔄',
        'info'
      );
      fetchStats();
    } catch (err) {
      // Revert optimistic update
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, completed: todo.completed } : t))
      );
      addToast(err.message, 'error');
    }
  };

  // UPDATE Todo (PUT)
  const handleUpdateTodo = async (e) => {
    e.preventDefault();
    if (!editingTodo || !editingTodo.title.trim()) {
      addToast('Title cannot be empty', 'error');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/todos/${editingTodo.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingTodo.title.trim(),
          description: editingTodo.description || '',
          category: editingTodo.category || 'General',
          priority: editingTodo.priority || 'medium',
          due_date: editingTodo.due_date || null,
          completed: editingTodo.completed,
        }),
      });

      if (!res.ok) throw new Error('Failed to update task');
      const updated = await res.json();
      setTodos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingTodo(null);
      addToast('Task updated successfully! 💾', 'success');
      fetchStats();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // DELETE Todo
  const handleDeleteConfirm = async () => {
    if (!deletingTodo) return;
    try {
      const res = await fetch(`${API_BASE}/api/todos/${deletingTodo.id}/`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete task');

      setTodos((prev) => prev.filter((t) => t.id !== deletingTodo.id));
      addToast(`"${deletingTodo.title}" deleted from database.`, 'info');
      setDeletingTodo(null);
      fetchStats();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // CLEAR COMPLETED
  const handleClearCompleted = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/todos/clear-completed/`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to clear completed tasks');
      const data = await res.json();
      setTodos((prev) => prev.filter((t) => !t.completed));
      addToast(`Cleared ${data.deleted_count} completed task(s)!`, 'success');
      fetchStats();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // SEED SAMPLE DATA
  const handleSeedData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/todos/seed/`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to seed sample tasks');
      const data = await res.json();
      addToast(data.message, 'success');
      fetchTodos();
      fetchStats();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // Categories list union
  const allCategories = useMemo(() => {
    const set = new Set([...DEFAULT_CATEGORIES, ...(stats.categories || [])]);
    return ['All', ...Array.from(set)];
  }, [stats.categories]);

  // Check if date is overdue
  const isOverdue = (dueDate, completed) => {
    if (!dueDate || completed) return false;
    const today = new Date().toISOString().split('T')[0];
    return dueDate < today;
  };

  return (
    <div className="app-container">
      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span>
              {toast.type === 'success' && '✓'}
              {toast.type === 'error' && '✕'}
              {toast.type === 'info' && 'ℹ'}
            </span>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Top Header / Navigation */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon-wrapper">💊</div>
          <div>
            <h1 className="brand-title">
              MedicineHub & TaskFlow
            </h1>
            <p className="brand-subtitle">
              Live PostgreSQL + Django REST CRUD Architecture
            </p>
          </div>
        </div>

        <div className="header-actions">
          {/* PostgreSQL Status Indicator */}
          <div
            className={`db-status-pill ${health?.db_connected ? 'connected' : 'error'}`}
            title={health?.db_version || health?.error || 'Connecting to database...'}
            onClick={() => {
              fetchHealth();
              addToast(
                health?.db_connected
                  ? `Connected to PostgreSQL database "${health?.db_name}" on host "${health?.db_host}"`
                  : 'Database disconnected!',
                health?.db_connected ? 'success' : 'error'
              );
            }}
          >
            <span className={`status-dot ${health?.db_connected ? 'pulse' : ''}`} />
            <span>
              {health?.db_connected
                ? `PostgreSQL (${health.db_name})`
                : 'DB Offline'}
            </span>
          </div>

          <button
            className="refresh-btn"
            onClick={() => {
              fetchTodos();
              fetchStats();
              fetchHealth();
              addToast('Refreshed data from backend', 'info');
            }}
            title="Refresh from server"
          >
            🔄
          </button>

          <button
            className="theme-btn"
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Analytics / Stats Metrics */}
      <div className="stats-grid">
        <div className="stat-card" style={{ '--card-accent': '#6366f1' }}>
          <div className="stat-info">
            <div className="stat-label">Total Tasks</div>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-icon">📋</div>
        </div>

        <div className="stat-card" style={{ '--card-accent': '#10b981' }}>
          <div className="stat-info">
            <div className="stat-label">Completed</div>
            <div className="stat-value">{stats.completed}</div>
          </div>
          <div className="stat-icon">✅</div>
        </div>

        <div className="stat-card" style={{ '--card-accent': '#f59e0b' }}>
          <div className="stat-info">
            <div className="stat-label">Pending</div>
            <div className="stat-value">{stats.pending}</div>
          </div>
          <div className="stat-icon">⏳</div>
        </div>

        <div className="stat-card" style={{ '--card-accent': '#ef4444' }}>
          <div className="stat-info">
            <div className="stat-label">High Priority</div>
            <div className="stat-value">{stats.high_priority}</div>
          </div>
          <div className="stat-icon">🔥</div>
        </div>
      </div>

      {/* Create Task Card Form */}
      <section className="create-task-card">
        <div className="form-header">
          <div className="form-title">
            <span>✨</span> Create New Task or Medicine Operation
          </div>
          <button
            type="button"
            className="quick-seed-btn"
            onClick={handleSeedData}
            title="Populate demo medicine inventory tasks"
          >
            ⚡ Load Demo Sample Tasks
          </button>
        </div>

        <form onSubmit={handleCreateTodo} className="form-body">
          <div className="title-input-row">
            <input
              type="text"
              className="main-input"
              placeholder="What needs to be done? (e.g. Dispense Amoxicillin, Inspect Fridge Temp...)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              disabled={submitting}
              autoFocus
            />
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting || !newTitle.trim()}
            >
              {submitting ? 'Adding...' : '+ Add Task'}
            </button>
          </div>

          <div className="form-options-row">
            <input
              type="text"
              className="desc-input"
              placeholder="Additional notes / instructions (optional)..."
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              disabled={submitting}
            />

            <select
              className="select-input"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              disabled={submitting}
            >
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <input
              type="date"
              className="date-input"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
              title="Due date (optional)"
              disabled={submitting}
            />
          </div>

          <div className="priority-selector">
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Priority:
            </span>
            {(['low', 'medium', 'high']).map((prio) => (
              <button
                key={prio}
                type="button"
                className={`prio-btn ${prio} ${newPriority === prio ? 'active' : ''}`}
                onClick={() => setNewPriority(prio)}
              >
                {prio === 'high' && '🔴 '}
                {prio === 'medium' && '🟡 '}
                {prio === 'low' && '🟢 '}
                {prio.charAt(0).toUpperCase() + prio.slice(1)}
              </button>
            ))}
          </div>
        </form>
      </section>

      {/* Filter and Search Controls */}
      <div className="controls-bar">
        <div className="search-and-actions">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              className="search-input"
              placeholder="Search tasks by title or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="clear-search-btn"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>

          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="-created_at">Sort: Newest First</option>
            <option value="created_at">Sort: Oldest First</option>
            <option value="due_date">Sort: Due Date (Earliest)</option>
            <option value="-priority">Sort: Priority</option>
            <option value="title">Sort: Title (A-Z)</option>
          </select>

          {stats.completed > 0 && (
            <button
              className="btn-secondary"
              onClick={handleClearCompleted}
              style={{ whiteSpace: 'nowrap', fontSize: '13px', padding: '10px 14px' }}
            >
              🧹 Clear Completed ({stats.completed})
            </button>
          )}
        </div>

        {/* Filter Tabs & Category Pills */}
        <div className="filter-tabs">
          <div className="status-tabs">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'completed', label: 'Completed' },
              { id: 'high', label: 'High Priority' },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`tab-btn ${statusFilter === tab.id ? 'active' : ''}`}
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="category-pills">
            {allCategories.map((cat) => (
              <button
                key={cat}
                className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Todo Items List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          Loading tasks from PostgreSQL...
        </div>
      ) : todos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h2 className="empty-title">No tasks found</h2>
          <p className="empty-subtitle">
            {searchQuery || selectedCategory !== 'All' || statusFilter !== 'all'
              ? 'Try adjusting your filters or search terms.'
              : 'Your task list is empty. Add a task above or load the sample medicine operations.'}
          </p>
          <button className="btn-primary" onClick={handleSeedData}>
            ⚡ Populate Sample Tasks
          </button>
        </div>
      ) : (
        <div className="todo-list">
          {todos.map((todo) => {
            const overdue = isOverdue(todo.due_date, todo.completed);
            return (
              <div
                key={todo.id}
                className={`todo-item ${todo.completed ? 'completed' : ''}`}
              >
                {/* Custom Checkbox */}
                <label className="custom-checkbox">
                  <input
                    type="checkbox"
                    className="checkbox-input"
                    checked={todo.completed}
                    onChange={() => handleToggleComplete(todo)}
                  />
                  <div className="checkbox-box">✓</div>
                </label>

                {/* Content */}
                <div className="todo-content">
                  <div className="todo-title-row">
                    <span className="todo-title">{todo.title}</span>
                  </div>

                  {todo.description && (
                    <p className="todo-description">{todo.description}</p>
                  )}

                  <div className="todo-meta-row">
                    <span className={`meta-badge prio-${todo.priority}`}>
                      {todo.priority === 'high' && '🔴 High'}
                      {todo.priority === 'medium' && '🟡 Medium'}
                      {todo.priority === 'low' && '🟢 Low'}
                    </span>

                    {todo.category && (
                      <span className="meta-badge category">
                        🏷️ {todo.category}
                      </span>
                    )}

                    {todo.due_date && (
                      <span className={`meta-badge ${overdue ? 'overdue' : 'date'}`}>
                        📅 {todo.due_date} {overdue && '• Overdue!'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="todo-actions">
                  <button
                    className="action-btn"
                    onClick={() => setEditingTodo({ ...todo })}
                    title="Edit task"
                  >
                    ✏️
                  </button>
                  <button
                    className="action-btn delete"
                    onClick={() => setDeletingTodo(todo)}
                    title="Delete task"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Todo Modal */}
      {editingTodo && (
        <div className="modal-overlay" onClick={() => setEditingTodo(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Edit Task</h2>
              <button
                className="modal-close"
                onClick={() => setEditingTodo(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateTodo}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Task Title</label>
                  <input
                    type="text"
                    className="main-input"
                    value={editingTodo.title}
                    onChange={(e) =>
                      setEditingTodo({ ...editingTodo, title: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="main-input"
                    rows="3"
                    value={editingTodo.description || ''}
                    onChange={(e) =>
                      setEditingTodo({ ...editingTodo, description: e.target.value })
                    }
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="select-input"
                      value={editingTodo.category}
                      onChange={(e) =>
                        setEditingTodo({ ...editingTodo, category: e.target.value })
                      }
                    >
                      {DEFAULT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Due Date</label>
                    <input
                      type="date"
                      className="date-input"
                      value={editingTodo.due_date || ''}
                      onChange={(e) =>
                        setEditingTodo({ ...editingTodo, due_date: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <div className="priority-selector">
                    {(['low', 'medium', 'high']).map((prio) => (
                      <button
                        key={prio}
                        type="button"
                        className={`prio-btn ${prio} ${editingTodo.priority === prio ? 'active' : ''}`}
                        onClick={() =>
                          setEditingTodo({ ...editingTodo, priority: prio })
                        }
                      >
                        {prio === 'high' && '🔴 '}
                        {prio === 'medium' && '🟡 '}
                        {prio === 'low' && '🟢 '}
                        {prio.charAt(0).toUpperCase() + prio.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingTodo(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTodo && (
        <div className="modal-overlay" onClick={() => setDeletingTodo(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Delete Task?</h2>
              <button
                className="modal-close"
                onClick={() => setDeletingTodo(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>
                Are you sure you want to delete{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  "{deletingTodo.title}"
                </strong>
                ? This will permanently remove the record from your PostgreSQL database.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeletingTodo(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDeleteConfirm}
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
