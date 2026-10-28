import { createClient } from 'jsr:@supabase/supabase-js@2'

// Endpoint público (verify_jwt = false): quien recupera su contraseña no tiene
// sesión. La verificación real la hace recuperacion_verificar() en Postgres,
// que compara el hash bcrypt y bloquea tras 5 intentos fallidos.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  let cuerpo: Record<string, unknown>
  try {
    cuerpo = await req.json()
  } catch {
    return json({ error: 'Cuerpo JSON inválido' }, 400)
  }

  const email = typeof cuerpo.email === 'string' ? cuerpo.email.trim() : ''
  if (!email) return json({ error: 'Falta el correo.' }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  if (cuerpo.accion === 'pregunta') {
    const { data, error } = await admin.rpc('recuperacion_obtener_pregunta', { p_email: email })
    if (error) return json({ error: 'No se pudo consultar la pregunta.' }, 500)
    if (!data) return json({ error: 'Ese correo no tiene una pregunta de seguridad configurada.' }, 404)
    return json({ pregunta: data })
  }

  if (cuerpo.accion === 'restablecer') {
    const respuesta = typeof cuerpo.respuesta === 'string' ? cuerpo.respuesta : ''
    const nuevaPassword = typeof cuerpo.nuevaPassword === 'string' ? cuerpo.nuevaPassword : ''

    // Espejo de REQUISITOS_PASSWORD en el cliente. Va duplicado a propósito: la
    // validación del navegador es cosmética y este endpoint es público, así que
    // quien llame directo a la función se saltaría las reglas sin esto.
    const faltantes = [
      nuevaPassword.length >= 8 ? '' : 'al menos 8 caracteres',
      /\p{Lu}/u.test(nuevaPassword) ? '' : 'una letra mayúscula',
      /\p{Ll}/u.test(nuevaPassword) ? '' : 'una letra minúscula',
      /\p{N}/u.test(nuevaPassword) ? '' : 'un número',
      /[^\p{L}\p{N}\s]/u.test(nuevaPassword) ? '' : 'un símbolo',
    ].filter(Boolean)

    if (faltantes.length > 0) {
      return json({ error: `A la contraseña le falta: ${faltantes.join(', ')}.` }, 400)
    }

    const { data, error } = await admin.rpc('recuperacion_verificar', {
      p_email: email,
      p_respuesta: respuesta,
    })
    if (error) return json({ error: 'No se pudo verificar la respuesta.' }, 500)

    const estado = data?.estado
    if (estado === 'sin_pregunta') {
      return json({ error: 'Ese correo no tiene una pregunta de seguridad configurada.' }, 404)
    }
    if (estado === 'bloqueado') {
      return json({ error: 'Demasiados intentos fallidos. Espera 15 minutos e intenta de nuevo.' }, 429)
    }
    if (estado !== 'ok') {
      const restantes = data?.intentos_restantes ?? 0
      return json({ error: `Respuesta incorrecta. Te ${restantes === 1 ? 'queda' : 'quedan'} ${restantes} intento(s).` }, 401)
    }

    const { error: errorActualizar } = await admin.auth.admin.updateUserById(data.usuario_id, {
      password: nuevaPassword,
    })
    if (errorActualizar) return json({ error: errorActualizar.message }, 400)

    return json({ ok: true })
  }

  return json({ error: 'Acción no reconocida.' }, 400)
})
