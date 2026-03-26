import { Routes, Route, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import SongDetail from './SongDetail'
import MixBuilder from './MixBuilder'
import Mixes from './Mixes'
import MixDetail from './MixDetail'
import Setlists from './Setlists' 
import SetlistBuilder from './SetlistBuilder' 
import SetlistDetail from './SetlistDetail'
import Modal from './Modal'

const MUSICAL_KEYS = [
  'C', 'Cm', 'C#', 'C#m', 'D', 'Dm', 'D#', 'D#m', 'E', 'Em',
  'F', 'Fm', 'F#', 'F#m', 'G', 'Gm', 'G#', 'G#m', 'A', 'Am',
  'A#', 'A#m', 'B', 'Bm'
]

const Repertorio = () => {
  const [band, setBand] = useState(null)
  const [songs, setSongs] = useState([])
  const [vocalists, setVocalists] = useState([]) 
  
  const [existingAuthors, setExistingAuthors] = useState([])
  const [authorInput, setAuthorInput] = useState('')
  const [newSong, setNewSong] = useState({ title: '', authors: [], key_signature: '', vocalists: [] })
  
  // ESTADO PARA EL ARCHIVO ADJUNTO (Cifra/Partitura)
  const [cifraFile, setCifraFile] = useState(null) 

  // NUEVO: ESTADO PARA EL MODAL DE ÉXITO
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isKeyMenuOpen, setIsKeyMenuOpen] = useState(false)

  // Estados de búsqueda y filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [filterVocalist, setFilterVocalist] = useState('Todos')
  const [filterKey, setFilterKey] = useState('Todas') 

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: bandData } = await supabase.from('bands').select('*').limit(1).single()
      
      if (bandData) {
        setBand(bandData)
        
        const { data: vocalistsData } = await supabase.from('band_vocalists').select('name').eq('band_id', bandData.id)
        if (vocalistsData) setVocalists(vocalistsData.map(v => v.name))

        const { data: dictData } = await supabase.from('band_authors').select('name').eq('band_id', bandData.id)
        const catalogAuthors = dictData ? dictData.map(a => a.name) : []

        const { data: songsData } = await supabase
          .from('songs')
          .select('*')
          .eq('band_id', bandData.id)
          .order('created_at', { ascending: false })
        
        if (songsData) {
          setSongs(songsData)
          const usedAuthors = songsData.flatMap(song => song.authors || [])
          const uniqueCombinedAuthors = [...new Set([...catalogAuthors, ...usedAuthors])]
          uniqueCombinedAuthors.sort((a, b) => a.localeCompare(b))
          setExistingAuthors(uniqueCombinedAuthors)
        }
      }
    }
    fetchInitialData()
  }, [])

  const toggleVocalist = (vocalist) => {
    setNewSong((prev) => {
      const isSelected = prev.vocalists.includes(vocalist)
      return {
        ...prev,
        vocalists: isSelected ? prev.vocalists.filter(v => v !== vocalist) : [...prev.vocalists, vocalist]
      }
    })
  }

  const addAuthor = (authorName) => {
    const cleanName = authorName.trim()
    if (cleanName && !newSong.authors.includes(cleanName)) {
      setNewSong({ ...newSong, authors: [...newSong.authors, cleanName] })
    }
    setAuthorInput('')
  }

  const removeAuthor = (authorToRemove) => {
    setNewSong({
      ...newSong,
      authors: newSong.authors.filter(a => a !== authorToRemove)
    })
  }

  const filteredAuthorSuggestions = existingAuthors.filter(
    a => a.toLowerCase().includes(authorInput.toLowerCase()) && !newSong.authors.includes(a)
  )

  const handleAddSong = async (e) => {
    e.preventDefault() 
    if (!band || !newSong.title) return
    setIsSubmitting(true)

    try {
      const finalAuthors = [...newSong.authors]
      if (authorInput.trim() && !finalAuthors.includes(authorInput.trim())) {
        finalAuthors.push(authorInput.trim())
      }

      // 1. CREAMOS LA CANCIÓN PRIMERO (Para obtener su ID)
      const { data: songData, error: songError } = await supabase
        .from('songs')
        .insert([{ 
          band_id: band.id, 
          title: newSong.title, 
          authors: finalAuthors,
          key_signature: newSong.key_signature,
          vocalists: newSong.vocalists 
        }])
        .select() 

      if (songError) throw songError;
      const insertedSong = songData[0]; // Capturamos la canción recién creada

      // 2. SI HAY UN ARCHIVO, LO SUBIMOS Y REGISTRAMOS EN song_attachments
      if (cifraFile) {
        // Generar un nombre único para el archivo
        const fileExt = cifraFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${band.id}/${fileName}`;

        // A) Subir al bucket de Storage
        const { error: uploadError } = await supabase.storage
          .from('chords_attachments')
          .upload(filePath, cifraFile);

        if (uploadError) throw uploadError;

        // B) Registrar en la tabla song_attachments
        const { error: attachmentError } = await supabase
          .from('song_attachments')
          .insert([{
            song_id: insertedSong.id,
            file_name: cifraFile.name,
            file_type: cifraFile.type, // Ej: 'image/jpeg' o 'application/pdf'
            storage_path: filePath
          }]);

        if (attachmentError) throw attachmentError;
      }

      // 3. ACTUALIZAR LA INTERFAZ
      setSongs([insertedSong, ...songs])
      const updatedAuthors = [...new Set([...existingAuthors, ...finalAuthors])]
      updatedAuthors.sort((a, b) => a.localeCompare(b))
      setExistingAuthors(updatedAuthors)
      
      // Limpiar formulario y archivo
      setNewSong({ title: '', authors: [], key_signature: '', vocalists: [] })
      setAuthorInput('')
      setCifraFile(null)
      document.getElementById('file-upload').value = '';

      setIsSuccessModalOpen(true);

    } catch (error) {
      console.error("Error al guardar:", error)
      alert("Error al guardar la canción o subir el archivo. Revisa la consola.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Lógica de filtrado actualizada
  const filteredSongs = songs.filter(song => {
    const matchesSearch = song.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (song.authors && song.authors.some(a => a.toLowerCase().includes(searchQuery.toLowerCase())))
    
    const matchesVocalist = filterVocalist === 'Todos' || 
                            (song.vocalists && song.vocalists.includes(filterVocalist))
    
    // Nueva condición para el tono
    const matchesKey = filterKey === 'Todas' || song.key_signature === filterKey

    return matchesSearch && matchesVocalist && matchesKey
  })

  return (
    <div className="grid md:grid-cols-3 gap-6">
      
      {/* Columna Izquierda: Formulario */}
      <div className="md:col-span-1 bg-neutral-800 p-6 rounded-lg shadow-lg h-fit border border-neutral-700">
        <h3 className="text-xl font-bold text-emerald-400 mb-4">Agregar Música ➕</h3>
        
        <form onSubmit={handleAddSong} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-gray-400 font-bold uppercase">Título *</label>
            <input 
              type="text" 
              required
              value={newSong.title}
              onChange={(e) => setNewSong({...newSong, title: e.target.value})}
              className="w-full mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 text-white focus:border-emerald-500 outline-none"
              placeholder="Ej: Trem das Onze"
            />
          </div>

          <div className="relative">
            <label className="text-xs text-gray-400 font-bold uppercase">Autores / Intérpretes</label>
            <div className="w-full mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 focus-within:border-emerald-500 flex flex-wrap gap-2 items-center">
              {newSong.authors.map(author => (
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
                placeholder={newSong.authors.length === 0 ? "Ej: Zeca Pagodinho" : "Agregar otro..."}
              />
            </div>

            {authorInput.trim() && filteredAuthorSuggestions.length > 0 && (
              <div className="absolute top-full left-0 w-full mt-1 bg-neutral-900 border border-neutral-600 rounded shadow-xl z-20 max-h-48 overflow-y-auto">
                {filteredAuthorSuggestions.map(suggestion => (
                  <div 
                    key={suggestion}
                    className="p-2 text-gray-300 hover:bg-emerald-800 hover:text-white cursor-pointer text-sm"
                    onClick={() => addAuthor(suggestion)}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <label className="text-xs text-gray-400 font-bold uppercase">Tonalidad</label>
            <div 
              onClick={() => setIsKeyMenuOpen(!isKeyMenuOpen)}
              className="w-full mt-1 bg-neutral-900 border border-neutral-700 rounded p-2 text-white cursor-pointer flex justify-between items-center hover:border-emerald-700 transition-colors"
            >
              <span className={newSong.key_signature ? "text-white" : "text-gray-500"}>
                {newSong.key_signature || "Selecciona la tonalidad..."}
              </span>
              <span className="text-xs text-gray-500">▼</span>
            </div>

            {isKeyMenuOpen && (
              <div className="absolute top-full left-0 w-full mt-1 bg-neutral-900 border border-neutral-600 rounded shadow-xl z-10 max-h-48 overflow-y-auto">
                <div 
                  className="p-2 text-gray-400 hover:bg-neutral-800 cursor-pointer text-sm border-b border-neutral-800"
                  onClick={() => { setNewSong({...newSong, key_signature: ''}); setIsKeyMenuOpen(false) }}
                >
                  Sin tonalidad
                </div>
                <div className="grid grid-cols-4 gap-1 p-2">
                  {MUSICAL_KEYS.map((note) => (
                    <div 
                      key={note}
                      className="p-2 text-center rounded hover:bg-emerald-800 hover:text-white cursor-pointer text-gray-300 font-mono text-sm transition-colors"
                      onClick={() => { setNewSong({...newSong, key_signature: note}); setIsKeyMenuOpen(false) }}
                    >
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {vocalists.length > 0 && (
            <div>
              <label className="text-xs text-gray-400 font-bold uppercase block mb-2">Vocalistas (Opcional)</label>
              <div className="flex flex-wrap gap-2">
                {vocalists.map((vocalist) => {
                  const isSelected = newSong.vocalists.includes(vocalist)
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

          {/* INPUT PARA SUBIR PDF/IMAGEN */}
          <div className="border border-dashed border-emerald-900/50 bg-neutral-900 p-4 rounded-lg text-center mt-2">
            <label className="text-xs text-emerald-500 font-bold uppercase block mb-2 cursor-pointer hover:text-emerald-400">
              {cifraFile ? '📄 Archivo seleccionado' : '📎 Adjuntar Partitura / Cifra'}
              <input 
                id="file-upload"
                type="file" 
                accept=".pdf, image/jpeg, image/png" 
                className="hidden"
                onChange={(e) => setCifraFile(e.target.files[0])}
              />
            </label>
            {cifraFile && (
              <div className="flex justify-between items-center bg-neutral-950 p-2 rounded border border-neutral-800 mt-2">
                <span className="text-xs text-gray-300 truncate max-w-[200px]">{cifraFile.name}</span>
                <button 
                  type="button" 
                  onClick={() => {
                    setCifraFile(null); 
                    document.getElementById('file-upload').value = '';
                  }} 
                  className="text-red-500 hover:text-red-400 font-bold text-xs bg-red-950/30 px-2 py-1 rounded"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando y subiendo...' : 'Guardar Canción'}
          </button>
        </form>
      </div>

      {/* Columna Derecha: Catálogo y Filtros */}
      <div className="md:col-span-2 bg-neutral-800 p-6 rounded-lg shadow-lg border border-neutral-700">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Catálogo de <span className="text-emerald-400">{band?.name || '...'}</span> 🎵</h2>
          <span className="bg-neutral-900 text-emerald-400 text-xs px-3 py-1 rounded-full border border-neutral-700">
            {filteredSongs.length} canciones
          </span>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <input 
              type="text" 
              placeholder="🔍 Buscar por título o autor..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-md p-2.5 text-white focus:border-emerald-500 outline-none transition-all"
            />
          </div>
          
          <div className="flex flex-row gap-2">
            <select 
              value={filterVocalist}
              onChange={(e) => setFilterVocalist(e.target.value)}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-md p-2.5 text-white focus:border-emerald-500 outline-none cursor-pointer text-sm min-w-[140px]"
            >
              <option value="Todos">👤 Todos</option>
              {vocalists.map(v => (
                <option key={v} value={v}>🎤 {v}</option>
              ))}
            </select>

            <select 
              value={filterKey}
              onChange={(e) => setFilterKey(e.target.value)}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-md p-2.5 text-white focus:border-emerald-500 outline-none cursor-pointer text-sm font-mono min-w-[120px]"
            >
              <option value="Todas">🎵 Tonos</option>
              {MUSICAL_KEYS.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredSongs.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            {songs.length === 0 
              ? "No hay canciones todavía. ¡Agrega la primera de tu repertorio!"
              : "No se encontraron canciones que coincidan con tu búsqueda."}
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredSongs.map((song) => (
              <Link to={`/cancion/${song.id}`} key={song.id} className="bg-neutral-900 p-4 rounded-md border border-neutral-700 flex flex-col hover:border-emerald-500 hover:shadow-lg transition-all cursor-pointer">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-lg font-bold text-white">{song.title}</h4>
                    <p className="text-sm text-gray-400">
                      {song.authors && song.authors.length > 0 ? song.authors.join(', ') : 'Autor desconocido'}
                    </p>
                  </div>
                  {song.key_signature && (
                    <div className="bg-neutral-800 px-3 py-1 rounded text-emerald-400 font-mono font-bold border border-neutral-700">
                      {song.key_signature}
                    </div>
                  )}
                </div>
                
                {song.vocalists && song.vocalists.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {song.vocalists.map(v => (
                      <span key={v} className="text-xs bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-900/50">
                        🎤 {v}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
      <Modal 
        isOpen={isSuccessModalOpen} 
        onClose={() => setIsSuccessModalOpen(false)} 
        onConfirm={() => setIsSuccessModalOpen(false)} 
        title="¡Música Agregada!" 
        message="La canción y su archivo adjunto se guardaron correctamente en tu catálogo." 
        confirmText="Aceptar" 
        type="success" 
      />

    </div>
  )
}

function App() {
  return (
    <div className="min-h-screen bg-neutral-900 text-gray-100 font-sans">
      <nav className="bg-neutral-950 border-b border-emerald-900/50 p-4 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-black text-xl text-white tracking-wider">
              ARTE<span className="text-emerald-500">BRASIL</span>
            </Link>
            <div className="flex gap-4">
              <Link to="/" className="text-sm font-medium text-gray-400 hover:text-emerald-400">Repertorio</Link>
              <Link to="/mixes" className="text-sm font-medium text-gray-400 hover:text-emerald-400">Mixes</Link>
              <Link to="/setlists" className="text-sm font-medium text-gray-400 hover:text-emerald-400">Setlists</Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto mt-8 p-4">
        <Routes>
          <Route path="/" element={<Repertorio />} />
          <Route path="/mixes" element={<Mixes />} />
          <Route path="/setlists" element={<Setlists />} />
          <Route path="/crear-setlist" element={<SetlistBuilder />} />
          <Route path="/editar-setlist/:id" element={<SetlistBuilder />} />
          <Route path="/setlist/:id" element={<SetlistDetail />} />
          <Route path="/cancion/:id" element={<SongDetail />} />
          <Route path="/crear-mix" element={<MixBuilder />} />
          <Route path="/crear-mix/:id" element={<MixBuilder />} />
          <Route path="/mixes/:id" element={<MixDetail />} />
        </Routes>
      </main>
    </div>
  )
}

export default App