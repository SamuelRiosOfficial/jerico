# JERICO — Camino a Jericó

Juego bíblico desarrollado con React + Vite.

## Juego local
El botón **Iniciar juego** conserva el modo de 1 a 4 participantes en el mismo dispositivo.

## Multijugador en línea
El botón **Jugar en línea** permite crear una sala o entrar con un código/enlace QR. Las salas admiten hasta cuatro jugadores, comparten turnos y estado en tiempo real y finalizan cuando alguien llega a 30 pasos.

### Configuración de Supabase necesaria para publicar el modo en línea
1. Crea un proyecto Supabase.
2. En Authentication > Providers, activa **Anonymous Sign-Ins**.
3. En Project Settings > API, copia la Project URL y la publishable key.
4. Ejecuta el archivo `supabase/migrations/20261116010000_jerico_multiplayer.sql` en el SQL Editor del proyecto.
5. Añade estos secretos/variables al entorno de compilación de GitHub Pages como **Actions variables**: `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`. La clave publishable está diseñada para uso de cliente; nunca agregues la clave `service_role`.
6. Para desarrollo local, copia `.env.example` a `.env.local` y completa las dos variables.

El modo local sigue funcionando sin Supabase. El modo en línea muestra un aviso si el backend aún no está configurado.

## Validar
`npm install`, `npm test`, `npm run build`.
