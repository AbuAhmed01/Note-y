import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive, Bell, BookOpen, Bold, BrainCircuit, Check, ChevronDown, Clock3, Download,
  FileText, Folder, FolderPlus, Heading2, Headphones, Highlighter, Italic, Library, List, Mic, MoreHorizontal,
  PanelLeftClose, Plus, Search, Send, Settings2, Sparkles, Star, Underline, Users, X,
} from 'lucide-react'
import './App.css'

type Note = {
  id: string
  title: string
  folder: string
  content: string
  createdAt: string
  updatedAt: string
  starred: boolean
  archived: boolean
}

type ChatMessage = { role: 'user' | 'ai'; text: string }
type ProviderSettings = {
  endpoint: string
  model: string
  transcriptionEndpoint: string
  transcriptionModel: string
  language: string
}
type AppSettings = {
  fileFormat: 'md' | 'txt'
  theme: 'midnight' | 'paper' | 'moss'
  folderLabel: string
}

type DirectoryHandle = {
  name: string
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<{ createWritable: () => Promise<{ write: (data: Blob | string) => Promise<void>; close: () => Promise<void> }> }>
}

declare global {
  interface Window { showDirectoryPicker?: () => Promise<DirectoryHandle> }
}

const starterNote: Note = {
  id: 'welcome-note',
  title: 'Welcome to your workspace',
  folder: 'Personal',
  content: '<p><strong>Your notes live here.</strong> Create a document to start writing, or record audio directly from the editor.</p><p>Use the toolbar to <mark>highlight important ideas</mark>, format text, and ask your local AI for a summary.</p>',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  starred: false,
  archived: false,
}

const defaultFolders = ['Personal', 'Work', 'Study']
const nowIso = () => new Date().toISOString()
const todayLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()
const createNoteData = (folder: string): Note => {
  const now = nowIso()
  return { id: crypto.randomUUID(), title: 'Untitled document', folder, content: '', createdAt: now, updatedAt: now, starred: false, archived: false }
}

const openAudioStore = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open('note-y-media', 1)
  request.onupgradeneeded = () => request.result.createObjectStore('recordings')
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

const saveRecording = async (noteId: string, blob: Blob) => {
  const database = await openAudioStore()
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction('recordings', 'readwrite').objectStore('recordings').put(blob, noteId)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
  database.close()
}

const htmlToText = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.innerText.trim()
const isBlankHtml = (html: string) => htmlToText(html).length === 0
const noteFileContents = (note: Note, format: AppSettings['fileFormat']) => format === 'md'
  ? `# ${note.title || 'Untitled document'}\n\n${htmlToText(note.content)}\n`
  : `${note.title || 'Untitled document'}\n\n${htmlToText(note.content)}\n`
const fileSafe = (value: string) => (value.trim() || 'untitled-document').replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '-').toLowerCase()

