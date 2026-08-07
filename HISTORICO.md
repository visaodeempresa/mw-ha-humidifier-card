# Histórico — mw-ha-humidifier-card

## 2026-08-07 — nascimento (v0.1.0)

Pedido: «tenho um umidificador inteligente conectado em uma tomada
inteligente. É o caso dos dois umidificadores da sala, o do escritório e o da
suíte. Crie o MW Humidifier — pode ser With Power, Only Humidifier ou Only
Power». Veio com a foto do card atual e o YAML inteiro que ele substitui: um
`power-button-card` numa grade `square: true` ao lado de quatro
`custom:button-card`, cada um com ~90 linhas de `styles:` em JS template.

Decisões:

- **Um card, três modos.** `with_power` / `only_humidifier` / `only_power`.
  A alternativa — três cards — perderia justamente o que o par tem de
  interessante: a tomada sabe se o aparelho tem energia.
- **Cópia, não biblioteca** (ADR 0002). O bloco da tomada é port do
  `mw-ha-power-button-card` e os botões são port do `custom:button-card`
  quadrado. Só a paleta de papel vem de `IA/lib/paper-palette/`, porque é dado.
- **A condição de visibilidade virou propriedade.** No YAML original os botões
  tinham `visibility: state == on` na tomada. Virou
  `hide_controls_when_off` (padrão `true`), com um detalhe que o YAML original
  não tinha: **a altura do card não muda** quando os botões somem — as duas
  colunas continuam existindo, então uma parede de umidificadores não dança.
- **Ícone deduzido do fim do `entity_id`.** As três últimas partes do
  `object_id`, não o id inteiro: `switch.suite_umidificador_da_suite_local_led`
  tem "umidificador" no meio e casaria com qualquer regra genérica de umidade.
  Com isso o YAML mínimo não tem uma linha de ícone.
- **`select` é botão de primeira classe.** O nível de névoa
  (`_spraying_level`) e o `countdown` são `select` em todo umidificador Tuya —
  toque gira para a próxima opção e o quadrado mostra o valor curto
  (`LEVEL 3` → `3`). `cancel` conta como desligado.
- **`humidity_entity` opcional.** Um card de umidificador que não diz a
  umidade do cômodo é um card de tomada. Fica vazio por padrão para o desenho
  sair idêntico à foto.

Dois consertos que o original tem e este não repete — os dois apareceram na
bancada visual, não no probe:

- **Unidade da entidade, não do código.** O `power-button-card` escreve `V` e
  `A` fixos. Os umidificadores Tuya locais reportam corrente em **mA**:
  `153,0 A` seria erro de três ordens de grandeza. Agora a unidade sai de
  `unit_of_measurement`, com a letra só de reserva.
- **`text-transform:uppercase` não vale para leitura.** Herdado do template,
  ele transformava `153 mA` em `153 MA` — miliampère virava megaampère. O
  `uppercase` continua no card; as linhas de sensor saem dele.
- De quebra, a linha pequena passou a formatar o número na vírgula da casa:
  `221,7 V` em vez de `221.7 V` ao lado de um `22,7 W`.

Verificação:

- `node --check` + `tools/probe.js` (66 verificações) verdes, com as entidades
  **reais** da casa (suíte, escritório, janela da sala, sala de yoga).
- Bancada visual em `memoria-ia/harness/` (ícones MDI de verdade, seis
  cenários) conferida em 480 px de largura de card — a largura de verdade.
- **Conferência na tela do HA é do dono.**
