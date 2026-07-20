import { useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { useIsFetching, useQueryClient } from "@tanstack/react-query"
import {
  ArrowsClockwiseIcon,
  ArrowClockwiseIcon,
  BookOpenIcon,
  BooksIcon,
  CalendarBlankIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ChartPieSliceIcon,
  CreditCardIcon,
  ListIcon,
  ListBulletsIcon,
  ListChecksIcon,
  TagIcon,
  UsersThreeIcon,
  SignOutIcon,
  ChartLineIcon,
  WalletIcon,
  IdentificationCardIcon,
  UserCircleIcon,
  XCircleIcon,
  FolderIcon,
  type Icon,
} from "@phosphor-icons/react"
import {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipTrigger,
} from "@radix-ui/react-tooltip"
import { useAuth } from "@/context/auth-context"
import { useSidebar } from "@/context/ui-context"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PatientAvatar } from "@/components/patient/patient-avatar"
import { ProfileDrawer } from "@/components/profile/profile-drawer"

type NavItem = {
  to: string
  label: string
  icon: Icon
  end?: boolean
}

type NavGroup = {
  id: string
  label: string
  icon: Icon
  children: NavEntry[]
}

type NavEntry = NavItem | NavGroup

function isGroup(e: NavEntry): e is NavGroup {
  return (e as NavGroup).children !== undefined
}

