import {
  AirplaneTiltIcon,
  BabyIcon,
  BarbellIcon,
  BookOpenIcon,
  BriefcaseIcon,
  CalendarDotsIcon,
  CarIcon,
  CoffeeIcon,
  ConfettiIcon,
  FirstAidKitIcon,
  ForkKnifeIcon,
  GraduationCapIcon,
  HeartbeatIcon,
  HouseIcon,
  MusicNotesIcon,
  PawPrintIcon,
  PersonSimpleRunIcon,
  PersonSimpleTaiChiIcon,
  ScissorsIcon,
  ShoppingCartIcon,
  StarIcon,
  StethoscopeIcon,
  ToothIcon,
  UserIcon,
  UsersThreeIcon,
  WrenchIcon,
  type Icon,
} from "@phosphor-icons/react"
import type { AgendaCategory } from "@/db/types"

/**
 * Ícones que uma categoria de compromisso pode ter. A chave é o que vai para
 * o banco (`agenda_categories.icon`) — não renomeie sem migrar os dados.
 * A ordem é a do seletor.
 */
export const EVENT_ICONS: { key: string; label: string; icon: Icon }[] = [
  { key: "calendar", label: "Geral", icon: CalendarDotsIcon },
  { key: "stethoscope", label: "Consulta", icon: StethoscopeIcon },
  { key: "heartbeat", label: "Saúde", icon: HeartbeatIcon },
  { key: "tooth", label: "Dentista", icon: ToothIcon },
  { key: "first-aid", label: "Exames", icon: FirstAidKitIcon },
  { key: "barbell", label: "Academia", icon: BarbellIcon },
  { key: "tai-chi", label: "Pilates / ioga", icon: PersonSimpleTaiChiIcon },
  { key: "run", label: "Corrida", icon: PersonSimpleRunIcon },
  { key: "user", label: "Pessoal", icon: UserIcon },
  { key: "house", label: "Casa / família", icon: HouseIcon },
  { key: "users", label: "Pessoas", icon: UsersThreeIcon },
  { key: "baby", label: "Filhos", icon: BabyIcon },
  { key: "paw", label: "Pet", icon: PawPrintIcon },
  { key: "graduation-cap", label: "Estudo", icon: GraduationCapIcon },
  { key: "book", label: "Leitura", icon: BookOpenIcon },
  { key: "briefcase", label: "Trabalho", icon: BriefcaseIcon },
  { key: "coffee", label: "Café / pausa", icon: CoffeeIcon },
  { key: "fork-knife", label: "Refeição", icon: ForkKnifeIcon },
  { key: "confetti", label: "Lazer / festa", icon: ConfettiIcon },
  { key: "music", label: "Música", icon: MusicNotesIcon },
  { key: "airplane", label: "Viagem", icon: AirplaneTiltIcon },
  { key: "car", label: "Carro", icon: CarIcon },
  { key: "cart", label: "Compras", icon: ShoppingCartIcon },
  { key: "scissors", label: "Beleza", icon: ScissorsIcon },
  { key: "wrench", label: "Manutenção", icon: WrenchIcon },
  { key: "star", label: "Importante", icon: StarIcon },
]

const ICON_BY_KEY = new Map(EVENT_ICONS.map((i) => [i.key, i.icon] as const))

/** Ícone de uma categoria; chave desconhecida cai no calendário. */
export function eventIcon(key?: string | null): Icon {
  return (key && ICON_BY_KEY.get(key)) || CalendarDotsIcon
}

/**
 * Cores oferecidas para categorias. Começa pelas frias de propósito: rosa,
 * âmbar, verde e vermelho já significam algo nos cartões de atendimento
 * (a atender, não pago, concluído, pendência).
 */
export const EVENT_COLORS = [
  "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e", "#f97316", "#eab308",
  "#84cc16", "#22c55e", "#64748b", "#94a3b8",
] as const

/** Compromisso sem categoria (ou com a categoria apagada). */
export const NEUTRAL_EVENT_COLOR = "#94a3b8"

export function eventColor(category?: AgendaCategory | null): string {
  return category?.color ?? NEUTRAL_EVENT_COLOR
}

function channels(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const n = parseInt(m ? m[1] : "94a3b8", 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** A cor com transparência — fundos e bordas tingidos sobre o tema escuro. */
export function tint(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * A cor puxada para o branco, para texto sobre fundo escuro: os tons 500/600
 * da paleta sozinhos ficam com pouco contraste em letra pequena. Feito em JS
 * (e não com `color-mix`) para funcionar nos iPads mais antigos.
 */
export function lighten(hex: string, amount = 0.45): string {
  const [r, g, b] = channels(hex)
  const mix = (c: number) => Math.round(c + (255 - c) * amount)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}
