import React, { useEffect, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { motion } from 'framer-motion';
import Button from '../components/ui/Button';
import { fetchJson } from '../common/fetchJson';

const TABS = ['content', 'blog', 'submissions', 'conversations'];
const STATUS_OPTIONS = ['all', 'new', 'reviewing', 'replied', 'archived'];

const createEmptyBlogDraft = () => ({
  slug: '',
  header: 'Product',
  title: '',
  by: 'Patience AI Team',
  publishedAt: new Date().toISOString().slice(0, 16),
  excerpt: '',
  tags: '',
  content: ''
});

const formatDate = (value) =>
  value ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Unknown';

const AdminPage = ({ onAction, defaultContent, currentContent, currentContentSource, onContentSaved }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('content');
  const [contentJson, setContentJson] = useState(JSON.stringify(currentContent || defaultContent, null, 2));
  const [contentError, setContentError] = useState('');
  const [contentSaving, setContentSaving] = useState(false);
  const [blogDraft, setBlogDraft] = useState(createEmptyBlogDraft());
  const [submissions, setSubmissions] = useState([]);
  const [counts, setCounts] = useState({ total: 0, new: 0, reviewing: 0, replied: 0, archived: 0 });
  const [submissionFilter, setSubmissionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [submissionError, setSubmissionError] = useState('');
  const [submissionLoading, setSubmissionLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [conversationSearch, setConversationSearch] = useState('');
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationError, setConversationError] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessage, setEditingMessage] = useState('');

  const selectedSubmission = submissions.find((item) => item.id === selectedId) || submissions[0] || null;

  const loadSiteContent = async () => {
    try {
      const payload = await fetchJson('/api/site-content');
      if (payload?.content) {
        setContentJson(JSON.stringify(payload.content, null, 2));
        onContentSaved(payload.content);
      }
    } catch (error) {
      setContentError(error.message);
      setContentJson(JSON.stringify(defaultContent, null, 2));
    }
  };

  const loadSubmissions = async () => {
    setSubmissionLoading(true);
    setSubmissionError('');

    try {
      const params = new URLSearchParams();
      if (submissionFilter !== 'all') {
        params.set('status', submissionFilter);
      }
      if (search.trim()) {
        params.set('search', search.trim());
      }

      const payload = await fetchJson(`/api/admin?${params.toString()}`);
      setSubmissions(payload.items || []);
      setCounts(payload.counts || { total: 0, new: 0, reviewing: 0, replied: 0, archived: 0 });
      setSelectedId((current) => current || payload.items?.[0]?.id || null);
    } catch (error) {
      setSubmissionError(error.message);
    } finally {
      setSubmissionLoading(false);
    }
  };

  const checkSession = async () => {
    setLoadingAuth(true);
    try {
      const payload = await fetchJson('/api/auth');
      if (payload.authenticated) {
        setAuthenticated(true);
        setUsername(payload.user?.username || '');
        await Promise.all([loadSiteContent(), loadSubmissions(), loadConversations()]);
      } else {
        setAuthenticated(false);
      }
    } catch {
      setAuthenticated(false);
    } finally {
      setLoadingAuth(false);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    loadSubmissions();
  }, [submissionFilter]);

  useEffect(() => {
    if (!authenticated || activeTab !== 'conversations') {
      return;
    }

    loadConversations(conversationSearch.trim());
  }, [activeTab]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      const payload = await fetchJson('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });

      if (payload.authenticated) {
        setAuthenticated(true);
        setUsername(payload.user?.username || loginForm.username);
        await Promise.all([loadSiteContent(), loadSubmissions(), loadConversations()]);
      }
    } catch (error) {
      setLoginError(error.message);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' }).catch(() => {});
    setAuthenticated(false);
    setUsername('');
  };

  const saveContent = async () => {
    setContentError('');
    setContentSaving(true);

    try {
      const parsed = JSON.parse(contentJson);
      const payload = await fetchJson('/api/site-content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: parsed })
      });

      if (payload?.content) {
        setContentJson(JSON.stringify(payload.content, null, 2));
        onContentSaved(payload.content);
      }
    } catch (error) {
      setContentError(error.message);
    } finally {
      setContentSaving(false);
    }
  };

  const resetContent = async () => {
    setContentError('');
    setContentSaving(true);

    try {
      const payload = await fetchJson('/api/site-content', {
        method: 'DELETE'
      });

      const content = payload?.content || defaultContent;
      setContentJson(JSON.stringify(content, null, 2));
      onContentSaved(content);
    } catch (error) {
      setContentError(error.message);
    } finally {
      setContentSaving(false);
    }
  };

  const populateBlogDraft = (post = null) => {
    setBlogDraft({
      slug: post?.slug || '',
      header: post?.header || 'Product',
      title: post?.title || '',
      by: post?.by || 'Patience AI Team',
      publishedAt: post?.publishedAt ? new Date(post.publishedAt).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      excerpt: post?.excerpt || '',
      tags: Array.isArray(post?.tags) ? post.tags.join(', ') : '',
      content: Array.isArray(post?.content) ? post.content.join('\n\n') : ''
    });
  };

  const publishBlogDraft = async () => {
    setContentError('');
    setContentSaving(true);

    try {
      const parsed = JSON.parse(contentJson);
      const posts = Array.isArray(parsed.blogPage?.posts) ? [...parsed.blogPage.posts] : [];
      const publishedAt = new Date(blogDraft.publishedAt).toISOString();
      const nextPost = {
        slug: blogDraft.slug.trim(),
        header: blogDraft.header.trim() || 'Product',
        title: blogDraft.title.trim(),
        by: blogDraft.by.trim() || 'Patience AI Team',
        publishedAt,
        excerpt: blogDraft.excerpt.trim(),
        tags: blogDraft.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
        content: blogDraft.content
          .split('\n')
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
      };

      if (!nextPost.slug || !nextPost.title || !nextPost.excerpt || !nextPost.content.length) {
        throw new Error('Slug, title, excerpt, and content are required.');
      }

      const existingIndex = posts.findIndex((post) => post.slug === nextPost.slug);
      if (existingIndex >= 0) {
        posts[existingIndex] = nextPost;
      } else {
        posts.unshift(nextPost);
      }

      parsed.blogPage = {
        ...(parsed.blogPage || {}),
        posts
      };

      const payload = await fetchJson('/api/site-content', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: parsed })
      });

      if (payload?.content) {
        setContentJson(JSON.stringify(payload.content, null, 2));
        onContentSaved(payload.content);
        populateBlogDraft(nextPost);
      }
    } catch (error) {
      setContentError(error.message);
    } finally {
      setContentSaving(false);
    }
  };

  const updateSubmissionStatus = async (id, status) => {
    setSavingId(id);
    setSubmissionError('');

    try {
      const payload = await fetchJson('/api/admin', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      });

      const updated = payload.item;
      setSubmissions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      setSubmissionError(error.message);
    } finally {
      setSavingId(null);
    }
  };

  const deleteSubmission = async (id) => {
    setSavingId(id);
    setSubmissionError('');

    try {
      await fetchJson('/api/admin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      setSubmissions((current) => current.filter((item) => item.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
      }
    } catch (error) {
      setSubmissionError(error.message);
    } finally {
      setSavingId(null);
    }
  };


  const loadConversations = async (conversationId = '') => {
    setConversationLoading(true);
    setConversationError('');

    try {
      const params = new URLSearchParams();
      if (conversationId) {
        params.set('conversationId', conversationId);
      }
      const payload = await fetchJson(`/api/chat-admin?${params.toString()}`);
      const next = payload.conversations || [];
      setConversations(next);
      setSelectedConversationId((current) => current || next[0]?.conversationId || '');
    } catch (error) {
      setConversationError(error.message);
    } finally {
      setConversationLoading(false);
    }
  };

  const deleteConversation = async (conversationId) => {
    await fetchJson('/api/chat-admin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId })
    });
    await loadConversations(conversationSearch.trim());
  };

  const deleteConversationMessage = async (id) => {
    await fetchJson('/api/chat-admin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    await loadConversations(conversationSearch.trim());
  };

  const saveConversationMessage = async () => {
    if (!editingMessageId || !editingMessage.trim()) {
      return;
    }

    await fetchJson('/api/chat-admin', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editingMessageId, message: editingMessage.trim() })
    });

    setEditingMessageId(null);
    setEditingMessage('');
    await loadConversations(conversationSearch.trim());
  };

  const filteredSubmissions = submissions.filter((item) => {
    const haystack = [item.name, item.email, item.subject, item.message, item.status, item.source, item.company, item.product_name]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return search.trim() ? haystack.includes(search.trim().toLowerCase()) : true;
  });

  if (loadingAuth) {
    return (
      <main className="bg-slate-950 text-white px-4 py-6 md:px-8 lg:px-10 min-h-[70vh] flex items-center justify-center">
        <p className="text-white/60">Loading admin console...</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="bg-slate-950 text-white px-4 py-6 md:px-8 lg:px-10 min-h-[70vh] flex items-center justify-center">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl">
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80 mb-3">Admin access</p>
          <h1 className="text-3xl font-semibold mb-3">Sign in</h1>
          <p className="text-white/60 mb-8">Sign in with your admin account to manage site content and submissions.</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-white/70 mb-2">Username</label>
              <input
                value={loginForm.username}
                onChange={(e) => setLoginForm((current) => ({ ...current, username: e.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                placeholder="Enter admin username"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm((current) => ({ ...current, password: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                  placeholder="Enter admin password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>
            {loginError && <div className="text-red-200 text-sm">{loginError}</div>}
            <Button variant="white" className="w-full rounded-2xl px-6 py-3">
              Login
            </Button>
          </form>
        </div>
      </main>
    );
  }

  const contentObject = (() => {
    try {
      return JSON.parse(contentJson);
    } catch {
      return null;
    }
  })();

  const blogPosts = contentObject?.blogPage?.posts || [];

  return (
    <main className="bg-slate-950 text-white px-4 py-6 md:px-8 lg:px-10">
      <section className="max-w-7xl mx-auto">
        <div className="rounded-[2rem] overflow-hidden border border-white/10 bg-[linear-gradient(135deg,#0f172a_0%,#111827_45%,#1f2937_100%)] shadow-2xl">
          <div className="p-6 md:p-8 border-b border-white/10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80 mb-3">NeonDB admin</p>
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Submission + content console</h1>
              <p className="text-white/65 mt-3 max-w-2xl">
                Logged in as {username}. Edit the full site JSON, publish it to NeonDB, and manage leads from one place.
              </p>
              <p className="text-white/45 mt-2 text-sm">Content source: {currentContentSource || 'local'}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="white" className="rounded-2xl px-6 py-3" onClick={() => onAction({ type: 'route', to: '/' })}>
                Back home
              </Button>
              <Button variant="secondary" className="rounded-2xl px-6 py-3" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>

          <div className="p-6 md:p-8 space-y-8">
            <div className="flex flex-wrap gap-2">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    activeTab === tab ? 'bg-white text-slate-950' : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab === 'content' && (
              <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                    <div>
                      <h2 className="text-2xl font-semibold">Site JSON</h2>
                      <p className="text-white/55 text-sm mt-1">Update the whole site from a single JSON document.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="secondary" className="rounded-2xl px-5 py-3" onClick={resetContent} disabled={contentSaving}>
                        Reset
                      </Button>
                      <Button variant="white" className="rounded-2xl px-5 py-3" onClick={saveContent} disabled={contentSaving}>
                        {contentSaving ? 'Saving...' : 'Save JSON'}
                      </Button>
                    </div>
                  </div>

                  {contentError && (
                    <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100 mb-4">
                      {contentError}
                    </div>
                  )}

                  <textarea
                    value={contentJson}
                    onChange={(e) => setContentJson(e.target.value)}
                    spellCheck={false}
                    className="w-full min-h-[520px] rounded-[1.5rem] border border-white/10 bg-slate-950/80 px-4 py-4 font-mono text-sm text-white/90 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                  />

                  {!contentObject && (
                    <div className="mt-4 text-sm text-amber-200">
                      JSON is invalid. Fix the syntax before saving.
                    </div>
                  )}
                </div>

                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 space-y-4">
                  <h3 className="text-xl font-semibold">Live notes</h3>
                  <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-4">
                    <p className="text-white/45 text-sm mb-1">Current source</p>
                    <p className="text-white">{currentContentSource || 'local'}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-4">
                    <p className="text-white/45 text-sm mb-1">Editing mode</p>
                    <p className="text-white">Whole-site JSON editing with live publish to NeonDB.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-4">
                    <p className="text-white/45 text-sm mb-1">Temp login</p>
                    <p className="text-white">Set ADMIN_USERNAME and ADMIN_PASSWORD in Vercel environment variables.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-4">
                    <p className="text-white/45 text-sm mb-1">Save behavior</p>
                    <p className="text-white">Save updates the `site_content` row. Reset deletes the custom row and restores defaults.</p>
                  </div>
                </div>
              </div>
            )}


            {activeTab === 'conversations' && (
              <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      value={conversationSearch}
                      onChange={(e) => setConversationSearch(e.target.value)}
                      placeholder="Find by conversation id (PatienceAI-...)"
                      className="flex-1 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm"
                    />
                    <Button variant="secondary" className="rounded-xl px-4 py-2" onClick={() => loadConversations(conversationSearch.trim())}>
                      Search
                    </Button>
                  </div>

                  {conversationError && <p className="text-red-200 text-sm mb-3">{conversationError}</p>}
                  {conversationLoading && <p className="text-white/60 text-sm">Loading conversations...</p>}

                  <div className="space-y-2 max-h-[420px] overflow-y-auto">
                    {(conversations || []).map((conversation) => (
                      <button
                        type="button"
                        key={conversation.conversationId}
                        onClick={() => setSelectedConversationId(conversation.conversationId)}
                        className={`w-full rounded-xl border text-left px-3 py-3 transition-colors ${
                          selectedConversationId === conversation.conversationId
                            ? 'border-cyan-300/60 bg-cyan-300/10'
                            : 'border-white/10 bg-slate-900/50 hover:bg-white/5'
                        }`}
                      >
                        <p className="font-medium text-sm">{conversation.conversationId}</p>
                        <p className="text-xs text-white/50 mt-1">IP: {conversation.ipAddress || 'unknown'}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
                  {(() => {
                    const activeConversation = conversations.find((item) => item.conversationId === selectedConversationId) || conversations[0];
                    if (!activeConversation) {
                      return <p className="text-white/60">No conversations found.</p>;
                    }

                    return (
                      <div>
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <div>
                            <h3 className="text-xl font-semibold">{activeConversation.conversationId}</h3>
                            <p className="text-xs text-white/50">IP: {activeConversation.ipAddress || 'unknown'}</p>
                          </div>
                          <Button variant="secondary" className="rounded-xl px-4 py-2" onClick={() => deleteConversation(activeConversation.conversationId)}>
                            Delete conversation
                          </Button>
                        </div>

                        <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                          {activeConversation.messages.map((item) => (
                            <div key={item.id} className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                              <p className="text-xs uppercase tracking-wide text-white/40 mb-2">{item.role} • {formatDate(item.created_at)}</p>
                              {editingMessageId === item.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editingMessage}
                                    onChange={(e) => setEditingMessage(e.target.value)}
                                    className="w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-sm min-h-20"
                                  />
                                  <div className="flex gap-2">
                                    <Button variant="white" className="rounded-lg px-3 py-2" onClick={saveConversationMessage}>Save</Button>
                                    <Button variant="secondary" className="rounded-lg px-3 py-2" onClick={() => { setEditingMessageId(null); setEditingMessage(''); }}>Cancel</Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm text-white/90 whitespace-pre-wrap">{item.message}</p>
                                  <div className="flex gap-2 mt-3">
                                    <Button variant="secondary" className="rounded-lg px-3 py-1.5" onClick={() => { setEditingMessageId(item.id); setEditingMessage(item.message); }}>
                                      Edit
                                    </Button>
                                    <Button variant="secondary" className="rounded-lg px-3 py-1.5" onClick={() => deleteConversationMessage(item.id)}>
                                      Delete
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {activeTab === 'blog' && (
              <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-semibold">Published posts</h2>
                      <p className="text-white/50 text-sm mt-1">Select a post to edit or create a new article.</p>
                    </div>
                    <Button
                      variant="secondary"
                      className="rounded-2xl px-4 py-2"
                      onClick={() => populateBlogDraft()}
                    >
                      New post
                    </Button>
                  </div>
                  <div className="divide-y divide-white/10">
                    {blogPosts.length ? (
                      blogPosts.map((post) => (
                        <button
                          key={post.slug}
                          type="button"
                          onClick={() => populateBlogDraft(post)}
                          className="w-full text-left p-5 hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-4 mb-2">
                            <p className="font-semibold text-white">{post.title}</p>
                            <span className="text-xs uppercase tracking-[0.25em] px-2.5 py-1 rounded-full bg-cyan-300/10 text-cyan-200">
                              {post.header}
                            </span>
                          </div>
                          <p className="text-sm text-white/60 line-clamp-2">{post.excerpt}</p>
                          <p className="text-xs text-white/40 mt-3">
                            {post.by} • {formatDate(post.publishedAt)}
                          </p>
                        </button>
                      ))
                    ) : (
                      <div className="p-6 text-white/60">No blog posts yet.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                    <div>
                      <h2 className="text-2xl font-semibold">Blog editor</h2>
                      <p className="text-white/50 text-sm mt-1">Write and publish posts to the website blog section.</p>
                    </div>
                    <Button
                      variant="white"
                      className="rounded-2xl px-5 py-3"
                      onClick={publishBlogDraft}
                      disabled={contentSaving}
                    >
                      {contentSaving ? 'Publishing...' : 'Publish post'}
                    </Button>
                  </div>

                  {contentError && (
                    <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100 mb-4">
                      {contentError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {[
                      { label: 'Slug', key: 'slug', type: 'text', placeholder: 'new-post-slug' },
                      { label: 'Header', key: 'header', type: 'text', placeholder: 'Product' },
                      { label: 'Title', key: 'title', type: 'text', placeholder: 'Post title' },
                      { label: 'By', key: 'by', type: 'text', placeholder: 'Author name' },
                      { label: 'Published at', key: 'publishedAt', type: 'datetime-local', placeholder: '' },
                      { label: 'Tags', key: 'tags', type: 'text', placeholder: 'Tag 1, Tag 2' }
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm text-white/70 mb-2">{field.label}</label>
                        <input
                          type={field.type}
                          value={blogDraft[field.key]}
                          onChange={(e) => setBlogDraft((current) => ({ ...current, [field.key]: e.target.value }))}
                          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                          placeholder={field.placeholder}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm text-white/70 mb-2">Excerpt</label>
                    <textarea
                      value={blogDraft.excerpt}
                      onChange={(e) => setBlogDraft((current) => ({ ...current, excerpt: e.target.value }))}
                      rows={4}
                      className="w-full rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 resize-none"
                      placeholder="Short summary shown on the blog index"
                    />
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm text-white/70 mb-2">Content</label>
                    <textarea
                      value={blogDraft.content}
                      onChange={(e) => setBlogDraft((current) => ({ ...current, content: e.target.value }))}
                      rows={12}
                      className="w-full rounded-[1.5rem] border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 resize-none"
                      placeholder="Write one paragraph per line"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      className="rounded-2xl px-5 py-3"
                      onClick={() => setBlogDraft(createEmptyBlogDraft())}
                    >
                      Reset draft
                    </Button>
                    {blogPosts[0] && (
                      <Button
                        variant="white"
                        className="rounded-2xl px-5 py-3"
                        onClick={() => populateBlogDraft(blogPosts[0])}
                      >
                        Load latest
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'submissions' && (
              <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/10 text-sm text-white/55 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <span>Submissions</span>
                    <span>{filteredSubmissions.length} shown</span>
                  </div>

                  <div className="p-4 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {STATUS_OPTIONS.map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setSubmissionFilter(option)}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                            submissionFilter === option ? 'bg-white text-slate-950' : 'bg-white/5 text-white/70 hover:bg-white/10'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          loadSubmissions();
                        }
                      }}
                      placeholder="Search submissions"
                      className="w-full lg:w-[360px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/70"
                    />
                  </div>

                  {submissionError && (
                    <div className="px-4 pb-4">
                      <div className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-red-100">
                        {submissionError}
                      </div>
                    </div>
                  )}

                  <div className="divide-y divide-white/10">
                    {submissionLoading ? (
                      <div className="p-6 text-white/60">Loading submissions...</div>
                    ) : filteredSubmissions.length ? (
                      filteredSubmissions.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedId(item.id)}
                          className={`w-full text-left p-5 transition-colors ${
                            selectedSubmission?.id === item.id ? 'bg-white/10' : 'hover:bg-white/5'
                          }`}
                        >
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-2 items-center">
                                <p className="font-semibold text-white">{item.name}</p>
                                <span className="text-xs uppercase tracking-[0.25em] px-2.5 py-1 rounded-full bg-cyan-300/10 text-cyan-200">
                                  {item.status}
                                </span>
                              </div>
                              <p className="text-sm text-white/65">{item.email}</p>
                              {(item.product_name || item.company) && (
                                <p className="text-sm text-white/55">
                                  {[item.product_name, item.company].filter(Boolean).join(' • ')}
                                </p>
                              )}
                              <p className="text-white/90">{item.subject}</p>
                              <p className="text-sm text-white/55 line-clamp-2">{item.message}</p>
                            </div>
                            <div className="text-sm text-white/45 md:text-right shrink-0">
                              <p>{formatDate(item.created_at)}</p>
                              <p className="mt-1">Source: {item.source}</p>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-6 text-white/60">No submissions match your filters.</div>
                    )}
                  </div>
                </div>

                <motion.aside
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 md:p-7"
                >
                  {selectedSubmission ? (
                    <div className="space-y-6">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80 mb-3">Selected lead</p>
                        <h2 className="text-2xl font-semibold">{selectedSubmission.name}</h2>
                        <p className="text-white/60 mt-2">{selectedSubmission.email}</p>
                      </div>

                      <div className="space-y-3 text-sm text-white/70">
                        <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-4">
                          <p className="text-white/45 mb-1">Subject</p>
                          <p className="text-white">{selectedSubmission.subject}</p>
                        </div>
                        {(selectedSubmission.product_name || selectedSubmission.company) && (
                          <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-4">
                            <p className="text-white/45 mb-1">Product / Company</p>
                            <p className="text-white">
                              {[selectedSubmission.product_name, selectedSubmission.company].filter(Boolean).join(' • ')}
                            </p>
                          </div>
                        )}
                        <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-4">
                          <p className="text-white/45 mb-1">Message</p>
                          <p className="leading-relaxed whitespace-pre-wrap">{selectedSubmission.message}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                          <p className="text-white/45">Source</p>
                          <p className="text-white mt-1">{selectedSubmission.source}</p>
                        </div>
                        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                          <p className="text-white/45">Created</p>
                          <p className="text-white mt-1">{formatDate(selectedSubmission.created_at)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        {['new', 'reviewing', 'replied', 'archived'].map((status) => (
                          <Button
                            key={status}
                            variant={selectedSubmission.status === status ? 'white' : 'secondary'}
                            className="rounded-2xl px-4 py-3"
                            onClick={() => updateSubmissionStatus(selectedSubmission.id, status)}
                            disabled={savingId === selectedSubmission.id}
                          >
                            {savingId === selectedSubmission.id && selectedSubmission.status !== status ? 'Saving...' : status}
                          </Button>
                        ))}
                      </div>

                      <Button
                        variant="coral"
                        className="rounded-2xl px-4 py-3 w-full"
                        onClick={() => deleteSubmission(selectedSubmission.id)}
                        disabled={savingId === selectedSubmission.id}
                      >
                        Delete submission
                      </Button>
                    </div>
                  ) : (
                    <div className="min-h-[340px] flex items-center justify-center text-white/55 text-center">
                      Select a submission to inspect the message and update its status.
                    </div>
                  )}
                </motion.aside>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
};

export default AdminPage;
