/* Probe headless — instancia o card e o editor fora do navegador.
 * Pega erro de template, grade quebrada e campo sumido do editor sem
 * depender do HA. Roda no CI e antes de qualquer PR:  node tools/probe.js
 *
 * As entidades abaixo são as reais da casa (umidificadores Tuya local da
 * suíte e do escritório + tomadas medidoras) — probe com dado de mentira
 * não pega regra que só quebra com o nome de verdade.
 */
"use strict";
const fs = require("fs");
const path = require("path");

const stub = {
  style: {}, dataset: {},
  addEventListener() {}, appendChild() {}, querySelector() { return stub; },
  querySelectorAll() { return []; }, dispatchEvent() {}, focus() {}, remove() {},
};
global.HTMLElement = class {
  constructor() { this.children = []; }
  attachShadow() {
    this.shadowRoot = {
      innerHTML: "",
      getElementById: () => null,
      querySelector: () => stub,
      querySelectorAll: () => [],
    };
    return this.shadowRoot;
  }
  appendChild(el) { this.children.push(el); return el; }
  dispatchEvent() {}
  addEventListener() {}
};
const reg = {};
global.customElements = { define: (n, c) => (reg[n] = c), get: (n) => reg[n] };
global.document = {
  body: { appendChild() {} },
  createElement: () => ({
    style: { cssText: "" }, dataset: {},
    attachShadow() { this.shadowRoot = stub; return stub; },
    addEventListener() {}, appendChild() {}, dispatchEvent() {},
    querySelector: () => stub, querySelectorAll: () => [],
  }),
};
global.window = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {} };
global.CustomEvent = class { constructor(t, d) { this.type = t; Object.assign(this, d); } };
console.info = () => {};

eval(fs.readFileSync(path.join(__dirname, "..", "dist", "mw-humidifier-card.js"), "utf8"));

const sw = (state, friendly) => ({ state, attributes: { friendly_name: friendly, device_class: "switch" } });
const hass = {
  locale: { language: "pt-BR" },
  states: {
    // tomada inteligente da suíte (dispositivo "tom1")
    "switch.tomada_umidificador_suite_local_tomada": sw("on", "🟪🔌💧 TOMADA UMIDIFICADOR SUÍTE (LOCAL) Tomada"),
    "sensor.tomada_umidificador_suite_local_voltagem": {
      state: "221.7", attributes: { device_class: "voltage", unit_of_measurement: "V", friendly_name: "Voltagem" },
    },
    "sensor.tomada_umidificador_suite_local_corrente": {
      state: "153.0", attributes: { device_class: "current", unit_of_measurement: "mA", friendly_name: "Corrente" },
    },
    "sensor.tomada_umidificador_suite_local_potencia": {
      state: "22.7", attributes: { device_class: "power", unit_of_measurement: "W", friendly_name: "Potência" },
    },
    // umidificador da suíte (dispositivo "umi1")
    "switch.suite_umidificador_da_suite_local_tomada": sw("on", "🟪💧 UMIDIFICADOR DA SUÍTE (LOCAL) Tomada"),
    "switch.suite_umidificador_da_suite_local_led": sw("on", "🟪💧 UMIDIFICADOR DA SUÍTE (LOCAL) LED"),
    "switch.suite_umidificador_da_suite_local_mute": sw("on", "🟪💧 UMIDIFICADOR DA SUÍTE (LOCAL) Mute"),
    "switch.suite_umidificador_da_suite_local_sleep": sw("off", "🟪💧 UMIDIFICADOR DA SUÍTE (LOCAL) Sleep"),
    "select.suite_umidificador_da_suite_local_spraying_level": {
      state: "LEVEL 3",
      attributes: { options: ["LEVEL 1", "LEVEL 2", "LEVEL 3"], friendly_name: "Spraying level" },
    },
    "select.suite_umidificador_da_suite_local_countdown": {
      state: "cancel",
      attributes: { options: ["cancel", "1h", "2h", "3h"], friendly_name: "Countdown" },
    },
    // ambiente
    "sensor.suite_umidade": {
      state: "58", attributes: { device_class: "humidity", unit_of_measurement: "%", friendly_name: "Umidade da suíte" },
    },
    // umidificador do escritório, com a tomada caída (tudo sem resposta)
    "switch.escritorio_umidificador_escritorio_local_tomada": sw("unavailable", "Tomada"),
    "switch.escritorio_umidificador_escritorio_local_led": sw("unavailable", "LED"),
    "switch.tomada_umidificador_escritorio_socket_1": sw("off", "⬛️🔌💧 TOMADA UMIDIFICADOR ESCRITÓRIO Socket 1"),
    "sensor.tomada_umidificador_escritorio_potencia": {
      state: "unavailable", attributes: { device_class: "power", unit_of_measurement: "W", friendly_name: "Energia" },
    },
  },
  entities: {
    "switch.tomada_umidificador_suite_local_tomada": { device_id: "tom1" },
    "sensor.tomada_umidificador_suite_local_voltagem": { device_id: "tom1" },
    "sensor.tomada_umidificador_suite_local_corrente": { device_id: "tom1" },
    "sensor.tomada_umidificador_suite_local_potencia": { device_id: "tom1" },
    "switch.suite_umidificador_da_suite_local_tomada": { device_id: "umi1" },
    "switch.suite_umidificador_da_suite_local_led": { device_id: "umi1" },
    "switch.suite_umidificador_da_suite_local_mute": { device_id: "umi1" },
    "switch.suite_umidificador_da_suite_local_sleep": { device_id: "umi1" },
    "select.suite_umidificador_da_suite_local_spraying_level": { device_id: "umi1" },
    "select.suite_umidificador_da_suite_local_countdown": { device_id: "umi1" },
    "switch.escritorio_umidificador_escritorio_local_tomada": { device_id: "umi2" },
    "switch.escritorio_umidificador_escritorio_local_led": { device_id: "umi2" },
    "switch.tomada_umidificador_escritorio_socket_1": { device_id: "tom2" },
    "sensor.tomada_umidificador_escritorio_potencia": { device_id: "tom2" },
  },
  devices: {
    tom1: { name: "TOMADA UMIDIFICADOR SUÍTE" },
    umi1: { name: "UMIDIFICADOR DA SUÍTE" },
    umi2: { name: "UMIDIFICADOR ESCRITÓRIO" },
    tom2: { name: "TOMADA UMIDIFICADOR ESCRITÓRIO" },
  },
  callService() { this._calls.push([...arguments]); },
  _calls: [],
};

