<!-- Fonte canônica: IA/lib/mw-devops/templates/pull_request_template.md -->

## O que muda

<!-- uma frase: o que o usuário vê de diferente na tela do HA -->

## Como foi verificado

- [ ] `node --check dist/<asset>.js`
- [ ] `node tools/probe.js` (verde)
- [ ] visto rodando no HA real (dashboard: ____ )
- [ ] se não deu para ver na tela, está dito aqui **por quê**

## Efeito na versão

<!-- o auto-release lê os commits: "feat" = minor · "BREAKING"/"!:" = major · resto = patch -->

- bump esperado: `patch` / `minor` / `major`

## Notas

<!-- armadilha nova? vira linha na skill do repo antes do merge -->
