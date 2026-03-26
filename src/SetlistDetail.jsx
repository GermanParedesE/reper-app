import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from './lib/supabase'

// 1. AÑADIMOS LOS COLORES PARA QUE LAS ALERTAS SE VEAN IGUAL QUE EN LA EDICIÓN
const SECTIONS = [
  { name: 'General', color: 'bg-blue-900/20 border-blue-500/50 text-blue-400' },
  { name: 'Intro', color: 'bg-purple-900/20 border-purple-500/50 text-purple-400' },
  { name: 'Verso', color: 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400' },
  { name: 'Coro', color: 'bg-amber-900/20 border-amber-500/50 text-amber-400' },
  { name: 'Corte', color: 'bg-red-900/20 border-red-500/50 text-red-400' },
  { name: 'Final', color: 'bg-pink-900/20 border-pink-500/50 text-pink-400' }
]

export default function SetlistDetail() {
  const { id } = useParams()
  const [items, setItems] = useState([])
  const [showInfo, setShowInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const [globalAction, setGlobalAction] = useState({ action: 'collapse_all', ts: 0 }) 

  useEffect(() => {
    const fetchFullShow = async () => {
      const { data } = await supabase
        .from('setlists')
        .select(`
          name, event_date,
          setlist_items (
            sort_order,
            song_id,
            mix_id,
            is_divider,
            songs (title, lyrics, key_signature, authors, song_attachments(storage_path)),
            mixes (
              title,
              mix_songs (
                sort_order,
                songs (title, lyrics, key_signature, authors, song_attachments(storage_path))
              )
            )
          )
        `)
        .eq('id', id)
        .single()

      if (data) {
        setShowInfo({ name: data.name, date: data.event_date })
        const sortedItems = data.setlist_items.sort((a, b) => a.sort_order - b.sort_order)
        setItems(sortedItems)
      }
      setLoading(false)
    }
    fetchFullShow()
  }, [id])

  const triggerGlobal = (action) => {
    setGlobalAction({ action, ts: Date.now() })
  }

  if (loading) return <div className="p-10 text-center text-emerald-500 animate-pulse text-2xl font-black">PREPARANDO EL ESCENARIO...</div>

  return (
    <div className="max-w-4xl mx-auto pb-20">
      
      {/* CABECERA: Con el top-[61px] para que no corte el texto con el menú principal */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-neutral-800 pb-6 gap-6 sticky top-[61px] bg-neutral-900/95 z-40 pt-4 backdrop-blur-sm">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter">{showInfo?.name}</h1>
          <p className="text-emerald-500 font-bold mt-2">
            MODO SHOW • {items.filter(i => !i.is_divider).length} CANCIONES/MIXES
          </p>
        </div>
        
        <div className="flex flex-col items-end gap-3 w-full md:w-auto">
          <Link to={`/editar-setlist/${id}`} className="bg-neutral-800 hover:bg-neutral-700 text-white px-4 py-2 rounded-lg text-xs font-bold border border-neutral-700 transition-all w-full md:w-auto text-center">
            ⚙️ EDITAR ORDEN
          </Link>
          
          <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-700 w-full md:w-auto gap-1">
            <button 
              onClick={() => triggerGlobal('expand_lyrics')}
              className="flex-1 px-3 py-2 rounded-lg text-[10px] sm:text-xs font-black tracking-widest uppercase transition-all bg-neutral-800 text-emerald-500 hover:bg-emerald-900/50"
            >
              🎤 Abrir Letras
            </button>
            <button 
              onClick={() => triggerGlobal('expand_chords')}
              className="flex-1 px-3 py-2 rounded-lg text-[10px] sm:text-xs font-black tracking-widest uppercase transition-all bg-neutral-800 text-amber-500 hover:bg-amber-900/50"
            >
              🎸 Abrir Cifras
            </button>
            <button 
              onClick={() => triggerGlobal('collapse_all')}
              className="flex-1 px-3 py-2 rounded-lg text-[10px] sm:text-xs font-black tracking-widest uppercase transition-all bg-neutral-800 text-gray-400 hover:bg-neutral-700 hover:text-white"
            >
              🙈 Ocultar Todo
            </button>
          </div>
        </div>
      </header>

      <div className="space-y-4">
        {(() => {
          let currentSongNumber = 1;
          let currentSetNumber = 1;

          return items.map((item, idx) => {
            if (item.is_divider) {
              currentSongNumber = 1; 
              currentSetNumber++;    
              return (
                <div key={idx} className="my-10 py-6 bg-red-950/20 border-y-2 border-red-900/50 text-center rounded-2xl">
                  <h2 className="text-2xl font-black text-red-500 uppercase tracking-widest">
                    🛑 INICIO SALIDA {currentSetNumber}
                  </h2>
                </div>
              );
            }

            const displayNum = currentSongNumber;
            currentSongNumber++;

            return (
              <div key={idx} className="space-y-2">
                {item.mix_id ? (
                  <div className="bg-emerald-950/10 rounded-2xl border border-emerald-900/30 p-2 space-y-2">
                    <h2 className="text-emerald-500/80 font-black text-sm uppercase tracking-widest pl-3 pt-2">
                      BLOQUE {displayNum}: {item.mixes.title}
                    </h2>
                    {item.mixes.mix_songs.sort((a,b) => a.sort_order - b.sort_order).map((ms, i) => (
                      <SongSection key={i} song={ms.songs} index={`${displayNum}.${i+1}`} globalAction={globalAction} />
                    ))}
                  </div>
                ) : (
                  <SongSection song={item.songs} index={displayNum} globalAction={globalAction} />
                )}
              </div>
            );
          });
        })()}
      </div>
    </div>
  )
}

// Sub-componente que renderiza cada canción individualmente
function SongSection({ song, index, globalAction }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [localViewMode, setLocalViewMode] = useState('lyrics');

  useEffect(() => {
    if (globalAction.ts === 0) return;
    if (globalAction.action === 'collapse_all') {
      setIsExpanded(false);
    } else if (globalAction.action === 'expand_lyrics') {
      setLocalViewMode('lyrics');
      setIsExpanded(true);
    } else if (globalAction.action === 'expand_chords') {
      setLocalViewMode('chords');
      setIsExpanded(true);
    }
  }, [globalAction]);

  const handleToggle = (mode) => {
    if (isExpanded && localViewMode === mode) {
      setIsExpanded(false);
    } else {
      setLocalViewMode(mode);
      setIsExpanded(true);
    }
  };

  useEffect(() => {
    if (song?.song_attachments && song.song_attachments.length > 0) {
      const path = song.song_attachments[0].storage_path;
      const { data } = supabase.storage.from('chords_attachments').getPublicUrl(path);
      setImageUrl(data.publicUrl);
    }
  }, [song]);

  // 2. AÑADIMOS LA FUNCIÓN renderLyrics AQUÍ DENTRO, CON TUS AJUSTES DE ESPACIADO
  const renderLyrics = (text) => {
    if (!text) return <p className="text-neutral-700 italic text-base">Instrumental / Sin letra</p>;

    const regex = /\[(General|Intro|Verso|Coro|Corte|Final):\s*(.*?)\]/gi;
    const parts = text.split(regex);
    
    const result = [];
    for (let i = 0; i < parts.length; i++) {
      if (i % 3 === 0) {
         let textPart = parts[i];
         
         if (i > 0 && textPart.startsWith('\n')) {
           textPart = textPart.substring(1);
         }
         
         if (textPart) result.push(<span key={i}>{textPart}</span>);
      } else {
         const section = parts[i];
         const content = parts[i+1];
         const secColor = SECTIONS.find(s => s.name.toLowerCase() === section.toLowerCase())?.color || 'bg-neutral-800 border-neutral-600 text-gray-300';
         
         result.push(
           <div key={`tag-${i}`} className={`my-1 p-2.5 rounded-lg border-l-4 ${secColor} shadow-md block w-full max-w-2xl bg-neutral-950/90`}>
             <span className="font-black text-[10px] uppercase tracking-widest block opacity-80 leading-none">
               🚨 {section}
             </span>
             <span className="text-lg md:text-xl font-bold font-sans leading-tight block mt-1">
               {content}
             </span>
           </div>
         );
         i++;
      }
    }
    return result;
  }

  return (
    <section className="bg-neutral-900/50 rounded-xl border border-neutral-800/80 overflow-hidden transition-all duration-300">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 gap-4">
        <div className="flex items-center gap-4 flex-1">
          <span className="text-3xl font-black text-neutral-700 w-12 text-center">{index}</span>
          <div>
            <h3 className="text-xl font-bold text-white leading-tight">{song.title}</h3>
            <p className="text-gray-500 uppercase text-[10px] tracking-widest mt-1">{song.authors?.join(', ')}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end pl-16 sm:pl-0">
          <span className="text-sm font-mono font-black text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
            {song.key_signature || '-'}
          </span>

          <div className="flex bg-neutral-950 p-1 rounded-lg border border-neutral-800">
            <button 
              onClick={() => handleToggle('lyrics')}
              className={`px-4 py-1.5 rounded-md text-xs font-black tracking-widest uppercase transition-all ${
                isExpanded && localViewMode === 'lyrics' ? 'bg-emerald-600 text-white shadow-md scale-105' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              🎤 Letra
            </button>
            <button 
              onClick={() => handleToggle('chords')}
              className={`px-4 py-1.5 rounded-md text-xs font-black tracking-widest uppercase transition-all ${
                isExpanded && localViewMode === 'chords' ? 'bg-amber-600 text-white shadow-md scale-105' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              🎸 Cifra
            </button>
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 border-t border-neutral-800 bg-neutral-900/30">
          {localViewMode === 'lyrics' ? (
            <div className="text-xl md:text-2xl text-gray-300 leading-relaxed font-serif whitespace-pre-wrap px-4 md:px-12 border-l-4 border-emerald-900/30">
              {/* 3. LLAMAMOS A LA FUNCIÓN AQUÍ PARA QUE DIBUJE LAS ETIQUETAS */}
              {renderLyrics(song.lyrics)}
            </div>
          ) : (
            <div className="px-4 md:px-12">
              {imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt={`Cifra de ${song.title}`} 
                  className="max-w-full rounded-xl border border-neutral-800 shadow-2xl bg-white" 
                  loading="lazy"
                />
              ) : (
                <div className="bg-neutral-950/50 border border-neutral-800 rounded-xl p-6 text-center max-w-lg mx-auto">
                  <span className="text-3xl block mb-2">📭</span>
                  <p className="text-neutral-500 text-sm font-bold uppercase tracking-widest">
                    Sin partitura adjunta
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}