let fails = 0;
const check = (label, cond, extra = "") => {
  if (cond) { console.log(`  ok   ${label}`); return; }
  fails += 1;
  console.log(`  FAIL ${label}${extra ? " — " + extra : ""}`);
};
const mk = (cfg) => {
  const el = new reg["mw-humidifier-card"]();
  el.setConfig(cfg);
  el.hass = hass;
  return el;
};
const html = (cfg) => mk(cfg).shadowRoot.innerHTML;

const SUITE = {
  entity: "switch.tomada_umidificador_suite_local_tomada",
  sensor_potencia: "sensor.tomada_umidificador_suite_local_potencia",
  sensor_voltagem: "sensor.tomada_umidificador_suite_local_voltagem",
  sensor_corrente: "sensor.tomada_umidificador_suite_local_corrente",
  buttons: [
    "switch.suite_umidificador_da_suite_local_tomada",
    "switch.suite_umidificador_da_suite_local_led",
    "switch.suite_umidificador_da_suite_local_mute",
    "switch.suite_umidificador_da_suite_local_sleep",
  ],
};

console.log("modo with_power:");
const wp = html({ ...SUITE, protocol_icon: "mdi:wifi", background_image_url: "http://x/tuya.png" });
check("duas colunas iguais", wp.includes("grid-template-columns:1fr 1fr"));
check("tomada quadrada define a altura", wp.includes("aspect-ratio:1 / 1"));
check("potência em destaque (22,7)", wp.includes(">22,7<"));
check("unidade W ao lado do número", wp.includes('class="pu">W<'));
check("V e A escondidos com a potência em destaque",
  !wp.includes("mdi:lightning-bolt") && !wp.includes("mdi:current-ac"));
