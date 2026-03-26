import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { Link } from 'react-router-dom'
import Modal from './Modal' 

export default function Mixes() {
  const [mixes, setMixes] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Estados para controlar el Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedMix, setSelectedMix] = useState(null)

  // Función para cargar los datos desde Supabase
  const fetchMixes = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('mixes')
      .select(`
        id, 
        title, 
        created_at,
        intensity,
        samba_type,
        mix_songs (
          sort_order,
          songs (title)
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error("Error al cargar mixes:", error)
    } else if (data) {
      setMixes(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchMixes()
  }, [])

  // Abre el modal y guarda la referencia del mix que queremos borrar
  const openDeleteConfirm = (mix) => {
    setSelectedMix(mix)
    setIsModalOpen(true)
  }

  // Se ejecuta cuando el usuario confirma en el Modal
  const confirmDelete = async () => {
    if (!selectedMix) return
    
    try {
      // 1. Borrar canciones del mix
      const { error: songsError } = await supabase
        .from('mix_songs')
        .delete()
        .eq('mix_id', selectedMix.id)

      if (songsError) throw songsError

      // 2. Borrar el mix
      const { error: mixError } = await supabase
        .from('mixes')
        .delete()
        .eq('id', selectedMix.id)

      if (mixError) throw mixError

      // 3. Actualizar la lista visualmente
      setMixes(mixes.filter(m => m.id !== selectedMix.id))
      
    } catch (error) {
      console.error("Error en la eliminación:", error)
      alert("No se pudo eliminar el pot-pourri.")
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight">Mis Mixes</h2>
          <p className="text-gray-400 text-sm mt-1">Gestión de pot-pourris reutilizables para Arte Brasil.</p>
        </div>
        <Link 
          to="/crear-mix" 
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded-full transition-all shadow-lg flex items-center gap-2 active:scale-95"
        >
          <span className="text-xl">+</span> Crear Nuevo Mix
        </Link>
      </div>

      {/* Contenido Principal */}
      {loading ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
          <p className="text-gray-500 italic animate-pulse">Cargando catálogo de mixes...</p>
        </div>
      ) : mixes.length === 0 ? (
        <div className="bg-neutral-800/50 p-12 rounded-xl border border-dashed border-neutral-700 text-center">
          <p className="text-gray-500 mb-6 text-lg">Aún no has armado ningún pot-pourri.</p>
          <Link 
            to="/crear-mix" 
            className="inline-block bg-neutral-900 border border-emerald-900/50 text-emerald-400 px-6 py-2 rounded-lg hover:bg-emerald-900/20 transition-colors"
          >
            Comienza a armar uno ahora →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {mixes.map((mix) => (
            <div 
                key={mix.id} 
                className="bg-neutral-800 p-5 rounded-xl border border-neutral-700 hover:border-emerald-500/50 transition-all shadow-md group flex flex-col justify-between"
            >
                <div>
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">🧱 {mix.title}</h3>
                    <span className="bg-neutral-950 text-emerald-400 text-[10px] font-black px-2 py-1 rounded border border-emerald-900/30 uppercase tracking-tighter">
                    {mix.mix_songs?.length || 0} temas
                    </span>
                </div>
                
                {/* --- MOVER TAGS AQUÍ ABAJO PARA MEJOR DISEÑO --- */}
                <div className="flex flex-wrap gap-2 mb-4">
                    {mix.intensity && (
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${
                        mix.intensity === 'máximo' || mix.intensity === 'muy alto' 
                        ? 'bg-red-900/20 border-red-500 text-red-500' 
                        : 'bg-emerald-900/20 border-emerald-500 text-emerald-500'
                    }`}>
                        ⚡ {mix.intensity.toUpperCase()}
                    </span>
                    )}
                    {mix.samba_type && (
                    <span className="bg-neutral-950 text-gray-400 text-[9px] font-black px-2 py-0.5 rounded border border-neutral-700 uppercase">
                        🥁 {mix.samba_type}
                    </span>
                    )}
                </div>

                {/* Lista de canciones corta dentro de la card */}
                <div className="mb-6 space-y-1">
                {mix.mix_songs
                    ?.sort((a, b) => a.sort_order - b.sort_order)
                    .slice(0, 4) // Mostramos las primeras 4 para no romper el diseño
                    .map((item, idx) => (
                    <p key={idx} className="text-[11px] text-gray-400 flex items-center gap-2 truncate">
                        <span className="text-emerald-500/50 font-bold">{idx + 1}.</span>
                        {item.songs?.title}
                    </p>
                    ))}
                {mix.mix_songs?.length > 4 && (
                    <p className="text-[10px] text-gray-600 italic pl-5">
                    + {mix.mix_songs.length - 4} más...
                    </p>
                )}
                </div>

                <p className="text-[10px] text-gray-500 font-mono uppercase tracking-widest mb-6">
                    Registrado: {new Date(mix.created_at).toLocaleDateString()}
                </p>
                </div>
              
              <div className="flex justify-between items-center pt-4 border-t border-neutral-700/50">
                <div className="flex gap-4">
                    <Link to={`/mixes/${mix.id}`} className="text-sm font-black text-emerald-500 hover:text-emerald-400">VER LETRAS</Link>
                    
                    {/* BOTÓN EDITAR */}
                    <Link to={`/crear-mix/${mix.id}`} className="text-sm font-bold text-gray-400 hover:text-white transition-colors">EDITAR</Link>
                </div>
                
                <button onClick={() => openDeleteConfirm(mix)} className="text-[10px] font-bold text-gray-600 hover:text-red-500 uppercase">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN ESTÉTICO */}
      <Modal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={confirmDelete}
        title="¿Eliminar Pot-pourri?"
        message={`Estás a punto de borrar "${selectedMix?.title}". Se eliminará la estructura del mix pero no las canciones originales.`}
        confirmText="Confirmar Eliminación"
      />
    </div>
  )
}