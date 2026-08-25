export default function AccesoRestringido() {
  return (
    <div className="py-16 text-center border border-dashed border-gray-300 rounded-xl">
      <p className="text-4xl mb-2">🔒</p>
      <p className="text-gray-600 font-medium">No tienes permiso para ver los costos</p>
      <p className="text-sm text-gray-400">Esta información solo está disponible para el propietario de la finca</p>
    </div>
  )
}
