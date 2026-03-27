import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Modal from './Modal'

const MUSICAL_KEYS = [
  'C', 'Cm', 'C#', 'C#m', 'D', 'Dm', 'D#', 'D#m', 'E', 'Em',
  'F', 'Fm', 'F#', 'F#m', 'G', 'Gm', 'G#', 'G#m', 'A', 'Am',
  'A#', 'A#m', 'B', 'Bm'
]

const SECTIONS = [
  { name: 'General', color: 'bg-blue-900/20 border-blue-500/50 text-blue-400' },
  { name: 'Intro', color: 'bg-purple-900/20 border-purple-500/50 text-purple-400' },
  { name: 'Verso', color: 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400' },
  { name: 'Coro', color: 'bg-amber-900/20 border-amber-500/50 text-amber-400' },
  { name: 'Corte', color: 'bg-red-900/20 border-red-500/50 text-red-400' },
  { name: 'Final', color: 'bg-pink-900/20 border-pink-500/50 text-pink-400' }
]

export default function SongDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [song, setSong] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState('lyrics') 
  const [imageUrl, setImageUrl] = useState(null)

  const [isEditing, setIsEditing] = useState(false)
  
  const [editForm, setEditForm] = useState({ title: '', key_signature: '', lyrics: '', authors: [], vocalists: [] })
  
  // ESTADOS PARA SUGERENCIAS DE AUTORES
  const [authorInput, setAuthorInput] = useState('')
  const [existingAuthors, setExistingAuthors] = useState([])
  const [availableVocalists, setAvailableVocalists] = useState([])

  const [newCifraFile, setNewCifraFile] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const [newAnnotation, setNewAnnotation] = useState({ section: 'Corte', content: '' })
  const textareaRef = useRef(null)

  useEffect(() => {
    fetchSong()
  }, [id])

  const fetchSong = async () => {
    const { data } = await supabase
      .from('songs')
      .select('*, song_attachments(id, storage_path, file_name)')
      .eq('id', id)
      .single()

    if (data) {
      setSong(data)
      setEditForm({
        title: data.title,
        key_signature: data.key_signature || '',
        lyrics: data.lyrics || '',
        authors: data.authors || [],
        vocalists: data.vocalists || []
      })

      // 1. OBTENEMOS VOCALISTAS
      const { data: vData } = await supabase.from('band_vocalists').select('name').eq('band_id', data.band_id)
      if (vData) setAvailableVocalists(vData.map(v => v.name))

      // 2. OBTENEMOS TODOS LOS AUTORES PARA LAS SUGERENCIAS
      const { data: dictData } = await supabase.from('band_authors').select('name').eq('band_id', data.band_id)
      const catalogAuthors = dictData ? dictData.map(a => a.name) : []

      const { data: songsData } = await supabase.from('songs').select('authors').eq('band_id', data.band_id)
      const usedAuthors = songsData ? songsData.flatMap(s => s.authors || []) : []

      const uniqueCombinedAuthors = [...new Set([...catalogAuthors, ...usedAuthors])]
      uniqueCombinedAuthors.sort((a, b) => a.localeCompare(b))
      setExistingAuthors(uniqueCombinedAuthors)

      if (data.song_attachments && data.song_attachments.length > 0) {
        const path = data.song_attachments[0].storage_path
        const { data: publicUrlData } = supabase.storage.from('chords_attachments').getPublicUrl(path)
        setImageUrl(publicUrlData.publicUrl)
      } else {
        setImageUrl(null)
      }
    }
    setLoading(false)
  }

  const addAuthor = (name) => {
    const clean = name.trim()
    if (clean && !editForm.authors.includes(clean)) {
      setEditForm({ ...editForm, authors: [...editForm.authors, clean] })
    }
    setAuthorInput('')
  }

  const removeAuthor = (name) => {
    setEditForm({ ...editForm, authors: editForm.authors.filter(a => a !== name) })
  }

  // Filtrado de sugerencias
  const filteredAuthorSuggestions = existingAuthors.filter(
    a => a.toLowerCase().includes(authorInput.toLowerCase()) && !editForm.authors.includes(a)
  )

  const toggleVocalist = (name) => {
    setEditForm(prev => {
      const isSelected = prev.vocalists.includes(name)
      return {
        ...prev,
        vocalists: isSelected ? prev.vocalists.filter(v => v !== name) : [...prev.vocalists, name]
      }
    })
  }

  const handleInsertAnnotation = () => {
    if (!newAnnotation.content.trim()) return;
    const tagToInsert = `\n[${newAnnotation.section}: ${newAnnotation.content}]\n`;
    const textarea = textareaRef.current;
    
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const currentLyrics = editForm.lyrics;
      const newLyrics = currentLyrics.substring(0, start) + tagToInsert + currentLyrics.substring(end);
      
      setEditForm({...editForm, lyrics: newLyrics});
      setNewAnnotation({ ...newAnnotation, content: '' });
      setTimeout(() => textarea.focus(), 10);
    }
  }

  const renderLyrics = (text) => {
    if (!text) return <p className="text-neutral-700 italic text-lg">Aún no has agregado la letra. ¡Dale a Editar!</p>;
    const regex = /\[(General|Intro|Verso|Coro|Corte|Final):\s*(.*?)\]/gi;
    const parts = text.split(regex);
    
    const result = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 3 === 0) {
         let textPart = parts[i];
         if (i > 0 && textPart.startsWith('\n')) textPart = textPart.substring(1);
         if (textPart) result.push(<span key={i}>{textPart}</span>);
      } else {
         const section = parts[i];
         const content = parts[i+1];
         const secColor = SECTIONS.find(s => s.name.toLowerCase() === section.toLowerCase())?.color || 'bg-neutral-800 border-neutral-600 text-gray-300';
         
         result.push(
           <div key={`tag-${i}`} className={`my-1 p-2.5 rounded-lg border-l-4 ${secColor} shadow-md block w-full max-w-2xl bg-neutral-950/90`}>
             <span className="font-black text-[10px] uppercase tracking-widest block opacity-80 leading-none">🚨 {section}</span>
             <span className="text-lg md:text-xl font-bold font-sans leading-tight block mt-1">{content}</span>
           </div>
         );
         i++; 
      }
    }
    return result;
  }

  const confirmDelete = async () => {
    setIsDeleting(true)
    try {
      await supabase.from('song_attachments').delete().eq('song_id', id);
      await supabase.from('setlist_items').delete().eq('song_id', id);
      await supabase.from('mix_songs').delete().eq('song_id', id);
      await supabase.from('songs').delete().eq('id', id);
      navigate('/'); 
    } catch (err) {
      console.error(err);
      alert("Hubo un error al eliminar. Revisa la consola.");
      setIsDeleting(false)
      setIsDeleteModalOpen(false)
    }
  }

  const handleSaveEdit = async () => {
    setIsSaving(true)
    try {
      // CAPTURAR TEXTO PENDIENTE EN EL INPUT DE AUTORES
      const finalAuthors = [...editForm.authors]
      if (authorInput.trim() && !finalAuthors.includes(authorInput.trim())) {
        finalAuthors.push(authorInput.trim())
      }

      await supabase.from('songs').update({
        title: editForm.title,
        key_signature: editForm.key_signature,
        lyrics: editForm.lyrics,
        authors: finalAuthors, // Guardamos los autores finales
        vocalists: editForm.vocalists
      }).eq('id', id)

      if (newCifraFile) {
        const fileExt = newCifraFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${song.band_id}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('chords_attachments').upload(filePath, newCifraFile);
        if (uploadError) throw uploadError;

        if (song.song_attachments && song.song_attachments.length > 0) {
          await supabase.from('song_attachments').update({
            file_name: newCifraFile.name,
            file_type: newCifraFile.type,
            storage_path: filePath
          }).eq('id', song.song_attachments[0].id)
        } else {
          await supabase.from('song_attachments').insert([{
            song_id: id, file_name: newCifraFile.name, file_type: newCifraFile.type, storage_path: filePath
          }])
        }
      }

      setIsEditing(false)
      setNewCifraFile(null)
      setAuthorInput('') // Limpiamos el input
      fetchSong() 
    } catch (error) {
      console.error(error)
      alert("Error al actualizar la canción")
    } finally {
      setIsSaving(false)
    }
  }

  if (loading) return <div className="p-10 text-center text-emerald-500 animate-pulse text-2xl font-black">Cargando canción...</div>
  if (!song) return <div className="p-10 text-center text-white text-xl">Canción no encontrada.</div>

  return (
    <div className="max-w-4xl mx-auto pb-20">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center border-b border-neutral-800 pb-6 gap-4">
        <div>
          <Link to="/" className="text-emerald-500 hover:text-emerald-400 text-sm font-bold mb-2 inline-block">← Volver al Catálogo</Link>
          
          {!isEditing && (
            <div>
              <h1 className="text-4xl font-black text-white uppercase tracking-tighter mt-2">{song.title}</h1>
              <p className="text-gray-400 uppercase text-xs tracking-widest mt-1">
                {song.authors?.length > 0 ? song.authors.join(', ') : 'Autor desconocido'}
              </p>
              
              {song.vocalists && song.vocalists.length > 0 && (
                <div className="flex gap-2 mt-3">
                  {song.vocalists.map(v => (
                    <span key={v} className="text-xs bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-900/50">
                      🎤 {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {!isEditing ? (
            <>
              <button onClick={() => setIsEditing(true)} className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg text-sm font-bold border border-neutral-700 transition-all">
                ✏️ EDITAR
              </button>
              <button onClick={() => setIsDeleteModalOpen(true)} className="bg-red-950/40 hover:bg-red-900/60 text-red-500 px-4 py-2 rounded-lg text-sm font-bold border border-red-900/50 transition-all">
                🗑️ ELIMINAR
              </button>
            </>
          ) : (
            <button onClick={() => setIsEditing(false)} className="bg-neutral-800 text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm font-bold border border-neutral-700 transition-all">
              CANCELAR
            </button>
          )}
        </div>
      </header>

      {/* --- MODO EDICIÓN --- */}
      {isEditing ? (
        <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 space-y-8">
          <div className="grid md:grid-cols-2 gap-x-4 gap-y-6">
            <div>
              <label className="text-xs text-gray-400 font-bold uppercase block mb-1">Título</label>
              <input type="text" value={editForm.title} onChange={e => setEditForm({...editForm, title: e.target.value})} className="w-full bg-neutral-900 border border-neutral-600 rounded p-3 text-white focus:border-emerald-500 outline-none"/>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-bold uppercase block mb-1">Tonalidad</label>
              <select value={editForm.key_signature} onChange={e => setEditForm({...editForm, key_signature: e.target.value})} className="w-full bg-neutral-900 border border-neutral-600 rounded p-3 text-white focus:border-emerald-500 outline-none font-mono">
                <option value="">Sin Tonalidad</option>
                {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>

            {/* SECCIÓN AUTORES CON MENÚ DESPLEGABLE */}
            <div className="md:col-span-2 relative">
              <label className="text-xs text-gray-400 font-bold uppercase block mb-1">Autores / Intérpretes originales</label>
              <div className="w-full bg-neutral-900 border border-neutral-600 rounded p-2 focus-within:border-emerald-500 flex flex-wrap gap-2 items-center">
                {editForm.authors.map(author => (
                  <span key={author} className="bg-emerald-900/50 text-emerald-400 text-sm px-2 py-1 rounded flex items-center gap-1 border border-emerald-500/30">
                    {author}
                    <button type="button" onClick={() => removeAuthor(author)} className="hover:text-white ml-1">×</button>
                  </span>
                ))}
                <input 
                  type="text" 
                  value={authorInput}
                  onChange={(e) => setAuthorInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault() 
                      addAuthor(authorInput)
                    }
                  }}
                  className="bg-transparent text-white outline-none flex-1 min-w-[120px] text-sm"
                  placeholder="Agregar autor..."
                />
              </div>

              {authorInput.trim() && filteredAuthorSuggestions.length > 0 && (
                <div className="absolute top-full left-0 w-full mt-1 bg-neutral-900 border border-neutral-600 rounded shadow-xl z-20 max-h-48 overflow-y-auto">
                  {filteredAuthorSuggestions.map(suggestion => (
                    <div 
                      key={suggestion}
                      className="p-2 text-gray-300 hover:bg-emerald-800 hover:text-white cursor-pointer text-sm border-b border-neutral-800"
                      onClick={() => addAuthor(suggestion)}
                    >
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="md:col-span-2 border-t border-neutral-700 pt-6 mt-2 flex flex-col md:flex-row justify-between items-start md:items-start gap-6">
              {availableVocalists.length > 0 && (
                <div className="flex-1">
                  <label className="text-xs text-gray-400 font-bold uppercase block mb-2">Vocalista en la Banda (Opcional)</label>
                  <div className="flex flex-wrap gap-2">
                    {availableVocalists.map((vocalist) => {
                      const isSelected = editForm.vocalists.includes(vocalist)
                      return (
                        <button
                          type="button"
                          key={vocalist}
                          onClick={() => toggleVocalist(vocalist)}
                          className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                            isSelected 
                              ? 'bg-emerald-900/50 border-emerald-500 text-emerald-400' 
                              : 'bg-neutral-900 border-neutral-700 text-gray-400 hover:border-neutral-500'
                          }`}
                        >
                          {vocalist}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="w-full md:w-auto flex flex-col items-start md:items-end shrink-0">
                <div className="flex bg-neutral-950 p-1.5 rounded-lg border border-neutral-700 gap-1 w-full md:w-auto shadow-inner">
                  <select 
                    value={newAnnotation.section}
                    onChange={e => setNewAnnotation({...newAnnotation, section: e.target.value})}
                    className="bg-neutral-900 border-none rounded p-1.5 text-emerald-400 font-bold text-xs outline-none"
                  >
                    {SECTIONS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                  <input 
                    type="text" 
                    placeholder="Ej: Parada en seco..."
                    value={newAnnotation.content}
                    onChange={e => setNewAnnotation({...newAnnotation, content: e.target.value})}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInsertAnnotation(); } }}
                    className="bg-transparent border-none text-white text-xs outline-none px-2 w-full md:w-36 placeholder-gray-600"
                  />
                  <button 
                    type="button"
                    onClick={handleInsertAnnotation}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-1 px-4 rounded text-xs whitespace-nowrap"
                  >
                    + Insertar en Letra
                  </button>
                </div>
                <p className="text-[10px] text-gray-500 mt-2 italic text-left md:text-right">
                  Haz clic en el cuadro de texto donde quieres la indicación y presiona "+ Insertar en Letra".
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 font-bold uppercase block mb-2">Letra de la Canción</label>
            <textarea ref={textareaRef} value={editForm.lyrics} onChange={e => setEditForm({...editForm, lyrics: e.target.value})} rows="15" className="w-full bg-neutral-900 border border-neutral-600 rounded p-4 text-white focus:border-emerald-500 outline-none font-serif text-lg leading-relaxed whitespace-pre-wrap" placeholder="Pega la letra aquí..."/>
          </div>

          <div className="border border-dashed border-amber-900/50 bg-neutral-900 p-4 rounded-lg text-center">
            <label className="text-xs text-amber-500 font-bold uppercase block mb-2 cursor-pointer hover:text-amber-400">
              {newCifraFile ? '📄 Nuevo archivo listo para subir' : '📎 Subir/Reemplazar Partitura (PDF, JPG, PNG)'}
              <input type="file" accept=".pdf, image/jpeg, image/png" className="hidden" onChange={(e) => setNewCifraFile(e.target.files[0])}/>
            </label>
            {newCifraFile && <p className="text-xs text-gray-400 mt-2">{newCifraFile.name}</p>}
            {!newCifraFile && song.song_attachments?.length > 0 && <p className="text-xs text-gray-500 mt-2 italic">Ya existe un archivo adjunto. Subir uno nuevo lo reemplazará.</p>}
          </div>

          <button onClick={handleSaveEdit} disabled={isSaving} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg transition-all disabled:opacity-50">
            {isSaving ? 'Guardando...' : '💾 GUARDAR CAMBIOS'}
          </button>
        </div>
      ) : (
        /* --- MODO VISTA --- */
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-mono font-black text-emerald-500 bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-500/20">
              {song.key_signature || '-'}
            </span>

            <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-700 w-full md:w-auto">
              <button onClick={() => setViewMode('lyrics')} className={`flex-1 px-6 py-2 rounded-lg text-sm font-black tracking-widest uppercase transition-all ${viewMode === 'lyrics' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>🎤 Letra</button>
              <button onClick={() => setViewMode('chords')} className={`flex-1 px-6 py-2 rounded-lg text-sm font-black tracking-widest uppercase transition-all ${viewMode === 'chords' ? 'bg-amber-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>🎸 Cifra</button>
            </div>
          </div>

          <div className="pt-2">
            {viewMode === 'lyrics' ? (
              <div className="text-2xl md:text-3xl text-gray-200 leading-relaxed font-serif whitespace-pre-wrap pl-2 md:pl-10 mt-6">
                {renderLyrics(song.lyrics)}
              </div>
            ) : (
              <div className="pl-2 md:pl-10 mt-6">
                {imageUrl ? (
                  <img src={imageUrl} alt={`Cifra de ${song.title}`} className="max-w-full rounded-xl border border-neutral-800 shadow-2xl bg-white" loading="lazy"/>
                ) : (
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-10 text-center max-w-lg">
                    <span className="text-4xl block mb-4">📭</span>
                    <p className="text-neutral-500 text-lg font-bold uppercase tracking-widest">Sin partitura adjunta</p>
                    <button onClick={() => setIsEditing(true)} className="text-emerald-500 font-bold text-sm hover:text-emerald-400 border border-emerald-500/30 px-4 py-2 rounded-lg mt-4">Adjuntar ahora</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal isOpen={isDeleteModalOpen} onClose={() => !isDeleting && setIsDeleteModalOpen(false)} onConfirm={confirmDelete} title="⚠️ Eliminar Canción" message={`¿Estás completamente seguro de eliminar "${song?.title}"? Esta acción no se puede deshacer y borrará la canción de tus mixes y setlists.`} confirmText={isDeleting ? "Eliminando..." : "Sí, eliminar definitivamente"} type="danger" />
    </div>
  )
}