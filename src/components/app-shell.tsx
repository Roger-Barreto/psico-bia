import { useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import {
  CalendarBlankIcon,
  CaretDownIcon,
  ListChecksIcon,
  UsersThreeIcon,
  SignOutIcon,
  ChartLineIcon,
  IdentificationCardIcon,
  UserCircleIcon,
  XCircleIcon,
  FolderIcon,
  type Icon,
} from "@phosphor-icons/react"
import { useAuth } from "@/context/auth-context"
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
import { PatientAvatar } from "@/components/patient/patient-avatar"
import { ProfileDrawer } from "@/components/profile/profile-drawer"

type NavItem = {
  to: string
  label: string
  icon: Icon
  end?: boolean
}

type NavGroup = {
  label: string
  icon: Icon
  children: NavItem[]
}

type NavEntry = NavItem | NavGroup

function isGroup(e: NavEntry): e is NavGroup {
  return (e as NavGroup).children !== undefined
}

const navItems: NavEntry[] = [
  { to: "/", label: "Dashboard", icon: ChartLineIcon, end: true },
  { to: "/agenda", label: "Agenda", icon: CalendarBlankIcon },
  {
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

export function AppShell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)

  const displayName = user?.displayName ?? user?.username ?? "admin"
  const initials = displayName.slice(0, 2).toUpperCase()

  return (
    <div className="app-bg min-h-screen text-foreground">
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border/60 bg-background/70 px-6 backdrop-blur-md">
            <div className="flex-1" />

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

          <main className="flex-1 p-6 lg:p-8">
            <div className="mx-auto w-full max-w-7xl animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <ProfileDrawer open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  )
}

function Sidebar() {
  const location = useLocation()
  const cadastrosPaths = ["/patients", "/insurances", "/discharge-reasons", "/checklist"]
  const cadastrosActive = cadastrosPaths.some((p) =>
    location.pathname.startsWith(p),
  )
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Cadastros: cadastrosActive,
  })

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/80 backdrop-blur md:flex">
      <div className="relative flex h-16 items-center gap-3 px-6">
        <div className="relative inline-block">
          <img
            src="/logo.svg"
            alt="PsicoBia"
            className="size-9 rounded-xl shadow-glow"
          />
          <span className="absolute -top-2 -right-3 rounded-full bg-secondary/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-secondary">
            beta
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">PsicoBia</p>
          <p className="text-xs text-muted-foreground">Admin Panel</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((entry) => {
          if (!isGroup(entry)) {
            return <SidebarLink key={entry.to} item={entry} />
          }
          const open = openGroups[entry.label] ?? false
          const Icon = entry.icon
          const groupActive = entry.children.some((c) =>
            location.pathname.startsWith(c.to),
          )
          return (
            <div key={entry.label}>
              <button
                type="button"
                onClick={() =>
                  setOpenGroups((s) => ({ ...s, [entry.label]: !open }))
                }
                className={cn(
                  "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  groupActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                <Icon
                  weight="fill"
                  className={cn(
                    "size-5 shrink-0",
                    groupActive ? "text-primary" : "text-muted-foreground",
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
                    <SidebarLink key={c.to} item={c} compact />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

    </aside>
  )
}

function SidebarLink({
  item,
  compact = false,
}: {
  item: NavItem
  compact?: boolean
}) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "group relative flex items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all",
          compact ? "py-2" : "py-2.5",
          isActive
            ? "bg-primary/15 text-foreground"
            : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              "absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-opacity",
              isActive ? "opacity-100" : "opacity-0",
            )}
          />
          <Icon
            weight="fill"
            className={cn(
              "shrink-0 transition-colors",
              compact ? "size-4" : "size-5",
              isActive
                ? "text-primary"
                : "text-muted-foreground group-hover:text-primary",
            )}
          />
          <span>{item.label}</span>
        </>
      )}
    </NavLink>
  )
}
