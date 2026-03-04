// src/components/StudentManual.jsx
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, MessageCircle, Send, X, Bot, BookOpen } from 'lucide-react';
import { chatbotAsk } from '../services/api';
import './StudentManual.css';

/* ── Manual data organised by chapter / section ── */
const MANUAL_SECTIONS = [
  {
    id: 'ch4-conduct',
    title: 'Student Conduct and Discipline',
    icon: '⚖️',
    highlight: true,
    content: `Students are expected to observe proper decorum at all times. They must comply with the university code of student conduct, including wearing proper uniform, carrying their ID at all times, and respecting university personnel and fellow students.`,
    subsections: [
      {
        id: 'duties',
        title: 'Duties and Responsibilities of Students',
        content: `Every student shall:
1. Love God, country, and his/her fellowmen.
2. Live a meaningful and productive life.
3. Observe the University Code of Student Conduct.
4. Develop his/her skills, capacities, and talents in pursuit of academic excellence.
5. Respect the Filipino flag and all that upholds and symbolizes the country.
6. Respect the customs and traditions, the laws of the land, and the rules and policies of the University.
7. Uphold the dignity of the institution by exhibiting proper decorum at all times in all places.
8. Uphold the academic and moral integrity of the institution by trying to achieve excellence and moral uprightness.
9. Promote and preserve the peace and order in the University by observing the rules on discipline and establish harmonious relationship with fellow students, faculty, staff, and other stakeholders.
10. Promote general welfare by actively participating in civic and socio-cultural affairs.`
      }
    ]
  },
  {
    id: 'penalties-general',
    title: 'Penalties – General Provisions',
    icon: '📋',
    highlight: true,
    content: `Section 1. General Provisions

1.1. The Director/Chief of the OSAS shall determine, recommend, and impose appropriate penalties after due process taking into account the following:
  1.1.1. Nature and gravity of offense;
  1.1.2. Previous record of misconduct / establish precedents;
  1.1.3. Position or status of the aggrieved party;
  1.1.4. Pertinent and applicable aggravating and mitigating circumstances.

1.2. Students who are certified by the OSAS as violator of major offenses shall be subjected to corresponding disciplinary actions after due process.`
  },
  {
    id: 'minor-offenses',
    title: 'Minor Offenses (Section 2.1)',
    icon: '🟡',
    highlight: true,
    content: `2.1.1. Failure to wear proper uniform, complete uniform
2.1.2. Possession and passing of pornographic materials in print and non-printed materials
2.1.3. Littering / unsanitary acts
2.1.4. Loitering
2.1.5. Eating in restricted areas like library, computer laboratories and other laboratories
2.1.6. Unauthorized use of school facilities
2.1.7. Lending / borrowing of Identification Card
2.1.8. Driving without license / unregistered vehicle / violation of traffic rules inside the campus like over speeding and noisy mufflers (RA 8749 – Clean Air Act)`
  },
  {
    id: 'major-offenses',
    title: 'Major Offenses (Section 2.2)',
    icon: '🔴',
    highlight: true,
    content: `2.2.1. Possession and use of alcoholic drinks and prohibited drugs and deadly weapons and explosives or anything ordinary objects that are abused or misused
2.2.2. Smoking as reiterated in RA 8749
2.2.3. Disrespect
2.2.4. Vandalism in all areas / facility of the campus
2.2.5. Dishonesty / cheating / forgery / falsification
2.2.6. Creating barricades / obstructions
2.2.7. Assaults / physical injuries / verbal abuse in all forms and medium: oral, social media, text messages
2.2.8. Hazing
2.2.9. Harassment and sexual abuse / acts of lasciviousness
2.2.10. Use of unauthorized software and electronic gadgets
2.2.11. Involvement in unrecognized sorority / fraternity
2.2.12. Gambling
2.2.13. Public display of affection or intimacy, indecent or immoral acts like scandalous videos
2.2.14. Possession and distribution of offensive / subversive materials
2.2.15. Grave threats
2.2.16. Inciting to fight / sedition
2.2.17. Conducting activity without approval of the OSAS and misrepresenting the University in student activities
2.2.18. Bullying`
  },
  {
    id: 'penalties-minor',
    title: 'Penalties for Minor Offenses (Section 3.1)',
    icon: '🟡',
    highlight: true,
    content: `3.1.1. First offense: reprimand and apology, promissory letter, restitution, summons for parent/s guardian/s.
3.1.2. Second offense: suspension from one (1) to four (4) days, community service as determined by the Office of Student Affairs and Services.
3.1.3. Third offense: treated as major offense.`
  },
  {
    id: 'penalties-major',
    title: 'Penalties for Major Offenses (Section 3.2)',
    icon: '🔴',
    highlight: true,
    content: `3.2.1. First offense: suspension from five (5) to ten (10) days or Community Service, as determined by the Office of Student Affairs and Services.
3.2.2. Second offense: suspension from eleven (11) to fifteen (15) days.
3.2.3. Third offense: suspension to forty-five (45) calendar days to dismissal depending upon the gravity of the offense after due process.`
  },
  {
    id: 'penalties-additional',
    title: 'Additional Penalty Provisions (Sections 4–10)',
    icon: '📌',
    content: `Section 4. When the offense is committed by a non-bonafide student within the University, and with the involvement of ISU student/s, the latter shall be accountable for the acts of the former.

Section 5. The parents / guardians of the offender shall always attend meetings and counselling to know their children's behavioural gross misconduct.

Section 6. Any student not enrolled at the time he/she is charged but refuses to be under jurisdiction of the University, his/her succeeding enrollment in any College/Campus of the University shall be withheld pending resolution of his/her case.

Section 7. The imposition of the disciplinary sanctions for the violation of any rule under this Code shall not prevent the University from endorsing the case to proper government authorities when the same may involve violations of penal laws.

Section 8. Policies issued from time to time by the University President on matters not covered in this handbook shall form an integral part of these guidelines.

Section 9. Previous policies, rules and regulations on student organizations enforced before the effectivity of this handbook are hereby superseded by these guidelines.

Section 10. Policies issued by the Student Government with regard to student activities in accordance with the provisions of the Constitution and By-Laws shall form an integral part of these guidelines.`
  },
  {
    id: 'disciplinary-actions',
    title: 'Disciplinary Actions',
    icon: '⚡',
    highlight: true,
    content: `a. Any violation of the Code of Conduct shall subject the student to appropriate disciplinary actions and due process in accordance with the policies and procedures of the University.

b. Any person who allegedly committed academic infractions shall be given a chance to explain and defend his/her side.

c. For an aggrieved student, a written complaint on the incident shall be submitted to the Department Chair or Dean indicating the date, time, subject and nature of offense. The Dean shall impose appropriate actions.

d. If the aggrieved party is a faculty or employee, complaints or charges shall be resolved by the Human Resource Management Office (HRMO) in accordance with established rules and regulations of the University.

e. In the case of a campus or university official, complaints shall be forwarded to the VP-ARA who shall be responsible for appropriate action.`
  },
  {
    id: 'investigation',
    title: 'Committee on Investigation / Appeal',
    icon: '🔍',
    content: `Section 1. The Office of Student Affairs Services shall create a committee on investigation composed of:
• Director / Chief of Student Services
• Director of Instruction / ARA
• Two senior faculties
• SSC President of the campus

The committee shall conduct investigation and collect pieces of evidence. Any appeal may be addressed to the Campus Head or University President who may create a Committee on Appeals.

Section 2. No disciplinary proceedings shall be instituted except for conduct prohibited by law or by university rules and regulations.
2.1. A disciplinary proceeding shall be instituted upon:
  2.1.1. Filing of written complaint under oath by the complainant to OSAS;
  2.1.2. Submission of official report about the violation.
2.2. There shall be an official entry book specifying the person charged, complainant, witnesses and substance of the charge.

Section 3. Student vs. Faculty/Employee (student as respondent) → handled by OSAS.
Section 4. Faculty/Staff as respondent → committee appointed by Director of Instruction/ARA.
Section 5. Dispute between/among students → special committee (OSAS Chief/Director, SSC Adviser, SSC President, CCL Chief Justice, CCL Speaker of the House).
Section 6. Dispute between students of different campuses → University Student Tribunal (SSCF officers, SSC Chief Justices, SSC Speakers of the House).`
  },
  {
    id: 'academic-status',
    title: 'Academic Status & Retention',
    icon: '📊',
    content: `Academic Status (Section 8):
• Good standing – no failing and/or incomplete grades.
• Warning – failed in 25% of total units enrolled.
• Probation – failed in 50% of total units enrolled.
• Dismissed – failed in 75% but less than 100% of academic units (dismissed from program, may apply to another).
• Permanent Disqualification – failed in 100% of academic units (no longer allowed to enroll in any program in all campuses).

Retention Policies follow the same thresholds as academic status above.`
  },
  {
    id: 'attendance',
    title: 'Class Attendance (Section 15)',
    icon: '📅',
    content: `15.a. All students shall attend the prescribed number of hours in a subject.

15.b. Any student absent due to inevitable circumstances shall secure an excuse slip from the Guidance Office. Illness absences require a medical certificate verified by the Campus/University Physician/Nurse.

15.c. Students absent for more than 20% of total lecture and laboratory hours in a term without valid reasons shall be dropped from the class roll.

15.d. A 15-minute tardiness shall be equivalent to one-hour period of absence.`
  },
  {
    id: 'rights',
    title: 'Rights of the Students',
    icon: '🛡️',
    content: `Students of Isabela State University have the right to:
• Receive quality and relevant education
• Due process in all disciplinary cases
• Freedom of expression in accordance with institutional principles
• Access student services and facilities
• Participate in student organizations and governance
• Be informed of policies that affect them`
  }
];