check("marca d'água desenhada", wp.includes('class="wm"'));
check("selinho de protocolo", wp.includes("mdi:wifi"));
check("quatro botões", (wp.match(/class="btn"/g) || []).length === 4);
check("grade de botões em 2 colunas", wp.includes("grid-template-columns:repeat(2,1fr)"));
check("ícone do LED detectado pelo sufixo", wp.includes("mdi:led-strip-variant"));
check("ícone de mudo detectado", wp.includes("mdi:speaker-off"));
check("ícone de sono detectado", wp.includes("mdi:sleep"));
check("papel creme no botão ligado", wp.includes("linear-gradient(145deg, #fdfaf3, #e8e3d8)"));
check("botão desligado usa o fundo escuro", wp.includes("rgba(0, 0, 0, 0.45)"));
check("sem nome dentro do botão por padrão", !wp.includes('class="bn"'));

const vac = html({ ...SUITE, power_big: false });
check("power_big:false traz V e A de volta",
  vac.includes("mdi:lightning-bolt") && vac.includes("mdi:current-ac"));
check("corrente mostra a unidade da entidade (mA), não 'A'", vac.includes(" mA"));
check("unidade escapa do uppercase do card (mA ≠ MA)", vac.includes("text-transform:none"));
check("número da linha pequena na vírgula da casa", vac.includes(">221,7 V<") &&
  vac.includes(">153 mA<"), vac.slice(vac.indexOf("mdi:current-ac"), vac.indexOf("mdi:current-ac") + 220));

const hum = html({ ...SUITE, humidity_entity: "sensor.suite_umidade" });
check("umidade do ambiente na tomada", hum.includes("58 %") && hum.includes("mdi:water-percent"));
check("linha de umidade entra na grade", hum.includes('"humidity humidity"'));

console.log("tomada desligada:");
const offHass = JSON.parse(JSON.stringify({ states: hass.states }));
offHass.states["switch.tomada_umidificador_suite_local_tomada"].state = "off";
const offCard = new reg["mw-humidifier-card"]();
offCard.setConfig(SUITE);
offCard.hass = { ...hass, states: offHass.states };
const off = offCard.shadowRoot.innerHTML;
check("botões somem com a tomada desligada", !off.includes('class="btn"'));
check("tomada continua ocupando metade (altura estável)",
  off.includes("grid-template-columns:1fr 1fr"));

const offKeep = new reg["mw-humidifier-card"]();
offKeep.setConfig({ ...SUITE, hide_controls_when_off: false });
offKeep.hass = { ...hass, states: offHass.states };
check("hide_controls_when_off:false mantém os botões",
  (offKeep.shadowRoot.innerHTML.match(/class="btn"/g) || []).length === 4);

console.log("modo only_humidifier:");
const oh = html({
  mode: "only_humidifier",
  buttons: SUITE.buttons.concat(["select.suite_umidificador_da_suite_local_spraying_level",
    "select.suite_umidificador_da_suite_local_countdown"]),
  button_columns: 3,
});
check("uma coluna só (sem tomada)", oh.includes("grid-template-columns:1fr;"));
check("sem bloco de tomada", !oh.includes('id="mhc-tile"'));
check("seis botões em 3 colunas",
  (oh.match(/class="btn"/g) || []).length === 6 && oh.includes("repeat(3,1fr)"));
check("nível de névoa vira ícone de spray", oh.includes("mdi:spray"));
check("valor do select encurtado (LEVEL 3 → 3)", oh.includes(">3</span>"));
check("countdown em 'cancel' conta como desligado e mostra travessão",
  oh.includes("mdi:timer-outline") && !oh.includes(">CANCE<"));

const named = html({ mode: "only_humidifier", buttons: SUITE.buttons, show_button_names: true });
check("show_button_names escreve o papel do botão",
  named.includes(">LED<") && named.includes(">Mudo<") && named.includes(">Sono<"));

// a saída da régua da sala de yoga: nenhum papel específico casa, e a regra
// genérica de umidificador (última da fila) é quem salva o ícone
hass.states["switch.tomadas_da_sala_de_yoga_umidificador"] = sw("on", "TOMADAS DA SALA DE YOGA Umidificador");
const regua = html({
  mode: "only_humidifier", buttons: ["switch.tomadas_da_sala_de_yoga_umidificador"],
  show_button_names: true,
});
check("saída de régua vira mdi:air-humidifier, não o switch genérico",
  regua.includes("mdi:air-humidifier") && !regua.includes("mdi:toggle-switch-variant"));

