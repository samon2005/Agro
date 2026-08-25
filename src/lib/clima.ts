export type ClimaActual = {
  temperatura: number
  humedad: number
  hora: string
}

export async function getClimaActual(lat: number, lon: number): Promise<ClimaActual | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m&timezone=auto`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!data.current) return null
    return {
      temperatura: data.current.temperature_2m,
      humedad: data.current.relative_humidity_2m,
      hora: data.current.time,
    }
  } catch {
    return null
  }
}

export async function geocodeMunicipio(municipio: string, departamento: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const query = encodeURIComponent(`${municipio}, ${departamento}, Colombia`)
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${query}&count=1&language=es&format=json`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const first = data.results?.[0]
    if (!first) return null
    return { lat: first.latitude, lon: first.longitude }
  } catch {
    return null
  }
}

export function recomendacionesAmbientales(params: {
  tempInterior: number | null
  tempExterior: number | null
  humedadInterior: number | null
  nh3: number | null
  co2: number | null
  climaExterior: ClimaActual | null
}): string[] {
  const { tempInterior, humedadInterior, nh3, co2, climaExterior } = params
  const recomendaciones: string[] = []
  const tempExt = climaExterior?.temperatura ?? params.tempExterior

  if (tempInterior != null && tempInterior > 30) {
    if (tempExt != null && tempExt > 28) {
      recomendaciones.push(`🌡️ Temperatura interior alta (${tempInterior}°C) y el ambiente exterior también está caluroso (${tempExt}°C) — aumenta la ventilación y considera nebulización para bajar la sensación térmica.`)
    } else {
      recomendaciones.push(`🌡️ Temperatura interior alta (${tempInterior}°C) aunque el exterior está más fresco (${tempExt ?? '—'}°C) — abre cortinas y mejora la circulación de aire para aprovechar el ambiente exterior.`)
    }
  } else if (tempInterior != null && tempExt != null && tempExt < 15 && tempInterior < 18) {
    recomendaciones.push(`❄️ Ambiente exterior frío (${tempExt}°C) y temperatura interior baja (${tempInterior}°C) — revisa cortinas y calefacción para evitar estrés por frío.`)
  }

  if (humedadInterior != null && humedadInterior > 85) {
    recomendaciones.push(`💧 Humedad interior muy alta (${humedadInterior}%) — mejora la ventilación para reducir el riesgo de enfermedades respiratorias y cama húmeda.`)
  } else if (humedadInterior != null && humedadInterior < 40) {
    recomendaciones.push(`💧 Humedad interior baja (${humedadInterior}%) — considera nebulización ligera, el ambiente muy seco favorece el polvo y problemas respiratorios.`)
  }

  if (nh3 != null && nh3 > 25) {
    recomendaciones.push(`🌬️ Amoníaco elevado (${nh3} ppm) — aumenta la ventilación y revisa el manejo de la cama; niveles altos afectan las vías respiratorias.`)
  }

  if (co2 != null && co2 > 3000) {
    recomendaciones.push(`🌬️ CO₂ elevado (${co2} ppm) — mejora el recambio de aire del galpón.`)
  }

  if (recomendaciones.length === 0) {
    recomendaciones.push('✅ Las condiciones ambientales registradas están dentro de rangos normales.')
  }

  return recomendaciones
}
