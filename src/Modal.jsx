import { useEffect } from 'react'

export default function Modal({ isOpen, onClose, onConfirm, title, message, confirmText = "Eliminar", type = "danger" }) {
  // Cerrar con la tecla Esc
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay con desenfoque */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Caja del Modal */}
      <div className="relative bg-neutral-800 border border-neutral-700 rounded-xl shadow-2xl max-w-sm w-full p-6 transform transition-all scale-100">
        <div className="text-center">
          <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${
            type === 'danger' ? 'bg-red-900/20 text-red-500' : 'bg-emerald-900/20 text-emerald-500'
          }`}>
            {type === 'danger' ? '⚠️' : '✅'}
          </div>
          <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
          <p className="text-sm text-gray-400 mb-6">{message}</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-1 px-4 py-2 rounded-lg font-bold transition-all ${
              type === 'danger' 
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20' 
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}