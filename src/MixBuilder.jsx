import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useNavigate, useParams } from 'react-router-dom'
import Modal from './Modal'

// DND-Kit imports
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const SortableSongItem = ({ song, index, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: song.id })
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 1, opacity: isDragging ? 0.5 : 1 }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-4 bg-neutral-900 p-3 rounded border border-emerald-900/30 mb-3 touch-none">
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-emerald-500 px-1">⣿</div>
      <span className="text-emerald-500 font-bold w-4 text-center">{index + 1}</span>
      <div className="flex-1">
        <p className="font-bold text-white text-sm">{song.title}</p>
        <p className="text-[10px] text-gray-500 uppercase">{song.key_signature || 'S/T'}</p>
      </div>
      <button onClick={() => onRemove(song.id)} className="text-gray-600 hover:text-red-500 transition-colors text-xs">Quitar</button>
    </div>
  )
}

export default function MixBuilder() {
  const { id } = useParams() // Capturamos el ID si venimos de "Editar"
  const navigate = useNavigate()
  const [songs, setSongs] = useState([])
  const [band, setBand] = useState(null)


  
  // Estados del Mix
  const [mixTitle, setMixTitle] = useState('')
  const [mixIntensity, setMixIntensity] = useState('')
  const [mixSambaType, setMixSambaType] = useState('')
  const [selectedSongs, setSelectedSongs] = useState([])
  const [originalTitle, setOriginalTitle] = useState('')
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    const fetchData = async () => {
      // 1. Cargar Banda y Canciones
      const { data: bandData } = await supabase.from('bands').select('*').limit(1).single()
      if (bandData) {
        setBand(bandData)
        const { data: songsData } = await supabase.from('songs').select('*').eq('band_id', bandData.id).order('title')
        if (songsData) setSongs(songsData)

        // 2. SI HAY ID, CARGAR DATOS DEL MIX PARA EDITAR
        if (id) {
          const { data: mixData } = await supabase
            .from('mixes')
            .select(`*, mix_songs(sort_order, songs(*))`)
            .eq('id', id)
            .single()

          if (mixData) {
            setMixTitle(mixData.title)
            setOriginalTitle(mixData.title)
            setMixIntensity(mixData.intensity || '')
            setMixSambaType(mixData.samba_type || '')
            const loadedSongs = mixData.mix_songs
              .sort((a, b) => a.sort_order - b.sort_order)
              .map(ms => ms.songs)
            setSelectedSongs(loadedSongs)
          }
        }
      }
    }
    fetchData()
  }, [id])

  const addSongToMix = (song) => {
    if (!selectedSongs.find(s => s.id === song.id)) {
      setSelectedSongs([...selectedSongs, song])
    }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      setSelectedSongs((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id)
        const newIndex = items.findIndex((i) => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  // 1. Modificamos la función para que acepte el parámetro 'isCloning'
const handleSaveMix = async (isCloning = false) => {
  // Validación de campos vacíos
  if (!mixTitle || selectedSongs.length < 2) {
    alert("Completa el título y agrega al menos 2 canciones.")
    return
  }

  // VALIDACIÓN DE NOMBRE PARA CLONACIÓN
  if (isCloning && mixTitle.trim() === originalTitle.trim()) {
    setIsWarningModalOpen(true) // Abrimos el modal estético
    return // Detenemos el guardado
  }

  setIsSaving(true)
  try {
    let mixId = id

    if (!id || isCloning) {
      // MODO NUEVO O CLON
      const { data: newMix } = await supabase.from('mixes').insert([{ 
        band_id: band.id, 
        title: mixTitle.trim(), 
        intensity: mixIntensity || null, 
        samba_type: mixSambaType || null 
      }]).select().single()
      mixId = newMix.id
    } else {
      // MODO EDICIÓN
      await supabase.from('mixes').update({ 
        title: mixTitle.trim(), 
        intensity: mixIntensity || null, 
        samba_type: mixSambaType || null 
      }).eq('id', id)
      
      await supabase.from('mix_songs').delete().eq('mix_id', id)
    }

    const entries = selectedSongs.map((s, i) => ({ 
      mix_id: mixId, 
      song_id: s.id, 
      sort_order: i + 1 
    }))
    await supabase.from('mix_songs').insert(entries)

    setIsSuccessModalOpen(true)
  } catch (e) {
    console.error(e)
  } finally {
    setIsSaving(false)
  }
}

  return (
    <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8">
      {/* Columna Izquierda: Buscador */}
      <div className="bg-neutral-800 p-6 rounded-lg border border-neutral-700 h-fit">
        <h2 className="text-xl font-bold text-white mb-4 tracking-tight">Seleccionar Canciones 🎵</h2>
        <input type="text" placeholder="Buscar canción..." className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 mb-4 text-white outline-none focus:border-emerald-500" onChange={(e) => setSearchQuery(e.target.value)} />
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {songs.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase())).map(song => (
            <div key={song.id} onClick={() => addSongToMix(song)} className="p-3 bg-neutral-900 rounded border border-neutral-700 hover:border-emerald-500 cursor-pointer flex justify-between items-center group transition-all">
              <div>
                <p className="text-white text-sm font-medium">{song.title}</p>
                <p className="text-[10px] text-gray-500 uppercase">{song.authors?.join(', ')}</p>
              </div>
              <span className="text-emerald-500 font-mono font-bold text-xs bg-emerald-500/10 px-2 py-1 rounded">{song.key_signature}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Columna Derecha: El Mix */}
      <div className="bg-neutral-800 p-6 rounded-lg border border-neutral-700 flex flex-col">
        <h2 className="text-xl font-bold text-emerald-400 mb-4 uppercase tracking-wider">{id ? 'Editar Mix ✏️' : 'Nuevo Mix 🧱'}</h2>
        
        <input type="text" placeholder="Nombre del Mix..." className="w-full bg-neutral-900 border border-neutral-700 rounded p-3 mb-4 text-white text-lg font-bold outline-none focus:border-emerald-500" value={mixTitle} onChange={(e) => setMixTitle(e.target.value)} />

        <div className="grid grid-cols-2 gap-3 mb-6">
          <select value={mixIntensity} onChange={(e) => setMixIntensity(e.target.value)} className="bg-neutral-900 border border-neutral-700 rounded p-2 text-white text-xs outline-none focus:border-emerald-500"><option value="">Intensidad...</option><option value="bajo">Bajo</option><option value="medio">Medio</option><option value="alto">Alto</option><option value="muy alto">Muy Alto</option><option value="máximo">Máximo</option></select>
          <select value={mixSambaType} onChange={(e) => setMixSambaType(e.target.value)} className="bg-neutral-900 border border-neutral-700 rounded p-2 text-white text-xs outline-none focus:border-emerald-500"><option value="">Estilo...</option><option value="samba-canção">Samba-canção</option><option value="samba de raiz">Samba de raiz</option><option value="partido-alto">Partido-alto</option><option value="pagode">Pagode</option><option value="samba-enredo">Samba-enredo</option><option value="samba de roda">Samba de roda</option></select>
        </div>

        <div className="flex-1 min-h-[300px]">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={selectedSongs.map(s => s.id)} strategy={verticalListSortingStrategy}>
              {selectedSongs.map((song, index) => (
                <SortableSongItem key={song.id} song={song} index={index} onRemove={(id) => setSelectedSongs(selectedSongs.filter(s => s.id !== id))} />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div className="flex flex-col gap-3 mt-8">
        {id ? (
            // Si estamos editando, mostramos dos opciones
            <div className="flex gap-3">
            <button 
                onClick={() => handleSaveMix(false)} 
                disabled={isSaving} 
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded shadow-lg transition-all disabled:opacity-50"
            >
                {isSaving ? 'Guardando...' : 'Actualizar Original'}
            </button>
            
            <button 
                onClick={() => handleSaveMix(true)} 
                disabled={isSaving} 
                className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white font-bold py-3 rounded shadow-lg transition-all border border-neutral-600"
            >
                Guardar como Copia
            </button>
            </div>
        ) : (
            // Si es un mix nuevo, solo mostramos el botón de guardar normal
            <button 
            onClick={() => handleSaveMix(false)} 
            disabled={isSaving} 
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded shadow-lg transition-all disabled:opacity-50"
            >
            {isSaving ? 'Guardando...' : '💾 Guardar Mix'}
            </button>
        )}
        </div>
      </div>

      <Modal isOpen={isSuccessModalOpen} onClose={() => navigate('/mixes')} onConfirm={() => navigate('/mixes')} title={id ? "Mix Actualizado" : "Mix Guardado"} message="Los cambios se han guardado correctamente." confirmText="Ir a Mixes" type="success" />
        {/* MODAL DE ADVERTENCIA POR NOMBRE DUPLICADO */}
        <Modal 
        isOpen={isWarningModalOpen}
        onClose={() => setIsWarningModalOpen(false)}
        onConfirm={() => setIsWarningModalOpen(false)}
        title="Nombre Duplicado"
        message={`Para guardar una copia, el nombre debe ser diferente al original ("${originalTitle}"). Por favor, cámbialo e intenta de nuevo.`}
        confirmText="Entendido"
        type="danger" // Usamos el estilo rojo para advertencia
        />
    </div>
  )
}