const custom = html({
  mode: "only_humidifier",
  buttons: [{ entity: "switch.suite_umidificador_da_suite_local_led", icon: "mdi:lamp", name: "Luzinha" }],
  show_button_names: true,
});
check("forma longa {entity,icon,name} respeitada",
  custom.includes("mdi:lamp") && custom.includes(">Luzinha<"));

console.log("modo only_power:");
const op = html({ mode: "only_power", entity: SUITE.entity, sensor_potencia: SUITE.sensor_potencia });
check("sem botões", !op.includes('class="btn"'));
check("tomada preenche o card", op.includes("height:100%"));

console.log("aparelho sem resposta:");
const deadCard = html({
  mode: "only_humidifier",
  buttons: ["switch.escritorio_umidificador_escritorio_local_led"],
  show_button_names: true,
});
check("botão morto vira mdi:cancel", deadCard.includes("mdi:cancel"));
check("botão morto fica âmbar", deadCard.includes("#f5c518"));
check("nome do botão morto é riscado", deadCard.includes("line-through"));

const deadTile = html({
  mode: "only_power",
  entity: "switch.escritorio_umidificador_escritorio_local_tomada",
  sensor_potencia: "sensor.tomada_umidificador_escritorio_potencia",
});
check("tomada offline mostra o selo", deadTile.includes("OFFLINE"));
check("potência sem leitura vira travessão", deadTile.includes(">—<"));

console.log("configuração inválida:");
const throws = (cfg) => { try { new reg["mw-humidifier-card"]().setConfig(cfg); return false; } catch (e) { return true; } };
check("with_power sem entity falha", throws({ buttons: SUITE.buttons }));
check("with_power sem botões falha", throws({ entity: SUITE.entity }));
check("only_humidifier sem botões falha", throws({ mode: "only_humidifier" }));
check("only_power sem botões é válido",
  !throws({ mode: "only_power", entity: SUITE.entity }));
check("modo desconhecido cai no padrão", (() => {
  const el = new reg["mw-humidifier-card"]();
  el.setConfig({ ...SUITE, mode: "banana" });
  return el._config.mode === "with_power";
})());

console.log("ações:");
const act = mk({ mode: "only_humidifier", buttons: SUITE.buttons.concat(["select.suite_umidificador_da_suite_local_spraying_level"]) });
hass._calls = [];
act._tapButton("switch.suite_umidificador_da_suite_local_led");
check("switch usa homeassistant.toggle",
  hass._calls[0]?.[0] === "homeassistant" && hass._calls[0]?.[1] === "toggle", JSON.stringify(hass._calls[0]));
hass._calls = [];
act._tapButton("select.suite_umidificador_da_suite_local_spraying_level");
check("select gira para a próxima opção (LEVEL 3 → LEVEL 1)",
  hass._calls[0]?.[1] === "select_option" && hass._calls[0]?.[2]?.option === "LEVEL 1",
  JSON.stringify(hass._calls[0]));

console.log("editor:");
const ed = new reg["mw-humidifier-card-editor"]();
ed.hass = hass;
ed.setConfig(SUITE);
const schema = ed._schema();
// o esquema é uma árvore: as seções expansíveis levam campos dentro
const flatten = (list, out = []) => {
  list.forEach((f) => (f.type === "expandable" ? flatten(f.schema, out) : out.push(f)));
  return out;
};
const flat = flatten(schema);
const byName = (n) => flat.find((f) => f.name === n);
check("modo é o primeiro campo", schema[0].name === "mode");
check("três modos oferecidos", schema[0].selector.select.options.length === 3);
check("select de dispositivo do umidificador", !!byName("device"));
check("dispositivos filtrados por 'umidific' (4 + todos)",
  byName("device").selector.select.options.length === 5,
  JSON.stringify(byName("device").selector.select.options.map((o) => o.label)));
check("botões usam selector múltiplo", byName("buttons").selector.entity.multiple === true);
check("sensor de potência filtrado pelo dispositivo da tomada",
  byName("sensor_potencia").selector.entity.include_entities?.length === 1,
  JSON.stringify(byName("sensor_potencia").selector.entity));
check("V e A escondidos com a potência em destaque",
  !byName("sensor_voltagem") && !byName("sensor_corrente"));
