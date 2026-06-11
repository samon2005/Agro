import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function ProduccionPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>🥛</span> Registros de Producción
          </h2>
          <p className="text-gray-500 mt-1">Seguimiento diario de producción por animal o lote</p>
        </div>
        <Button className="bg-green-700 hover:bg-green-800 text-white">
          + Nuevo Registro
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { tipo: 'Leche', icon: '🥛', unidad: 'Litros hoy', color: 'blue' },
          { tipo: 'Huevos', icon: '🥚', unidad: 'Unidades hoy', color: 'yellow' },
          { tipo: 'Carne', icon: '🥩', unidad: 'Kg este mes', color: 'red' },
        ].map(({ tipo, icon, unidad, color }) => (
          <Card key={tipo} className={`border-${color}-200 bg-${color}-50`}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{icon}</span>
                <div>
                  <p className={`text-sm font-medium text-${color}-700`}>{tipo}</p>
                  <p className="text-2xl font-bold text-gray-900">—</p>
                  <p className="text-xs text-gray-500">{unidad}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historial de Producción</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-5xl mb-4">📈</span>
            <p className="text-lg font-semibold text-gray-700">Sin registros de producción</p>
            <p className="text-sm text-gray-400 mt-1 mb-6">
              Registra la producción diaria para ver tendencias y estadísticas
            </p>
            <Button className="bg-green-700 hover:bg-green-800 text-white">
              Registrar Producción
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
