import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useNavigate, useParams } from 'react-router-dom'
import Modal from './Modal'

import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const MUSICAL_KEYS = [
  'C', 'Cm', 'C#', 'C#m', 'D', 'Dm', 'D#', 'D#m', 'E', 'Em',
  'F', 'Fm', 'F#', 'F#m', 'G', 'Gm', 'G#', 'G#m', 'A', 'Am',
  'A#', 'A#m', 'B', 'Bm'
]

// Componente visual para cada ítem en la lista
const SortableSetlistItem = ({ item, displayNumber, onRemove }) => {
  const [isExpanded, setIsExpanded] = useState(false); // Estado para abrir/cerrar detalles del mix
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.tempId })
  
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 10 : 1, opacity: isDragging ? 0.5 : 1 }

  if (item.isDivider) {
    return (
      <div ref={setNodeRef} style={style} className="flex items-center gap-4 bg-red-950/40 p-3 rounded-xl border border-red-900/50 mb-3 touch-none shadow-lg">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-red-500 hover:text-red-400 px-1 text-xl">⣿</div>
        <div className="flex-1 text-center">
          <span className="text-red-400 font-black tracking-widest uppercase">🛑 {item.title}</span>
        </div>
        <button onClick={() => onRemove(item.tempId)} className="text-gray-700 hover:text-red-500 transition-colors p-2">✕</button>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className="bg-neutral-900 p-4 rounded-xl border border-emerald-900/30 mb-3 touch-none shadow-lg group">
      <div className="flex items-center gap-4">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-emerald-800 hover:text-emerald-500 px-1 text-xl">⣿</div>
        
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="text-emerald-500 font-black tabular-nums">{displayNumber}.</span>
            <h4 className="font-bold text-white text-lg">{item.title}</h4>
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-black border ${item.isMix ? 'bg-amber-900/20 text-amber-500 border-amber-900/50' : 'bg-blue-900/20 text-blue-500 border-blue-900/50'}`}>
              {item.isMix ? 'MIX 🧱' : 'CANCIÓN 🎵'}
            </span>
          </div>
          
          {/* Botón para desplegar canciones del mix */}
          {item.isMix && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[10px] text-amber-500 mt-1 hover:text-amber-400 uppercase tracking-wider flex items-center gap-1"
            >
              {isExpanded ? '▲ Ocultar temas' : `▼ Ver ${item.mixSongs?.length} temas`}
            </button>
          )}
          
          {!item.isMix && item.details && <p className="text-[10px] text-gray-500 mt-1 italic uppercase tracking-wider">{item.details}</p>}
        </div>

        <button onClick={() => onRemove(item.tempId)} className="text-gray-700 hover:text-red-500 transition-colors p-2">✕</button>
      </div>

      {/* Radiografía del Mix: Lista de canciones desplegada */}
      {item.isMix && isExpanded && (
        <div className="mt-3 ml-12 pl-4 border-l-2 border-amber-900/30 space-y-1">
          {item.mixSongs?.map((song, i) => (
            <div key={i} className="text-xs text-gray-400 flex items-center gap-2">
              <span className="text-amber-500/50">{i+1}.</span>
              <span className="text-gray-300">{song.title}</span>
              {song.key_signature && <span className="text-[9px] font-mono text-emerald-500 bg-emerald-900/20 px-1 rounded">{song.key_signature}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SetlistBuilder() {
  const [songs, setSongs] = useState([])
  const [mixes, setMixes] = useState([])
  const [band, setBand] = useState(null)
  
  // Estado para saber qué mixes están expandidos en la biblioteca lateral
  const [expandedLibraryMixes, setExpandedLibraryMixes] = useState([])

  const [searchQuery, setSearchQuery] = useState('')
  const [filterKey, setFilterKey] = useState('Todas')
  const [filterVocalist, setFilterVocalist] = useState('Todos')
  const [vocalistsList, setVocalistsList] = useState([])

  const [showName, setShowName] = useState('')
  const [showDate, setShowDate] = useState('')
  const [selectedItems, setSelectedItems] = useState([])
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  
  const navigate = useNavigate()
  const { id } = useParams()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    const fetchData = async () => {
      const { data: bandData } = await supabase.from('bands').select('*').limit(1).single();
      if (bandData) {
        setBand(bandData);
        
        const { data: vData } = await supabase.from('band_vocalists').select('name').eq('band_id', bandData.id)
        if (vData) setVocalistsList(vData.map(v => v.name))

        const { data: s } = await supabase.from('songs').select('*').eq('band_id', bandData.id).order('title');
        
        // AQUÍ MEJORAMOS LA CONSULTA PARA TRAER LAS CANCIONES DENTRO DEL MIX
        const { data: m } = await supabase
          .from('mixes')
          .select('*, mix_songs(sort_order, songs(title, key_signature))')
          .eq('band_id', bandData.id)
          .order('title');
        
        setSongs(s || []);
        setMixes(m || []);
      }

      if (id) {
        // TAMBIÉN MEJORAMOS LA CONSULTA AL EDITAR UN SHOW
        const { data: setlistData } = await supabase
          .from('setlists')
          .select(`*, setlist_items(song_id, mix_id, is_divider, sort_order, songs(id, title, key_signature), mixes(id, title, mix_songs(sort_order, songs(title, key_signature))))`)
          .eq('id', id)
          .single();

        if (setlistData) {
          setShowName(setlistData.name);
          setShowDate(setlistData.event_date || '');
          const items = setlistData.setlist_items
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(item => ({
              tempId: Math.random().toString(36).substr(2, 9),
              id: item.is_divider ? null : (item.song_id || item.mix_id),
              title: item.is_divider ? '✂️ CORTE DE SALIDA (DESCANSO)' : (item.songs?.title || item.mixes?.title),
              isMix: !!item.mix_id,
              isDivider: item.is_divider || false,
              details: item.is_divider ? 'Separador' : (!item.mix_id ? item.songs?.key_signature : ''),
              // Mapeamos las canciones del mix para pasarlas al componente
              mixSongs: item.mix_id ? item.mixes?.mix_songs?.sort((a,b) => a.sort_order - b.sort_order).map(ms => ms.songs) : []
            }));
          setSelectedItems(items);
        }
      }
    };
    fetchData();
  }, [id]);

  const addItem = (obj, isMix, isDivider = false) => {
    const newItem = {
      tempId: Math.random().toString(36).substr(2, 9),
      id: isDivider ? null : obj.id,
      title: isDivider ? '✂️ CORTE DE SALIDA (DESCANSO)' : obj.title,
      isMix: isMix,
      isDivider: isDivider,
      details: isDivider ? 'Separador visual' : (!isMix ? (obj.key_signature || 'Sin tono') : ''),
      // Mapeamos las canciones del mix al agregarlo de la biblioteca
      mixSongs: isMix ? obj.mix_songs?.sort((a,b) => a.sort_order - b.sort_order).map(ms => ms.songs) : []
    }
    setSelectedItems([...selectedItems, newItem])
  }

  const toggleLibraryMix = (mixId) => {
    setExpandedLibraryMixes(prev => 
      prev.includes(mixId) ? prev.filter(id => id !== mixId) : [...prev, mixId]
    )
  }

  const handleDragEnd = (event) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      setSelectedItems((items) => {
        const oldIndex = items.findIndex((i) => i.tempId === active.id)
        const newIndex = items.findIndex((i) => i.tempId === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const saveSetlist = async () => {
    if (!showName || selectedItems.length === 0) return alert("Asigna un nombre al show y agrega música.");
    setIsSaving(true);
    
    try {
      let currentSetlistId = id;
      if (id) {
        await supabase.from('setlists').update({ name: showName, event_date: showDate || null }).eq('id', id);
        await supabase.from('setlist_items').delete().eq('setlist_id', id);
      } else {
        const { data: newSetlist } = await supabase.from('setlists').insert([{ band_id: band.id, name: showName, event_date: showDate || null }]).select().single();
        currentSetlistId = newSetlist.id;
      }

      const itemsToSave = selectedItems.map((item, idx) => ({
        setlist_id: currentSetlistId,
        song_id: (!item.isMix && !item.isDivider) ? item.id : null,
        mix_id: item.isMix ? item.id : null,
        is_divider: item.isDivider || false,
        sort_order: idx + 1
      }));

      await supabase.from('setlist_items').insert(itemsToSave);
      setIsSuccessModalOpen(true);
    } catch (err) {
      console.error(err);
      alert("Error al guardar.");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredSongs = songs.filter(song => {
    const matchesSearch = song.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (song.authors && song.authors.some(a => a.toLowerCase().includes(searchQuery.toLowerCase())))
    const matchesKey = filterKey === 'Todas' || song.key_signature === filterKey
    const matchesVocalist = filterVocalist === 'Todos' || (song.vocalists && song.vocalists.includes(filterVocalist))
    return matchesSearch && matchesKey && matchesVocalist
  });

  const filteredMixes = mixes.filter(mix => mix.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      {/* Lado Izquierdo: Biblioteca */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-neutral-800 p-5 rounded-xl border border-neutral-700 sticky top-24">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">📂 Mi Repertorio</h3>
          
          <div className="bg-neutral-900/50 p-3 rounded-lg border border-neutral-700 mb-4 space-y-3">
            <input 
              type="text" 
              placeholder="🔍 Buscar canción o mix..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-600 rounded p-2 text-white text-sm outline-none focus:border-emerald-500 transition-all"
            />
            <div className="flex gap-2">
              <select value={filterVocalist} onChange={(e) => setFilterVocalist(e.target.value)} className="flex-1 bg-neutral-900 border border-neutral-600 rounded p-2 text-white text-xs outline-none focus:border-emerald-500 cursor-pointer">
                <option value="Todos">👤 Todos</option>
                {vocalistsList.map(v => <option key={v} value={v}>🎤 {v}</option>)}
              </select>
              <select value={filterKey} onChange={(e) => setFilterKey(e.target.value)} className="flex-1 bg-neutral-900 border border-neutral-600 rounded p-2 text-white text-xs outline-none focus:border-emerald-500 cursor-pointer font-mono">
                <option value="Todas">🎵 Tonos</option>
                {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>

          <button 
            onClick={() => addItem(null, false, true)}
            className="w-full mb-6 bg-red-900/30 hover:bg-red-900/50 text-red-400 font-bold py-3 rounded-lg border border-red-900/50 transition-all flex justify-center items-center gap-2"
          >
            🛑 AGREGAR CORTE DE SALIDA
          </button>

          <div className="space-y-6 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar">
            {/* Mixes Filtrados con Radiografía */}
            {filteredMixes.length > 0 && (
              <div>
                <p className="text-[10px] text-emerald-500 font-black uppercase mb-3 tracking-widest border-b border-emerald-900/30 pb-1">Mixes Reutilizables</p>
                {filteredMixes.map(m => (
                  <div key={m.id} className="mb-2 bg-neutral-900 rounded-lg border border-neutral-700 hover:border-amber-500 transition-all">
                    <div className="p-3 flex justify-between items-center group">
                      <div className="cursor-pointer flex-1 flex items-center gap-2" onClick={() => toggleLibraryMix(m.id)}>
                        <span className="text-white text-sm">🧱 {m.title}</span>
                        <span className="text-[10px] text-gray-500">{expandedLibraryMixes.includes(m.id) ? '▲' : '▼'}</span>
                      </div>
                      {/* El botón de "+" es el único que lo agrega a la lista */}
                      <button onClick={() => addItem(m, true)} className="text-amber-500 font-bold px-2 text-lg hover:scale-125 transition-transform">+</button>
                    </div>
                    
                    {/* Lista desplegable de canciones del mix en la biblioteca */}
                    {expandedLibraryMixes.includes(m.id) && (
                      <div className="px-3 pb-3 pt-1 border-t border-neutral-800 bg-neutral-950/50 rounded-b-lg">
                        {m.mix_songs?.sort((a,b) => a.sort_order - b.sort_order).map((ms, i) => (
                          <div key={i} className="text-[10px] text-gray-400 mb-1 flex items-center gap-1">
                            <span className="text-emerald-500/50">{i+1}.</span> 
                            <span className="truncate flex-1">{ms.songs?.title}</span>
                            <span className="text-[8px] font-mono text-emerald-600 bg-emerald-900/10 px-1 rounded">{ms.songs?.key_signature}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Canciones Sueltas */}
            {filteredSongs.length > 0 && (
              <div>
                <p className="text-[10px] text-emerald-500 font-black uppercase mb-3 tracking-widest border-b border-emerald-900/30 pb-1">Canciones Sueltas</p>
                {filteredSongs.map(s => (
                  <div key={s.id} onClick={() => addItem(s, false)} className="p-3 mb-2 bg-neutral-900 rounded-lg border border-neutral-700 hover:border-blue-500 cursor-pointer flex justify-between items-center transition-all group">
                    <span className="text-gray-300 text-sm">{s.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-600 font-mono">{s.key_signature}</span>
                      <span className="text-blue-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">+</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lado Derecho: Constructor */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-2xl">
          <h2 className="text-xl font-bold text-emerald-400 mb-6 uppercase tracking-wider">Armar Nueva Presentación 🎸</h2>
          
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            <input type="text" placeholder="Nombre del Evento" className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white font-bold outline-none focus:border-emerald-500" value={showName} onChange={e => setShowName(e.target.value)} />
            <input type="date" className="w-full bg-neutral-900 border border-neutral-700 rounded-lg p-3 text-white outline-none focus:border-emerald-500" value={showDate} onChange={e => setShowDate(e.target.value)} />
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={selectedItems.map(i => i.tempId)} strategy={verticalListSortingStrategy}>
              <div className="min-h-[400px] bg-neutral-900/30 p-4 rounded-xl border border-neutral-800">
                {(() => {
                  let currentNumber = 1; 
                  return selectedItems.map((item) => {
                    let numToDisplay = null;
                    if (item.isDivider) {
                      currentNumber = 1; 
                    } else {
                      numToDisplay = currentNumber; 
                      currentNumber++; 
                    }
                    return (
                      <SortableSetlistItem key={item.tempId} item={item} displayNumber={numToDisplay} onRemove={id => setSelectedItems(selectedItems.filter(i => i.tempId !== id))} />
                    );
                  });
                })()}
                
                {selectedItems.length === 0 && (
                  <div className="h-[300px] flex flex-col items-center justify-center text-gray-600 italic border-2 border-dashed border-neutral-800 rounded-xl">
                    <span className="text-4xl mb-2 opacity-20">🎼</span>
                    <p>Haz clic en los elementos de la izquierda para agregarlos al show</p>
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>

          <button onClick={saveSetlist} disabled={isSaving} className="w-full mt-8 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg transition-all disabled:opacity-50">
            {isSaving ? 'Guardando...' : '💾 FINALIZAR SHOW'}
          </button>
        </div>
      </div>

      <Modal isOpen={isSuccessModalOpen} onClose={() => navigate('/setlists')} onConfirm={() => navigate('/setlists')} title="¡Show Planificado!" message="El setlist y sus salidas han sido guardadas." confirmText="Ir a mis Shows" type="success" />
    </div>
  )
}