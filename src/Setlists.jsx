import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { Link } from 'react-router-dom'

export default function Setlists() {
  const [setlists, setSetlists] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSetlists = async () => {
      const { data } = await supabase
        .from('setlists')
        .select(`
          id, 
          name, 
          event_date,
          setlist_items (id)
        `)
        .order('event_date', { ascending: false })
      
      if (data) setSetlists(data)
      setLoading(false)
    }
    fetchSetlists()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-white">Próximos Shows 📋</h2>
        <Link 
          to="/crear-setlist" 
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-6 rounded-full transition-all shadow-lg"
        >
          + Nuevo Setlist
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-500 italic">Cargando presentaciones...</p>
      ) : setlists.length === 0 ? (
        <div className="bg-neutral-800 p-10 rounded-lg border border-dashed border-neutral-700 text-center">
          <p className="text-gray-500">No hay shows programados.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {setlists.map((show) => (
            <div key={show.id} className="bg-neutral-800 p-5 rounded-xl border border-neutral-700 hover:border-emerald-500 transition-all">
              <div className="flex justify-between items-start mb-4">
                <span className="text-2xl">🎸</span>
                <span className="bg-neutral-900 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded border border-emerald-900/30">
                  {show.setlist_items?.length || 0} BLOQUES
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{show.name}</h3>
              <p className="text-xs text-gray-500 mb-6">
                📅 {show.event_date ? new Date(show.event_date).toLocaleDateString() : 'Fecha no definida'}
              </p>
              <div className="flex gap-4 border-t border-neutral-700 pt-4">
              <Link 
                to={`/setlist/${show.id}`} 
                className="text-sm font-bold text-emerald-500 hover:text-emerald-400 tracking-wider"
              >
                ABRIR SHOW
              </Link>
              <Link 
                to={`/editar-setlist/${show.id}`} 
                className="text-sm font-bold text-gray-500 hover:text-white tracking-wider"
              >
                EDITAR
              </Link>
            </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}