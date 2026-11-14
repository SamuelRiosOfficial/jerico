# JERICO — Camino a Jericó

Juego bíblico multijugador local para 1–4 participantes, desarrollado con React + Vite.

## Ejecutar localmente
```bash
npm install
npm run dev
``

## Compilar
```bash
npm run build
npm run preview
``

## Reglas implementadas
- Cinco escenarios de seis pasos cada uno: 30 pasos totales.
- 1 a 4 jugadores, nombres de hasta 12 caracteres y cuatro personajes únicos.
- Dificultad elegida antes de cada turno: Fácil (+1), Medio (+2), Difícil (+3).
- Respuesta incorrecta: no avanza.
- Preguntas aleatorias por dificultad, sin repetir hasta agotar el banco compartido de la partida.
- El primer jugador que alcanza Jericó gana inmediatamente y termina la partida.
- Secuencia de victoria: derrumbe de murallas, lectura de Josué 6:1–5 y felicitación al ganador.

## Estado del desarrollo
Primera versión funcional del flujo principal. Los recursos artísticos aprobados y el banco completo de 120 preguntas se integrarán en los siguientes commits de producción. El juego utiliza recursos gráficos CSS provisionales cuando aún no hay un archivo de arte integrado.
