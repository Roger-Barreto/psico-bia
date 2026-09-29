# Celular — correções de uso no iPhone/iPad

Varredura de todas as telas em 375×812, com a área segura do iPhone simulada
(`--safe-top: 59px`, `--safe-bottom: 34px`). Motivada por dois relatos: o motivo de
encerramento que "não deixava selecionar" e um **X que não dava para clicar**.

## 1. O X de fechar

**Causa.** O app instalado como PWA usa `viewport-fit=cover` +
`apple-mobile-web-app-status-bar-style: black-translucent` — ele desenha por baixo da
barra de status, e o iOS fica com os toques dessa faixa (~47–59px num iPhone com
notch). O cabeçalho do app já respeitava a área segura; os **drawers e diálogos, não**:
o X ficava em `top: 16px`, inteiro dentro da faixa. No iPad a barra tem ~24px e cobria
metade do botão.

Dois agravantes:

- o X era `absolute` dentro da área rolável — rolou o drawer, o X foi embora junto; num
  atendimento comprido era preciso voltar ao topo para fechar;
- o alvo tinha 32px.

**Correção** ([`sheet.tsx`](../../src/components/ui/sheet.tsx),
[`dialog.tsx`](../../src/components/ui/dialog.tsx)):

- drawers reservam a área da barra de status com uma faixa opaca no topo; diálogos são
  centralizados **na área segura** e limitados a ela em altura;
- o X fica numa âncora `sticky`: acompanha a rolagem e está sempre à mão;
- alvo de 40px, com fundo próprio (ele passa por cima do conteúdo ao rolar);
- o X continua **por último no DOM** e sobe para o topo com `order-first` — assim o foco
  inicial segue indo para o primeiro campo, como antes. Por isso `Sheet` e `Dialog`
  passaram a ser colunas flex (`order` não existe em bloco, e `sticky` num item de grid
  fica preso à própria linha).

> **Ao criar um drawer/diálogo:** não ponha `padding-top` no `SheetContent`/
> `DialogContent`. Os navegadores não concordam sobre medir o `top` de um `sticky` a
> partir da borda do padding ou do conteúdo; sem padding as duas contas dão o mesmo
> lugar. O espaço do topo já vem da faixa (drawer) ou da âncora + `gap` (diálogo).

As áreas seguras viraram variáveis CSS (`--safe-top` etc., em
[`index.css`](../../src/index.css)) para dar para simular um iPhone no navegador do
desktop: `document.documentElement.style.setProperty('--safe-top', '59px')`.

## 2. Motivo de encerramento

Ver [`discharge-reason-field.tsx`](../../src/components/patient/discharge-reason-field.tsx).
Duas causas, a primeira confirmada nos dados de produção:

1. **Conta sem nenhum motivo cadastrado.** Só as contas migradas do JSON antigo
   trouxeram motivos; conta nova nasce sem nenhum. O menu abria **vazio**, sem aviso e
   sem caminho para criar um — e o encerramento exige motivo. A conta mais recente em
   uso estava exatamente assim.
2. **Menu flutuante dentro do drawer.** O `Select` é um `position: fixed` portalado para
   dentro de um elemento que rola e tem `backdrop-filter`. É o mesmo arranjo que já
   tinha deixado a forma de pagamento sem abrir em alguns aparelhos (commit `3ff1f57`),
   e aqui no pior caso: o campo fica no fim de um formulário comprido.

Virou um **grupo de opções na própria tela** (linhas de 44px, a linha inteira é
clicável), com criação de motivo inline e, para a conta sem motivos, sugestões de um
toque.

> O `Select` de **Convênio**, no mesmo formulário, tem a construção antiga. Não houve
> relato; se houver, o caminho é o mesmo.

## 3. Conteúdo cortado na lateral

Um grid de uma coluna sem `grid-cols-1` dimensiona a coluna pelo **conteúdo mais
largo**, e um nome comprido com `truncate` (`white-space: nowrap`) é largo. Um paciente
de nome longo no dia alargava a Agenda inteira para ~550px numa tela de 375px; como o
`main` tem `overflow-x-clip`, o que passava era cortado — as setas do calendário, as
colunas de sexta e sábado e os selos de status. Em `/patients`, os botões de editar e
arquivar.

Correção: `grid-cols-1` na base e `minmax(0,1fr)` nas colunas flexíveis de Agenda,
Pacientes, Lançamentos, Cartões, Cofrinhos, Pessoas, dashboard financeiro e lista de
pendências.

## 4. Outros

| Onde | Antes | Agora |
|---|---|---|
| Cadastro do paciente, Gênero + Nascimento | Lado a lado: o rótulo do nascimento quebrava e passava por cima do gênero | Uma coluna no celular |
| Abas do cadastro | 3 abas em linha | 4 abas (entrou *Pacotes*), ícone sobre o rótulo no celular |
| Limpar data (X do `DatePicker`) | 20px — um toque um pouco fora abria o calendário | 36px |
| Excluir anotação | 24px | 36px |
| Editar / arquivar em `/patients` | 28px | 36px |
| Diálogos | Colados nas bordas da tela | 12px de margem lateral |
| Menu lateral do celular | Navegação longa não rolava | Rola |
