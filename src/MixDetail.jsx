import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'

export default function MixDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [mix, setMix] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMixDetail = async () => {
      const { data, error } = await supabase
        .from('mixes')
        .select(`
          id,
          title,
          intensity,
          samba_type,
          mix_songs (
            sort_order,
            songs (
              id,
              title,
              authors,
              key_signature,
              lyrics
            )
          )
        `)
        .eq('id', id)
        .single()

      if (data) {
        // Ordenamos las canciones por el campo sort_order
        const sortedSongs = data.mix_songs.sort((a, b) => a.sort_order - b.sort_order)
        setMix({ ...data, sortedSongs })
      }
      setLoading(false)
    }
    fetchMixDetail()
  }, [id])

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando pot-pourri...</div>
  if (!mix) return <div className="p-8 text-center text-red-500">No se encontró el mix.</div>

  return (
    <div className="max-w-3xl mx-auto">
      <button 
        onClick={() => navigate('/mixes')} 
        className="mb-6 text-gray-400 hover:text-emerald-400 transition-colors flex items-center gap-2"
      >
        ← Volver a Mixes
      </button>

      <div className="bg-neutral-800 p-6 md:p-10 rounded-lg shadow-xl border border-neutral-700">
        <header className="mb-8 border-b border-neutral-700 pb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">🧱</span>
                    <h1 className="text-4xl font-black text-white uppercase tracking-tight">{mix.title}</h1>
                </div>
                <p className="text-emerald-400 font-medium">Pot-pourri de {mix.sortedSongs.length} canciones</p>
                </div>

                {/* TAGS EN EL DETALLE */}
                <div className="flex gap-2">
                {mix.intensity && (
                    <span className={`text-xs font-black px-3 py-1 rounded-full border ${
                    mix.intensity === 'máximo' || mix.intensity === 'muy alto' 
                        ? 'bg-red-900/20 border-red-500 text-red-500' 
                        : 'bg-emerald-900/20 border-emerald-500 text-emerald-500'
                    }`}>
                    ⚡ {mix.intensity.toUpperCase()}
                    </span>
                )}
                {mix.samba_type && (
                    <span className="bg-neutral-900 text-gray-400 text-xs font-black px-3 py-1 rounded-full border border-neutral-700 uppercase">
                    🥁 {mix.samba_type}
                    </span>
                )}
                </div>
            </div>
        </header>

        <div className="space-y-12">
          {mix.sortedSongs.map((item, index) => (
            <section key={item.songs.id} className="relative">
              {/* Indicador de orden lateral */}
              <div className="absolute -left-4 md:-left-12 top-0 text-emerald-900 font-black text-6xl opacity-20 select-none">
                {index + 1}
              </div>

              <div className="flex justify-between items-end mb-4 border-b border-emerald-900/30 pb-2">
                <div>
                  <h2 className="text-2xl font-bold text-white">{item.songs.title}</h2>
                  <p className="text-sm text-gray-400">{item.songs.authors?.join(', ')}</p>
                </div>
                {item.songs.key_signature && (
                  <span className="bg-neutral-900 text-emerald-400 font-mono font-bold px-3 py-1 rounded border border-neutral-700">
                    {item.songs.key_signature}
                  </span>
                )}
              </div>

              <div className="text-gray-200 text-xl leading-relaxed font-serif whitespace-pre-wrap">
                {item.songs.lyrics || <p className="italic text-gray-600 text-sm">Sin letra registrada.</p>}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}