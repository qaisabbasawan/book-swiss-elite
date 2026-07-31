import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getVehicles, saveVehicle as sbSaveVehicle, deleteVehicle as sbDeleteVehicle, toggleVehicle as sbToggleVehicle,
  getBookings, saveBooking, updateBookingStatus as sbUpdateStatus, deleteBooking as sbDeleteBooking,
  getCustomers, deleteCustomer as sbDeleteCustomer,
  getVehiclePricing, saveVehiclePricing as sbSaveVehiclePricing,
  getPricing, savePricing as sbSavePricing,
  getAreas, toggleArea as sbToggleArea,
  getFormSettings, saveFormSettings as sbSaveFormSettings,
  getSettings, saveSettings as sbSaveSettings,
  getTrackingSettings, saveTrackingSettings as sbSaveTrackingSettings,
  getAdmins, saveAdminUser as sbSaveAdmin, deleteAdmin as sbDeleteAdmin,
} from '../utils/db.js';
import '../styles/admin.css';

/* ── Helpers ─────────────────────────────────────────────────── */
const fmtDate = d => d ? new Date(d+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) : '—';
const fmtTs   = ts => ts ? new Date(ts).toLocaleString('en-GB') : '—';
const cap     = s => s ? s.charAt(0).toUpperCase()+s.slice(1) : '';

function statusBadge(s) {
  const map = { pending:'badge-amber', confirmed:'badge-green', 'in-progress':'badge-blue', completed:'badge-green', cancelled:'badge-red' };
  return <span className={`status-badge ${map[s]||'badge-amber'}`}>{cap(s)}</span>;
}
function paymentBadge(p) {
  return <span className={`status-badge ${p==='paid'?'badge-green':'badge-amber'}`}>{cap(p||'unpaid')}</span>;
}

let _toastId = 0;

