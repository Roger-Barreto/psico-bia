# Design System

## Tema (tokens CSS) — `src/index.css`

Tema **escuro único** (não há toggle claro/escuro; `:root` e `.dark` recebem os mesmos tokens).
Cores em HSL via custom properties:

| Token | Valor | Uso |
|---|---|---|
| `--background` | `231 42% 10%` | Fundo navy profundo. |
| `--foreground` | `14 80% 95%` | Texto principal (quase branco rosado). |
| `--card` / `--popover` | navy mais claro | Superfícies. |
| `--primary` | `353 78% 74%` | **Rosa** — cor de marca/ação. |
| `--secondary` | `46 100% 85%` | **Amarelo** — destaque/reagendar. |
| `--accent` | `14 95% 91%` | Rosa suave. |
| `--muted` / `--muted-foreground` | — | Elementos secundários. |
| `--destructive` | `0 72% 60%` | Vermelho (perigo/pendência). |
| `--border` / `--input` / `--ring` | — | Bordas e foco (ring = primary). |
| `--radius` | `0.85rem` | Raio base. |
| `--sidebar*` | navy escuro | Sidebar. |

Extras de `index.css`:
- `.app-bg` — gradientes radiais rosa/amarelo sutis sobre o fundo.
- Inversão dos indicadores nativos de date/time picker (visíveis no escuro).
- Estilo de seleção de texto e scrollbar customizada.
- `font-feature-settings` (Inter com variantes estilísticas).

## Tailwind — `tailwind.config.js`

- `darkMode: ["class"]`; conteúdo varre `index.html` + `src/**/*.{ts,tsx}`.
- Cores mapeadas para os tokens HSL (`hsl(var(--…))`).
- Fonte `sans`: Inter + fallbacks de sistema.
- `borderRadius` lg/md/sm derivados de `--radius`.
- Keyframes/animações: `accordion-down/up`, `fade-in`, `shimmer` (brilho em loop que varre o
  card de aniversariantes).
- `boxShadow.glow` — sombra rosada para realces.
- Plugin `tailwindcss-animate`.

Cores **fora do tema** usadas pontualmente: `emerald` (pago/atendido), `amber` (não pago),
`destructive` (pendência) — aplicadas direto via classes utilitárias para semântica de status.

## Componentes primitivos — `src/components/ui/`

Estilo shadcn/ui sobre **Radix UI**, com variantes via `class-variance-authority`:

| Primitivo | Base |
|---|---|
| `button` | CVA (variantes: default, outline, secondary, ghost, destructive; tamanhos). |
| `dialog` | Radix Dialog (modal). |
| `sheet` | Radix Dialog (drawer lateral). |
| `dropdown-menu` | Radix DropdownMenu. |
| `popover` | Radix Popover. |
| `select` | Radix Select. |
| `checkbox` | Radix Checkbox. |
| `radio-group` | Radix RadioGroup. |
| `avatar` | Radix Avatar (com fallback de iniciais). |
| `separator` | Radix Separator. |
| `label` | Radix Label. |
| `card`, `input`, `skeleton` | wrappers estilizados. |
| `calendar` | react-day-picker (com caption dropdown e range). |
| `date-picker` | popover + calendar (props: `value`, `onChange`, `min`, `max`, `clearable`). |
| `time-picker` | seletor de `HH:MM` em **grades de toque** (hora 6×4, minuto 6×2) — sem lista rolável, ver [nota iPad](#seletores-em-modais-ipadwebkit). |
| `copy-button` | botão de copiar para a área de transferência (`inline` para listas, `boxed` na altura do `Input`); usa `lib/clipboard.ts` com fallback `execCommand`. |
| `confirm-dialog` | host imperativo (ver [componentes](componentes.md#confirmação-imperativa)). |

### Seletores em modais (iPad/WebKit)

Todo navegador no iPadOS roda sobre WebKit (Safari, Chrome, **Opera**). Uma
região com scroll próprio dentro de um popover `position: fixed` portalado
para dentro de um modal travado pelo `react-remove-scroll` **congela** nesses
navegadores: o `Popover` do Radix é `modal={false}` por padrão e portanto não
registra trava própria, então quem arbitra o `touchmove` continua sendo a trava
do `Dialog`/`Sheet` — que resolve "quem rola" subindo a árvore a partir do alvo
e se perde ao cruzar o `position: fixed` cujo bloco contêiner é o modal
(`transform` + `backdrop-filter`).

Regra: **popover dentro de modal não pode depender de scroll interno.** O
`TimePicker` cabe inteiro na tela (grades) e usa `portalToBody`; o `DatePicker`
(calendário) já era assim. `Select` e `DropdownMenu` do Radix são seguros —
esses embrulham o próprio conteúdo em `RemoveScroll` e assumem a trava.

## Ícones

`@phosphor-icons/react`, importados **nominalmente** (tree-shaking), quase sempre com `weight="fill"`.

## Gráficos

`recharts` — barras (faturamento/dia, top pacientes, faturamento mensal), pizza (`CategoryPie` para
status/gênero/convênio/motivo) e `RadialBarChart` (medidor financeiro).

## Microinterações

- **framer-motion:** transição de mês no dashboard (slide direcional, opacidade).
- **canvas-confetti** (`lib/celebrate.ts`): confete "happy" (verde/amarelo/roxo/azul, emojis 🎉✨💚🌟🥳)
  ao atender/pagar; "sad" (cinza, 💔😔🌧️💧) ao faltar/reagendar; `celebrateBirthday()`
  (rosa/dourado, 🎂🎈🎁🎉✨) ao abrir a agenda num dia com aniversariante; `celebrateBook()` ao
  concluir um livro.
- **sonner:** toasts com tema dark, `richColors`, cantos arredondados.
- Animação `fade-in` no conteúdo principal.

## Avatares

56 imagens `public/monster-avatars/<1..56>.png`. Há também um gerador de retrato pixel-art em
`scripts/gen_portrait.py` (Pillow) que produz `public/sprites/portrait_64.png` — utilitário isolado,
não usado em runtime.
