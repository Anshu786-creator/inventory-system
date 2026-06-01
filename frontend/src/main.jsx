import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API_BASE = import.meta.env.VITE_API_BASE || '/inventory-system/backend/api/index.php';
const roles = ['user', 'inventory_head', 'admin'];

function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('inventory_user') || 'null'));
  const [view, setView] = useState(user ? 'dashboard' : 'login');
  const [message, setMessage] = useState('');

  const api = useMemo(() => async (action, options = {}) => {
    const response = await fetch(`${API_BASE}?action=${action}`, {
      method: options.method || 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }, []);

  function saveLogin(nextUser) {
    localStorage.setItem('inventory_user', JSON.stringify(nextUser));
    setUser(nextUser);
    setView('dashboard');
  }

  async function logout() {
    try {
      await api('logout', { method: 'POST' });
    } catch {
      // Local state is cleared even if the session is already expired.
    }
    localStorage.removeItem('inventory_user');
    setUser(null);
    setView('login');
  }

  function flash(text) {
    setMessage(text);
    setTimeout(() => setMessage(''), 3500);
  }

  useEffect(() => {
    if (!user) return;
    api('me')
      .then((data) => {
        localStorage.setItem('inventory_user', JSON.stringify(data.user));
        setUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem('inventory_user');
        setUser(null);
        setView('login');
      });
  }, []);

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-box">
          <h1>Inventory Management System</h1>
          <p className="muted">Local network ready. No CDN links are used.</p>
          {view === 'register' ? (
            <Register api={api} onDone={() => setView('login')} flash={flash} />
          ) : (
            <Login api={api} onLogin={saveLogin} flash={flash} />
          )}
          <button className="link-button" onClick={() => setView(view === 'register' ? 'login' : 'register')}>
            {view === 'register' ? 'Already registered? Login' : 'Need an account? Register'}
          </button>
          {message && <div className="notice">{message}</div>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <h2>Inventory</h2>
        <div className="user-card">
          <strong>{user.name}</strong>
          <span>{user.email}</span>
          <small>{labelRole(user.role)}</small>
        </div>
        {['dashboard', 'profile', 'transfers'].map((item) => (
          <button key={item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>
            {title(item)}
          </button>
        ))}
        {user.role === 'admin' && (
          <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>Admin</button>
        )}
        <button onClick={logout}>Logout</button>
      </aside>

      <section className="content">
        {message && <div className="notice">{message}</div>}
        {view === 'dashboard' && <Dashboard api={api} user={user} flash={flash} />}
        {view === 'profile' && <Profile api={api} user={user} setUser={setUser} flash={flash} />}
        {view === 'transfers' && <Transfers api={api} user={user} flash={flash} />}
        {view === 'admin' && user.role === 'admin' && <AdminPanel api={api} flash={flash} />}
      </section>
    </main>
  );
}

function Login({ api, onLogin, flash }) {
  const [form, setForm] = useState({ email: 'admin@example.com', password: 'Admin@123' });
  return (
    <form className="form-grid" onSubmit={async (event) => {
      event.preventDefault();
      try {
        const data = await api('login', { method: 'POST', body: form });
        onLogin(data.user);
      } catch (error) {
        flash(error.message);
      }
    }}>
      <label>Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
      <button type="submit">Login</button>
    </form>
  );
}

function Register({ api, onDone, flash }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  return (
    <form className="form-grid" onSubmit={async (event) => {
      event.preventDefault();
      try {
        const data = await api('register', { method: 'POST', body: form });
        flash(data.message);
        onDone();
      } catch (error) {
        flash(error.message);
      }
    }}>
      <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
      <label>Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
      <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 chars and special character" /></label>
      <button type="submit">Create Account</button>
    </form>
  );
}

function Dashboard({ api, user, flash }) {
  const blank = { ledger_page_no: '', nomenclature: '', quantity_au: '' };
  const [inventories, setInventories] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [transfer, setTransfer] = useState({ inventory_id: '', to_user_id: '', note: '' });

  async function load() {
    const [inventoryData, userData] = await Promise.all([api('inventories'), api('users')]);
    setInventories(inventoryData.inventories);
    setUsers(userData.users);
  }

  useEffect(() => { load().catch((error) => flash(error.message)); }, []);

  async function submitInventory(event) {
    event.preventDefault();
    try {
      if (editing) {
        await api('inventories', { method: 'PUT', body: { ...form, id: editing } });
        flash('Inventory updated');
      } else {
        await api('inventories', { method: 'POST', body: form });
        flash('Inventory added');
      }
      setForm(blank);
      setEditing(null);
      await load();
    } catch (error) {
      flash(error.message);
    }
  }

  async function requestTransfer(event) {
    event.preventDefault();
    try {
      const data = await api('transfer_requests', { method: 'POST', body: transfer });
      flash(data.message);
      setTransfer({ inventory_id: '', to_user_id: '', note: '' });
    } catch (error) {
      flash(error.message);
    }
  }

  return (
    <>
      <Header title="Inventory Register" subtitle="Add, view, and modify the four required inventory columns." />
      <section className="grid-two">
        <form className="panel form-grid" onSubmit={submitInventory}>
          <h3>{editing ? 'Modify Inventory' : 'Add Inventory'}</h3>
          <label>Ledger No./Page No.<input value={form.ledger_page_no} onChange={(e) => setForm({ ...form, ledger_page_no: e.target.value })} /></label>
          <label>Nomenclature<input value={form.nomenclature} onChange={(e) => setForm({ ...form, nomenclature: e.target.value })} /></label>
          <label>Quantity/AU in no.<input type="number" min="0" value={form.quantity_au} onChange={(e) => setForm({ ...form, quantity_au: e.target.value })} /></label>
          <button type="submit">{editing ? 'Update' : 'Save'}</button>
        </form>

        <form className="panel form-grid" onSubmit={requestTransfer}>
          <h3>Request Transfer</h3>
          <label>Your Inventory
            <select value={transfer.inventory_id} onChange={(e) => setTransfer({ ...transfer, inventory_id: e.target.value })}>
              <option value="">Select inventory</option>
              {inventories.filter((item) => Number(item.owner_user_id) === Number(user.id)).map((item) => (
                <option key={item.id} value={item.id}>{item.nomenclature}</option>
              ))}
            </select>
          </label>
          <label>Transfer To
            <select value={transfer.to_user_id} onChange={(e) => setTransfer({ ...transfer, to_user_id: e.target.value })}>
              <option value="">Select existing user</option>
              {users.filter((person) => Number(person.id) !== Number(user.id)).map((person) => (
                <option key={person.id} value={person.id}>{person.name} ({person.email})</option>
              ))}
            </select>
          </label>
          <label>Note<input value={transfer.note} onChange={(e) => setTransfer({ ...transfer, note: e.target.value })} /></label>
          <button type="submit">Send to Inventory Head</button>
        </form>
      </section>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sl. No.</th>
              <th>Ledger No./Page No.</th>
              <th>Nomenclature</th>
              <th>Quantity/AU in no.</th>
              <th>Owner</th>
              <th>Modify</th>
            </tr>
          </thead>
          <tbody>
            {inventories.map((item, index) => (
              <tr key={item.id}>
                <td>{index + 1}</td>
                <td>{item.ledger_page_no}</td>
                <td>{item.nomenclature}</td>
                <td>{item.quantity_au}</td>
                <td>{item.owner_name}</td>
                <td><button onClick={() => {
                  setEditing(item.id);
                  setForm({
                    ledger_page_no: item.ledger_page_no,
                    nomenclature: item.nomenclature,
                    quantity_au: item.quantity_au,
                  });
                }}>Modify</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Profile({ api, user, setUser, flash }) {
  const [profile, setProfile] = useState({ name: user.name, email: user.email });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '' });
  return (
    <>
      <Header title="Profile" subtitle="Every user can update profile details and password." />
      <section className="grid-two">
        <form className="panel form-grid" onSubmit={async (event) => {
          event.preventDefault();
          try {
            await api('profile', { method: 'PUT', body: profile });
            const nextUser = { ...user, ...profile };
            localStorage.setItem('inventory_user', JSON.stringify(nextUser));
            setUser(nextUser);
            flash('Profile updated');
          } catch (error) {
            flash(error.message);
          }
        }}>
          <h3>Update Profile</h3>
          <label>Name<input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></label>
          <label>Email<input value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></label>
          <button type="submit">Save Profile</button>
        </form>
        <form className="panel form-grid" onSubmit={async (event) => {
          event.preventDefault();
          try {
            await api('password', { method: 'PUT', body: passwords });
            setPasswords({ current_password: '', new_password: '' });
            flash('Password updated');
          } catch (error) {
            flash(error.message);
          }
        }}>
          <h3>Change Password</h3>
          <label>Current Password<input type="password" value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} /></label>
          <label>New Password<input type="password" value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} /></label>
          <button type="submit">Update Password</button>
        </form>
      </section>
    </>
  );
}

function Transfers({ api, user, flash }) {
  const [requests, setRequests] = useState([]);

  async function load() {
    const data = await api('transfer_requests');
    setRequests(data.requests);
  }

  useEffect(() => { load().catch((error) => flash(error.message)); }, []);

  async function decide(request_id, decision) {
    try {
      const data = await api('approve_transfer', { method: 'PUT', body: { request_id, decision } });
      flash(data.message);
      await load();
    } catch (error) {
      flash(error.message);
    }
  }

  return (
    <>
      <Header title="Transfer Requests" subtitle="Inventory head or admin approves transfer requests to complete transactions." />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Inventory</th>
              <th>From</th>
              <th>To</th>
              <th>Status</th>
              <th>Note</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td>{request.nomenclature}</td>
                <td>{request.from_user_name}</td>
                <td>{request.to_user_name}</td>
                <td><span className={`status ${request.status}`}>{request.status}</span></td>
                <td>{request.note}</td>
                <td>
                  {request.status === 'pending' && ['inventory_head', 'admin'].includes(user.role) ? (
                    <div className="row-actions">
                      <button onClick={() => decide(request.id, 'approved')}>Approve</button>
                      <button className="danger" onClick={() => decide(request.id, 'rejected')}>Reject</button>
                    </div>
                  ) : 'No action'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function AdminPanel({ api, flash }) {
  const [users, setUsers] = useState([]);

  async function load() {
    const data = await api('users');
    setUsers(data.users);
  }

  useEffect(() => { load().catch((error) => flash(error.message)); }, []);

  async function updateRole(user_id, role) {
    try {
      await api('role', { method: 'PUT', body: { user_id, role } });
      flash('Role updated');
      await load();
    } catch (error) {
      flash(error.message);
    }
  }

  return (
    <>
      <Header title="Admin Role Management" subtitle="Default admin can change roles to user, inventory head, or admin." />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((person) => (
              <tr key={person.id}>
                <td>{person.name}</td>
                <td>{person.email}</td>
                <td>
                  <select value={person.role} onChange={(e) => updateRole(person.id, e.target.value)}>
                    {roles.map((role) => <option key={role} value={role}>{labelRole(role)}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Header({ title, subtitle }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}

function title(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function labelRole(value) {
  return value.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

createRoot(document.getElementById('root')).render(<App />);