/* ── Main Component ──────────────────────────────────────────── */
export default function AdminDashboard() {
  const navigate = useNavigate();

  const [page, setPage]         = useState('overview');
  const [vehicles, setVehicles] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [areas, setAreas]       = useState([]);
  const [pricing, setPricing]   = useState({});
  const [vPricing, setVPricing] = useState({});
  const [settings, setSettings] = useState({});
  const [formSettings, setFormSettings] = useState({});
  const [trackingSettings, setTrackingSettings] = useState({});
  const [admins, setAdmins]     = useState([]);
  const [toasts, setToasts]     = useState([]);
  const [modal, setModal]       = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifDot, setNotifDot] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  /* Auth */
  const auth = (() => { try { return JSON.parse(localStorage.getItem('se_auth')||'{}'); } catch(e){ return {}; } })();

  useEffect(() => {
    if (!auth.loggedIn) { navigate('/admin', { replace:true }); return; }
    loadAll();
  }, []);

  const loadAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const [v, b, c, a, p, vp, s, fs, ts, adm] = await Promise.all([
        getVehicles(), getBookings(), getCustomers(), getAreas(),
        getPricing(), getVehiclePricing(), getSettings(), getFormSettings(), getTrackingSettings(), getAdmins(),
      ]);
      setVehicles(v); setBookings(b); setCustomers(c); setAreas(a);
      setPricing(p); setVPricing(vp); setSettings(s); setFormSettings(fs); setTrackingSettings(ts); setAdmins(adm);
    } catch(err) {
      console.error('DB load error:', err);
      addToast('Failed to load data from database.', 'error');
    } finally {
      setLoadingData(false);
    }
  }, []);

  function addToast(msg, type='success') {
    const id = ++_toastId;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }

  function logout() {
    localStorage.removeItem('se_auth');
    navigate('/admin', { replace: true });
  }

  /* ── VEHICLES ───────────────────────────────────────────────── */
  async function saveVehicle(vData) {
    try {
      if (!vData.id) { vData.id = 'v' + Date.now(); vData.enabled = true; }
      await sbSaveVehicle(vData);
      setVehicles(await getVehicles());
      addToast(`Vehicle "${vData.name}" saved.`);
    } catch(e) { addToast('Failed to save vehicle.', 'error'); }
  }
  async function toggleVehicle(id) {
    const v = vehicles.find(x => x.id === id);
    if (!v) return;
    try {
      await sbToggleVehicle(id, !v.enabled);
      setVehicles(await getVehicles());
      addToast(`Vehicle ${!v.enabled ? 'enabled' : 'disabled'}.`);
    } catch(e) { addToast('Failed to update vehicle.', 'error'); }
  }
  async function deleteVehicle(id) {
    try {
      await sbDeleteVehicle(id);
      setVehicles(await getVehicles());
      addToast('Vehicle deleted.', 'error');
    } catch(e) { addToast('Failed to delete vehicle.', 'error'); }
  }

  /* ── BOOKINGS ───────────────────────────────────────────────── */
  async function updateBookingStatus(id, status) {
    try {
      await sbUpdateStatus(id, status);
      setBookings(b => b.map(x => x.id === id ? { ...x, status } : x));
      addToast(`Status updated to ${cap(status)}.`);
    } catch(e) { addToast('Failed to update status.', 'error'); }
  }
  async function deleteBooking(id) {
    try {
      await sbDeleteBooking(id);
      setBookings(b => b.filter(x => x.id !== id));
      addToast('Booking deleted.', 'error');
    } catch(e) { addToast('Failed to delete booking.', 'error'); }
  }

  /* ── CUSTOMERS ──────────────────────────────────────────────── */
  async function deleteCustomer(id) {
    try {
      await sbDeleteCustomer(id);
      setCustomers(c => c.filter(x => x.id !== id));
      addToast('Customer removed.', 'error');
    } catch(e) { addToast('Failed to remove customer.', 'error'); }
  }

  /* ── PRICING ────────────────────────────────────────────────── */
  async function savePricing(p) {
    try {
      await sbSavePricing(p);
      setPricing({ ...p });
      addToast('Pricing settings saved.');
    } catch(e) { addToast('Failed to save pricing.', 'error'); }
  }
  async function saveVehiclePricing(vehicleId, p) {
    try {
      await sbSaveVehiclePricing(vehicleId, p);
      setVPricing(vp => ({ ...vp, [vehicleId]: p }));
      addToast('Vehicle pricing saved.');
    } catch(e) { addToast('Failed to save pricing.', 'error'); }
  }

  /* ── SERVICE AREAS ──────────────────────────────────────────── */
  async function toggleArea(code, enabled) {
    try {
      await sbToggleArea(code, enabled);
      setAreas(a => a.map(x => x.code === code ? { ...x, enabled } : x));
      addToast(`${code} ${enabled ? 'enabled' : 'disabled'}.`);
    } catch(e) { addToast('Failed to update area.', 'error'); }
  }

  /* ── FORM SETTINGS ──────────────────────────────────────────── */
  async function saveFormSettings(fs) {
    try {
      await sbSaveFormSettings(fs);
      setFormSettings({ ...fs });
      addToast('Form settings saved.');
    } catch(e) { addToast('Failed to save form settings.', 'error'); }
  }

  /* ── GENERAL SETTINGS ───────────────────────────────────────── */
  async function saveSettings(s) {
    try {
      await sbSaveSettings(s);
      setSettings({ ...s });
      addToast('Settings saved.');
    } catch(e) { addToast('Failed to save settings.', 'error'); }
  }

  /* ── TRACKING CODES ─────────────────────────────────────────── */
  async function saveTrackingSettings(t) {
    try {
      await sbSaveTrackingSettings(t);
      setTrackingSettings({ ...t });
      addToast('Tracking codes saved. Live on the booking page now.');
    } catch(e) { addToast('Failed to save tracking codes.', 'error'); }
  }

  /* ── ADMIN USERS ────────────────────────────────────────────── */
  async function saveAdminUser(u) {
    try {
      const saved = await sbSaveAdmin(u);
      setAdmins(await getAdmins());
      addToast('Admin user saved.');
    } catch(e) { addToast('Failed to save admin user.', 'error'); }
  }
  async function deleteAdmin(id) {
    try {
      await sbDeleteAdmin(id);
      setAdmins(a => a.filter(x => x.id !== id));
      addToast('Admin user removed.', 'error');
    } catch(e) { addToast('Failed to remove admin.', 'error'); }
  }

  /* ── STATS ──────────────────────────────────────────────────── */
  const stats = {
    total:     bookings.length,
    pending:   bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    revenue:   bookings.filter(b => b.payment === 'paid').reduce((s,b) => s + (b.estimatedFare||0), 0),
  };

  const currency = pricing.currency || 'CHF';

  /* ── NAV ICONS (SVG) ───────────────────────────────────────── */
  const IC = {
    overview:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
    bookings:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>,
    customers:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    vehicles:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2v-4l3-6h14l3 6v4a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17" r="2.5"/><circle cx="16.5" cy="17" r="2.5"/></svg>,
    pricing:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    areas:         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
    formSettings:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>,
    tracking:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.1-3-3L7 13.6"/></svg>,
    adminUsers:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    settings:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    logout:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
    bell:          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
    extLink:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  };

  /* ── NAV SECTIONS ───────────────────────────────────────────── */
  const navSections = [
    { label:'MAIN', items:[
      { id:'overview',      label:'Dashboard',     icon: IC.overview },
      { id:'bookings',      label:'Bookings',      icon: IC.bookings, badge: stats.pending || null },
      { id:'vehicles',      label:'Vehicles',      icon: IC.vehicles },
      { id:'customers',     label:'Customers',     icon: IC.customers },
    ]},
    { label:'CONFIGURATION', items:[
      { id:'pricing',       label:'Pricing',       icon: IC.pricing },
      { id:'service-areas', label:'Service Areas', icon: IC.areas },
      { id:'form-settings', label:'Form Settings', icon: IC.formSettings },
    ]},
    { label:'MARKETING', items:[
      { id:'tracking-codes', label:'Tracking Codes', icon: IC.tracking },
    ]},
    { label:'SYSTEM', items:[
      { id:'admin-users',   label:'Admin Users',   icon: IC.adminUsers },
      { id:'settings',      label:'Settings',      icon: IC.settings },
    ]},
  ];

  function navigate_(p) { setPage(p); setNotifDot(false); }

  /* ── RENDER SECTIONS ────────────────────────────────────────── */
  function renderPage() {
    switch(page) {
      case 'overview':      return <Overview stats={stats} bookings={bookings} vehicles={vehicles} customers={customers} currency={currency} onNavigate={navigate_} onView={b => setModal({type:'booking', data:b})}/>;
      case 'bookings':      return <BookingsSection bookings={bookings} search={searchQuery} onView={b => setModal({type:'booking', data:b})} onDelete={id => setModal({type:'confirm', action:()=>deleteBooking(id), msg:'Delete this booking?'})}/>;
      case 'customers':     return <CustomersSection customers={customers} onDelete={id => setModal({type:'confirm', action:()=>deleteCustomer(id), msg:'Remove this customer?'})}/>;
      case 'vehicles':      return <VehiclesSection vehicles={vehicles} onAdd={() => setModal({type:'vehicle', data:null})} onEdit={v => setModal({type:'vehicle', data:v})} onToggle={toggleVehicle} onDelete={id => setModal({type:'confirm', action:()=>deleteVehicle(id), msg:'Delete this vehicle?'})}/>;
      case 'pricing':       return <PricingSection pricing={pricing} vPricing={vPricing} vehicles={vehicles} currency={currency} onSave={savePricing} onVehiclePrice={(id,p) => setModal({type:'vpricing', vehicleId:id, current:p})} />;
      case 'service-areas': return <AreasSection areas={areas} onToggle={toggleArea}/>;
      case 'form-settings': return <FormSettingsSection fs={formSettings} onSave={saveFormSettings}/>;
      case 'tracking-codes': return <TrackingCodesSection ts={trackingSettings} onSave={saveTrackingSettings}/>;
      case 'admin-users':   return <AdminUsersSection admins={admins} onAdd={() => setModal({type:'adminuser', data:null})} onEdit={u => setModal({type:'adminuser', data:u})} onDelete={id => setModal({type:'confirm', action:()=>deleteAdmin(id), msg:'Remove this admin user?'})}/>;
      case 'settings':      return <SettingsSection settings={settings} onSave={saveSettings}/>;
      default: return null;
    }
  }

  if (loadingData) return (
    <div style={{minHeight:'100vh',background:'#050505',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'1.25rem'}}>
      <div style={{fontSize:'1.2rem',fontWeight:700,letterSpacing:'.2em',color:'#f2efe8'}}>◆ SWISS <span style={{color:'#C9A84C'}}>ELITE</span></div>
      <div style={{width:36,height:36,border:'2.5px solid rgba(201,168,76,0.2)',borderTopColor:'#C9A84C',borderRadius:'50%',animation:'spin .75s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div className="admin-layout">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? '' : 'collapsed'}`} id="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="sidebar-logo">◆</div>
            {sidebarOpen && <div><div className="sidebar-name">Swiss Elite</div><div className="sidebar-role">Admin Panel</div></div>}
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarOpen(v => !v)}>{sidebarOpen ? '◀' : '▶'}</button>
        </div>
        <nav className="sidebar-nav">
          {navSections.map(section => (
            <div key={section.label} className="nav-section">
              {sidebarOpen && <div className="nav-section-label">{section.label}</div>}
              {section.items.map(item => (
                <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => navigate_(item.id)}>
                  <span className="nav-icon">{item.icon}</span>
                  {sidebarOpen && <span className="nav-label">{item.label}</span>}
                  {sidebarOpen && item.badge ? <span className="nav-badge">{item.badge}</span> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-item nav-item-logout" onClick={logout}>
            <span className="nav-icon">{IC.logout}</span>
            {sidebarOpen && <span className="nav-label">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="main-wrap">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-search">
            <input className="search-input" placeholder="Search bookings, customers…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/>
          </div>
          <div className="topbar-right">
            <button className="icon-btn" title="Notifications" onClick={() => { setNotifDot(false); navigate_('bookings'); }}>
              {IC.bell}{notifDot && <span className="notif-dot"/>}
            </button>
            <a href="/" target="_blank" className="icon-btn" title="Open booking form">{IC.extLink}</a>
            <div className="topbar-user">
              <div className="user-avatar">{(auth.name||'A')[0]}</div>
              <div>
                <div className="topbar-name">{auth.name || 'Admin'}</div>
                <div className="topbar-role">{cap(auth.role||'admin')}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="main-content" id="main-content">
          {renderPage()}
        </main>
      </div>

      {/* ── MODALS ── */}
      {modal?.type === 'vehicle'   && <VehicleModal data={modal.data} onSave={v => { saveVehicle(v); setModal(null); }} onClose={() => setModal(null)}/>}
      {modal?.type === 'booking'   && <BookingModal booking={modal.data} onStatus={(id,s) => { updateBookingStatus(id,s); setModal(null); }} onClose={() => setModal(null)}/>}
      {modal?.type === 'vpricing'  && <VehiclePricingModal vehicleId={modal.vehicleId} current={modal.current} vehicles={vehicles} currency={currency} onSave={(id,p) => { saveVehiclePricing(id,p); setModal(null); }} onClose={() => setModal(null)}/>}
      {modal?.type === 'adminuser' && <AdminUserModal data={modal.data} onSave={u => { saveAdminUser(u); setModal(null); }} onClose={() => setModal(null)}/>}
      {modal?.type === 'confirm'   && <ConfirmModal msg={modal.msg} onConfirm={() => { modal.action(); setModal(null); }} onClose={() => setModal(null)}/>}

      {/* Toasts */}
      <div id="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   SECTION COMPONENTS
══════════════════════════════════════════ */

function Overview({ stats, bookings, vehicles, customers, currency, onNavigate, onView }) {
  const recent   = bookings.slice(0, 5);
  const today    = new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  const cancelled = bookings.filter(b => b.status === 'cancelled').length;
  const activeVeh = vehicles.filter(v => v.enabled !== false).length;

  const statCards = [
    { label:'Total Bookings',  val: stats.total,     cls:'',      icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>, sub: stats.total === 0 ? 'Awaiting first booking' : `${stats.completed} completed` },
    { label:'Pending',         val: stats.pending,   cls:'amber', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, sub: stats.pending === 0 ? 'None pending' : 'Awaiting confirmation' },
    { label:'Confirmed',       val: stats.confirmed, cls:'green', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>, sub: stats.confirmed === 0 ? 'None confirmed' : 'Ready to dispatch' },
    { label:'Cancelled',       val: cancelled,       cls:'red',   icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>, sub: 'Total cancelled' },
    { label:'Active Vehicles', val: activeVeh,       cls:'blue',  icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2v-4l3-6h14l3 6v4a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17" r="2.5"/><circle cx="16.5" cy="17" r="2.5"/></svg>, sub: `${vehicles.length} total in fleet` },
    { label:'Total Customers', val: customers.length, cls:'',     icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, sub: customers.length === 0 ? 'No customers yet' : 'Registered clients' },
  ];

  return (
    <div className="page active" id="page-overview">
      <div className="overview-head">
        <div>
          <h1 className="page-title">Dashboard Overview</h1>
          <p className="overview-date">{today}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {statCards.map(s => (
          <div key={s.label} className={`stat-card ${s.cls}`}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-val">{s.val}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Revenue card */}
      <div className="revenue-card">
        <div className="revenue-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" width="22"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
        <div>
          <div className="revenue-val">{currency} {stats.revenue > 0 ? stats.revenue.toLocaleString() : '—'}</div>
          <div className="revenue-label">TOTAL REVENUE</div>
          <div className="revenue-sub">{stats.revenue === 0 ? 'Revenue tracked from paid bookings' : `From ${bookings.filter(b=>b.payment==='paid').length} paid bookings`}</div>
        </div>
      </div>

      {/* Bottom panels */}
      <div className="overview-panels">
        <div className="panel overview-panel-main">
          <div className="panel-head">
            <h3 className="panel-section-title">Recent Bookings</h3>
            <button className="act-btn act-btn-view" onClick={() => onNavigate('bookings')}>View all →</button>
          </div>
          {recent.length === 0 ? (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" style={{opacity:0.25,display:'block',margin:'0 auto 0.75rem'}}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
              <p>No bookings yet.<br/><a href="/" target="_blank" style={{color:'var(--gold)'}}>Open booking form →</a></p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="data-table"><thead><tr>
                <th>Reference</th><th>Customer</th><th>Route</th><th>Date</th><th>Status</th><th></th>
              </tr></thead><tbody>
                {recent.map(b => (
                  <tr key={b.id}>
                    <td><span className="ref-code">{b.id}</span></td>
                    <td><div className="td-name">{b.name}</div><div className="td-sub">{b.email}</div></td>
                    <td><div className="td-route">{b.pickup} → {b.dropoff}</div></td>
                    <td><span className="td-sub">{fmtDate(b.date)}</span></td>
                    <td>{statusBadge(b.status)}</td>
                    <td><button className="act-btn act-btn-view" onClick={() => onView(b)}>View</button></td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
        </div>

        <div className="panel overview-panel-side">
          <h3 className="panel-section-title">Quick Stats</h3>
          <div className="quick-stats">
            {[
              ['Completion rate', stats.total > 0 ? `${Math.round((stats.completed/stats.total)*100)}%` : '0%'],
              ['This week', bookings.filter(b=>{ const d=new Date(b.createdAt); const now=new Date(); return (now-d)<7*864e5; }).length],
              ['Avg fare', stats.completed > 0 ? `${currency} ${Math.round(bookings.filter(b=>b.estimatedFare).reduce((s,b)=>s+(b.estimatedFare||0),0)/Math.max(bookings.filter(b=>b.estimatedFare).length,1))}` : '—'],
              ['Round trips', bookings.filter(b=>b.tripType==='round-trip').length],
              ['Airport transfers', bookings.filter(b=>(b.pickup||'').toLowerCase().includes('airport')||(b.dropoff||'').toLowerCase().includes('airport')).length],
            ].map(([label, val]) => (
              <div key={label} className="qs-row">
                <span className="qs-label">{label}</span>
                <span className="qs-val">{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BookingsSection({ bookings, search, onView, onDelete }) {
  const filtered = bookings.filter(b =>
    !search || [b.id, b.name, b.email, b.pickup, b.dropoff].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <div className="page active">
      <div className="page-head"><h1 className="page-title">Bookings</h1><span style={{color:'var(--text-muted)',fontSize:'.85rem'}}>{bookings.length} total</span></div>
      {filtered.length === 0 ? (
        <div className="panel"><div className="empty-state"><p>{bookings.length === 0 ? <>No bookings yet. <a href="/" target="_blank" style={{color:'var(--gold)'}}>Open booking form →</a></> : 'No results match your search.'}</p></div></div>
      ) : (
        <div className="panel" style={{padding:0}}>
          <div className="table-wrap">
            <table className="data-table"><thead><tr>
              <th>Ref ID</th><th>Customer</th><th>Pickup</th><th>Drop-off</th><th>Date & Time</th><th>Vehicle</th><th>Status</th><th>Payment</th><th>Actions</th>
            </tr></thead><tbody>
              {filtered.map(b => (
                <tr key={b.id}>
                  <td><span style={{fontFamily:'monospace',color:'var(--gold)',fontSize:'.8rem'}}>{b.id}</span></td>
                  <td><div style={{fontWeight:500}}>{b.name}</div><div style={{fontSize:'.75rem',color:'var(--text-muted)'}}>{b.email}</div><div style={{fontSize:'.75rem',color:'var(--text-muted)'}}>{b.phone}</div></td>
                  <td style={{fontSize:'.82rem',maxWidth:140}}>{b.pickup}</td>
                  <td style={{fontSize:'.82rem',maxWidth:140}}>{b.dropoff}</td>
                  <td style={{fontSize:'.82rem'}}>{fmtDate(b.date)}<br/>{b.time}</td>
                  <td style={{fontSize:'.82rem'}}>{b.vehicle}<br/><span style={{color:'var(--text-muted)',fontSize:'.75rem'}}>{b.tripType==='round-trip'?'Round Trip':'One Way'}</span></td>
                  <td>{statusBadge(b.status)}</td>
                  <td>{paymentBadge(b.payment)}</td>
                  <td>
                    <div className="action-btns">
                      <button className="act-btn act-btn-view" onClick={() => onView(b)}>View</button>
                      <button className="act-btn act-btn-del" onClick={() => onDelete(b.id)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomersSection({ customers, onDelete }) {
  return (
    <div className="page active">
      <div className="page-head"><h1 className="page-title">Customers</h1><span style={{color:'var(--text-muted)',fontSize:'.85rem'}}>{customers.length} total</span></div>
      {customers.length === 0 ? (
        <div className="panel"><div className="empty-state"><p>No customers yet.</p></div></div>
      ) : (
        <div className="panel" style={{padding:0}}>
          <div className="table-wrap">
            <table className="data-table"><thead><tr>
              <th>Customer</th><th>Phone</th><th>Bookings</th><th>Last Booking</th><th>Since</th><th>Actions</th>
            </tr></thead><tbody>
              {customers.map(c => (
                <tr key={c.id}>
                  <td><div style={{fontWeight:500}}>{c.name}</div><div style={{fontSize:'.75rem',color:'var(--text-muted)'}}>{c.email}</div></td>
                  <td style={{fontSize:'.82rem'}}>{c.phone}</td>
                  <td><span className="status-badge badge-blue">{c.bookings||0}</span></td>
                  <td style={{fontSize:'.82rem'}}>{fmtDate(c.lastBooking)}</td>
                  <td style={{fontSize:'.82rem'}}>{fmtTs(c.createdAt)}</td>
                  <td><button className="act-btn act-btn-del" onClick={() => onDelete(c.id)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                  </button></td>
                </tr>
              ))}
            </tbody></table>
          </div>
        </div>
      )}
    </div>
  );
}

function VehiclesSection({ vehicles, onAdd, onEdit, onToggle, onDelete }) {
  return (
    <div className="page active">
      <div className="page-head"><h1 className="page-title">Vehicles</h1><button className="btn-primary" onClick={onAdd}>+ Add Vehicle</button></div>
      {vehicles.length === 0 ? (
        <div className="panel"><div className="empty-state"><p>No vehicles yet.</p></div></div>
      ) : (
        <div id="vehicles-grid" className="vehicles-grid">
          {vehicles.map(v => (
            <div key={v.id} className={`v-card ${v.enabled ? '' : 'disabled-card'}`}>
              <img className="v-card-img" src={v.image} alt={v.name}
                onError={e => { e.target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='225'%3E%3Crect width='400' height='225' fill='%23111'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23C8A45D' font-size='14'%3E${v.name}%3C/text%3E%3C/svg%3E`; }}/>
              <div className="v-card-body">
                <div className="v-card-top">
                  <div><div className="v-card-name">{v.name}</div><div className="v-card-cat">{v.category}</div></div>
                  <span className={`status-badge ${v.enabled?'badge-enabled':'badge-disabled'}`}>{v.enabled?'Active':'Disabled'}</span>
                </div>
                <div className="v-card-specs">
                  <div className="v-card-spec"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>{v.passengers} Passengers</div>
                  <div className="v-card-spec"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>{v.luggage} Luggage</div>
                </div>
                <div className="v-card-features">{(v.features||[]).map((f,i) => <span key={i} className="v-feature">{f}</span>)}</div>
                <div className="v-card-foot">
                  <div className="action-btns">
                    <button className="act-btn act-btn-edit" onClick={() => onEdit(v)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit
                    </button>
                    <button className="act-btn act-btn-toggle" onClick={() => onToggle(v.id)}>{v.enabled ? '⏸ Disable' : '▶ Enable'}</button>
                    <button className="act-btn act-btn-del" onClick={() => onDelete(v.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PricingSection({ pricing, vPricing, vehicles, currency, onSave, onVehiclePrice }) {
  const [p, setP] = useState(pricing);
  useEffect(() => setP(pricing), [pricing]);
  return (
    <div className="page active">
      <div className="page-head"><h1 className="page-title">Pricing Settings</h1><button className="btn-primary" onClick={() => onSave(p)}>Save Changes</button></div>
      <div className="two-col">
        <div className="panel">
          <h3 className="panel-section-title">Base Pricing</h3>
          <div className="form-grid">
            <div className="form-field"><label>Currency</label><select className="form-input" value={p.currency||'CHF'} onChange={e => setP({...p,currency:e.target.value})}><option value="CHF">CHF — Swiss Franc</option><option value="EUR">EUR — Euro</option></select></div>
            <div className="form-field"><label>Minimum Transfer Fee</label><input className="form-input" type="number" value={p.min||''} onChange={e => setP({...p,min:parseFloat(e.target.value)||0})} placeholder="0.00"/></div>
            <div className="form-field"><label>Base Price per km</label><input className="form-input" type="number" value={p.perkm||''} onChange={e => setP({...p,perkm:parseFloat(e.target.value)||0})} placeholder="0.00"/></div>
            <div className="form-field"><label>Airport Surcharge</label><input className="form-input" type="number" value={p.airport||''} onChange={e => setP({...p,airport:parseFloat(e.target.value)||0})} placeholder="0.00"/></div>
            <div className="form-field"><label>Night Rate (%)</label><input className="form-input" type="number" value={p.night||''} onChange={e => setP({...p,night:parseFloat(e.target.value)||0})} placeholder="0"/></div>
            <div className="form-field"><label>Weekend Surcharge (%)</label><input className="form-input" type="number" value={p.weekend||''} onChange={e => setP({...p,weekend:parseFloat(e.target.value)||0})} placeholder="0"/></div>
          </div>
        </div>
        <div className="panel">
          <h3 className="panel-section-title">Per-Vehicle Pricing</h3>
          <p style={{fontSize:'.8rem',color:'var(--text-muted)',marginBottom:'1rem',lineHeight:1.6}}>Set individual base price, price/km, and minimum fare per vehicle.</p>
          <div id="vehicle-pricing-list">
            {vehicles.map(v => {
              const vp = vPricing[v.id] || {};
              const hasPrice = vp.basePrice || vp.pricePerKm;
              return (
                <div key={v.id} className="toggle-item" style={{flexWrap:'wrap',gap:'.75rem'}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:500}}>{v.name}</div>
                    <div className="toggle-label-sub">{v.category}</div>
                    <div style={{fontSize:'.73rem',marginTop:'.25rem',color:'var(--text-sec)'}}>
                      {hasPrice ? `${currency} ${vp.basePrice||0} base + ${currency} ${vp.pricePerKm||0}/km · min ${currency} ${vp.minPrice||0}` : <em style={{color:'var(--text-muted)'}}>No pricing set</em>}
                    </div>
                  </div>
                  <button className="act-btn act-btn-edit" onClick={() => onVehiclePrice(v.id, vp)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Set Pricing
                  </button>
                </div>
              );
            })}
          </div>
          <div className="info-banner" style={{marginTop:'1.5rem'}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Fare = Base + (km × Price/km). Round trip doubles the total.
          </div>
        </div>
      </div>
    </div>
  );
}

function AreasSection({ areas, onToggle }) {
  return (
    <div className="page active">
      <div className="page-head"><h1 className="page-title">Service Areas</h1></div>
      <div className="two-col">
        <div className="panel">
          <h3 className="panel-section-title">Active Service Countries</h3>
          <div id="service-areas-list">
            {areas.map(a => (
              <div key={a.code} className="area-item">
                <span className="area-flag">{a.flag}</span>
                <div className="area-info"><div className="area-name">{a.name}</div><div className="area-sub">{a.cities}</div></div>
                <div style={{display:'flex',gap:'.5rem',alignItems:'center'}}>
                  <span className={`status-badge ${a.enabled?'badge-enabled':'badge-disabled'}`}>{a.enabled?'Active':'Off'}</span>
                  <label className="toggle"><input type="checkbox" checked={!!a.enabled} onChange={e => onToggle(a.code, e.target.checked)}/><span className="toggle-slider"/></label>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h3 className="panel-section-title">Coverage Info</h3>
          <p style={{fontSize:'.82rem',color:'var(--text-muted)',lineHeight:1.7,marginBottom:'1rem'}}>Transfers are restricted to enabled service countries. The booking form validates pickup and drop-off locations against this list.</p>
          <div className="info-banner"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>Changes sync to the booking form instantly.</div>
        </div>
      </div>
    </div>
  );
}

function FormSettingsSection({ fs, onSave }) {
  const [s, setS] = useState(fs);
  useEffect(() => setS(fs), [fs]);
  const f = (k, v) => setS(prev => ({...prev, [k]: v}));
  return (
    <div className="page active">
      <div className="page-head"><h1 className="page-title">Form Settings</h1><button className="btn-primary" onClick={() => onSave(s)}>Save & Sync</button></div>
      <div className="two-col">
        <div className="panel">
          <h3 className="panel-section-title">Step Titles</h3>
          <div className="form-grid">
            {[['title1','Step 1 Title'],['title2','Step 2 Title'],['title3','Step 3 Title']].map(([k,l]) => (
              <div key={k} className="form-field"><label>{l}</label><input className="form-input" value={s[k]||''} onChange={e => f(k, e.target.value)}/></div>
            ))}
          </div>
        </div>
        <div className="panel">
          <h3 className="panel-section-title">Button Labels</h3>
          <div className="form-grid">
            {[['btn1Text','Step 1 Button'],['btn2Text','Step 2 Button'],['btnSubmitText','Submit Button']].map(([k,l]) => (
              <div key={k} className="form-field"><label>{l}</label><input className="form-input" value={s[k]||''} onChange={e => f(k, e.target.value)}/></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackingCodesSection({ ts, onSave }) {
  const [s, setS] = useState(ts);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setS(ts); setDirty(false); }, [ts]);
  const f = (k, v) => { setS(prev => ({...prev, [k]: v})); setDirty(true); };

  function save() {
    onSave(s);
    setDirty(false);
  }

  return (
    <div className="page active">
      <div className="page-head">
        <h1 className="page-title">Tracking Codes</h1>
        <button className="btn-primary" onClick={save} disabled={!dirty}>Save & Go Live</button>
      </div>

      <div className="info-banner" style={{marginBottom:'1.5rem'}}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Only paste code copied directly from Google Ads, Google Analytics, or Google Tag Manager. Whatever
        you paste here runs on every visitor's browser on the live booking page — never paste code from
        an untrusted source.
      </div>

      <div className="two-col">
        <div className="panel">
          <h3 className="panel-section-title">Landing Page Code</h3>
          <p style={{fontSize:'.8rem',color:'var(--text-muted)',marginBottom:'1rem',lineHeight:1.6}}>
            Runs on every page load. This is your GA4 / Google Ads "global site tag" — paste the full
            &lt;script&gt; snippet Google gives you when you set up a new tag or campaign.
          </p>
          <textarea
            className="form-input"
            rows={10}
            style={{fontFamily:'monospace', fontSize:'.78rem', lineHeight:1.6}}
            placeholder={'<!-- Paste your Google tag here, e.g. -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag(\'js\', new Date());\n  gtag(\'config\', \'G-XXXXXXX\');\n</script>'}
            value={s.landingCode || ''}
            onChange={e => f('landingCode', e.target.value)}
          />
        </div>
        <div className="panel">
          <h3 className="panel-section-title">Thank-You Page Code</h3>
          <p style={{fontSize:'.8rem',color:'var(--text-muted)',marginBottom:'1rem',lineHeight:1.6}}>
            Runs once, only when a booking is successfully confirmed. This is your Google Ads conversion
            "event snippet" — paste it here to count booking completions as conversions.
          </p>
          <textarea
            className="form-input"
            rows={10}
            style={{fontFamily:'monospace', fontSize:'.78rem', lineHeight:1.6}}
            placeholder={'<!-- Paste your Google Ads conversion event snippet here, e.g. -->\n<script>\n  gtag(\'event\', \'conversion\', {\n    \'send_to\': \'AW-XXXXXXX/XXXXXXXXXXXX\'\n  });\n</script>'}
            value={s.thankyouCode || ''}
            onChange={e => f('thankyouCode', e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function AdminUsersSection({ admins, onAdd, onEdit, onDelete }) {
  return (
    <div className="page active">
      <div className="page-head"><h1 className="page-title">Admin Users</h1><button className="btn-primary" onClick={onAdd}>+ Add User</button></div>
      <div className="panel" style={{padding:0}}>
        <div className="table-wrap">
          <table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {admins.map(a => (
              <tr key={a.id}>
                <td style={{fontWeight:500}}>{a.name}</td>
                <td style={{fontSize:'.82rem'}}>{a.email}</td>
                <td><span className="status-badge badge-blue">{cap(a.role)}</span></td>
                <td><span className={`status-badge ${a.status==='active'?'badge-enabled':'badge-disabled'}`}>{cap(a.status||'active')}</span></td>
                <td>
                  <div className="action-btns">
                    <button className="act-btn act-btn-edit" onClick={() => onEdit(a)}>Edit</button>
                    <button className="act-btn act-btn-del" onClick={() => onDelete(a.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ settings, onSave }) {
  const [s, setS] = useState(settings);
  useEffect(() => setS(settings), [settings]);
  const f = (k, v) => setS(prev => ({...prev, [k]: v}));
  return (
    <div className="page active">
      <div className="page-head"><h1 className="page-title">Settings</h1><button className="btn-primary" onClick={() => onSave(s)}>Save Changes</button></div>
      <div className="panel">
        <h3 className="panel-section-title">Company Information</h3>
        <div className="form-grid">
          {[['company','Company Name'],['phone','Phone'],['email','Email'],['address','Address'],['website','Website']].map(([k,l]) => (
            <div key={k} className="form-field"><label>{l}</label><input className="form-input" value={s[k]||''} onChange={e => f(k, e.target.value)}/></div>
          ))}
          <div className="form-field"><label>Currency</label><select className="form-input" value={s.currency||'CHF'} onChange={e => f('currency',e.target.value)}><option value="CHF">CHF</option><option value="EUR">EUR</option></select></div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   MODALS
══════════════════════════════════════════ */

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-backdrop" style={{display:'flex'}} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-head"><h3>{title}</h3><button className="modal-close" onClick={onClose}>✕</button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

function VehicleModal({ data, onSave, onClose }) {
  const [v, setV] = useState(data || { name:'', category:'', passengers:4, luggage:2, badge:'', badgeType:'green', features:'', description:'', image:'' });
  const f = (k, val) => setV(prev => ({...prev, [k]: val}));

  function handleImg(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5*1024*1024) { alert('Image must be under 5MB.'); return; }
    const reader = new FileReader();
    reader.onload = ev => f('image', ev.target.result);
    reader.readAsDataURL(file);
  }

  function submit() {
    if (!v.name) { alert('Vehicle name is required.'); return; }
    onSave({ ...v, features: typeof v.features === 'string' ? v.features.split(',').map(s=>s.trim()).filter(Boolean) : v.features });
  }

  return (
    <Modal title={data ? 'Edit Vehicle' : 'Add Vehicle'} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={submit}>Save Vehicle</button></>}>
      <div className="form-grid">
        <div className="form-field" style={{gridColumn:'1/-1'}}>
          <label>Vehicle Image</label>
          {v.image ? <img src={v.image} alt="preview" style={{width:'100%',maxHeight:200,objectFit:'cover',borderRadius:8,marginBottom:'0.5rem'}}/> : null}
          <input type="file" accept="image/*" onChange={handleImg} className="form-input"/>
        </div>
        <div className="form-field"><label>Vehicle Name *</label><input className="form-input" value={v.name} onChange={e => f('name',e.target.value)}/></div>
        <div className="form-field"><label>Category</label><input className="form-input" value={v.category} onChange={e => f('category',e.target.value)}/></div>
        <div className="form-field"><label>Passengers</label><input className="form-input" type="number" value={v.passengers} onChange={e => f('passengers',parseInt(e.target.value)||4)}/></div>
        <div className="form-field"><label>Luggage</label><input className="form-input" type="number" value={v.luggage} onChange={e => f('luggage',parseInt(e.target.value)||2)}/></div>
        <div className="form-field"><label>Badge Text</label><input className="form-input" value={v.badge} onChange={e => f('badge',e.target.value)}/></div>
        <div className="form-field"><label>Badge Style</label>
          <select className="form-input" value={v.badgeType} onChange={e => f('badgeType',e.target.value)}>
            <option value="green">Green</option><option value="gold">Gold</option><option value="silver">Silver</option>
          </select>
        </div>
        <div className="form-field" style={{gridColumn:'1/-1'}}><label>Features (comma-separated)</label><input className="form-input" value={Array.isArray(v.features) ? v.features.join(', ') : v.features} onChange={e => f('features',e.target.value)}/></div>
        <div className="form-field" style={{gridColumn:'1/-1'}}><label>Description</label><textarea className="form-input" rows={2} value={v.description} onChange={e => f('description',e.target.value)}/></div>
      </div>
    </Modal>
  );
}

function BookingModal({ booking: b, onStatus, onClose }) {
  const [status, setStatus] = useState(b.status || 'pending');
  return (
    <Modal title="Booking Details" onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Close</button><button className="btn-primary" onClick={() => onStatus(b.id, status)}>Update Status</button></>}>
      <div style={{background:'rgba(200,164,93,0.08)',border:'1px solid rgba(200,164,93,0.25)',borderRadius:10,padding:'1rem 1.25rem',marginBottom:'1.25rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <div style={{fontSize:'.68rem',letterSpacing:'.12em',textTransform:'uppercase',color:'var(--text-muted)'}}>Booking Reference</div>
          <div style={{fontSize:'1.1rem',fontWeight:700,color:'var(--gold)',letterSpacing:'.08em'}}>{b.id}</div>
        </div>
        {statusBadge(b.status)}
      </div>
      <div className="detail-grid">
        {[
          ['Full Name', b.name], ['Email', b.email||'—'], ['Phone', b.phone||'—'],
          ['Trip Type', b.tripType==='round-trip'?'Round Trip':'One Way'],
          ['Pickup', b.pickup||'—'], ['Drop-off', b.dropoff||'—'],
          ['Pickup Date', fmtDate(b.date)], ['Pickup Time', b.time||'—'],
          ...(b.tripType==='round-trip'&&b.returnDate ? [['Return Date', fmtDate(b.returnDate)], ['Return Time', b.returnTime||'—']] : []),
          ['Vehicle', b.vehicle||'—'],
          ...(b.estimatedDistance ? [['Est. Distance', `~${b.estimatedDistance} km`]] : []),
          ...(b.estimatedFare     ? [['Estimated Fare', `CHF ${Number(b.estimatedFare).toLocaleString()}`]] : []),
          ['Payment', b.payment||'unpaid'], ['Source', b.source||'website'], ['Booked On', fmtTs(b.createdAt)],
        ].map(([label, val]) => (
          <div key={label} className="detail-item">
            <div className="detail-label">{label}</div>
            <div className="detail-value">{val}</div>
          </div>
        ))}
      </div>
      {b.notes && (
        <div style={{marginTop:'.75rem',padding:'.85rem 1rem',background:'var(--bg-input)',borderRadius:8,border:'1px solid var(--border)'}}>
          <div className="detail-label" style={{marginBottom:'.3rem'}}>Special Requests</div>
          <div style={{fontSize:'.85rem',color:'var(--text-sec)'}}>{b.notes}</div>
        </div>
      )}
      <div className="form-field" style={{marginTop:'1.25rem',paddingTop:'1rem',borderTop:'1px solid var(--border)'}}>
        <label className="detail-label">Update Status</label>
        <select className="form-input" style={{marginTop:'.4rem'}} value={status} onChange={e => setStatus(e.target.value)}>
          {['pending','confirmed','in-progress','completed','cancelled'].map(s => <option key={s} value={s}>{cap(s)}</option>)}
        </select>
      </div>
    </Modal>
  );
}

function VehiclePricingModal({ vehicleId, current, vehicles, currency, onSave, onClose }) {
  const v = vehicles.find(x => x.id === vehicleId);
  const [p, setP] = useState({ basePrice:'', pricePerKm:'', minPrice:'', ...current });
  return (
    <Modal title={`Pricing — ${v?.name || vehicleId}`} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={() => { if (!p.basePrice||!p.pricePerKm||!p.minPrice) { alert('Fill all fields.'); return; } onSave(vehicleId,{basePrice:parseFloat(p.basePrice),pricePerKm:parseFloat(p.pricePerKm),minPrice:parseFloat(p.minPrice)}); }}>Save Pricing</button></>}>
      <p style={{fontSize:'.78rem',color:'var(--text-muted)',marginBottom:'1.25rem',lineHeight:1.6}}>
        <strong style={{color:'var(--gold)'}}>Fare = Base Price + (km × Price/km), minimum applies.</strong> Round trip = one-way × 2.
      </p>
      <div className="form-grid" style={{gridTemplateColumns:'1fr 1fr'}}>
        <div className="form-field"><label>Base Price ({currency})</label><input className="form-input" type="number" placeholder="e.g. 80" value={p.basePrice} onChange={e => setP(x=>({...x,basePrice:e.target.value}))}/><small style={{color:'var(--text-muted)',fontSize:'.72rem'}}>Fixed charge per ride</small></div>
        <div className="form-field"><label>Price per km ({currency})</label><input className="form-input" type="number" placeholder="e.g. 2.50" value={p.pricePerKm} onChange={e => setP(x=>({...x,pricePerKm:e.target.value}))}/><small style={{color:'var(--text-muted)',fontSize:'.72rem'}}>Multiplied by distance</small></div>
        <div className="form-field"><label>Minimum Price ({currency})</label><input className="form-input" type="number" placeholder="e.g. 80" value={p.minPrice} onChange={e => setP(x=>({...x,minPrice:e.target.value}))}/><small style={{color:'var(--text-muted)',fontSize:'.72rem'}}>Floor price for any ride</small></div>
        <div className="form-field"><label>Return Ride</label><div style={{padding:'.7rem .9rem',background:'var(--bg-input)',border:'1px solid var(--border)',borderRadius:8,fontSize:'.82rem',color:'var(--text-sec)'}}>× 2 automatically</div></div>
      </div>
    </Modal>
  );
}

function AdminUserModal({ data, onSave, onClose }) {
  const [u, setU] = useState(data || { name:'', email:'', role:'admin', status:'active' });
  return (
    <Modal title={data ? 'Edit Admin User' : 'Add Admin User'} onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={() => { if (!u.name||!u.email) { alert('Name and email required.'); return; } onSave(u); }}>Save</button></>}>
      <div className="form-grid">
        <div className="form-field"><label>Full Name</label><input className="form-input" value={u.name} onChange={e => setU(x=>({...x,name:e.target.value}))}/></div>
        <div className="form-field"><label>Email</label><input className="form-input" type="email" value={u.email} onChange={e => setU(x=>({...x,email:e.target.value}))}/></div>
        <div className="form-field"><label>Role</label><select className="form-input" value={u.role} onChange={e => setU(x=>({...x,role:e.target.value}))}><option value="admin">Admin</option><option value="superadmin">Superadmin</option></select></div>
        <div className="form-field"><label>Status</label><select className="form-input" value={u.status||'active'} onChange={e => setU(x=>({...x,status:e.target.value}))}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
      </div>
    </Modal>
  );
}

function ConfirmModal({ msg, onConfirm, onClose }) {
  return (
    <Modal title="Confirm Action" onClose={onClose}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-danger" onClick={onConfirm}>Confirm</button></>}>
      <p style={{color:'var(--text-sec)',fontSize:'.88rem',lineHeight:1.6}}>{msg}</p>
    </Modal>
  );
}