function App() {
  const [notes, setNotes] = useState<Note[]>(() => {
    const saved = localStorage.getItem('note-y-notes')
    return saved ? JSON.parse(saved) as Note[] : [starterNote]
  })
  const [folders, setFolders] = useState(() => {
    const saved = localStorage.getItem('note-y-folders')
    return saved ? JSON.parse(saved) as string[] : defaultFolders
  })
  const [activeView, setActiveView] = useState('All notes')
  const [selectedId, setSelectedId] = useState(notes[0]?.id ?? '')
  const [search, setSearch] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showComposer, setShowComposer] = useState(false)
  const [showFolderInput, setShowFolderInput] = useState(false)
  const [newFolder, setNewFolder] = useState('')
  const [provider, setProvider] = useState<ProviderSettings>(() => ({
    endpoint: localStorage.getItem('note-y-ai-endpoint') ?? 'http://localhost:11434/v1/chat/completions',
    model: localStorage.getItem('note-y-ai-model') ?? 'llama3.2',
    transcriptionEndpoint: localStorage.getItem('note-y-transcription-endpoint') ?? 'http://localhost:8000/transcribe',
    transcriptionModel: localStorage.getItem('note-y-transcription-model') ?? 'whisper-1',
    language: localStorage.getItem('note-y-transcription-language') ?? 'auto',
  }))
  const [apiStatus, setApiStatus] = useState('')
  const [settings, setSettings] = useState<AppSettings>(() => ({
    fileFormat: (localStorage.getItem('note-y-file-format') as AppSettings['fileFormat']) ?? 'md',
    theme: (localStorage.getItem('note-y-theme') as AppSettings['theme']) ?? 'midnight',
    folderLabel: localStorage.getItem('note-y-folder-label') ?? 'Browser storage (choose a folder to mirror files)',
  }))
  const directory = useRef<DirectoryHandle | null>(null)

  useEffect(() => localStorage.setItem('note-y-notes', JSON.stringify(notes)), [notes])
  useEffect(() => localStorage.setItem('note-y-folders', JSON.stringify(folders)), [folders])
  useEffect(() => {
    localStorage.setItem('note-y-file-format', settings.fileFormat)
    localStorage.setItem('note-y-theme', settings.theme)
    localStorage.setItem('note-y-folder-label', settings.folderLabel)
    document.documentElement.dataset.theme = settings.theme
  }, [settings])
  useEffect(() => {
    if (!directory.current) return
    notes.forEach(async (note) => {
      const handle = await directory.current?.getFileHandle(`${fileSafe(note.title)}.${settings.fileFormat}`, { create: true })
      if (!handle) return
      const writable = await handle.createWritable()
      await writable.write(noteFileContents(note, settings.fileFormat))
      await writable.close()
    })
  }, [notes, settings.fileFormat])
  const visibleNotes = useMemo(() => notes.filter((note) => {
    const matchesView = activeView === 'All notes' || (activeView === 'Recent' ? true : activeView === 'Starred' ? note.starred : activeView === 'Archive' ? note.archived : note.folder === activeView)
    const matchesSearch = `${note.title} ${note.content}`.toLowerCase().includes(search.toLowerCase())
    return matchesView && matchesSearch && (activeView === 'Archive' || !note.archived)
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [activeView, notes, search])
  const selected = visibleNotes.find((note) => note.id === selectedId) ?? visibleNotes[0]
  const createNote = () => {
    const note = createNoteData(folders[0] ?? 'Personal')
    setNotes((current) => [note, ...current])
    setSelectedId(note.id)
    setActiveView('All notes')
    setShowComposer(true)
  }

  const updateNote = (changes: Partial<Note>) => {
    if (!selected) return
    if (changes.content !== undefined && isBlankHtml(changes.content)) {
      setNotes((current) => current.filter((note) => note.id !== selected.id))
      setSelectedId('')
      setShowComposer(false)
      return
    }
    setNotes((current) => current.map((note) => note.id === selected.id ? { ...note, ...changes, updatedAt: nowIso() } : note))
  }

  const addFolder = () => {
    const name = newFolder.trim()
    if (name && !folders.includes(name)) setFolders((current) => [...current, name])
    setNewFolder('')
    setShowFolderInput(false)
  }

  const exportNote = () => {
    if (!selected) return
    const blob = new Blob([noteFileContents(selected, settings.fileFormat)], { type: 'text/plain' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${fileSafe(selected.title)}.${settings.fileFormat}`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const chooseDataFolder = async () => {
    if (!window.showDirectoryPicker) {
      setApiStatus('Folder access is available in the desktop app or a Chromium browser.')
      return
    }
    try {
      directory.current = await window.showDirectoryPicker()
      setSettings((current) => ({ ...current, folderLabel: directory.current?.name ?? current.folderLabel }))
      setApiStatus('File mirror connected. Notes save to this folder automatically.')
    } catch { setApiStatus('Folder selection cancelled.') }
  }
  const saveAudioFile = async (note: Note, audio: Blob) => {
    const handle = await directory.current?.getFileHandle(`${fileSafe(note.title)}.audio.webm`, { create: true })
    if (!handle) return
    const writable = await handle.createWritable()
    await writable.write(audio)
    await writable.close()
  }

  const navItems = [['All notes', Library], ['Recent', Clock3], ['Starred', Star], ['Archive', Archive]] as const

  return <div className={`app-shell view-${fileSafe(activeView)}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Sparkles size={16} /></div><span>ReallyNoted</span></div>
      <button className="new-note" onClick={createNote}><Plus size={17} /> New document <span>⌘ N</span></button>
      <nav className="primary-nav">{navItems.map(([label, Icon]) => <button key={label} className={activeView === label ? 'active' : ''} onClick={() => setActiveView(label)}><Icon size={17} /> {label}</button>)}</nav>
      <div className="sidebar-label"><span>FOLDERS</span><button aria-label="Collapse folders"><PanelLeftClose size={15} /></button></div>
      <div className="folder-list">{folders.map((folder, index) => <button key={folder} onClick={() => setActiveView(folder)} className={activeView === folder ? 'active' : ''}><span className={`folder-dot dot-${index % 3}`}><Folder size={14} /></span>{folder}<span className="folder-count">{notes.filter((note) => note.folder === folder && !note.archived).length}</span></button>)}</div>
      {showFolderInput ? <div className="folder-input"><input autoFocus value={newFolder} onChange={(event) => setNewFolder(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && addFolder()} placeholder="Folder name" /><button onClick={addFolder}><Plus size={14} /></button></div> : <button className="add-folder" onClick={() => setShowFolderInput(true)}><FolderPlus size={16} /> Add folder</button>}
      <div className="sidebar-bottom"><button onClick={() => setShowSettings(true)}><Settings2 size={17} /> Settings</button><div className="profile"><div className="avatar">ME</div><div><strong>My workspace</strong><small>Local account</small></div><MoreHorizontal size={17} /></div></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div className="breadcrumbs"><span>{activeView}</span><ChevronDown size={14} /><span className="muted">Local workspace</span></div><div className="top-actions"><div className="search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search notes..." /><kbd>⌘ K</kbd></div><button className="icon-button" aria-label="Notifications"><Bell size={18} /></button><div className="mini-avatar">ME</div></div></header>
      <div className="content-wrap">
        <section className="welcome-row"><div><p className="eyebrow">{todayLabel}</p><h1>Your knowledge, your workspace <span>✦</span></h1><p className="subheading">{visibleNotes.length ? 'Pick up where you left off.' : 'Create a document to get started.'}</p></div><button className="record-button" onClick={createNote}><FileText size={17} /> New document</button></section>
        <section className="stats-row"><Stat icon={<FileText size={18} />} tone="purple" value={String(notes.filter((note) => !note.archived).length)} label="Your documents" /><Stat icon={<Headphones size={18} />} tone="green" value="Local" label="Audio transcription" /><Stat icon={<BrainCircuit size={18} />} tone="amber" value="Ready" label="AI summaries" /></section>
        <section className="workspace-grid">
          <div className="note-panel">
            {visibleNotes.length ? <><div className="panel-heading"><div><div className="title-line"><input className="title-input" value={selected?.title ?? ''} onChange={(event) => updateNote({ title: event.target.value })} /><span className="status-pill"><span /> Saved locally</span></div><p>{selected?.folder} · {selected ? new Date(selected.updatedAt).toLocaleString() : ''}</p></div><div className="heading-actions"><button className="more-button" onClick={() => selected && updateNote({ starred: !selected.starred })} aria-label="Star document"><Star size={19} fill={selected?.starred ? 'currentColor' : 'none'} /></button><button className="more-button" onClick={exportNote} aria-label="Export document"><Download size={18} /></button></div></div><Editor note={selected} updateNote={updateNote} provider={provider} apiStatus={apiStatus} setApiStatus={setApiStatus} onSaveAudio={saveAudioFile} /></> : <EmptyState onCreate={createNote} />}
          </div>
          <NotesList notes={visibleNotes} selectedId={selected?.id ?? ''} onSelect={setSelectedId} onArchive={(id) => setNotes((current) => current.map((note) => note.id === id ? { ...note, archived: !note.archived } : note))} />
        </section>
      </div>
    </main>
    {showSettings && <Settings provider={provider} setProvider={setProvider} settings={settings} setSettings={setSettings} folderLabel={settings.folderLabel} onChooseFolder={chooseDataFolder} onClose={() => setShowSettings(false)} />}
    {showComposer && selected && <QuickComposer note={selected} updateNote={updateNote} onClose={() => setShowComposer(false)} />}
  </div>
}

function Stat({ icon, tone, value, label }: { icon: React.ReactNode; tone: string; value: string; label: string }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div><strong>{value}</strong><span>{label}</span></div><small>Available</small></div>
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return <div className="empty-state"><FileText size={32} /><h2>No documents here</h2><p>Your workspace only shows your own notes. Create one to begin.</p><button className="record-button" onClick={onCreate}><Plus size={16} /> New document</button></div>
}

function RichTextToolbar({ onCommand }: { onCommand: (command: string, value?: string) => void }) {
  return <div className="rich-toolbar" aria-label="Text formatting"><button onMouseDown={(event) => event.preventDefault()} onClick={() => onCommand('bold')} aria-label="Bold"><Bold size={14} /></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => onCommand('italic')} aria-label="Italic"><Italic size={14} /></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => onCommand('underline')} aria-label="Underline"><Underline size={14} /></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => onCommand('hiliteColor', '#624384')} aria-label="Highlight"><Highlighter size={14} /></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => onCommand('formatBlock', '<h2>')} aria-label="Heading"><Heading2 size={14} /></button><button onMouseDown={(event) => event.preventDefault()} onClick={() => onCommand('insertUnorderedList')} aria-label="Bullet list"><List size={14} /></button></div>
}

function QuickComposer({ note, updateNote, onClose }: { note: Note; updateNote: (changes: Partial<Note>) => void; onClose: () => void }) {
  const editorRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (editorRef.current && editorRef.current.innerHTML !== note.content) editorRef.current.innerHTML = note.content }, [note.content])
  const exec = (command: string, value?: string) => { document.execCommand(command, false, value); editorRef.current?.focus(); if (editorRef.current) updateNote({ content: editorRef.current.innerHTML }) }
  return <div className="modal-backdrop quick-compose-backdrop" onClick={onClose}><section className="quick-composer" onClick={(event) => event.stopPropagation()}><div className="quick-compose-top"><span>ReallyNoted quick note</span><button onClick={onClose} aria-label="Close quick note"><X size={17} /></button></div><input className="quick-title" value={note.title} onChange={(event) => updateNote({ title: event.target.value })} /><RichTextToolbar onCommand={exec} /><div ref={editorRef} className="quick-editor" data-placeholder="Start writing here..." contentEditable suppressContentEditableWarning onInput={(event) => updateNote({ content: event.currentTarget.innerHTML })} /><div className="quick-compose-bottom"><span>Saved locally</span><button className="record-button" onClick={onClose}><Check size={15} /> Done</button></div></section></div>
}