check("seções expansíveis (tomada, botões, geral)",
  schema.filter((f) => f.type === "expandable").length === 3);

const namesOf = (cfg) => {
  const e = new reg["mw-humidifier-card-editor"]();
  e.hass = hass;
  e.setConfig(cfg);
  return flatten(e._schema()).map((f) => f.name);
};
const vacNames = namesOf({ ...SUITE, power_big: false });
check("power_big:false revela V e A no editor",
  vacNames.includes("sensor_voltagem") && vacNames.includes("sensor_corrente"));

const onlyNames = namesOf({ mode: "only_humidifier", buttons: SUITE.buttons });
check("only_humidifier não pede tomada", !onlyNames.includes("entity"));
check("only_humidifier esconde 'esconder botões com a tomada desligada'",
  !onlyNames.includes("hide_controls_when_off"));

const powNames = namesOf({ mode: "only_power", entity: SUITE.entity });
check("only_power não pede botões", !powNames.includes("buttons"));

console.log("editor — o que vai para o YAML:");
const captured = [];
const edOut = new reg["mw-humidifier-card-editor"]();
edOut.hass = hass;
edOut.setConfig(SUITE);
edOut.dispatchEvent = (ev) => captured.push(ev.detail.config);
edOut._onChange({
  stopPropagation() {},
  detail: {
    value: {
      ...SUITE, mode: "with_power", buttons: SUITE.buttons,
      name: "", gap: 8, button_columns: 2, show_button_names: false,
      haptic: true, paper_color: "paper", __bg_preset: "none", height: null,
    },
  },
});
const out = captured[0];
check("defaults fora do YAML", out.gap === undefined && out.button_columns === undefined &&
  out.haptic === undefined && out.paper_color === undefined, JSON.stringify(out));
check("campo virtual __bg_preset nunca vai para o YAML", !("__bg_preset" in out));
check("botões gravados como lista curta de entity_id",
  Array.isArray(out.buttons) && out.buttons.length === 4 && typeof out.buttons[0] === "string");

const edLong = new reg["mw-humidifier-card-editor"]();
edLong.hass = hass;
edLong.setConfig({
  ...SUITE,
  buttons: [{ entity: "switch.suite_umidificador_da_suite_local_led", icon: "mdi:lamp" },
    "switch.suite_umidificador_da_suite_local_mute"],
});
const kept = [];
edLong.dispatchEvent = (ev) => kept.push(ev.detail.config);
edLong._onChange({
  stopPropagation() {},
  detail: {
    value: {
      entity: SUITE.entity, mode: "with_power",
      buttons: ["switch.suite_umidificador_da_suite_local_led",
        "switch.suite_umidificador_da_suite_local_mute"],
    },
  },
});
check("ícone escrito à mão sobrevive ao editor",
  kept[0].buttons[0]?.icon === "mdi:lamp" && kept[0].buttons[1] === "switch.suite_umidificador_da_suite_local_mute",
  JSON.stringify(kept[0].buttons));
check("chave fora do formulário continua no YAML",
  kept[0].sensor_potencia === SUITE.sensor_potencia);

const edDev = new reg["mw-humidifier-card-editor"]();
edDev.hass = hass;
edDev.setConfig({ mode: "only_humidifier", device: "umi2", buttons: ["switch.escritorio_umidificador_escritorio_local_led"] });
const swapped = [];
edDev.dispatchEvent = (ev) => swapped.push(ev.detail.config);
edDev._onChange({
  stopPropagation() {},
  detail: { value: { mode: "only_humidifier", device: "umi1", buttons: ["switch.escritorio_umidificador_escritorio_local_led"] } },
});
check("trocar de dispositivo troca os botões pelos do novo",
  swapped[0].buttons.length === 4 &&
  swapped[0].buttons.every((b) => b.startsWith("switch.suite_")), JSON.stringify(swapped[0].buttons));
check("ordem canônica: tomada primeiro, sono por último",
  /_tomada$/.test(swapped[0].buttons[0]) && /_sleep$/.test(swapped[0].buttons[3]),
  JSON.stringify(swapped[0].buttons));

console.log(fails ? `\n${fails} verificação(ões) falharam` : "\ntudo ok");
process.exit(fails ? 1 : 0);