const navItems: NavEntry[] = [
  { to: "/", label: "Dashboard", icon: ChartLineIcon, end: true },
  { to: "/agenda", label: "Agenda", icon: CalendarBlankIcon },
  {
    id: "financeiro",
    label: "Financeiro",
    icon: WalletIcon,
    children: [
      { to: "/financeiro", label: "Lançamentos", icon: ListBulletsIcon, end: true },
      { to: "/financeiro/dashboard", label: "Dashboard", icon: ChartPieSliceIcon },
      { to: "/financeiro/pessoas", label: "Pessoas", icon: UsersThreeIcon },
      { to: "/financeiro/cartoes", label: "Cartões", icon: CreditCardIcon },
      {
        id: "financeiro-cadastros",
        label: "Cadastros",
        icon: FolderIcon,
        children: [
          {
            to: "/financeiro/cadastros/categorias",
            label: "Categorias",
            icon: TagIcon,
          },
          {
            to: "/financeiro/cadastros/formas-de-pagamento",
            label: "Formas de pagamento",
            icon: CreditCardIcon,
          },
        ],
      },
    ],
  },
  {
    id: "leituras",
    label: "Leituras",
    icon: BookOpenIcon,
    children: [
      { to: "/leituras", label: "Track", icon: BooksIcon, end: true },
      { to: "/leituras/dashboard", label: "Dashboard", icon: ChartLineIcon },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    icon: FolderIcon,
    children: [
      { to: "/patients", label: "Pacientes", icon: UsersThreeIcon },
      { to: "/insurances", label: "Convênios", icon: IdentificationCardIcon },
      {
        to: "/discharge-reasons",
        label: "Motivos de encerramento",
        icon: XCircleIcon,
      },
      { to: "/checklist", label: "Checklist", icon: ListChecksIcon },
    ],
  },
]

/** Does this entry (or any descendant) match the current pathname? */
function entryContains(entry: NavEntry, pathname: string): boolean {
  if (isGroup(entry)) return entry.children.some((c) => entryContains(c, pathname))
  return entry.end ? pathname === entry.to : pathname.startsWith(entry.to)
}

/** All group ids, including nested — used to open every group by default. */
function allGroupIds(entries: NavEntry[]): string[] {
  const out: string[] = []
  for (const e of entries) {
    if (isGroup(e)) {
      out.push(e.id)
      out.push(...allGroupIds(e.children))
    }
  }
  return out
}

/** Top-level destinations shown in the mobile bottom tab bar. */
const bottomTabs: NavItem[] = [
  { to: "/", label: "Início", icon: ChartLineIcon, end: true },
  { to: "/agenda", label: "Agenda", icon: CalendarBlankIcon },
  { to: "/patients", label: "Pacientes", icon: UsersThreeIcon },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { mobileNavOpen, setMobileNavOpen } = useSidebar()
  const [profileOpen, setProfileOpen] = useState(false)

  const displayName = user?.displayName ?? user?.username ?? "admin"
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="app-bg min-h-screen text-foreground">
      <div className="flex min-h-screen">
        <DesktopSidebar />

        {/* Mobile navigation drawer */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent
            side="left"
            className="w-72 max-w-[85vw] p-0 pt-safe-top pl-safe-left"
          >
            <SheetHeader className="border-b-0 px-6 pb-2 pt-6">
              <SheetTitle className="flex items-center gap-3">
                <img
                  src="/logo.svg"
                  alt="PsicoBia"
                  className="size-9 rounded-xl shadow-glow"
                />
                <span>PsicoBia</span>
              </SheetTitle>
            </SheetHeader>
            <SidebarNav
              collapsed={false}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </SheetContent>
        </Sheet>

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 pt-safe-top backdrop-blur-md sm:px-6">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              aria-label="Abrir menu"
            >
              <ListIcon weight="bold" className="size-5" />
            </button>

            <div className="flex-1" />

            <RefreshButton />

            <SystemUpdateButton />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-full p-1 pr-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {user?.avatarId != null ? (
                    <PatientAvatar
                      avatarId={user.avatarId}
                      name={displayName}
                      size="sm"
                      className="size-9"
                    />
                  ) : (
                    <Avatar className="h-9 w-9 ring-offset-0 ring-1">
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-medium leading-tight">
                      {displayName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Administrador
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                  <UserCircleIcon weight="fill" /> Meu perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    logout()
                    navigate("/login", { replace: true })
                  }}
                  className="focus:bg-destructive/15 [&_svg]:text-destructive"
                >
                  <SignOutIcon weight="fill" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 overflow-x-clip p-4 max-md:pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:p-6 lg:p-8">
            <div className="@container mx-auto w-full max-w-7xl animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <BottomTabBar onOpenMenu={() => setMobileNavOpen(true)} />
      <ProfileDrawer open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  )
}

/** Refetch all data without a full page reload. Spins while any query is fetching. */
function RefreshButton() {
  const qc = useQueryClient()
  const fetching = useIsFetching() > 0
  return (
    <button
      type="button"
      onClick={() => {
        qc.invalidateQueries()
      }}
      disabled={fetching}
      className="grid size-10 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      aria-label="Atualizar dados"
      title="Atualizar dados"
    >
      <ArrowsClockwiseIcon
        weight="bold"
        className={cn("size-5", fetching && "animate-spin")}
      />
    </button>
  )
}

/**
 * Hard reload like Ctrl+F5: clears Cache Storage + service workers, then
 * reloads from network with a cache-busting query param.
 */
function SystemUpdateButton() {
  const [busy, setBusy] = useState(false)
  const hardReload = async () => {
    setBusy(true)
    try {
      if ("caches" in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
    } catch {
      // ignore — reload regardless
    } finally {
      const url = new URL(window.location.href)
      url.searchParams.set("_", Date.now().toString())
      window.location.replace(url.toString())
    }
  }
  return (
    <button
      type="button"
      onClick={hardReload}
      disabled={busy}
      className="flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
      aria-label="Atualizar sistema"
      title="Recarrega a página inteira limpando o cache (Ctrl+F5)"
    >
      <ArrowClockwiseIcon
        weight="bold"
        className={cn("size-5", busy && "animate-spin")}
      />
      <span className="hidden sm:inline">Atualizar sistema</span>
    </button>
  )
}

function DesktopSidebar() {
  const { collapsed, toggleCollapsed } = useSidebar()
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 pl-safe-left backdrop-blur transition-[width] duration-200 md:flex",
        collapsed ? "w-[4.5rem]" : "w-64",
      )}
    >
      <div
        className={cn(
          "relative flex min-h-16 items-center gap-3 pt-safe-top",
          collapsed ? "justify-center px-2" : "px-6",
        )}
      >
        <div className="relative inline-block">
          <img
            src="/logo.svg"
            alt="PsicoBia"
            className="size-9 rounded-xl shadow-glow"
          />
          {!collapsed && (
            <span className="absolute -top-2 -right-3 rounded-full bg-secondary/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-secondary">
              beta
            </span>
          )}
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-semibold leading-tight">PsicoBia</p>
            <p className="text-xs text-muted-foreground">Admin Panel</p>
          </div>
        )}
      </div>

      <SidebarNav collapsed={collapsed} />

      <div className={cn("border-t border-sidebar-border/60", collapsed ? "p-2" : "p-3")}>
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            "flex items-center font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground",
            collapsed
              ? "mx-auto size-11 justify-center rounded-xl"
              : "w-full gap-3 rounded-lg px-3 py-2.5 text-sm",
          )}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? (
            <CaretRightIcon weight="bold" className="size-6 shrink-0" />
          ) : (
            <>
              <CaretLeftIcon weight="bold" className="size-5 shrink-0" />
              <span>Recolher</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}

function SidebarNav({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean
  onNavigate?: () => void
}) {
  const location = useLocation()
  // Groups start expanded so every destination is visible on first paint.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {}
    for (const id of allGroupIds(navItems)) o[id] = true
    return o
  })
  const toggle = (id: string) =>
    setOpenGroups((s) => ({ ...s, [id]: !(s[id] ?? true) }))

  return (
    <nav
      className={cn(
        "flex-1 overflow-y-auto py-4",
        collapsed ? "space-y-2 px-2" : "space-y-1 px-3",
      )}
    >
      {navItems.map((entry) => {
        if (collapsed) {
          return isGroup(entry) ? (
            <CollapsedGroup
              key={entry.id}
              group={entry}
              onNavigate={onNavigate}
            />
          ) : (
            <SidebarLink
              key={entry.to}
              item={entry}
              collapsed
              onNavigate={onNavigate}
            />
          )
        }
        return (
          <ExpandedEntry
            key={isGroup(entry) ? entry.id : entry.to}
            entry={entry}
            depth={0}
            pathname={location.pathname}
            openGroups={openGroups}
            toggle={toggle}
            onNavigate={onNavigate}
          />
        )
      })}
    </nav>
  )
}