function Editor({ note, updateNote, provider, apiStatus, setApiStatus, onSaveAudio }: { note: Note | undefined; updateNote: (changes: Partial<Note>) => void; provider: ProviderSettings; apiStatus: string; setApiStatus: (value: string) => void; onSaveAudio: (note: Note, audio: Blob) => Promise<void> }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [tab, setTab] = useState<'Document' | 'Summary'>('Document')
  const [isRecording, setIsRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [speaker, setSpeaker] = useState('Speaker 1')
  const [summary, setSummary] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [pendingTranscript, setPendingTranscript] = useState('')
  const recorder = useRef<MediaRecorder | null>(null)
  const recordingChunks = useRef<Blob[]>([])
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => { if (editorRef.current && note && editorRef.current.innerHTML !== note.content) editorRef.current.innerHTML = note.content }, [note])
  useEffect(() => () => window.clearInterval(timer.current), [])
  if (!note) return null
  const formatTime = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
  const exec = (command: string, value?: string) => { document.execCommand(command, false, value); editorRef.current?.focus(); if (editorRef.current) updateNote({ content: editorRef.current.innerHTML }) }
  const toggleRecording = async () => {
    if (isRecording) { recorder.current?.stop(); recorder.current?.stream.getTracks().forEach((track) => track.stop()); setIsRecording(false); window.clearInterval(timer.current); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      recorder.current = new MediaRecorder(stream)
      recordingChunks.current = []
      recorder.current.ondataavailable = (event) => { if (event.data.size) recordingChunks.current.push(event.data) }
      recorder.current.onstop = async () => {
        const audio = new Blob(recordingChunks.current, { type: recorder.current?.mimeType || 'audio/webm' })
        try {
          await saveRecording(note.id, audio)
          await onSaveAudio(note, audio)
          setApiStatus('Audio saved on this device. Transcribing...')
          const form = new FormData()
          form.append('file', audio, `${note.id}.webm`)
          form.append('model', provider.transcriptionModel)
          if (provider.language !== 'auto') form.append('language', provider.language)
          const response = await fetch(provider.transcriptionEndpoint, { method: 'POST', body: form })
          if (!response.ok) throw new Error(`Transcription endpoint returned ${response.status}`)
          const data = await response.json() as { text?: string; segments?: { text?: string; start?: number; speaker?: string }[] }
          const transcript = data.segments?.length
            ? data.segments.map((segment) => `<p><strong>${segment.speaker || speaker}</strong> <span class="timestamp">[${formatTime(Math.round(segment.start || 0))}]</span> ${segment.text || ''}</p>`).join('')
            : `<p><strong>${speaker}</strong> ${data.text || ''}</p>`
          if (data.text || data.segments?.length) { setPendingTranscript(transcript); setApiStatus('Transcription ready. Insert it below your note when you are ready.') }
        } catch {
          setApiStatus('Audio saved locally, but transcription failed. Check the transcription endpoint in Settings.')
        }
      }
      recorder.current.start()
      setSeconds(0); setIsRecording(true)
      timer.current = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    } catch { setApiStatus('Microphone permission was denied. Allow access and try again.') }
  }
  const insertTranscript = () => {
    const text = pendingTranscript || `<p><strong>${speaker}</strong> <span class="timestamp">[${formatTime(seconds)}]</span> Add your transcribed text here.</p>`
    if (editorRef.current) { editorRef.current.innerHTML += text; updateNote({ content: editorRef.current.innerHTML }); setPendingTranscript(''); setApiStatus('Transcript inserted below your note.') }
  }
  const summarize = async () => {
    const text = editorRef.current?.innerText ?? ''
    if (!text.trim()) return setApiStatus('Add some document text before generating a summary.')
    setApiStatus('Generating summary...')
    try {
      const response = await fetch(provider.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: `Summarize this note in three concise bullet points:\n\n${text}` }], temperature: 0.2 }) })
      if (!response.ok) throw new Error(`AI endpoint returned ${response.status}`)
      const data = await response.json() as { choices?: { message?: { content?: string } }[] }
      setSummary(data.choices?.[0]?.message?.content ?? 'The AI endpoint returned no summary.')
      setApiStatus('Summary generated by your local model.')
    } catch { setSummary(`• ${text.slice(0, 180)}${text.length > 180 ? '...' : ''}\n• Review the highlighted ideas and add action items.\n• Connect a local OpenAI-compatible model in Settings for richer summaries.`); setApiStatus('Local fallback summary generated. Check Settings if your model is not running.') }
    setTab('Summary')
  }
  const sendChat = () => { if (!chatInput.trim()) return; setMessages((current) => [...current, { role: 'user', text: chatInput.trim() }, { role: 'ai', text: 'Ask your configured local model for a response by generating a summary, or connect the endpoint in Settings.' }]); setChatInput('') }

  return <><div className="editor-tools"><RichTextToolbar onCommand={exec} /><div className="tool-group"><label className="speaker-select"><Users size={14} /><select value={speaker} onChange={(event) => setSpeaker(event.target.value)}><option>Speaker 1</option><option>Speaker 2</option><option>Speaker 3</option></select></label><button className={isRecording ? 'recording' : ''} onClick={toggleRecording}><Mic size={15} /> {isRecording ? formatTime(seconds) : 'Record audio'}</button><button onClick={insertTranscript}><Headphones size={15} /> Insert transcript</button></div></div><div className="note-tabs"><button className={tab === 'Document' ? 'active' : ''} onClick={() => setTab('Document')}>Document</button><button className={tab === 'Summary' ? 'active' : ''} onClick={() => setTab('Summary')}><Sparkles size={13} /> AI summary</button><button onClick={summarize} className="generate-button"><BrainCircuit size={13} /> Generate</button></div>{tab === 'Document' ? <div ref={editorRef} className="rich-editor" data-placeholder="Start writing here..." contentEditable suppressContentEditableWarning onInput={(event) => updateNote({ content: event.currentTarget.innerHTML })} /> : <div className="summary-view"><div className="summary-banner"><Sparkles size={18} /><span><strong>AI summary</strong> {apiStatus || 'Generated on demand from this document'}</span></div><pre className="summary-text">{summary || 'Click Generate to summarize this document with your local model.'}</pre></div>}{pendingTranscript && <button className="transcript-ready" onClick={insertTranscript}><Headphones size={15} /> Insert the new transcript below this note</button>}<div className="editor-footer"><span>{apiStatus || 'Changes save automatically on this device.'}</span><div className="chat-inline"><input value={chatInput} onChange={(event) => setChatInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendChat()} placeholder="Ask about this document..." /><button onClick={sendChat}><Send size={15} /></button></div></div>{messages.length > 0 && <div className="messages">{messages.map((message, index) => <p key={`${message.role}-${index}`} className={message.role}>{message.text}</p>)}</div>}</>
}

