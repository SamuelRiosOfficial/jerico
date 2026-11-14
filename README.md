# JERICO — Camino a Jericó

Juego bíblico multijugador local para 1–4 participantes, desarrollado con React + Vite.

## Probar la versión publicada
El despliegue se realiza automáticamente con GitHub Actions y GitHub Pages después de superar las pruebas.

## Ejecutar localmente
```bash
npm install
npm run dev
``

## Validar y compilar
```bash
npm test
npm run build
npm run preview
``

## Reglas del juego
- Cinco escenarios con seis pasos cada uno: 30 pasos totales.
- De 1 a 4 jugadores; nombres de hasta 12 caracteres y personajes únicos.
- Los cuatro personajes tienen las mismas condiciones de juego.
- Dificultad elegida antes de cada turno: Fácil (+1), Medio (+2), Difícil (+3).
- Una respuesta incorrecta no permite avanzar.
- Banco bíblico aprobado de 120 preguntas: 40 por dificultad.
- Preguntas aleatorias y opciones mezcladas, manteniendo la respuesta correcta.
- El grupo de preguntas de cada dificultad es compartido por todos los jugadores y se renueva al agotarse.
- El primer jugador que alcanza 30 pasos gana inmediatamente y la partida termina para todos.
- Secuencia de victoria: cinco fotogramas del derrumbe de las murallas, efecto de temblor, lectura de Josué 6:1–5 y felicitación al ganador.

## Pruebas automáticas
La suite `node --test` valida el banco, la estructura de preguntas, la no repetición hasta agotar cada dificultad, la aleatorización de opciones, la puntuación, la victoria y la agrupación de escenarios.

## Recursos visuales
Los fondos de los cinco escenarios, la ilustración de portada, los sprites de personajes y los cinco fotogramas del derrumbe están en `public/assets/`.
