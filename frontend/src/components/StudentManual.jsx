// src/components/StudentManual.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, MessageCircle, Send, X, Bot, BookOpen, FileText } from 'lucide-react';
import { chatbotAsk, getStudentManual, getStudentManualInfo } from '../services/api';
import './StudentManual.css';

/* ── Manual Text Viewer ── */
const ManualViewer = ({ text, info, loading }) => {
  const [query, setQuery] = useState('');
  const preRef = useRef(null);

  // Highlight all matches inside the <pre> using mark tags
  const highlightedHtml = useCallback(() => {
    if (!text) return '';
    if (!query.trim()) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const escapedQuery = escapeHtml(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(new RegExp(escapedQuery, 'gi'), m => `<mark class="manual-highlight">${m}</mark>`);
  }, [text, query]);

  const matchCount = useCallback(() => {
    if (!query.trim() || !text) return 0;
    return (text.match(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length;
  }, [text, query]);

  if (loading) {
    return (
      <div className="manual-viewer-loading">
        <div className="manual-spinner" />
        <span>Loading manual…</span>
      </div>
    );
  }

  if (!text) {
    return (
      <div className="manual-viewer-empty">
        <FileText size={40} color="#d1d5db" />
        <p>No manual loaded. Upload a Student Manual (.txt) from the Admin Panel.</p>
      </div>
    );
  }

  const count = matchCount();

  return (
    <div className="manual-viewer">
      {/* search bar */}
      <div className="manual-search-bar">
        <div className="manual-search-input-wrap">
          <Search size={15} className="manual-search-icon" />
          <input
            className="manual-search-input"
            type="text"
            placeholder="Search manual…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="manual-search-clear" onClick={() => setQuery('')} title="Clear">
              <X size={13} />
            </button>
          )}
        </div>
        {query.trim() && (
          <span className="manual-search-count">
            {count > 0 ? `${count} match${count !== 1 ? 'es' : ''}` : 'No matches'}
          </span>
        )}
      </div>

      {/* text body */}
      <pre
        ref={preRef}
        className="manual-text-body"
        dangerouslySetInnerHTML={{ __html: highlightedHtml() }}
      />
    </div>
  );
};

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Chatbot Panel ── */
const ChatbotPanel = ({ open, onClose, manualName: manualNameProp }) => {
  const [manualName, setManualName] = useState(manualNameProp || 'Student Manual');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Sync if parent already knows the name (avoids an extra fetch)
  useEffect(() => {
    if (manualNameProp) setManualName(manualNameProp);
  }, [manualNameProp]);

  // Load manual info to personalise the greeting/title
  useEffect(() => {
    getStudentManualInfo()
      .then(res => {
        const info = res.data?.info;
        const name = info?.filename
          ? info.filename.replace(/\.[^.]+$/, '')
          : 'Student Manual';
        setManualName(name);
        setMessages([
          {
            role: 'bot',
            text: `Hello! I'm the **GuidanceOS Assistant** powered by **${name}**. Ask me anything about this manual and I'll find the relevant information for you.`
          }
        ]);
      })
      .catch(() => {
        setMessages([
          {
            role: 'bot',
            text: "Hello! I'm the **GuidanceOS Assistant**. Ask me anything about the student manual."
          }
        ]);
      });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', text: trimmed };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await chatbotAsk(trimmed);
      const reply = res.data?.reply || 'Sorry, I could not get a response. Please try again.';
      setMessages(prev => [...prev, { role: 'bot', text: reply }]);
    } catch (err) {
      console.error('Chatbot error:', err);
      setMessages(prev => [...prev, { role: 'bot', text: 'Sorry, an error occurred. Please try again later.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /** Render markdown-lite: bold (**text**) and newlines */
  const renderText = (text) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      // Split remaining by newline
      return part.split('\n').map((line, j) => (
        <React.Fragment key={`${i}-${j}`}>
          {j > 0 && <br />}
          {line}
        </React.Fragment>
      ));
    });
  };

  if (!open) return null;

  return (
    <div className="chatbot-panel">
      <div className="chatbot-header">
        <div className="chatbot-header-left">
          <Bot size={20} />
          <span>{manualName}</span>
        </div>
        <button className="chatbot-close" onClick={onClose} title="Close chat">
          <X size={18} />
        </button>
      </div>

      <div className="chatbot-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`chatbot-msg chatbot-msg-${msg.role}`}>
            {msg.role === 'bot' && <div className="chatbot-msg-avatar"><Bot size={16} /></div>}
            <div className={`chatbot-msg-bubble chatbot-msg-bubble-${msg.role}`}>
              {renderText(msg.text)}
            </div>
          </div>
        ))}
        {loading && (
          <div className="chatbot-msg chatbot-msg-bot">
            <div className="chatbot-msg-avatar"><Bot size={16} /></div>
            <div className="chatbot-msg-bubble chatbot-msg-bubble-bot chatbot-typing">
              <span className="dot"></span><span className="dot"></span><span className="dot"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chatbot-input-area">
        <input
          className="chatbot-input"
          type="text"
          placeholder={`Ask about ${manualName}…`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className="chatbot-send"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          title="Send"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

/* ── Main Student Manual Page ── */
const StudentManual = () => {
  const [chatOpen, setChatOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const [manualInfo, setManualInfo] = useState(null);
  const [manualLoading, setManualLoading] = useState(true);

  const manualName = manualInfo?.filename
    ? manualInfo.filename.replace(/\.[^.]+$/, '')
    : 'Student Manual';

  useEffect(() => {
    getStudentManual()
      .then(res => {
        setManualText(res.data?.text || '');
        setManualInfo(res.data?.info || null);
      })
      .catch(() => setManualText(''))
      .finally(() => setManualLoading(false));
  }, []);

  return (
    <div className="student-manual-container">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            marginRight: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 102, 51, 0.08)',
            borderRadius: '8px',
            color: 'var(--primary)',
            flexShrink: 0
          }}>
            <BookOpen style={{ width: '22px', height: '22px' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: '700', margin: 0 }}>{manualName}</h1>
            <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              {manualInfo?.source === 'upload'
                ? `Custom manual · uploaded ${new Date(manualInfo.uploadedAt).toLocaleDateString()}`
                : `${manualInfo?.filename?.replace(/\.[^.]+$/, '') || 'Student Manual'} — Reference Guide`}
            </p>
          </div>
        </div>

        {manualInfo && (
          <div style={{ fontSize: '12px', color: '#6b7280', textAlign: 'right', background: '#f9fafb', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
            {(manualInfo.chars || 0).toLocaleString()} chars · {' '}
            {(manualInfo.lines || 0).toLocaleString()} lines · {' '}
            <span style={{ color: manualInfo.source === 'upload' ? '#10b981' : '#9ca3af', fontWeight: 700 }}>
              {manualInfo.source === 'upload' ? 'CUSTOM' : 'DEFAULT'}
            </span>
          </div>
        )}
      </div>

      {/* Manual text viewer */}
      <ManualViewer text={manualText} info={manualInfo} loading={manualLoading} />

      {/* Floating chat button */}
      {!chatOpen && (
        <button className="chatbot-fab" onClick={() => setChatOpen(true)} title={`Ask about ${manualName}`}>
          <MessageCircle size={24} />
          <span className="chatbot-fab-label">Ask about {manualName}</span>
        </button>
      )}

      {/* Chatbot panel */}
      <ChatbotPanel open={chatOpen} onClose={() => setChatOpen(false)} manualName={manualName} />
    </div>
  );
};

export default StudentManual;
