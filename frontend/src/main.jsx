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
        <section className={`auth-box ${view === 'register' ? 'register-box' : 'login-box'}`}>
          <h1>Inventory Management System</h1>
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
        {['dashboard', 'transfers', 'profile'].map((item) => (
          <button key={item} className={view === item ? 'active' : ''} onClick={() => setView(item)}>
            {title(item)}
          </button>
        ))}
        {user.role === 'admin' && (
          <button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>Admin</button>
        )}
        {user.role === 'admin' && (
          <button className={view === 'masters' ? 'active' : ''} onClick={() => setView('masters')}>Master Configuration</button>
        )}
        <button onClick={logout}>Logout</button>
      </aside>

      <section className="content">
        {message && <div className="notice">{message}</div>}
        {view === 'dashboard' && <Dashboard api={api} user={user} flash={flash} />}
        {view === 'profile' && <Profile api={api} user={user} setUser={setUser} flash={flash} />}
        {view === 'transfers' && <Transfers api={api} user={user} flash={flash} />}
        {view === 'admin' && user.role === 'admin' && <AdminPanel api={api} flash={flash} />}
        {view === 'masters' && user.role === 'admin' && <MasterConfig api={api} flash={flash} />}
      </section>
    </main>
  );
}

function Login({ api, onLogin, flash }) {
  const [form, setForm] = useState({ email: '', password: '' });
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
  const [masters, setMasters] = useState({ cadres: [], designations: [], groups: [] });
  const [form, setForm] = useState({
    name: '',
    gender: '',
    cadre_id: '',
    designation_id: '',
    group_id: '',
    email: '',
    mobile_no: '',
    telephone_no: '',
    password: '',
  });

  useEffect(() => {
    api('masters')
      .then(setMasters)
      .catch((error) => flash(error.message));
  }, []);

  const activeCadres = masters.cadres.filter((item) => Number(item.is_active) === 1);
  const activeDesignations = masters.designations.filter((item) => (
    Number(item.is_active) === 1 && Number(item.cadre_id) === Number(form.cadre_id)
  ));
  const activeGroups = masters.groups.filter((item) => Number(item.is_active) === 1);

  function updateForm(patch) {
    setForm((current) => ({ ...current, ...patch }));
  }

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
      <label>Gender
        <select value={form.gender} onChange={(e) => updateForm({ gender: e.target.value })}>
          <option value="">Select gender</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </label>
      <label>Cadre
        <select value={form.cadre_id} onChange={(e) => updateForm({ cadre_id: e.target.value, designation_id: '' })}>
          <option value="">Select cadre</option>
          {activeCadres.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>Designation
        <select value={form.designation_id} onChange={(e) => updateForm({ designation_id: e.target.value })} disabled={!form.cadre_id}>
          <option value="">Select designation</option>
          {activeDesignations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>Group
        <select value={form.group_id} onChange={(e) => updateForm({ group_id: e.target.value })}>
          <option value="">Select group</option>
          {activeGroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>Email ID<input value={form.email} onChange={(e) => updateForm({ email: e.target.value })} /></label>
      <label>Mobile No.<input value={form.mobile_no} onChange={(e) => updateForm({ mobile_no: e.target.value })} /></label>
      <label>Telephone No.<input value={form.telephone_no} onChange={(e) => updateForm({ telephone_no: e.target.value })} /></label>
      <label>Create New Password<input type="password" value={form.password} onChange={(e) => updateForm({ password: e.target.value })} placeholder="Min 6 chars and special character" /></label>
      <button type="submit">Register</button>
    </form>
  );
}

function Dashboard({ api, user, flash }) {
  const blank = { ledger_page_no: '', nomenclature: '', quantity_au: '', unit: 'no.' };
  const [inventories, setInventories] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [transfer, setTransfer] = useState({ inventory_id: '', to_user_id: '', note: '' });
  const [search, setSearch] = useState('');
  const [nomenclatureSort, setNomenclatureSort] = useState('none');

  const visibleInventories = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = inventories.filter((item) => {
      if (!term) return true;
      return [item.ledger_page_no, item.nomenclature, item.quantity_au, item.owner_name]
        .some((value) => String(value ?? '').toLowerCase().includes(term));
    });

    if (nomenclatureSort === 'none') return filtered;

    return [...filtered].sort((a, b) => {
      const result = a.nomenclature.localeCompare(b.nomenclature, undefined, { sensitivity: 'base' });
      return nomenclatureSort === 'asc' ? result : -result;
    });
  }, [inventories, search, nomenclatureSort]);

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

  function toggleNomenclatureSort() {
    setNomenclatureSort((current) => {
      if (current === 'none') return 'asc';
      if (current === 'asc') return 'desc';
      return 'none';
    });
  }

  function printInventory() {
    const rows = visibleInventories.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(item.ledger_page_no)}</td>
        <td>${escapeHtml(item.nomenclature)}</td>
        <td>${escapeHtml(item.quantity_au)}</td>
        <td>${escapeHtml(item.owner_name)}</td>
      </tr>
    `).join('');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      flash('Popup blocked. Allow popups to print inventory.');
      return;
    }
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Inventory List</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111827; }
            h1 { font-size: 22px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Inventory List</h1>
          <table>
            <thead>
              <tr>
                <th>Sl. No.</th>
                <th>Ledger No./Page No.</th>
                <th>Nomenclature</th>
                <th>Quantity/AU</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="5">No inventory found</td></tr>'}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function exportInventoryCsv() {
    const rows = visibleInventories.map((item, index) => [
      index + 1,
      item.ledger_page_no,
      item.nomenclature,
      item.quantity_au,
      item.owner_name,
    ]);
    const csv = [
      ['Sl. No.', 'Ledger No./Page No.', 'Nomenclature', 'Quantity/AU', 'Owner'],
      ...rows,
    ].map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'inventory-list.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <>
      <Header title="Inventory Register" subtitle="Add, view, and modify the four required inventory columns." />
      <section className="grid-two">
        <form className="panel form-grid" onSubmit={submitInventory}>
          <h3>{editing ? 'Modify Inventory' : 'Add Inventory'}</h3>
          <label>Ledger No./Page No.<input value={form.ledger_page_no} onChange={(e) => setForm({ ...form, ledger_page_no: e.target.value })} /></label>
          <label>Nomenclature<input value={form.nomenclature} onChange={(e) => setForm({ ...form, nomenclature: e.target.value })} /></label>
          <div className="quantity-row">
            <label>Quantity/AU<input type="number" min="0" value={form.quantity_au} onChange={(e) => setForm({ ...form, quantity_au: e.target.value })} /></label>
            <label>Unit
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                <option value="kg">kg</option>
                <option value="no.">no.</option>
                <option value="dozen">dozen</option>
              </select>
            </label>
          </div>
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

      <div className="toolbar">
        <label className="search-box">Search Inventory
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ledger, nomenclature, quantity, owner" />
        </label>
        <div className="toolbar-actions">
          <button type="button" onClick={printInventory}>Print Inventory</button>
          <button type="button" onClick={exportInventoryCsv}>Export CSV</button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sl. No.</th>
              <th>Ledger No./Page No.</th>
              <th><button type="button" className="sort-header" onClick={toggleNomenclatureSort}>Nomenclature {sortMark(nomenclatureSort)}</button></th>
              <th>Quantity/AU</th>
              <th>Owner</th>
              <th>Modify</th>
            </tr>
          </thead>
          <tbody>
            {visibleInventories.map((item, index) => (
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
                    ...splitQuantityUnit(item.quantity_au),
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
  const [masters, setMasters] = useState({ cadres: [], designations: [], groups: [] });
  const [profile, setProfile] = useState({
    name: user.name || '',
    gender: user.gender || '',
    cadre_id: user.cadre_id || '',
    designation_id: user.designation_id || '',
    group_id: user.group_id || '',
    email: user.email || '',
    mobile_no: user.mobile_no || '',
    telephone_no: user.telephone_no || '',
  });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm_new_password: '' });

  useEffect(() => {
    api('masters')
      .then(setMasters)
      .catch((error) => flash(error.message));
  }, []);

  const activeCadres = masters.cadres.filter((item) => Number(item.is_active) === 1);
  const activeDesignations = masters.designations.filter((item) => (
    Number(item.is_active) === 1 && Number(item.cadre_id) === Number(profile.cadre_id)
  ));
  const activeGroups = masters.groups.filter((item) => Number(item.is_active) === 1);

  function updateProfile(patch) {
    setProfile((current) => ({ ...current, ...patch }));
  }

  return (
    <>
      <Header title="Profile" subtitle="Every user can update profile details and password." />
      <section className="profile-layout">
        <form className="panel form-grid profile-panel" onSubmit={async (event) => {
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
          <label>Name<input value={profile.name} onChange={(e) => updateProfile({ name: e.target.value })} /></label>
          <label>Gender
            <select value={profile.gender} onChange={(e) => updateProfile({ gender: e.target.value })}>
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>Cadre
            <select value={profile.cadre_id} onChange={(e) => updateProfile({ cadre_id: e.target.value, designation_id: '' })}>
              <option value="">Select cadre</option>
              {activeCadres.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Designation
            <select value={profile.designation_id} onChange={(e) => updateProfile({ designation_id: e.target.value })} disabled={!profile.cadre_id}>
              <option value="">Select designation</option>
              {activeDesignations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Group
            <select value={profile.group_id} onChange={(e) => updateProfile({ group_id: e.target.value })}>
              <option value="">Select group</option>
              {activeGroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Email ID<input value={profile.email} onChange={(e) => updateProfile({ email: e.target.value })} /></label>
          <label>Mobile No.<input value={profile.mobile_no} onChange={(e) => updateProfile({ mobile_no: e.target.value })} /></label>
          <label>Telephone No.<input value={profile.telephone_no} onChange={(e) => updateProfile({ telephone_no: e.target.value })} /></label>
          <button type="submit">Save Profile</button>
        </form>
        <form className="panel form-grid password-panel" onSubmit={async (event) => {
          event.preventDefault();
          if (passwords.new_password !== passwords.confirm_new_password) {
            flash('New password and confirm new password do not match.');
            return;
          }
          try {
            await api('password', { method: 'PUT', body: passwords });
            setPasswords({ current_password: '', new_password: '', confirm_new_password: '' });
            flash('Password updated');
          } catch (error) {
            flash(error.message);
          }
        }}>
          <h3>Change Password</h3>
          <label>Current Password<input type="password" value={passwords.current_password} onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} /></label>
          <label>New Password<input type="password" value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} /></label>
          <label>Confirm New Password<input type="password" value={passwords.confirm_new_password} onChange={(e) => setPasswords({ ...passwords, confirm_new_password: e.target.value })} /></label>
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
              <th>Request Sent Time</th>
              <th>Request Approved Time</th>
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
                <td>{formatDateTime(request.created_at)}</td>
                <td>{formatDateTime(request.decided_at)}</td>
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
              <th>Mobile</th>
              <th>Cadre</th>
              <th>Designation</th>
              <th>Group</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((person) => (
              <tr key={person.id}>
                <td>{person.name}</td>
                <td>{person.email}</td>
                <td>{person.mobile_no || '-'}</td>
                <td>{person.cadre_name || '-'}</td>
                <td>{person.designation_name || '-'}</td>
                <td>{person.group_name || '-'}</td>
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

function MasterConfig({ api, flash }) {
  const emptyCadre = { id: '', name: '', is_active: 1 };
  const emptyDesignation = { id: '', cadre_id: '', name: '', is_active: 1 };
  const emptyGroup = { id: '', name: '', is_active: 1 };
  const [masters, setMasters] = useState({ cadres: [], designations: [], groups: [] });
  const [cadreForm, setCadreForm] = useState(emptyCadre);
  const [designationForm, setDesignationForm] = useState(emptyDesignation);
  const [groupForm, setGroupForm] = useState(emptyGroup);

  async function load() {
    setMasters(await api('masters'));
  }

  useEffect(() => { load().catch((error) => flash(error.message)); }, []);

  async function saveMaster(event, type, form, reset) {
    event.preventDefault();
    try {
      const method = form.id ? 'PUT' : 'POST';
      const data = await api(type, { method, body: form });
      flash(data.message);
      reset();
      await load();
    } catch (error) {
      flash(error.message);
    }
  }

  return (
    <>
      <Header title="Master Configuration" subtitle="Admin can add or modify cadre, designation, and independent group records." />
      <section className="master-grid">
        <form className="panel form-grid" onSubmit={(event) => saveMaster(event, 'cadre', cadreForm, () => setCadreForm(emptyCadre))}>
          <h3>{cadreForm.id ? 'Modify Cadre' : 'Add Cadre'}</h3>
          <label>Cadre Name<input value={cadreForm.name} onChange={(e) => setCadreForm({ ...cadreForm, name: e.target.value })} /></label>
          <label>Status
            <select value={cadreForm.is_active} onChange={(e) => setCadreForm({ ...cadreForm, is_active: Number(e.target.value) })}>
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
          </label>
          <div className="row-actions">
            <button type="submit">{cadreForm.id ? 'Update Cadre' : 'Add Cadre'}</button>
            {cadreForm.id && <button type="button" onClick={() => setCadreForm(emptyCadre)}>Cancel</button>}
          </div>
        </form>

        <form className="panel form-grid" onSubmit={(event) => saveMaster(event, 'designation', designationForm, () => setDesignationForm(emptyDesignation))}>
          <h3>{designationForm.id ? 'Modify Designation' : 'Add Designation'}</h3>
          <label>Cadre
            <select value={designationForm.cadre_id} onChange={(e) => setDesignationForm({ ...designationForm, cadre_id: e.target.value })}>
              <option value="">Select cadre</option>
              {masters.cadres.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Designation Name<input value={designationForm.name} onChange={(e) => setDesignationForm({ ...designationForm, name: e.target.value })} /></label>
          <label>Status
            <select value={designationForm.is_active} onChange={(e) => setDesignationForm({ ...designationForm, is_active: Number(e.target.value) })}>
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
          </label>
          <div className="row-actions">
            <button type="submit">{designationForm.id ? 'Update Designation' : 'Add Designation'}</button>
            {designationForm.id && <button type="button" onClick={() => setDesignationForm(emptyDesignation)}>Cancel</button>}
          </div>
        </form>

        <form className="panel form-grid" onSubmit={(event) => saveMaster(event, 'group', groupForm, () => setGroupForm(emptyGroup))}>
          <h3>{groupForm.id ? 'Modify Group' : 'Add Group'}</h3>
          <label>Group Name<input value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} /></label>
          <label>Status
            <select value={groupForm.is_active} onChange={(e) => setGroupForm({ ...groupForm, is_active: Number(e.target.value) })}>
              <option value={1}>Active</option>
              <option value={0}>Inactive</option>
            </select>
          </label>
          <div className="row-actions">
            <button type="submit">{groupForm.id ? 'Update Group' : 'Add Group'}</button>
            {groupForm.id && <button type="button" onClick={() => setGroupForm(emptyGroup)}>Cancel</button>}
          </div>
        </form>
      </section>

      <section className="master-tables">
        <MasterTable
          title="Cadres"
          columns={['Name', 'Status']}
          rows={masters.cadres.map((item) => ({
            id: item.id,
            values: [item.name, statusText(item.is_active)],
            onEdit: () => setCadreForm({ id: item.id, name: item.name, is_active: Number(item.is_active) }),
          }))}
        />
        <MasterTable
          title="Designations"
          columns={['Cadre', 'Designation', 'Status']}
          rows={masters.designations.map((item) => ({
            id: item.id,
            values: [item.cadre_name, item.name, statusText(item.is_active)],
            onEdit: () => setDesignationForm({
              id: item.id,
              cadre_id: item.cadre_id,
              name: item.name,
              is_active: Number(item.is_active),
            }),
          }))}
        />
        <MasterTable
          title="Groups"
          columns={['Group', 'Status']}
          rows={masters.groups.map((item) => ({
            id: item.id,
            values: [item.name, statusText(item.is_active)],
            onEdit: () => setGroupForm({
              id: item.id,
              name: item.name,
              is_active: Number(item.is_active),
            }),
          }))}
        />
      </section>
    </>
  );
}

function MasterTable({ title, columns, rows }) {
  return (
    <div className="table-wrap master-table">
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            {columns.map((column) => <th key={column}>{column}</th>)}
            <th>Modify</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {row.values.map((value, index) => <td key={index}>{value}</td>)}
              <td><button type="button" onClick={row.onEdit}>Modify</button></td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={columns.length + 1}>No records found</td></tr>
          )}
        </tbody>
      </table>
    </div>
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

function statusText(value) {
  return Number(value) === 1 ? 'Active' : 'Inactive';
}

function sortMark(value) {
  if (value === 'asc') return 'A-Z';
  if (value === 'desc') return 'Z-A';
  return 'Sort';
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value.replace(' ', 'T')).toLocaleString();
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function splitQuantityUnit(value) {
  const text = String(value ?? '').trim();
  const match = text.match(/^(.*)\s(kg|no\.|dozen)$/);
  if (!match) return { quantity_au: text, unit: 'no.' };
  return { quantity_au: match[1], unit: match[2] };
}

createRoot(document.getElementById('root')).render(<App />);
