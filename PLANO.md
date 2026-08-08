# Plano — mw-ha-humidifier-card

Card de umidificador inteligente + tomada inteligente, feito na fábrica de
cards MW (arquivo único, sem build; editor `<ha-form>`; HACS tipo Dashboard).

**Componente separado de propósito.** O bloco da tomada nasceu do
`mw-ha-power-button-card` e os botões do `custom:button-card` quadrado, mas
nada é compartilhado (ADR 0002) fora da paleta de papel, que é dado.

## Entrega 1 — v0.1.0 (feita, aguardando validação na tela)

- [x] Três modos: `with_power`, `only_humidifier`, `only_power`.
- [x] Bloco da tomada: papel/neumórfico, potência em destaque, V/A opcionais,
      marca d'água, selinho de protocolo, interruptor, offline sem
      `unavailable` escrito por extenso.
- [x] Botões quadrados do aparelho com o visual do `custom:button-card`
      (papel ligado, inset desligado, 🚫 âmbar com halo vermelho sem resposta).
- [x] Ícone e rótulo **deduzidos do fim do `entity_id`** (tomada, LED, mudo,
      sono, névoa, timer, trava…), sem YAML de ícone.
- [x] `select` como botão: gira para a próxima opção e mostra o valor curto.
- [x] `hide_controls_when_off` reproduz a `visibility:` escrita à mão, **sem**
      mudar a altura do card.
- [x] Unidade tirada da entidade (mA ≠ A) e leitura fora do `uppercase`.
- [x] Número da linha pequena na vírgula da casa (`221,7 V`, não `221.7`).
- [x] `humidity_entity`: umidade do ambiente numa linha da tomada.
- [x] Editor visual: modo → tomada → sensores em cascata → dispositivo do
      umidificador → botões (seletor múltiplo filtrado), 3 seções expansíveis
      e a seção de cores com alfa.
- [x] Editor preserva a forma longa `{entity, icon, name}` escrita à mão.
- [x] Probe headless (75 verificações) com as entidades reais da casa.
- [x] Bancada visual em `memoria-ia/harness/` (ícones MDI de verdade).
- [x] README com 6 exemplos, todos com `entity_id` reais.

## Entrega 2 — publicação (feita em 2026-08-07)

- [x] Repositório público `visaodeempresa/mw-ha-humidifier-card`, `main` como
      branch padrão.
- [x] Release **v0.1.0** por tag assinada — o primeiro push de repositório
      novo não dispara workflow (armadilha conhecida da família).
- [x] Repositório personalizado no HACS (categoria `plugin` = Dashboard),
      baixado, recurso Lovelace cadastrado pelo próprio HACS com `?hacstag=`.
- [x] Instalação manual anterior (arquivos em `/config/www/community/` +
      recurso `?v=0.1.0`) **removida** antes: dois recursos apontando para o
      mesmo arquivo dariam dois `customElements.define` do mesmo nome.
- [x] `customElements.define` protegido por `customElements.get` nos dois
      componentes, para o caso de a sobreposição acontecer de novo.

## Entrega 3 — DevOps (aguardando o ok do dono depois do teste na tela)

- [ ] `IA/tools/mw-devops.sh apply mw-ha-humidifier-card`: CI (`node --check` +
      probe), auto-release e as regras do repositório no GitHub.

## Próximas (só com pedido do dono)

- [ ] Alvo de umidade: mostrar `humidifier.*` (`humidity` alvo) e permitir
      ajustar por gesto no card.
- [ ] Barra de nível de água, quando a integração expuser.
- [ ] Modo lista: vários umidificadores num card só.
- [ ] Levar o conserto da unidade (mA) de volta ao `mw-ha-power-button-card`.

## Regras deste repositório

- Nunca commitar direto na `main` **depois** que o DevOps entrar; merge é do
  dono. A v0.1.0 nasce na `main` a pedido, como no `door-window-element`.
- Versão no banner `console.info` não se mexe à mão — quem sobe é o workflow.
- Um lote de trabalho = uma branch nova.
- `memoria-ia/` é ignorada pelo git — memória de IA não vai para o público.
- Mexeu no bloco `paper-palette v1`? Rodar `IA/tools/check-embeds.sh`.
