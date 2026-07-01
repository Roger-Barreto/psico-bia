import { Outlet } from "react-router-dom"
import { ReadingTimerProvider } from "@/context/reading-timer"
import { ReadingTimerPill } from "@/components/reading/reading-timer-pill"

/**
 * Shell de todas as páginas /leituras/*. Provê o cronômetro de leitura (com
 * persistência em localStorage) e renderiza a pílula flutuante quando ativo.
 */
export function ReadingLayout() {
  return (
    <ReadingTimerProvider>
      <Outlet />
      <ReadingTimerPill />
    </ReadingTimerProvider>
  )
}