/* ── Collapsible Section Component ── */
const ManualSection = ({ section }) => {
  const [open, setOpen] = useState(section.highlight || false);

  return (
    <div className={`manual-section ${section.highlight ? 'manual-section-highlight' : ''}`}>
      <button className="manual-section-header" onClick={() => setOpen(o => !o)}>
        <span className="manual-section-icon">{section.icon}</span>
        <span className="manual-section-title">{section.title}</span>
        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
      </button>
      {open && (
        <div className="manual-section-body">
          <pre className="manual-pre">{section.content}</pre>
          {section.subsections?.map(sub => (
            <div key={sub.id} className="manual-subsection">
              <h4 className="manual-subsection-title">{sub.title}</h4>
              <pre className="manual-pre">{sub.content}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Chatbot Panel ── */
const ChatbotPanel = ({ open, onClose }) => {
  const [messages, setMessages] = useState([
    {
      role: 'bot',
      text: "Hello! I'm the **CounselMate Violation Rules Assistant**. I can help you with questions about student violations, offenses, penalties, disciplinary procedures, and student conduct from the ISU Student Manual.\n\nTry asking me things like:\n• \"What are the minor offenses?\"\n• \"What is the penalty for bullying?\"\n• \"How does the investigation process work?\""
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

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
          <span>Violation Rules Assistant</span>
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
          placeholder="Ask about violations, penalties, conduct..."
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

  return (
    <div className="student-manual-container">
      {/* Header */}
      <div className="student-manual-header">
        <div className="student-manual-header-text">
          <h1 className="student-manual-title">
            <BookOpen size={28} style={{ marginRight: 10, verticalAlign: 'middle' }} />
            ISU Student Manual
          </h1>
          <p className="student-manual-subtitle">
            Isabela State University — Student Conduct, Violations & Discipline Reference
          </p>
        </div>
      </div>

      {/* Quick Legend */}
      <div className="manual-legend">
        <span className="legend-item"><span className="legend-dot legend-dot-red"></span> Major Offense</span>
        <span className="legend-item"><span className="legend-dot legend-dot-yellow"></span> Minor Offense</span>
        <span className="legend-item"><span className="legend-dot legend-dot-blue"></span> Procedure / Info</span>
      </div>

      {/* Sections */}
      <div className="manual-sections">
        {MANUAL_SECTIONS.map(section => (
          <ManualSection key={section.id} section={section} />
        ))}
      </div>

      {/* Floating chat button */}
      {!chatOpen && (
        <button className="chatbot-fab" onClick={() => setChatOpen(true)} title="Ask about violations">
          <MessageCircle size={24} />
          <span className="chatbot-fab-label">Ask about Violations</span>
        </button>
      )}

      {/* Chatbot panel */}
      <ChatbotPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
};

export default StudentManual;