function NotesList({ notes, selectedId, onSelect, onArchive }: { notes: Note[]; selectedId: string; onSelect: (id: string) => void; onArchive: (id: string) => void }) {
  return <aside className="chat-panel notes-list"><div className="chat-heading"><div><h3>Your documents</h3><p>{notes.length} saved locally</p></div><BookOpen size={17} /></div>{notes.map((note) => <button key={note.id} className={`note-list-item ${selectedId === note.id ? 'selected' : ''}`} onClick={() => onSelect(note.id)}><div><strong>{note.title || 'Untitled document'}</strong><small>{note.folder} · {new Date(note.updatedAt).toLocaleDateString()}</small></div><span><button onClick={(event) => { event.stopPropagation(); onArchive(note.id) }} aria-label="Archive document"><Archive size={14} /></button></span></button>)}</aside>
}

function Settings({ provider, setProvider, settings, setSettings, folderLabel, onChooseFolder, onClose }: { provider: ProviderSettings; setProvider: (value: ProviderSettings) => void; settings: AppSettings; setSettings: (value: AppSettings) => void; folderLabel: string; onChooseFolder: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState(provider)
  const [appDraft, setAppDraft] = useState(settings)
  const [saved, setSaved] = useState(false)
  const save = () => {
    Object.entries(draft).forEach(([key, value]) => localStorage.setItem(`note-y-${key === 'endpoint' ? 'ai-endpoint' : key === 'model' ? 'ai-model' : key === 'transcriptionEndpoint' ? 'transcription-endpoint' : key === 'transcriptionModel' ? 'transcription-model' : 'transcription-language'}`, value))
    localStorage.setItem('note-y-file-format', appDraft.fileFormat)
    localStorage.setItem('note-y-theme', appDraft.theme)
    setProvider(draft)
    setSettings(appDraft)
    setSaved(true)
  }
  return <div className="modal-backdrop" onClick={onClose}><div className="settings-modal" onClick={(event) => event.stopPropagation()}><div className="modal-heading"><div><h2>Settings</h2><p>Everything stays on this device unless you choose a remote provider.</p></div><button onClick={onClose} aria-label="Close settings"><X size={18} /></button></div><h3>Files and appearance</h3><label>Saved file format<select value={appDraft.fileFormat} onChange={(event) => { setSaved(false); setAppDraft({ ...appDraft, fileFormat: event.target.value as AppSettings['fileFormat'] }) }}><option value="md">Markdown (.md)</option><option value="txt">Plain text (.txt)</option></select></label><div className="folder-setting"><span><strong>Notes folder</strong><small>{folderLabel}</small></span><button onClick={onChooseFolder}><Folder size={15} /> Choose folder</button></div><label>Theme<select value={appDraft.theme} onChange={(event) => { setSaved(false); setAppDraft({ ...appDraft, theme: event.target.value as AppSettings['theme'] }) }}><option value="midnight">Midnight</option><option value="paper">Paper</option><option value="moss">Moss</option></select></label><h3>Summaries and chat</h3><label>OpenAI-compatible endpoint<input value={draft.endpoint} onChange={(event) => { setSaved(false); setDraft({ ...draft, endpoint: event.target.value }) }} placeholder="http://localhost:11434/v1/chat/completions" /></label><label>LLM model<input value={draft.model} onChange={(event) => { setSaved(false); setDraft({ ...draft, model: event.target.value }) }} placeholder="llama3.2" /></label><h3>Audio transcription</h3><label>Whisper-compatible endpoint<input value={draft.transcriptionEndpoint} onChange={(event) => { setSaved(false); setDraft({ ...draft, transcriptionEndpoint: event.target.value }) }} placeholder="http://localhost:8000/transcribe" /></label><label>Transcription model<input value={draft.transcriptionModel} onChange={(event) => { setSaved(false); setDraft({ ...draft, transcriptionModel: event.target.value }) }} placeholder="whisper-1" /></label><label>Language (or auto)<input value={draft.language} onChange={(event) => { setSaved(false); setDraft({ ...draft, language: event.target.value }) }} placeholder="auto" /></label><p className="settings-help">Choose a folder to mirror notes as files. Recordings remain next to their note in the desktop file workflow and in local app storage otherwise.</p><button className="record-button settings-save" onClick={save}><Check size={16} /> {saved ? 'Saved' : 'Save settings'}</button></div></div>
}

export default App
