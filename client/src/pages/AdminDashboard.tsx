import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { SopDocument, SopPreview, ReportSummary, UserWithProperties, Brand, Property, Category } from '../types';
import Navbar from '../components/Navbar';
import Button from '../components/Button';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import FileDropzone from '../components/FileDropzone';
import Card from '../components/Card';
import LlmSettingsTab from '../components/LlmSettingsTab';

type MainTab = 'sops' | 'submissions' | 'settings';
type SettingsSubTab = 'users' | 'catalog' | 'llm';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<MainTab>('sops');
  const [settingsTab, setSettingsTab] = useState<SettingsSubTab>('users');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sops, setSops] = useState<SopDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');

  // Submissions tab state
  const [submissions, setSubmissions] = useState<ReportSummary[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subSearch, setSubSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');

  // Users tab state
  const [users, setUsers] = useState<UserWithProperties[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  // Catalog tab state
  const [brands, setBrands] = useState<Brand[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({ title: '', description: '', category: 'HR', brand: '', property: '', version: '1.0' });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [toast, setToast] = useState('');

  const [previewSop, setPreviewSop] = useState<SopPreview | null>(null);
  const [editSop, setEditSop] = useState<SopDocument | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: '', brand: '', property: '', version: '', is_active: 1 });

  useEffect(() => { loadSops(); loadSopCatalog(); }, []);

  async function loadSopCatalog() {
    try {
      const [p, c] = await Promise.all([
        api.get<Property[]>('/admin/properties'),
        api.get<Category[]>('/admin/categories'),
      ]);
      setProperties(p);
      setCategories(c);
    } catch { /* non-fatal */ }
  }
  useEffect(() => { if (activeTab === 'submissions') loadSubmissions(); }, [activeTab]);
  useEffect(() => {
    if (activeTab === 'settings' && settingsTab === 'users') loadUsers();
    if (activeTab === 'settings' && settingsTab === 'catalog') loadCatalog();
  }, [activeTab, settingsTab]);

  async function loadCatalog() {
    try {
      setCatalogLoading(true);
      const [b, p, c] = await Promise.all([
        api.get<Brand[]>('/admin/brands'),
        api.get<Property[]>('/admin/properties'),
        api.get<Category[]>('/admin/categories'),
      ]);
      setBrands(b);
      setProperties(p);
      setCategories(c);
    } finally {
      setCatalogLoading(false);
    }
  }

  async function loadUsers() {
    try {
      setUsersLoading(true);
      const data = await api.get<UserWithProperties[]>('/admin/users');
      setUsers(data);
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadSubmissions() {
    try {
      setSubLoading(true);
      const data = await api.get<ReportSummary[]>('/compare/reports');
      setSubmissions(data);
    } finally {
      setSubLoading(false);
    }
  }

  async function loadSops() {
    try {
      setLoading(true);
      const data = await api.get<SopDocument[]>('/sops');
      setSops(data);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!uploadFile) { setUploadError('Please select a file.'); return; }
    if (!uploadForm.title) { setUploadError('Title is required.'); return; }
    setUploadError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('title', uploadForm.title);
      fd.append('description', uploadForm.description);
      fd.append('category', uploadForm.category);
      fd.append('brand', uploadForm.brand);
      fd.append('property', uploadForm.property);
      fd.append('version', uploadForm.version);
      await api.upload('/sops/upload', fd);
      setUploadFile(null);
      setUploadForm({ title: '', description: '', category: 'HR', brand: '', property: '', version: '1.0' });
      showToast('SOP uploaded successfully');
      loadSops();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function handlePreview(sop: SopDocument) {
    try {
      const data = await api.get<SopPreview>(`/sops/${sop.id}/preview`);
      setPreviewSop(data);
    } catch {
      showToast('Failed to load preview');
    }
  }

  function openEdit(sop: SopDocument) {
    setEditSop(sop);
    setEditForm({
      title: sop.title,
      description: sop.description ?? '',
      category: sop.category ?? '',
      brand: sop.brand ?? '',
      property: sop.property ?? '',
      version: sop.version,
      is_active: sop.is_active,
    });
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editSop) return;
    try {
      await api.put(`/sops/${editSop.id}`, editForm);
      setEditSop(null);
      showToast('SOP updated');
      loadSops();
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  async function handleDeactivate(sop: SopDocument) {
    if (!confirm(`Deactivate "${sop.title}"?`)) return;
    try {
      await api.delete(`/sops/${sop.id}`);
      showToast('SOP deactivated');
      loadSops();
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  const filtered = sops.filter((s) => {
    const matchSearch = s.title.toLowerCase().includes(search.toLowerCase());
    const matchCat = !catFilter || s.category === catFilter;
    return matchSearch && matchCat;
  });

  const sopCategoryCount = new Set(sops.map((s) => s.category).filter(Boolean)).size;
  const activeSops = sops.filter((s) => s.is_active);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#FBF8EE' }}>
      <Navbar />

      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside
          className="flex flex-col flex-shrink-0 overflow-y-auto transition-[width] duration-200"
          style={{ width: sidebarCollapsed ? 64 : 240, background: '#121113' }}
        >
          {/* Collapse toggle */}
          <div className="flex items-center justify-end px-3 py-3 border-b border-white/10">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            >
              {sidebarCollapsed
                ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              }
            </button>
          </div>

          <nav className="flex-1 p-2 pt-3 space-y-0.5">
            <SidebarItem icon="📁" label="SOP Library"  active={activeTab === 'sops'}        collapsed={sidebarCollapsed} onClick={() => setActiveTab('sops')} />
            <SidebarItem icon="📋" label="Submissions"  active={activeTab === 'submissions'} collapsed={sidebarCollapsed} onClick={() => setActiveTab('submissions')} />

            {/* Settings accordion */}
            <button
              onClick={() => {
                if (sidebarCollapsed) { setSidebarCollapsed(false); setSettingsOpen(true); }
                else setSettingsOpen((o) => !o);
                if (activeTab !== 'settings') setActiveTab('settings');
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'settings'
                  ? 'bg-[#BFF143]/15 text-[#BFF143]'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <span className="text-base flex-shrink-0">⚙️</span>
              {!sidebarCollapsed && (
                <>
                  <span className="flex-1 text-left">Settings</span>
                  <span className="text-[10px] opacity-50">{settingsOpen ? '▲' : '▼'}</span>
                </>
              )}
            </button>

            {settingsOpen && !sidebarCollapsed && (
              <div className="ml-3 pl-3 border-l border-white/10 space-y-0.5 py-1">
                <SidebarSubItem label="Users"        active={activeTab === 'settings' && settingsTab === 'users'}   onClick={() => { setActiveTab('settings'); setSettingsTab('users'); }} />
                <SidebarSubItem label="Catalog"      active={activeTab === 'settings' && settingsTab === 'catalog'} onClick={() => { setActiveTab('settings'); setSettingsTab('catalog'); }} />
                <SidebarSubItem label="LLM Settings" active={activeTab === 'settings' && settingsTab === 'llm'}     onClick={() => { setActiveTab('settings'); setSettingsTab('llm'); }} />
              </div>
            )}
          </nav>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Page heading */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            {activeTab === 'sops' ? 'SOP Library'
              : activeTab === 'submissions' ? 'Submissions'
              : settingsTab === 'users' ? 'Users'
              : settingsTab === 'catalog' ? 'Catalog'
              : 'LLM Settings'}
          </h1>
          {activeTab === 'sops' && (
            <div className="flex gap-4 mt-4">
              <Stat label="Total SOPs" value={sops.length} />
              <Stat label="Active" value={activeSops.length} />
              <Stat label="Categories" value={sopCategoryCount} />
            </div>
          )}
        </div>

        {activeTab === 'settings' && settingsTab === 'users' && (
          <UsersTab
            users={users}
            loading={usersLoading}
            onRefresh={loadUsers}
            showToast={showToast}
          />
        )}

        {activeTab === 'settings' && settingsTab === 'catalog' && (
          <CatalogTab
            brands={brands}
            properties={properties}
            categories={categories}
            loading={catalogLoading}
            onRefresh={loadCatalog}
            showToast={showToast}
          />
        )}

        {activeTab === 'settings' && settingsTab === 'llm' && <LlmSettingsTab />}

        {activeTab === 'submissions' && (
          <SubmissionsTab
            submissions={submissions}
            loading={subLoading}
            subSearch={subSearch}
            setSubSearch={setSubSearch}
            dateFrom={dateFrom}
            setDateFrom={setDateFrom}
            dateTo={dateTo}
            setDateTo={setDateTo}
            brandFilter={brandFilter}
            setBrandFilter={setBrandFilter}
            propertyFilter={propertyFilter}
            setPropertyFilter={setPropertyFilter}
            onView={(id) => navigate(`/report/${id}`)}
          />
        )}

        {activeTab === 'sops' && <>
        {/* Upload Panel */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Upload New SOP</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            <FileDropzone onFile={setUploadFile} currentFile={uploadFile} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Title *</label>
                <input
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Employee Onboarding SOP"
                  className="w-full px-3 py-2 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Category</label>
                <select
                  value={uploadForm.category}
                  onChange={(e) => setUploadForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]"
                >
                  {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Property</label>
                <select
                  value={uploadForm.property}
                  onChange={(e) => {
                    const selected = properties.find((p) => p.name === e.target.value);
                    setUploadForm((f) => ({
                      ...f,
                      property: e.target.value,
                      brand: selected?.brand_name ?? '',
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]"
                >
                  <option value="">— Select Property —</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}{p.brand_name ? ` (${p.brand_name})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Brand</label>
                <input
                  value={uploadForm.brand}
                  readOnly
                  placeholder="Auto-filled from property"
                  className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-slate-50 text-slate-500 cursor-default"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Version</label>
                <input
                  value={uploadForm.version}
                  onChange={(e) => setUploadForm((f) => ({ ...f, version: e.target.value }))}
                  placeholder="1.0"
                  className="w-full px-3 py-2 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Description</label>
                <input
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Brief description..."
                  className="w-full px-3 py-2 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]"
                />
              </div>
            </div>
            {uploadError && (
              <p className="text-red-600 text-sm">{uploadError}</p>
            )}
            <Button type="submit" loading={uploading}>
              Upload SOP
            </Button>
          </form>
        </Card>

        {/* SOP Table */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SOPs..."
              className="flex-1 px-3 py-2 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]"
            />
            <select
              value={catFilter}
              onChange={(e) => setCatFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]"
            >
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          {loading ? (
            <p className="text-slate-500 text-center py-8">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No SOPs found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="text-left py-2 pr-4 font-medium">Title</th>
                    <th className="text-left py-2 pr-4 font-medium">Category</th>
                    <th className="text-left py-2 pr-4 font-medium">Version</th>
                    <th className="text-left py-2 pr-4 font-medium">Uploaded</th>
                    <th className="text-left py-2 pr-4 font-medium">Status</th>
                    <th className="text-left py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((sop) => (
                    <tr key={sop.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-3 pr-4 text-slate-900 font-medium">{sop.title}</td>
                      <td className="py-3 pr-4 text-slate-600">{sop.category || '—'}</td>
                      <td className="py-3 pr-4 text-slate-600">v{sop.version}</td>
                      <td className="py-3 pr-4 text-slate-500 text-xs">
                        {new Date(sop.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={sop.is_active ? 'complete' : 'error'} label={sop.is_active ? 'Active' : 'Inactive'} />
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handlePreview(sop)}>Preview</Button>
                          <Button variant="secondary" size="sm" onClick={() => openEdit(sop)}>Edit</Button>
                          {sop.is_active ? (
                            <Button variant="danger" size="sm" onClick={() => handleDeactivate(sop)}>Deactivate</Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </>}

        </div>
        </main>
      </div>

      {/* Preview Modal */}
      <Modal open={!!previewSop} onClose={() => setPreviewSop(null)} title="SOP Preview" width="max-w-2xl">
        {previewSop && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Category" value={previewSop.category ?? '—'} />
              <Info label="Version" value={`v${previewSop.version}`} />
              <Info label="Uploaded" value={new Date(previewSop.created_at).toLocaleDateString()} />
            </div>
            {previewSop.description && (
              <p className="text-slate-700 text-sm">{previewSop.description}</p>
            )}
            <div className="mt-3">
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wide">Extracted Text Preview</p>
              <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 whitespace-pre-wrap max-h-64 overflow-y-auto">
                {previewSop.preview || 'No text extracted.'}
              </pre>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editSop} onClose={() => setEditSop(null)} title="Edit SOP">
        {editSop && (
          <form onSubmit={handleEdit} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-700 mb-1">Title</label>
              <input
                value={editForm.title}
                onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-700 mb-1">Category</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]"
                >
                  {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">Version</label>
                <input
                  value={editForm.version}
                  onChange={(e) => setEditForm((f) => ({ ...f, version: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">Property</label>
                <select
                  value={editForm.property}
                  onChange={(e) => {
                    const selected = properties.find((p) => p.name === e.target.value);
                    setEditForm((f) => ({
                      ...f,
                      property: e.target.value,
                      brand: selected?.brand_name ?? '',
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]"
                >
                  <option value="">— Select Property —</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}{p.brand_name ? ` (${p.brand_name})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-700 mb-1">Brand</label>
                <input
                  value={editForm.brand}
                  readOnly
                  placeholder="Auto-filled from property"
                  className="w-full px-3 py-2 rounded-lg text-sm border border-slate-200 bg-slate-50 text-slate-500 cursor-default"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-700 mb-1">Description</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143] resize-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={editForm.is_active === 1}
                onChange={(e) => setEditForm((f) => ({ ...f, is_active: e.target.checked ? 1 : 0 }))}
                className="rounded"
              />
              <label htmlFor="is_active" className="text-sm text-slate-700">Active</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setEditSop(null)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

// ─── Submissions Tab ────────────────────────────────────────────────────────

interface SubmissionsTabProps {
  submissions: ReportSummary[];
  loading: boolean;
  subSearch: string;
  setSubSearch: (v: string) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  brandFilter: string;
  setBrandFilter: (v: string) => void;
  propertyFilter: string;
  setPropertyFilter: (v: string) => void;
  onView: (id: number) => void;
}

function scoreColor(score: number | null) {
  if (score === null) return '#94a3b8';
  if (score >= 80) return '#16A34A';
  if (score >= 50) return '#D97706';
  return '#DC2626';
}

function scoreLabel(score: number | null) {
  if (score === null) return '—';
  if (score >= 80) return 'Compliant';
  if (score >= 50) return 'Partial';
  return 'Non-Compliant';
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildExportRows(rows: ReportSummary[]) {
  return rows.map((r) => ({
    Document: r.submitted_filename,
    'SOP Checked Against': r.sop_title ?? '—',
    Brand: r.sop_brand ?? '—',
    Property: r.sop_property ?? '—',
    'Date Uploaded': fmtDate(r.created_at),
    Status: r.status,
    Grade: scoreLabel(r.compliance_score),
    'Completed At': r.completed_at ? fmtDate(r.completed_at) : '—',
  }));
}

function exportHTML(rows: ReportSummary[]) {
  const data = buildExportRows(rows);
  const headers = Object.keys(data[0] ?? {});
  const thead = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  const tbody = data.map((row) =>
    `<tr>${headers.map((h) => `<td>${(row as Record<string, string>)[h]}</td>`).join('')}</tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SOP Submissions Report</title>
<style>
  body { font-family: Verdana, sans-serif; background: #FBF8EE; color: #121113; padding: 32px; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  p.sub { font-size: 12px; color: #64748b; margin-bottom: 24px; }
  table { border-collapse: collapse; width: 100%; font-size: 13px; }
  th { background: #121113; color: #BFF143; padding: 10px 12px; text-align: left; font-weight: 600; }
  td { padding: 9px 12px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
</style>
</head>
<body>
<h1>Submissions Report</h1>
<p class="sub">Exported ${new Date().toLocaleString()} &mdash; ${data.length} record(s)</p>
<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
</body>
</html>`;

  download('submissions-report.html', html, 'text/html');
}

function exportPDF(rows: ReportSummary[]) {
  const data = buildExportRows(rows);
  const headers = Object.keys(data[0] ?? {});
  const thead = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  const tbody = data.map((row) =>
    `<tr>${headers.map((h) => `<td>${(row as Record<string, string>)[h]}</td>`).join('')}</tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SOP Submissions Report</title>
<style>
  @page { size: A4 landscape; margin: 18mm; }
  body { font-family: Verdana, sans-serif; color: #121113; font-size: 11px; }
  h1 { font-size: 16px; margin-bottom: 2px; }
  p.sub { font-size: 10px; color: #64748b; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #121113; color: #BFF143; padding: 7px 9px; text-align: left; font-weight: 600; }
  td { padding: 6px 9px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
</style>
</head>
<body>
<h1>Submissions Report</h1>
<p class="sub">Exported ${new Date().toLocaleString()} &mdash; ${data.length} record(s)</p>
<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) { win.document.write(html); win.document.close(); }
}

function exportDOCX(rows: ReportSummary[]) {
  const data = buildExportRows(rows);
  const headers = Object.keys(data[0] ?? {});
  const thead = `<tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  const tbody = data.map((row) =>
    `<tr>${headers.map((h) => `<td>${(row as Record<string, string>)[h]}</td>`).join('')}</tr>`
  ).join('');

  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:w="urn:schemas-microsoft-com:office:word"
  xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<title>SOP Submissions Report</title>
<style>
  body { font-family: Verdana, sans-serif; font-size: 11pt; }
  h1 { font-size: 16pt; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #121113; color: #BFF143; padding: 6pt; font-weight: bold; border: 1pt solid #333; }
  td { padding: 5pt; border: 1pt solid #cbd5e1; }
</style>
</head>
<body>
<h1>Submissions Report</h1>
<p>Exported ${new Date().toLocaleString()} &mdash; ${data.length} record(s)</p>
<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
</body>
</html>`;

  download('submissions-report.doc', html, 'application/msword');
}

function download(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type SortCol = 'grade' | 'brand' | 'property' | 'date';
type SortDir = 'asc' | 'desc';

function sortValue(r: ReportSummary, col: SortCol): string | number {
  switch (col) {
    case 'date':     return r.created_at;
    case 'grade':    return r.compliance_score ?? -1;
    case 'brand':    return (r.sop_brand ?? '').toLowerCase();
    case 'property': return (r.sop_property ?? '').toLowerCase();
  }
}

function SubmissionsTab({
  submissions, loading, subSearch, setSubSearch,
  dateFrom, setDateFrom, dateTo, setDateTo,
  brandFilter, setBrandFilter, propertyFilter, setPropertyFilter,
  onView,
}: SubmissionsTabProps) {
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const inputCls = 'px-3 py-2 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]';

  const brands = [...new Set(submissions.map((r) => r.sop_brand).filter(Boolean))] as string[];
  const properties = submissions
    .filter((r) => !brandFilter || r.sop_brand === brandFilter)
    .map((r) => r.sop_property)
    .filter(Boolean);
  const uniqueProperties = [...new Set(properties)] as string[];

  const filtered = submissions.filter((r) => {
    const q = subSearch.toLowerCase();
    const matchSearch = !q ||
      r.submitted_filename.toLowerCase().includes(q) ||
      (r.sop_title ?? '').toLowerCase().includes(q);
    const created = r.created_at.slice(0, 10);
    const matchFrom     = !dateFrom      || created >= dateFrom;
    const matchTo       = !dateTo        || created <= dateTo;
    const matchBrand    = !brandFilter   || r.sop_brand === brandFilter;
    const matchProperty = !propertyFilter || r.sop_property === propertyFilter;
    return matchSearch && matchFrom && matchTo && matchBrand && matchProperty;
  });

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const av = sortValue(a, sortCol);
        const bv = sortValue(b, sortCol);
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : filtered;

  function toggleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  function SortTh({ col, label, center }: { col: SortCol; label: string; center?: boolean }) {
    const active = sortCol === col;
    return (
      <th
        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none whitespace-nowrap transition-colors ${active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'} ${center ? 'text-center' : 'text-left'}`}
        onClick={() => toggleSort(col)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className="text-[10px] leading-none" style={{ opacity: active ? 1 : 0.35 }}>
            {active && sortDir === 'desc' ? '▼' : '▲'}
          </span>
        </span>
      </th>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters + Export */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-xs text-slate-500 mb-1">Search</label>
            <input
              value={subSearch}
              onChange={(e) => setSubSearch(e.target.value)}
              placeholder="Filename, SOP…"
              className={inputCls + ' w-full'}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Brand</label>
            <select
              value={brandFilter}
              onChange={(e) => { setBrandFilter(e.target.value); setPropertyFilter(''); }}
              className={inputCls}
            >
              <option value="">All Brands</option>
              {brands.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Property</label>
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className={inputCls}
              disabled={uniqueProperties.length === 0}
            >
              <option value="">All Properties</option>
              {uniqueProperties.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Date From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Date To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputCls} />
          </div>
          {(subSearch || dateFrom || dateTo || brandFilter || propertyFilter) && (
            <Button variant="ghost" size="sm" onClick={() => { setSubSearch(''); setDateFrom(''); setDateTo(''); setBrandFilter(''); setPropertyFilter(''); }}>
              Clear
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => exportHTML(sorted)} disabled={sorted.length === 0}>Export HTML</Button>
            <Button variant="secondary" size="sm" onClick={() => exportPDF(sorted)} disabled={sorted.length === 0}>Export PDF</Button>
            <Button variant="secondary" size="sm" onClick={() => exportDOCX(sorted)} disabled={sorted.length === 0}>Export DOCX</Button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">{sorted.length} of {submissions.length} submission{submissions.length !== 1 ? 's' : ''}</p>
      </Card>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16 text-slate-400 text-sm">Loading…</div>
      ) : sorted.length === 0 ? (
        <Card className="p-10 text-center text-slate-400 text-sm">No submissions match the current filters.</Card>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 820 }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Document</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">SOP</th>
                <SortTh col="brand"    label="Brand" />
                <SortTh col="property" label="Property" />
                <SortTh col="date" label="Date" />
                <SortTh col="grade"  label="Grade" />
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => {
                const color = scoreColor(r.compliance_score);
                return (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 max-w-[200px]">
                      <p className="font-medium text-slate-900 truncate" title={r.submitted_filename}>{r.submitted_filename}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[160px]">
                      <p className="truncate" title={r.sop_title ?? '—'}>{r.sop_title ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.sop_brand ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-[140px]">
                      <p className="truncate" title={r.sop_property ?? ''}>{r.sop_property ?? <span className="text-slate-300">—</span>}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-3">
                      {r.compliance_score !== null ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color, background: `${color}18`, border: `1px solid ${color}40` }}>
                          {scoreLabel(r.compliance_score)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'complete' && (
                        <button
                          onClick={() => onView(r.id)}
                          className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 transition-colors whitespace-nowrap"
                        >
                          View Report
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Brands & Properties Catalog Tab ─────────────────────────────────────────

function CatalogTab({ brands, properties, categories, loading, onRefresh, showToast }: {
  brands: Brand[];
  properties: Property[];
  categories: Category[];
  loading: boolean;
  onRefresh: () => void;
  showToast: (msg: string) => void;
}) {
  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]';

  // ── Brand modal state ──
  const [editBrand, setEditBrand] = useState<Brand | null>(null);
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [brandName, setBrandName] = useState('');
  const [brandError, setBrandError] = useState('');
  const [brandSaving, setBrandSaving] = useState(false);

  // ── Property modal state ──
  const [editProp, setEditProp] = useState<Property | null>(null);
  const [showAddProp, setShowAddProp] = useState(false);
  const [propName, setPropName] = useState('');
  const [propBrandId, setPropBrandId] = useState<string>('');
  const [propError, setPropError] = useState('');
  const [propSaving, setPropSaving] = useState(false);

  // ── Category modal state ──
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [showAddCat, setShowAddCat] = useState(false);
  const [catName, setCatName] = useState('');
  const [catError, setCatError] = useState('');
  const [catSaving, setCatSaving] = useState(false);

  function openAddBrand() { setBrandName(''); setBrandError(''); setShowAddBrand(true); }
  function openEditBrand(b: Brand) { setBrandName(b.name); setBrandError(''); setEditBrand(b); }

  async function saveBrand(e: FormEvent) {
    e.preventDefault();
    if (!brandName.trim()) { setBrandError('Name is required'); return; }
    setBrandError(''); setBrandSaving(true);
    try {
      if (editBrand) {
        await api.put(`/admin/brands/${editBrand.id}`, { name: brandName.trim() });
        showToast('Brand updated'); setEditBrand(null);
      } else {
        await api.post('/admin/brands', { name: brandName.trim() });
        showToast('Brand created'); setShowAddBrand(false);
      }
      onRefresh();
    } catch (err) { setBrandError((err as Error).message); }
    finally { setBrandSaving(false); }
  }

  async function deleteBrand(b: Brand) {
    if (!confirm(`Delete brand "${b.name}"? Properties under it will become unbranded.`)) return;
    try { await api.delete(`/admin/brands/${b.id}`); showToast('Brand deleted'); onRefresh(); }
    catch (err) { showToast((err as Error).message); }
  }

  function openAddProp() { setPropName(''); setPropBrandId(''); setPropError(''); setShowAddProp(true); }
  function openEditProp(p: Property) { setPropName(p.name); setPropBrandId(p.brand_id ? String(p.brand_id) : ''); setPropError(''); setEditProp(p); }

  async function saveProp(e: FormEvent) {
    e.preventDefault();
    if (!propName.trim()) { setPropError('Name is required'); return; }
    setPropError(''); setPropSaving(true);
    const payload = { name: propName.trim(), brand_id: propBrandId ? Number(propBrandId) : null };
    try {
      if (editProp) {
        await api.put(`/admin/properties/${editProp.id}`, payload);
        showToast('Property updated'); setEditProp(null);
      } else {
        await api.post('/admin/properties', payload);
        showToast('Property created'); setShowAddProp(false);
      }
      onRefresh();
    } catch (err) { setPropError((err as Error).message); }
    finally { setPropSaving(false); }
  }

  async function deleteProp(p: Property) {
    if (!confirm(`Delete property "${p.name}"?`)) return;
    try { await api.delete(`/admin/properties/${p.id}`); showToast('Property deleted'); onRefresh(); }
    catch (err) { showToast((err as Error).message); }
  }

  function openAddCat() { setCatName(''); setCatError(''); setShowAddCat(true); }
  function openEditCat(c: Category) { setCatName(c.name); setCatError(''); setEditCat(c); }

  async function saveCat(e: FormEvent) {
    e.preventDefault();
    if (!catName.trim()) { setCatError('Name is required'); return; }
    setCatError(''); setCatSaving(true);
    try {
      if (editCat) {
        await api.put(`/admin/categories/${editCat.id}`, { name: catName.trim() });
        showToast('Category updated'); setEditCat(null);
      } else {
        await api.post('/admin/categories', { name: catName.trim() });
        showToast('Category created'); setShowAddCat(false);
      }
      onRefresh();
    } catch (err) { setCatError((err as Error).message); }
    finally { setCatSaving(false); }
  }

  async function deleteCat(c: Category) {
    if (!confirm(`Delete category "${c.name}"?`)) return;
    try { await api.delete(`/admin/categories/${c.id}`); showToast('Category deleted'); onRefresh(); }
    catch (err) { showToast((err as Error).message); }
  }

  if (loading) return <div className="flex justify-center py-16 text-slate-400 text-sm">Loading…</div>;

  return (
    <div className="space-y-6">

      {/* ── Brands ── */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Brands</h2>
            <p className="text-xs text-slate-500 mt-0.5">{brands.length} brand{brands.length !== 1 ? 's' : ''}</p>
          </div>
          <Button size="sm" onClick={openAddBrand}>+ Add Brand</Button>
        </div>

        {brands.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No brands yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {brands.map((b) => (
              <div key={b.id} className="flex items-center justify-between py-3">
                <div>
                  <span className="font-medium text-slate-900 text-sm">{b.name}</span>
                  <span className="ml-2 text-xs text-slate-400">{b.property_count} propert{b.property_count !== 1 ? 'ies' : 'y'}</span>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => openEditBrand(b)} className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-2 transition-colors">Edit</button>
                  <button onClick={() => deleteBrand(b)} className="text-xs text-red-400 hover:text-red-600 underline underline-offset-2 transition-colors">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Properties ── */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Properties</h2>
            <p className="text-xs text-slate-500 mt-0.5">{properties.length} propert{properties.length !== 1 ? 'ies' : 'y'}</p>
          </div>
          <Button size="sm" onClick={openAddProp}>+ Add Property</Button>
        </div>

        {properties.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No properties yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {properties.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-900 text-sm">{p.name}</span>
                  {p.brand_name ? (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-[#BFF143]/20 text-slate-700 border border-[#BFF143]/40">{p.brand_name}</span>
                  ) : (
                    <span className="text-xs text-slate-300">No brand</span>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => openEditProp(p)} className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-2 transition-colors">Edit</button>
                  <button onClick={() => deleteProp(p)} className="text-xs text-red-400 hover:text-red-600 underline underline-offset-2 transition-colors">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Brand modal */}
      <Modal open={showAddBrand || !!editBrand} onClose={() => { setShowAddBrand(false); setEditBrand(null); }} title={editBrand ? `Edit Brand: ${editBrand.name}` : 'Add Brand'}>
        <form onSubmit={saveBrand} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700 mb-1">Brand Name *</label>
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="e.g. Banyan Tree" className={inputCls} autoFocus />
          </div>
          {brandError && <p className="text-red-600 text-sm">{brandError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => { setShowAddBrand(false); setEditBrand(null); }}>Cancel</Button>
            <Button type="submit" loading={brandSaving}>{editBrand ? 'Save Changes' : 'Create Brand'}</Button>
          </div>
        </form>
      </Modal>

      {/* Property modal */}
      <Modal open={showAddProp || !!editProp} onClose={() => { setShowAddProp(false); setEditProp(null); }} title={editProp ? `Edit Property: ${editProp.name}` : 'Add Property'}>
        <form onSubmit={saveProp} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700 mb-1">Property Name *</label>
            <input value={propName} onChange={(e) => setPropName(e.target.value)} placeholder="e.g. Banyan Tree Bangkok" className={inputCls} autoFocus />
          </div>
          <div>
            <label className="block text-sm text-slate-700 mb-1">Brand</label>
            <select value={propBrandId} onChange={(e) => setPropBrandId(e.target.value)} className={inputCls}>
              <option value="">— No Brand —</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          {propError && <p className="text-red-600 text-sm">{propError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => { setShowAddProp(false); setEditProp(null); }}>Cancel</Button>
            <Button type="submit" loading={propSaving}>{editProp ? 'Save Changes' : 'Create Property'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Categories ── */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Categories</h2>
            <p className="text-xs text-slate-500 mt-0.5">{categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}</p>
          </div>
          <Button size="sm" onClick={openAddCat}>+ Add Category</Button>
        </div>

        {categories.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">No categories yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between py-3">
                <span className="font-medium text-slate-900 text-sm">{c.name}</span>
                <div className="flex gap-3">
                  <button onClick={() => openEditCat(c)} className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-2 transition-colors">Edit</button>
                  <button onClick={() => deleteCat(c)} className="text-xs text-red-400 hover:text-red-600 underline underline-offset-2 transition-colors">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Category modal */}
      <Modal open={showAddCat || !!editCat} onClose={() => { setShowAddCat(false); setEditCat(null); }} title={editCat ? `Edit Category: ${editCat.name}` : 'Add Category'}>
        <form onSubmit={saveCat} className="space-y-4">
          <div>
            <label className="block text-sm text-slate-700 mb-1">Category Name *</label>
            <input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="e.g. Food & Beverage" className={inputCls} autoFocus />
          </div>
          {catError && <p className="text-red-600 text-sm">{catError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => { setShowAddCat(false); setEditCat(null); }}>Cancel</Button>
            <Button type="submit" loading={catSaving}>{editCat ? 'Save Changes' : 'Create Category'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

// ─── Users Tab ───────────────────────────────────────────────────────────────

type UserForm = {
  login: string;
  password: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  properties: string[];
};

const EMPTY_FORM: UserForm = { login: '', password: '', name: '', email: '', role: 'user', properties: [] };

function UsersTab({ users, loading, onRefresh, showToast }: {
  users: UserWithProperties[];
  loading: boolean;
  onRefresh: () => void;
  showToast: (msg: string) => void;
}) {
  const [editUser, setEditUser] = useState<UserWithProperties | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [propInput, setPropInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]';

  function openAdd() {
    setForm(EMPTY_FORM);
    setPropInput('');
    setFormError('');
    setShowAdd(true);
  }

  function openEdit(u: UserWithProperties) {
    setForm({ login: u.login, password: '', name: u.name, email: u.email, role: u.role, properties: [...u.properties] });
    setPropInput('');
    setFormError('');
    setEditUser(u);
  }

  function addProp() {
    const val = propInput.trim();
    if (!val || form.properties.includes(val)) { setPropInput(''); return; }
    setForm((f) => ({ ...f, properties: [...f.properties, val] }));
    setPropInput('');
  }

  function removeProp(p: string) {
    setForm((f) => ({ ...f, properties: f.properties.filter((x) => x !== p) }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.name || !form.email) { setFormError('Name and email are required'); return; }
    if (showAdd && !form.password) { setFormError('Password is required'); return; }
    setFormError('');
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        login: form.login,
        name: form.name,
        email: form.email,
        role: form.role,
        properties: form.properties,
      };
      if (form.password) payload.password = form.password;

      if (editUser) {
        await api.put(`/admin/users/${editUser.id}`, payload);
        showToast('User updated');
        setEditUser(null);
      } else {
        await api.post('/admin/users', payload);
        showToast('User created');
        setShowAdd(false);
      }
      onRefresh();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(u: UserWithProperties) {
    if (!confirm(`Delete user "${u.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/users/${u.id}`);
      showToast('User deleted');
      onRefresh();
    } catch (err) {
      showToast((err as Error).message);
    }
  }

  const isOpen = showAdd || !!editUser;
  const modalTitle = editUser ? `Edit: ${editUser.name}` : 'Add New User';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">{users.length} user{users.length !== 1 ? 's' : ''}</p>
        <Button onClick={openAdd}>+ Add User</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400 text-sm">Loading…</div>
      ) : users.length === 0 ? (
        <Card className="p-10 text-center text-slate-400 text-sm">No users found.</Card>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 680 }}>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Login</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Properties</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-700 text-xs">{u.login || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3"><Badge variant={u.role} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.properties.length === 0
                        ? <span className="text-slate-300 text-xs">—</span>
                        : u.properties.map((p) => (
                            <span key={p} className="inline-block px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200">{p}</span>
                          ))
                      }
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => openEdit(u)}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 transition-colors"
                      >Edit</button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="text-xs font-medium text-red-500 hover:text-red-700 underline underline-offset-2 transition-colors"
                      >Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={isOpen} onClose={() => { setShowAdd(false); setEditUser(null); }} title={modalTitle}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-700 mb-1">Login (Username)</label>
              <input value={form.login} onChange={(e) => setForm((f) => ({ ...f, login: e.target.value }))} placeholder="e.g. jsmith" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-slate-700 mb-1">
                Password {editUser && <span className="text-slate-400 font-normal">(leave blank to keep)</span>}
              </label>
              <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder={editUser ? '••••••••' : 'Required'} className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-slate-700 mb-1">Full Name *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-slate-700 mb-1">Email *</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm text-slate-700 mb-1">Role</label>
              <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as 'admin' | 'user' }))} className={inputCls}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {/* Properties */}
          <div>
            <label className="block text-sm text-slate-700 mb-1">Properties</label>
            <div className="flex gap-2">
              <input
                value={propInput}
                onChange={(e) => setPropInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addProp(); } }}
                placeholder="Type a property and press Enter"
                className={inputCls}
              />
              <Button type="button" variant="secondary" size="sm" onClick={addProp}>Add</Button>
            </div>
            {form.properties.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.properties.map((p) => (
                  <span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-700 border border-slate-200">
                    {p}
                    <button type="button" onClick={() => removeProp(p)} className="text-slate-400 hover:text-red-500 ml-0.5 leading-none">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {formError && <p className="text-red-600 text-sm">{formError}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" type="button" onClick={() => { setShowAdd(false); setEditUser(null); }}>Cancel</Button>
            <Button type="submit" loading={saving}>{editUser ? 'Save Changes' : 'Create User'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function SidebarItem({ icon, label, active, collapsed, onClick }: {
  icon: string; label: string; active: boolean; collapsed: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active ? 'bg-[#BFF143]/15 text-[#BFF143]' : 'text-white/60 hover:text-white hover:bg-white/10'
      }`}
    >
      <span className="text-base flex-shrink-0">{icon}</span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

function SidebarSubItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors ${
        active ? 'text-[#BFF143] bg-[#BFF143]/10' : 'text-white/50 hover:text-white hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-4 rounded-xl border-2 border-[#121113] bg-white min-w-[120px]">
      <div className="text-3xl font-bold" style={{ color: '#121113' }}>{value}</div>
      <div className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wide whitespace-nowrap">{label}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-slate-900 font-medium mt-0.5">{value}</p>
    </div>
  );
}