/** Expanded-sidebar entry, recursive so groups can nest (Financeiro › Cadastros). */
function ExpandedEntry({
  entry,
  depth,
  pathname,
  openGroups,
  toggle,
  onNavigate,
}: {
  entry: NavEntry
  depth: number
  pathname: string
  openGroups: Record<string, boolean>
  toggle: (id: string) => void
  onNavigate?: () => void
}) {
  if (!isGroup(entry)) {
    return (
      <SidebarLink
        item={entry}
        compact={depth > 0}
        collapsed={false}
        onNavigate={onNavigate}
      />
    )
  }

  const open = openGroups[entry.id] ?? true
  const Icon = entry.icon
  const active = entry.children.some((c) => entryContains(c, pathname))

  return (
    <div>
      <button
        type="button"
        onClick={() => toggle(entry.id)}
        className={cn(
          "group relative flex w-full items-center gap-3 rounded-lg px-3 font-medium transition-all",
          depth > 0 ? "py-2 text-sm" : "py-2.5 text-sm",
          active
            ? "text-foreground"
            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
        )}
      >
        <Icon
          weight="fill"
          className={cn(
            "shrink-0",
            depth > 0 ? "size-4" : "size-5",
            active ? "text-primary" : "text-muted-foreground",
          )}
        />
        <span className="flex-1 text-left">{entry.label}</span>
        <CaretDownIcon
          weight="bold"
          className={cn(
            "size-3.5 transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>
      {open && (
        <div className="ml-3 mt-1 space-y-1 border-l border-border/60 pl-2">
          {entry.children.map((c) => (
            <ExpandedEntry
              key={isGroup(c) ? c.id : c.to}
              entry={c}
              depth={depth + 1}
              pathname={pathname}
              openGroups={openGroups}
              toggle={toggle}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** Collapsed-sidebar group: icon button opening a flyout popover with children. */
function CollapsedGroup({
  group,
  onNavigate,
}: {
  group: NavGroup
  onNavigate?: () => void
}) {
  const location = useLocation()
  const Icon = group.icon
  const groupActive = group.children.some((c) =>
    entryContains(c, location.pathname),
  )
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "mx-auto flex size-11 items-center justify-center rounded-xl transition-all",
            groupActive
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
          )}
          aria-label={group.label}
        >
          <Icon
            weight="fill"
            className={cn(
              "size-6 shrink-0",
              groupActive ? "text-primary" : "text-muted-foreground",
            )}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-60 p-1.5">
        <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
          {group.label}
        </p>
        {group.children.map((c) =>
          isGroup(c) ? (
            <div key={c.id} className="mt-1">
              <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
                {c.label}
              </p>
              {c.children.map(
                (cc) =>
                  !isGroup(cc) && (
                    <SidebarLink
                      key={cc.to}
                      item={cc}
                      compact
                      collapsed={false}
                      onNavigate={onNavigate}
                    />
                  ),
              )}
            </div>
          ) : (
            <SidebarLink
              key={c.to}
              item={c}
              compact
              collapsed={false}
              onNavigate={onNavigate}
            />
          ),
        )}
      </PopoverContent>
    </Popover>
  )
}

function SidebarLink({
  item,
  compact = false,
  collapsed = false,
  onNavigate,
}: {
  item: NavItem
  compact?: boolean
  collapsed?: boolean
  onNavigate?: () => void
}) {
  const Icon = item.icon
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      aria-label={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center font-medium transition-all",
          collapsed
            ? "mx-auto size-11 justify-center rounded-xl"
            : cn(
                "gap-3 rounded-lg px-3 text-sm",
                compact ? "py-2" : "py-2.5",
              ),
          isActive
            ? "bg-primary/15 text-foreground"
            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          {!collapsed && (
            <span
              className={cn(
                "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
                isActive ? "opacity-100" : "opacity-0",
              )}
            />
          )}
          <Icon
            weight="fill"
            className={cn(
              "shrink-0 transition-colors",
              collapsed ? "size-6" : compact ? "size-4" : "size-5",
              isActive
                ? "text-primary"
                : "text-muted-foreground group-hover:text-primary",
            )}
          />
          {!collapsed && <span>{item.label}</span>}
        </>
      )}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          side="right"
          sideOffset={8}
          className="z-50 rounded-md border border-border/70 bg-popover/95 px-2.5 py-1.5 text-xs font-medium text-popover-foreground shadow-xl backdrop-blur data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
        >
          {item.label}
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  )
}

function BottomTabBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border/60 bg-background/85 pb-safe-bottom backdrop-blur-md md:hidden">
      {bottomTabs.map((tab) => {
        const Icon = tab.icon
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[0.65rem] font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )
            }
          >
            <Icon weight="fill" className="size-5" />
            <span>{tab.label}</span>
          </NavLink>
        )
      })}
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[0.65rem] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ListIcon weight="bold" className="size-5" />
        <span>Menu</span>
      </button>
    </nav>
  )
}
