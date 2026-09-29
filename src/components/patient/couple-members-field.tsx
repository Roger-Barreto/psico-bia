import { useState } from "react"
import { nanoid } from "nanoid"
import {
  LinkBreakIcon,
  LinkSimpleIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "@phosphor-icons/react"
import type { CoupleMember, Gender, Patient } from "@/db/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CopyButton } from "@/components/ui/copy-button"
import { DatePicker } from "@/components/ui/date-picker"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { AvatarPicker } from "./avatar-picker"
import { PatientAvatar, genderLabel } from "./patient-avatar"
import { PatientCombobox } from "./patient-combobox"
import { ageLabel, birthdateError } from "@/domain/age"
import {
  MAX_COUPLE_MEMBERS,
  MIN_COUPLE_MEMBERS,
  linkedIndividual,
} from "@/domain/couples"
import { todayISO } from "@/domain/dates"
import { formatCpf, isValidCpf, onlyDigits } from "@/lib/cpf"
import { randomMonsterAvatarId } from "@/lib/monster-avatars"

/** Pessoa do casal enquanto está sendo editada (campos como o usuário vê). */
export interface MemberDraft {
  id: string
  name: string
  gender: Gender | null
  birthdate: string // "" = não informado
  cpf: string // formatado ("000.000.000-00") ou ""
  avatarId: number
  patientId: string | null
}

export function newMemberDraft(partial: Partial<MemberDraft> = {}): MemberDraft {
  return {
    id: `m_${nanoid(8)}`,
    name: "",
    gender: null,
    birthdate: "",
    cpf: "",
    avatarId: randomMonsterAvatarId(),
    patientId: null,
    ...partial,
  }
}

export function draftsFromMembers(members: CoupleMember[]): MemberDraft[] {
  return members.map((m) => ({
    id: m.id,
    name: m.name,
    gender: m.gender,
    birthdate: m.birthdate ?? "",
    cpf: formatCpf(m.cpf ?? ""),
    avatarId: m.avatarId,
    patientId: m.patientId,
  }))
}

/**
 * O que é gravado. Pessoa ligada a um cadastro individual guarda uma CÓPIA
 * dos dados dele (atualizada a cada salvamento): se o cadastro individual
 * for apagado, o casal continua sabendo quem ela é.
 */
export function draftsToMembers(
  drafts: MemberDraft[],
  patientsById: Map<string, Patient>,
): CoupleMember[] {
  return drafts.map((d) => {
    const linked = linkedIndividual(d.patientId, patientsById)
    if (linked) {
      return {
        id: d.id,
        name: linked.name.trim(),
        gender: linked.gender,
        // `patients.birthdate` não tem CHECK de formato (linhas antigas vieram
        // do JSON como estavam); o casal tem. Formato estranho vira "sem data".
        birthdate: ISO_DATE.test(linked.birthdate ?? "") ? linked.birthdate : null,
        cpf: linked.cpf,
        avatarId: linked.avatarId,
        patientId: linked.id,
      }
    }
    return {
      id: d.id,
      name: d.name.trim(),
      gender: d.gender,
      birthdate: d.birthdate || null,
      cpf: onlyDigits(d.cpf) || null,
      avatarId: d.avatarId,
      // Vínculo que não achamos na lista (ainda carregando, ou o cadastro
      // virou casal) é mantido: quem desfaz vínculo de paciente apagado é o
      // banco. Os dados gravados continuam sendo a cópia.
      patientId: d.patientId,
    }
  })
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Nome efetivo (o do cadastro ligado, quando há). */
export function draftName(d: MemberDraft, patientsById: Map<string, Patient>): string {
  const linked = linkedIndividual(d.patientId, patientsById)
  return linked ? linked.name : d.name
}

/** Primeiro erro das pessoas do casal, ou `null`. */
export function membersError(
  drafts: MemberDraft[],
  patientsById: Map<string, Patient>,
): string | null {
  if (drafts.length < MIN_COUPLE_MEMBERS)
    return `O casal precisa de ao menos ${MIN_COUPLE_MEMBERS} pessoas`
  const linkedIds = new Set<string>()
  for (let i = 0; i < drafts.length; i++) {
    const d = drafts[i]
    const who = `Pessoa ${i + 1}`
    const linked = linkedIndividual(d.patientId, patientsById)
    if (linked) {
      if (linkedIds.has(linked.id))
        return "O mesmo paciente foi vinculado duas vezes"
      linkedIds.add(linked.id)
      continue
    }
    if (!d.name.trim()) return `${who}: informe o nome`
    const cpf = onlyDigits(d.cpf)
    if (cpf && !isValidCpf(cpf)) return `${who}: CPF inválido`
    const bd = birthdateError(d.birthdate, todayISO())
    if (bd) return `${who}: ${bd.toLowerCase()}`
  }
  return null
}

interface Props {
  drafts: MemberDraft[]
  onChange: (next: MemberDraft[]) => void
  /** Pacientes individuais que podem ser vinculados. */
  linkable: Patient[]
  patientsById: Map<string, Patient>
  /** Destaca nomes vazios depois da 1ª tentativa de salvar. */
  submitted: boolean
}

/**
 * As pessoas do casal, cada uma num cartão. Duas por padrão; dá para
 * acrescentar até quatro (há quem atenda trisais) e tirar até sobrarem duas.
 */
export function CoupleMembersField({
  drafts,
  onChange,
  linkable,
  patientsById,
  submitted,
}: Props) {
  function update(id: string, patch: Partial<MemberDraft>) {
    onChange(drafts.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  return (
    <div className="space-y-3">
      {drafts.map((d, i) => (
        <MemberCard
          key={d.id}
          index={i}
          draft={d}
          onChange={(patch) => update(d.id, patch)}
          onRemove={
            drafts.length > MIN_COUPLE_MEMBERS
              ? () => onChange(drafts.filter((x) => x.id !== d.id))
              : undefined
          }
          // Quem já está vinculado em outro cartão não aparece de novo.
          linkable={linkable.filter(
            (p) =>
              p.id === d.patientId ||
              !drafts.some((x) => x.id !== d.id && x.patientId === p.id),
          )}
          patientsById={patientsById}
          submitted={submitted}
        />
      ))}

      {drafts.length < MAX_COUPLE_MEMBERS && (
        <button
          type="button"
          onClick={() => onChange([...drafts, newMemberDraft()])}
          className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/70 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          <PlusIcon weight="bold" className="size-3.5" />
          Adicionar pessoa
        </button>
      )}
    </div>
  )
}

function MemberCard({
  index,
  draft: d,
  onChange,
  onRemove,
  linkable,
  patientsById,
  submitted,
}: {
  index: number
  draft: MemberDraft
  onChange: (patch: Partial<MemberDraft>) => void
  onRemove?: () => void
  linkable: Patient[]
  patientsById: Map<string, Patient>
  submitted: boolean
}) {
  const [linking, setLinking] = useState(false)
  const linked = linkedIndividual(d.patientId, patientsById)
  const nameId = `member-${d.id}-name`
  const cpfId = `member-${d.id}-cpf`
  const bdId = `member-${d.id}-birthdate`

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="flex items-center gap-3">
        {linked ? (
          <PatientAvatar avatarId={linked.avatarId} name={linked.name} size="md" />
        ) : (
          <AvatarPicker
            value={d.avatarId}
            onChange={(avatarId) => onChange({ avatarId })}
            name={d.name}
            size="md"
          />
        )}
        <p className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Pessoa {index + 1}
        </p>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remover pessoa ${index + 1}`}
            className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          >
            <TrashIcon weight="fill" className="size-4" />
          </button>
        )}
      </div>

      {linked ? (
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium">{linked.name}</p>
            <p className="text-xs text-muted-foreground">
              {[ageLabel(linked.birthdate), genderLabel(linked.gender)]
                .filter(Boolean)
                .join(" · ")}
              {linked.cpf ? ` · CPF ${formatCpf(linked.cpf)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 text-foreground/90">
              <LinkSimpleIcon weight="bold" className="size-3.5 text-primary" />
              Vínculo com o cadastro individual
            </span>
            <button
              type="button"
              onClick={() =>
                // Desvincular mantém os dados visíveis para edição local.
                onChange({
                  patientId: null,
                  name: linked.name,
                  gender: linked.gender,
                  birthdate: linked.birthdate ?? "",
                  cpf: formatCpf(linked.cpf ?? ""),
                  avatarId: linked.avatarId,
                })
              }
              className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            >
              <LinkBreakIcon weight="bold" className="size-3.5" />
              Desvincular
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Os dados desta pessoa vêm do cadastro individual dela — edite por lá.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={nameId}>Nome</Label>
            <Input
              id={nameId}
              value={d.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Nome completo"
              aria-invalid={submitted && !d.name.trim()}
            />
            {submitted && !d.name.trim() && (
              <p className="text-xs text-rose-300">Informe o nome.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>
              Gênero{" "}
              <span className="font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <RadioGroup
              value={d.gender ?? ""}
              onValueChange={(v) => onChange({ gender: v as Gender })}
              className="flex flex-wrap gap-x-4 gap-y-2"
            >
              {(["female", "male", "other"] as Gender[]).map((g) => (
                <label
                  key={g}
                  className="flex min-h-9 cursor-pointer items-center gap-2 text-sm"
                >
                  <RadioGroupItem value={g} />
                  {g === "female" ? "F" : g === "male" ? "M" : "Outro"}
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={bdId}>
                Nascimento{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <DatePicker
                id={bdId}
                value={d.birthdate}
                onChange={(birthdate) => onChange({ birthdate })}
                max={todayISO()}
                clearable
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={cpfId}>
                CPF{" "}
                <span className="font-normal text-muted-foreground">(opcional)</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id={cpfId}
                  inputMode="numeric"
                  value={d.cpf}
                  onChange={(e) => onChange({ cpf: formatCpf(e.target.value) })}
                  placeholder="000.000.000-00"
                />
                <CopyButton
                  variant="boxed"
                  value={d.cpf}
                  label={`CPF de ${d.name || `pessoa ${index + 1}`}`}
                  disabled={!d.cpf}
                />
              </div>
            </div>
          </div>

          {linkable.length > 0 &&
            (linking ? (
              <div className="space-y-2 rounded-lg border border-border/60 p-2">
                <div className="flex items-center justify-between gap-2 px-1">
                  <p className="text-xs text-muted-foreground">
                    Escolha o cadastro individual desta pessoa
                  </p>
                  <button
                    type="button"
                    onClick={() => setLinking(false)}
                    aria-label="Cancelar vínculo"
                    className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted/40"
                  >
                    <XIcon weight="bold" className="size-4" />
                  </button>
                </div>
                <PatientCombobox
                  patients={linkable}
                  value=""
                  onChange={(patientId) => {
                    if (!patientId) return
                    onChange({ patientId })
                    setLinking(false)
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLinking(true)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-1 text-xs font-medium text-primary hover:underline"
              >
                <LinkSimpleIcon weight="bold" className="size-3.5" />
                Também é paciente individual? Vincular ao cadastro
              </button>
            ))}
        </>
      )}
    </div>
  )
}
