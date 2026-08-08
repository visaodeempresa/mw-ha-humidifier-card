/* mw-ha-humidifier-card — custom:mw-humidifier-card
 *
 * Um umidificador inteligente quase nunca é uma coisa só: é o aparelho (LED,
 * mudo, sono, nível de névoa) **mais** a tomada inteligente que mede V/A/W.
 * Este card junta os dois num objeto só, em três modos:
 *
 *   with_power       tomada (papel, potência em destaque) + botões do aparelho
 *   only_humidifier  só os botões do aparelho
 *   only_power       só a tomada
 *
 * Substitui o par «power-button-card + grade de button-card» escrito à mão,
 * inclusive a condição de visibilidade (os botões somem com a tomada desligada,
 * porque aparelho sem energia só sabe dizer «unavailable»).
 *
 * Arquivo único, sem build: este arquivo é fonte e artefato. JS puro +
 * <ha-form> do HA, sem dependências.
 * Repo: https://github.com/visaodeempresa/mw-ha-humidifier-card
 */
(() => {
  "use strict";

  const PRESET_URLS = {
    tuya: "https://raw.githubusercontent.com/mayconsoftware/mayconsoftware.github.io/refs/heads/main/assets/devices/ha-integration/ha-integration-tuya.png",
    tapo: "https://raw.githubusercontent.com/mayconsoftware/mayconsoftware.github.io/refs/heads/main/assets/devices/ha-integration/ha-integration-tapo.png",
  };

  const MODES = ["with_power", "only_humidifier", "only_power"];

  const DEFAULTS = {
    mode: "with_power",
    // ---- bloco da tomada ----
    entity: "",
    name: "",
    image_url: "",
    device_icon: "",
    background_image_url: "",
    background_transparent: 0.12,
    animate: false,
    protocol_icon: "",
    protocol_color_on: null,
    protocol_color_off: null,
    protocol_offset_x: 10,
    protocol_offset_y: 10,
    sensor_voltagem: "",
    sensor_corrente: "",
    sensor_potencia: "",
    humidity_entity: "",
    power_big: true,
    power_font_size: 34,
    power_lift: 6,
    // ---- bloco dos controles ----
    device: "",
    buttons: [],
    button_columns: 2,
    button_icon_size: 46,
    button_radius: 12,
    show_button_names: false,
    show_select_value: true,
    hide_controls_when_off: true,
    confirm_buttons: false,
    // ---- comuns ----
    gap: 8,
    height: "",
    control: true,
    haptic: true,
    confirm: false,
    confirm_text: "Tem certeza que quer {acao} {nome}?",
    paper_color: "paper",
    color_power_on: "#7a4b00",
    color_power_off: "#f0b429",
    color_on_border: "rgba(180, 180, 180, 0.55)",
    color_on_name: "#1a1a1a",
    color_on_subtext: "rgba(80, 80, 80, 1)",
    color_off_bg: "rgba(0, 0, 0, 0.45)",
    color_off_border: "rgba(255, 255, 255, 0.08)",
    color_off_name: "rgba(255, 255, 255, 0.5)",
    color_off_subtext: "rgba(255, 255, 255, 0.35)",
    color_unavail_bg: "rgba(80, 0, 0, 0.6)",
    color_unavail_border: "rgba(255, 80, 80, 0.3)",
    color_unknown_bg: "rgba(0, 0, 0, 0.7)",
    color_unknown_border: "rgba(80, 80, 80, 0.3)",
    color_btn_icon_off: "rgba(255, 255, 255, 0.70)",
    color_btn_name_off: "rgba(255, 255, 255, 0.78)",
    color_btn_dead: "#f5c518",
  };

  // Leitura morta: o sensor existe mas não tem valor (a tomada caiu e levou
  // junto os sensores dela). "unavailable" em 34px é feio e não informa nada.
  const NO_READING = "—";
  const noReading = (s) => s === undefined || s === null || s === "" ||
    s === "unavailable" || s === "unknown" || s === "none";

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Potência em destaque: no máximo 1 casa decimal e 4 dígitos inteiros —
  // passou de 9999, sobe de degrau (W → kW → MW) em vez de estourar a largura.
  const STEPS = [["W", "kW"], ["kW", "MW"], ["MW", "GW"]];
  const fmtPower = (raw, unit, lang) => {
    let v = Number.parseFloat(raw);
    if (!Number.isFinite(v)) return { value: String(raw ?? "—"), unit: unit || "" };
    let u = unit || "W";
    const round1 = (x) => Math.round(x * 10) / 10;
    v = round1(v);
    for (const [from, to] of STEPS) {
      if (Math.abs(v) >= 10000 && u.toLowerCase() === from.toLowerCase()) { v = round1(v / 1000); u = to; }
    }
    let value;
    try {
      value = new Intl.NumberFormat(lang || "pt-BR",
        { maximumFractionDigits: 1, useGrouping: false }).format(v);
    } catch (e) {
      value = String(v);
    }
    return { value, unit: u };
  };

  // As linhas pequenas (V, A, umidade) mostravam o estado cru: "221.7" com
  // ponto, ao lado de um "22,7" com vírgula no mesmo card. Mesma casa, mesma
  // vírgula. Estado que não é número passa intacto.
  const fmtNumber = (raw, lang) => {
    const v = Number.parseFloat(raw);
    if (!Number.isFinite(v) || !/^-?[\d.]+$/.test(String(raw).trim())) return String(raw);
    try {
      return new Intl.NumberFormat(lang || "pt-BR", { maximumFractionDigits: 2 }).format(v);
    } catch (e) {
      return String(v);
    }
  };

  /* Tipografia proporcional ao tile.
   *
   * O tile é um quadrado: `cqw` é 1% do lado dele. Tudo aqui dentro é
   * expresso como fração desse lado, tomando 236 px (a metade de um card de
   * 480) como referência — nos tamanhos de sempre nada muda de aparência, e
   * num card estreito o conteúdo ENCOLHE em vez de exigir mais altura.
   *
   * Isso é o que garante o quadrado: com `container-type: size` no tile, o
   * conteúdo não pode mais empurrar a altura; sem a tipografia proporcional,
   * ele apenas vazaria para fora em vez de esticar.
   *
   * ARMADILHA: `cqw` só vale para DESCENDENTES do container. Escrito no
   * próprio elemento que declara `container-type`, resolve contra o container
   * ancestral — e, não havendo nenhum, contra o viewport. Foi assim que o
   * `border-radius` do tile virou um círculo de 61 px. Por isso o raio, o
   * padding e o font-size base do tile continuam em px/%. */
  // 236 é o lado do tile (metade de um card de 480), mas `cqw` é 1% do
  // CONTENT BOX do container — e o tile tem `padding: 10%` de cada lado.
  // A referência, portanto, é 236 × 0,8. Errar isso encolhe tudo em 20%.
  const REF = 236 * 0.8;
  const cq = (px) => `${(Number(px) * 100 / REF).toFixed(2)}cqw`;

  // >>> paper-palette v1 — fonte canônica: /Volumes/SSD-T1-01/CLAUDE-SSD/IA/lib/paper-palette/paper-palette.js
  // 49 papéis encardidos: 7 matizes do arco-íris × 7 tons (1 = quase branco,
  // 7 = mais encardido). Saturação baixa de propósito — papel descansa a vista.
  const PAPER_HUES = [
    ["red", "Vermelho", 6], ["orange", "Laranja", 27], ["yellow", "Amarelo", 47],
    ["green", "Verde", 96], ["blue", "Azul", 203], ["indigo", "Anil", 236],
    ["violet", "Violeta", 283],
  ];
  const PAPER_TONES = [[97, 6], [96, 9], [94, 12], [92, 15], [90, 18], [88, 21], [85, 24]];
  const PAPER_DEFAULT = "linear-gradient(145deg, #fdfaf3, #e8e3d8)";
  const paperGradient = (key) => {
    const m = /^([a-z]+)-([1-7])$/.exec(String(key || "").trim());
    if (!m) return PAPER_DEFAULT;
    const hue = PAPER_HUES.find((h) => h[0] === m[1]);
    if (!hue) return PAPER_DEFAULT;
    const [l, s] = PAPER_TONES[+m[2] - 1];
    return `linear-gradient(145deg, hsl(${hue[2]}, ${s}%, ${l}%), hsl(${hue[2]}, ${s + 4}%, ${l - 7}%))`;
  };
  const paperOptions = () => [{ value: "paper", label: "Papel original (creme)" }].concat(
    ...PAPER_HUES.map((h) => PAPER_TONES.map((t, i) => ({
      value: `${h[0]}-${i + 1}`,
      label: `${h[1]} · tom ${i + 1}${i === 0 ? " (mais claro)" : i === 6 ? " (mais encardido)" : ""}`,
    }))));
  // <<< paper-palette v1

  /* --- feedback táctil e confirmação (copiados do mw-ha-power-button-card;
   *     ADR 0002: os cards da família não compartilham biblioteca) --------- */

  // o app companion escuta o evento "haptic" na window e chama o motor de
  // vibração nativo. Fora do app não existe essa ponte: cai no
  // navigator.vibrate (Chrome do Android; o Safari do iPhone não vibra).
  const VIBRATE_MS = { selection: 5, light: 10, success: 15, medium: 20, warning: 25, heavy: 30, failure: 40 };
  const inCompanionApp = () =>
    !!(window.externalApp || window.webkit?.messageHandlers?.externalBus);
  const haptic = (kind) => {
    try {
      window.dispatchEvent(new CustomEvent("haptic",
        { bubbles: true, composed: true, detail: kind }));
      if (!inCompanionApp() && navigator.vibrate) navigator.vibrate(VIBRATE_MS[kind] ?? 10);
    } catch (_) { /* vibração é enfeite: nunca pode derrubar o toque */ }
  };

  // 1) o diálogo é montado no document.body, não no shadow root — dentro dele
  //    o overflow do botão cortaria o modal;
  // 2) não usa window.confirm: o WebView do companion pode engolir o diálogo
  //    nativo e devolver false sozinho, e aí a ação nunca aconteceria.
  const CONFIRM_FALLBACK = "Tem certeza que quer {acao} {nome}?";
  const confirmAction = (tpl, nome, acao) => new Promise((resolve) => {
    const msg = String(tpl || CONFIRM_FALLBACK)
      .replace(/\{nome\}/g, nome).replace(/\{acao\}/g, acao);
    const host = document.createElement("div");
    host.attachShadow({ mode: "open" });
    host.shadowRoot.innerHTML = `
      <style>
        .ov{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
          background:rgba(0,0,0,0.55);padding:16px;}
        .box{max-width:min(420px,86vw);border-radius:14px;padding:22px 22px 16px;
          background:linear-gradient(145deg, #fdfaf3, #e8e3d8);color:#1a1a1a;
          font-family:inherit;font-size:15px;line-height:1.45;text-align:center;
          box-shadow:0 10px 40px rgba(0,0,0,0.45), inset 2px 2px 4px rgba(255,250,235,0.80);}
        .bt{display:flex;gap:10px;margin-top:20px;}
        button{flex:1;padding:11px 14px;border-radius:10px;font:inherit;font-size:14px;
          font-weight:600;cursor:pointer;border:1px solid rgba(0,0,0,0.18);}
        .no{background:rgba(0,0,0,0.06);color:#1a1a1a;}
        .yes{background:#1a1a1a;color:#fdfaf3;border-color:#1a1a1a;}
      </style>
      <div class="ov"><div class="box"><div class="msg"></div>
        <div class="bt"><button class="no">Cancelar</button><button class="yes">Confirmar</button></div>
      </div></div>`;
    // textContent, não innerHTML: o texto vem do YAML do dono, mas nome de
    // entidade não tem por que virar HTML.
    host.shadowRoot.querySelector(".msg").textContent = msg;
    const close = (ok) => {
      window.removeEventListener("keydown", onKey, true);
      host.remove();
      resolve(ok);
    };
    const onKey = (ev) => {
      if (ev.key === "Escape") { ev.stopPropagation(); close(false); }
      else if (ev.key === "Enter") { ev.stopPropagation(); close(true); }
    };
    host.shadowRoot.querySelector(".yes").addEventListener("click", () => close(true));
    host.shadowRoot.querySelector(".no").addEventListener("click", () => close(false));
    host.shadowRoot.querySelector(".ov").addEventListener("click", (ev) => {
      if (ev.target === ev.currentTarget) close(false);
    });
    window.addEventListener("keydown", onKey, true);
    document.body.appendChild(host);
    host.shadowRoot.querySelector(".yes").focus();
  });

  /* ------------------------- botões do aparelho ------------------------- */

  // Domínios que viram botão quadrado. `humidifier` entra porque o aparelho
  // costuma expor a entidade nativa junto com os switches da integração local.
  const BTN_DOMAINS = ["switch", "input_boolean", "light", "fan", "humidifier",
    "select", "input_select", "button", "input_button", "script", "scene", "automation"];
  // Domínios que a descoberta automática usa. Os `select` (nível de névoa,
  // countdown) existem em todo umidificador Tuya, mas entram por escolha do
  // dono: o padrão tem que sair igual à foto — tomada, LED, mudo, sono.
  const AUTOFILL_DOMAINS = ["switch", "input_boolean"];

  // Papel do botão, decidido pelo FIM do object_id. Testar o id inteiro não
  // funciona: `switch.suite_umidificador_da_suite_local_led` tem "umidificador"
  // no meio e casaria com qualquer regra genérica de umidade.
  const ROLES = [
    { re: /(spray|mist|nevoa|nebuliz|vapor|level|nivel)/, icon: "mdi:spray", label: "Névoa", order: 1 },
    { re: /(countdown|timer|temporiz|desliga)/, icon: "mdi:timer-outline", label: "Timer", order: 5 },
    { re: /(mute|mudo|silenc|beep|buzzer|sound|som|voice)/, icon: "mdi:speaker-off", label: "Mudo", order: 3 },
    { re: /(sleep|noturno|night|dormir)/, icon: "mdi:sleep", label: "Sono", order: 4 },
    { re: /(led|indicad|backlight)/, icon: "mdi:led-strip-variant", label: "LED", order: 2 },
    { re: /(child|crianc|trava|lock|bloqueio)/, icon: "mdi:lock", label: "Trava", order: 6 },
    { re: /(ioniz|anion|purif)/, icon: "mdi:air-purifier", label: "Íons", order: 7 },
    { re: /(warm|aquec|heat|quente)/, icon: "mdi:heat-wave", label: "Aquecer", order: 7 },
    { re: /(uv|esteril|steril)/, icon: "mdi:lightbulb-fluorescent-tube", label: "UV", order: 7 },
    { re: /(swing|oscil)/, icon: "mdi:tailwind", label: "Oscilar", order: 7 },
    { re: /(tomada|socket|outlet|power|liga)/, icon: "mdi:power", label: "Tomada", order: 0 },
    // por último de propósito: a saída da régua que alimenta o aparelho se
    // chama "..._umidificador" e não casa com nada mais específico. A regra
    // genérica só é segura no fim da fila — e só porque o teste é no FIM do
    // object_id (senão pegaria todo switch de todo umidificador).
    { re: /(umidific|humidif|vaporiz|difusor)/, icon: "mdi:air-humidifier", label: "Umidificar", order: 8 },
  ];
  const DOMAIN_FALLBACK = {
    switch: { icon: "mdi:toggle-switch-variant", label: "Switch" },
    input_boolean: { icon: "mdi:toggle-switch-variant", label: "Flag" },
    light: { icon: "mdi:lightbulb", label: "Luz" },
    fan: { icon: "mdi:fan", label: "Vento" },
    humidifier: { icon: "mdi:air-humidifier", label: "Umidificar" },
    select: { icon: "mdi:format-list-bulleted", label: "Modo" },
    input_select: { icon: "mdi:format-list-bulleted", label: "Modo" },
    button: { icon: "mdi:gesture-tap-button", label: "Acionar" },
    input_button: { icon: "mdi:gesture-tap-button", label: "Acionar" },
    script: { icon: "mdi:script-text", label: "Script" },
    scene: { icon: "mdi:palette", label: "Cena" },
    automation: { icon: "mdi:robot", label: "Automação" },
  };
  // as três últimas partes do object_id: o bastante para pegar
  // "trava_para_criancas" e pouco para não pegar o nome do cômodo
  const tail = (entityId) => String(entityId || "").split(".")[1]?.split("_").slice(-3).join("_") || "";
  const roleOf = (entityId) => {
    const t = tail(entityId);
    const hit = ROLES.find((r) => r.re.test(t));
    if (hit) return hit;
    const d = DOMAIN_FALLBACK[String(entityId || "").split(".")[0]];
    return { icon: d?.icon || "mdi:toggle-switch-variant", label: d?.label || "", order: 8 };
  };

  // `buttons` aceita string (só a entidade) ou objeto {entity, icon, name}.
  // A string é a forma curta que o editor grava; o objeto é para quem quer
  // sobrescrever ícone ou rótulo à mão no YAML.
  const normalizeButtons = (list) => (Array.isArray(list) ? list : [])
    .map((b) => (typeof b === "string" ? { entity: b } : { ...b }))
    .filter((b) => b && typeof b.entity === "string" && b.entity.includes("."));

  const OFF_OPTIONS = ["cancel", "off", "none", "desligado", "desligada", "nenhum", "0"];
  const isSelect = (id) => /^(select|input_select)\./.test(id || "");
  const isMomentary = (id) => /^(button|input_button|scene)\./.test(id || "");

  // "LEVEL 3" → "3" · "cancel" → "—" · "1h" → "1H". Um botão de 60 px não
  // comporta o texto inteiro da opção, e o número é a informação.
  const shortOption = (state) => {
    const s = String(state ?? "").trim();
    if (!s) return NO_READING;
    if (OFF_OPTIONS.includes(s.toLowerCase())) return NO_READING;
    const num = /(\d+)\s*\w?$/.exec(s);
    if (num) return num[1] + (/h$/i.test(s) ? "h" : "");
    return s.length > 5 ? s.slice(0, 5).toUpperCase() : s.toUpperCase();
  };

  class MwHumidifierCard extends HTMLElement {
    setConfig(config) {
      if (!config) throw new Error("mw-humidifier-card: configuração vazia");
      const cfg = { ...DEFAULTS, ...config };
      if (!MODES.includes(cfg.mode)) cfg.mode = DEFAULTS.mode;
      cfg.buttons = normalizeButtons(cfg.buttons);
      if (cfg.mode !== "only_humidifier" && !cfg.entity) {
        throw new Error("mw-humidifier-card: no modo «" + cfg.mode +
          "» a propriedade 'entity' (tomada) é obrigatória");
      }
      if (cfg.mode !== "only_power" && !cfg.buttons.length) {
        throw new Error("mw-humidifier-card: no modo «" + cfg.mode +
          "» é preciso ao menos um botão em 'buttons'");
      }
      this._config = cfg;
      this._renderKey = null;
      if (this._hass) this._render();
    }

    set hass(hass) {
      this._hass = hass;
      if (!this._config) return;
      const c = this._config;
      const ids = [c.entity, c.sensor_voltagem, c.sensor_corrente, c.sensor_potencia,
        c.humidity_entity, ...c.buttons.map((b) => b.entity)];
      const key = ids.map((id) => (id && hass.states[id] ? hass.states[id].state : "·")).join("|");
      if (key !== this._renderKey) {
        this._renderKey = key;
        this._render();
      }
    }

    getCardSize() {
      const c = this._config || DEFAULTS;
      if (c.mode === "only_humidifier") {
        return Math.max(2, Math.ceil(c.buttons.length / Math.max(1, c.button_columns)) * 2);
      }
      return 3;
    }

    static getConfigElement() { return document.createElement("mw-humidifier-card-editor"); }

    static getStubConfig(hass) {
      const states = hass?.states || {};
      // um umidificador local da Tuya expõe ..._tomada/_led/_mute/_sleep no
      // mesmo prefixo — achando o "_led" acha-se o conjunto inteiro
      const led = Object.keys(states).find((e) =>
        e.startsWith("switch.") && /_led$/.test(e) && HUMID_RE.test(e));
      if (led) {
        const base = led.replace(/_led$/, "");
        const buttons = ["_tomada", "_led", "_mute", "_sleep"]
          .map((s) => base + s).filter((e) => states[e]);
        if (buttons.length) return { mode: "only_humidifier", buttons };
      }
      // casa sem umidificador local: a prévia ainda precisa montar sem erro
      return { mode: "only_power", entity: Object.keys(states).find((e) => e.startsWith("switch.")) || "" };
    }

    _st(id) { return (id && this._hass.states[id]) || null; }

    /* ------------------------------ tomada ------------------------------ */

    _powerBlock() {
      const c = this._config;
      const ent = this._st(c.entity);
      const state = ent ? ent.state : "unavailable";
      const isOn = state === "on";
      const isOff = state === "off";
      const dead = state === "unavailable" || state === "unknown";

      let bg, border;
      if (isOn) { bg = paperGradient(c.paper_color); border = c.color_on_border; }
      else if (isOff) { bg = c.color_off_bg; border = c.color_off_border; }
      else if (state === "unavailable") { bg = c.color_unavail_bg; border = c.color_unavail_border; }
      else if (state === "unknown") { bg = c.color_unknown_bg; border = c.color_unknown_border; }
      else { bg = "rgba(255,0,0,1.0)"; border = "rgba(255,255,255,0.1)"; }
      const shadow = isOn
        ? "0 2px 6px rgba(0,0,0,0.18),0 6px 16px rgba(0,0,0,0.14),0 12px 28px rgba(0,0,0,0.08),inset 4px 4px 8px rgba(255,252,240,0.90),inset -4px -4px 8px rgba(0,0,0,0.12)"
        : "none";
      const nameColor = isOn ? c.color_on_name : isOff ? c.color_off_name : "rgba(255,255,255,0.5)";

      let watermark = "";
      if (c.background_image_url) {
        const alpha = c.background_transparent ?? 0.12;
        // offline sem o brightness some: o fundo fica vinho escuro e a marca
        // em cinza puro não tem contraste nenhum contra ele.
        const wmFilter = dead ? "filter:grayscale(100%) brightness(1.8);"
          : isOff ? "filter:grayscale(40%) brightness(1.8);" : "";
        watermark = `<div class="wm" style="background-image:url('${esc(c.background_image_url)}');opacity:${alpha};${wmFilter}"></div>`;
      }

      const anim = c.animate && isOn ? "animation:mhc-spin 1s linear infinite;" : "";
      const opac = dead ? "opacity:0.3;" : isOff ? "opacity:0.35;" : "opacity:1;";
      let deviceImg = "";
      if (c.image_url) {
        const f = isOff ? "filter:grayscale(40%) brightness(1.8);" : dead ? "filter:grayscale(100%);"
          : "filter:drop-shadow(0 1px 2px rgba(0,0,0,0.32)) drop-shadow(0 3px 5px rgba(0,0,0,0.18)) drop-shadow(0 5px 8px rgba(0,0,0,0.10));";
        deviceImg = `<img src="${esc(c.image_url)}" alt="device" style="display:block;width:${cq(42)};height:${cq(42)};object-fit:contain;border-radius:${cq(6)};${anim}${opac}${f}transition:opacity .3s ease,filter .3s ease;">`;
      } else if (c.device_icon) {
        const ic = isOn ? (c.color_on_name || "#1a1a1a") : (c.color_off_name || "rgba(255,255,255,0.5)");
        const f = isOn ? "filter:drop-shadow(0 1px 2px rgba(0,0,0,0.32)) drop-shadow(0 3px 5px rgba(0,0,0,0.18)) drop-shadow(0 5px 8px rgba(0,0,0,0.10));" : "";
        deviceImg = `<ha-icon icon="${esc(c.device_icon)}" style="--mdc-icon-size:${cq(42)};width:${cq(42)};height:${cq(42)};color:${ic};display:flex;${anim}${opac}${f}transition:opacity .3s ease,color .3s ease;"></ha-icon>`;
      }

      let status;
      if (isOn || isOff) {
        const knobLeft = isOn ? cq(26) : cq(2);
        if (c.control === false) {
          status = `<div class="tgl locked"><div class="track" style="background:${isOn ? "rgba(0,180,0,0.4)" : "rgba(100,100,100,0.4)"}"><div class="knob" style="left:${knobLeft};background:rgba(200,200,200,0.6);"></div></div></div>`;
        } else {
          status = `<div class="tgl live" id="mhc-toggle"><div class="track" style="background:${isOn ? "rgba(76,175,80,1)" : "rgba(100,100,100,0.6)"}"><div class="knob" style="left:${knobLeft};background:white;box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div></div></div>`;
        }
      } else if (state === "unavailable") {
        status = '<span style="color:rgba(255,200,200,0.8);">OFFLINE</span>';
      } else if (state === "unknown") {
        status = '<span style="color:rgba(255,255,255,0.5);">DESCONHECIDO</span>';
      } else {
        status = "<span>SEM ESTADO</span>";
      }

      const big = c.power_big !== false;
      const subOn = c.color_on_subtext, subOff = c.color_off_subtext;
      const row = (sensorId, icon, unit, area) => {
        const st = this._st(sensorId);
        if (!st) return `<div class="row" style="grid-area:${area}"></div>`;
        const ic = isOn ? subOn : "gold";
        const tc = isOn ? subOn : subOff;
        // a unidade sai da PRÓPRIA entidade, com a letra só de reserva: os
        // umidificadores Tuya locais reportam corrente em mA, e escrever
        // "153,0 A" seria mentira de três ordens de grandeza.
        // Sem leitura some também a unidade: "— V" sugere um valor que não existe.
        const u = st.attributes?.unit_of_measurement || unit || "";
        const text = noReading(st.state) ? NO_READING
          : `${esc(fmtNumber(st.state, this._hass?.locale?.language))} ${esc(u)}`;
        return `<div class="row sensor" style="grid-area:${area}" data-entity="${esc(sensorId)}">
          <ha-icon icon="${icon}" style="--mdc-icon-size:${cq(14)};width:${cq(14)};height:${cq(14)};color:${ic};"></ha-icon><span style="color:${tc};">${text}</span></div>`;
      };

      const powerColor = isOn ? c.color_power_on : c.color_power_off;
      const pSize = Number(c.power_font_size) || 34;
      const bigPower = () => {
        const st = this._st(c.sensor_potencia);
        if (!st) return `<div class="row" style="grid-area:power"></div>`;
        const isz = cq(Math.round(pSize * 0.62));
        const dash = noReading(st.state);
        const { value, unit } = dash
          ? { value: NO_READING, unit: "" }
          : fmtPower(st.state, st.attributes?.unit_of_measurement, this._hass?.locale?.language);
        return `<div class="row big sensor" style="grid-area:power" data-entity="${esc(c.sensor_potencia)}">
          <ha-icon icon="mdi:flash" style="--mdc-icon-size:${isz};width:${isz};height:${isz};color:${powerColor};"></ha-icon
          ><span class="pv">${esc(value)}</span><span class="pu">${esc(unit)}</span></div>`;
      };

      // sem as linhas de V/A o bloco fica baixo demais no card. transform em vez
      // de margem — não mexe na grade, então o número não muda de tamanho.
      const lift = Number(c.power_lift);
      const liftCss = big && Number.isFinite(lift) && lift !== 0
        ? `transform:translateY(-${cq(lift)});` : "";

      const hum = c.humidity_entity ? row(c.humidity_entity, "mdi:water-percent", "%", "humidity") : "";
      const areas = big
        ? `"device_img status" "n n"${hum ? ' "humidity humidity"' : ""} "power power"`
        : `"device_img status" "n n"${hum ? ' "humidity humidity"' : ""} "voltage voltage" "current current" "power power"`;
      const rows = big
        ? `1fr min-content${hum ? " min-content" : ""} min-content`
        : `1fr min-content${hum ? " min-content" : ""} min-content min-content min-content`;

      let protocol = "";
      if (c.protocol_icon) {
        // caído, o fundo é vinho escuro e o branco a 25% quase não aparece —
        // o selinho sobe para 45% para continuar visível.
        const pc = isOn
          ? (c.protocol_color_on || "rgba(20, 20, 20, 0.72)")
          : dead
            ? (c.protocol_color_off || "rgba(255, 255, 255, 0.45)")
            : (c.protocol_color_off || "rgba(255, 255, 255, 0.25)");
        const pf = isOn
          ? "drop-shadow( 1px  1px 0px rgba(255, 255, 255, 0.65)) drop-shadow(-1px -1px 1px rgba(0,   0,   0,   0.50))"
          : "none";
        const px = Number.isFinite(Number(c.protocol_offset_x)) ? Number(c.protocol_offset_x) : 10;
        const py = Number.isFinite(Number(c.protocol_offset_y)) ? Number(c.protocol_offset_y) : 10;
        protocol = `<ha-icon class="proto" icon="${esc(c.protocol_icon)}" style="bottom:${cq(py)};right:${cq(px)};width:${cq(22)};height:${cq(22)};color:${pc};filter:${pf};"></ha-icon>`;
      }

      const css = `
        /* line-height SEM unidade, obrigatoriamente: o frontend do HA define
           --paper-font-body1_-_line-height: 20px no body, e line-height é
           herdado. Um valor absoluto não encolhe com o card — a linha do nome
           ficava travada em 20 px enquanto todo o resto diminuía, e a partir
           de certa largura o conteúdo não cabia mais no quadrado e vazava
           pela base. Sem unidade, cada elemento calcula a linha a partir do
           PRÓPRIO font-size, que é proporcional ao tile. */
        .tile{position:relative;overflow:visible;border-radius:18px;padding:10%;
          font-size:16px;line-height:1.15;text-transform:uppercase;box-sizing:border-box;
          background:${bg};border:1px solid ${border};box-shadow:${shadow};
          transition:background .3s ease,border-color .3s ease,box-shadow .3s ease;}
        .tgrid{display:grid;position:relative;height:100%;
          grid-template-areas:${areas};grid-template-columns:1fr 1fr;grid-template-rows:${rows};}
        .wm{position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;
          background-size:60%;background-position:center center;background-repeat:no-repeat;border-radius:inherit;}
        .dev{grid-area:device_img;justify-self:start;align-self:start;position:relative;z-index:1;line-height:0;overflow:visible;}
        .stat{grid-area:status;align-self:start;justify-self:end;font-size:${cq(10)};font-weight:500;position:relative;z-index:1;}
        .nm{grid-area:n;font-weight:600;font-size:${cq(14)};color:${nameColor};align-self:center;justify-self:start;
          padding-top:${cq(6)};padding-bottom:${cq(6)};white-space:normal;word-wrap:break-word;text-align:left;
          text-transform:none;position:relative;z-index:1;
          display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;${liftCss}}
        /* text-transform:none na linha, não no card: o uppercase herdado do
           template original transformava "153 mA" em "153 MA" — miliampère
           vira megaampère, seis ordens de grandeza de diferença. */
        .row{padding-bottom:${cq(4)};align-self:center;justify-self:start;font-size:${cq(10)};font-weight:500;
          position:relative;z-index:1;display:inline-flex;align-items:center;gap:${cq(5)};
          text-transform:none;}
        .row ha-icon{flex:none;line-height:0;display:flex;align-items:center;}
        .row.sensor{cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
        .row.big{gap:${cq(6)};align-items:baseline;padding-bottom:${cq(2)};${liftCss}}
        .row.big ha-icon{align-self:center;flex:none;
          filter:${isOn ? "drop-shadow(0 1px 0 rgba(255,255,255,0.55))" : "none"};}
        /* tabular-nums trava a largura do dígito: o número não dança a cada leitura */
        .row.big .pv{font-size:${cq(pSize)};font-weight:700;line-height:1.05;color:${powerColor};
          font-variant-numeric:tabular-nums;font-feature-settings:"tnum" 1;letter-spacing:-0.5px;
          text-shadow:${isOn ? "0 1px 0 rgba(255,255,255,0.55)" : "none"};}
        .row.big .pu{font-size:${cq(Math.round(pSize * 0.4))};font-weight:600;color:${powerColor};
          opacity:.72;letter-spacing:0;}
        .tile span{font-size:${cq(12)};font-weight:500;line-height:1.4;}
        .proto{position:absolute;z-index:2;pointer-events:none;line-height:0;}
        .tgl{display:inline-flex;align-items:center;}
        .tgl.live{cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation;}
        .tgl.locked{cursor:not-allowed;opacity:0.35;}
        .track{width:${cq(48)};height:${cq(24)};border-radius:${cq(12)};position:relative;transition:background .3s;pointer-events:none;}
        .knob{width:${cq(20)};height:${cq(20)};border-radius:50%;position:absolute;top:${cq(2)};transition:left .3s;pointer-events:none;}
        @keyframes mhc-spin{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}`;

      const html = `
        <div class="tile" id="mhc-tile">
          ${watermark}
          <div class="tgrid">
            <div class="dev">${deviceImg}</div>
            <div class="stat">${status}</div>
            <div class="nm">${esc(c.name || (ent?.attributes?.friendly_name ?? c.entity))}</div>
            ${hum}
            ${big ? "" : row(c.sensor_voltagem, "mdi:lightning-bolt", "V", "voltage")}
            ${big ? "" : row(c.sensor_corrente, "mdi:current-ac", "A", "current")}
            ${big ? bigPower() : row(c.sensor_potencia, "mdi:flash", "W", "power")}
          </div>
          ${protocol}
        </div>`;

      return { css, html, isOn, isOff, dead, state };
    }

    /* ----------------------------- controles ----------------------------- */

    _buttonsBlock() {
      const c = this._config;
      const paper = paperGradient(c.paper_color);
      const size = Number(c.button_icon_size) || 46;
      const radius = Number.isFinite(Number(c.button_radius)) ? Number(c.button_radius) : 12;

      const cells = c.buttons.map((b, i) => {
        const st = this._st(b.entity);
        const state = st ? st.state : "unavailable";
        const dead = !st || state === "unavailable" || state === "unknown";
        const role = roleOf(b.entity);
        const sel = isSelect(b.entity);
        const on = dead ? false
          : sel ? !OFF_OPTIONS.includes(String(state).toLowerCase())
            : state === "on";

        const icon = dead ? "mdi:cancel" : (b.icon || st.attributes?.icon || role.icon);
        const iconColor = dead ? c.color_btn_dead
          : on ? (c.color_on_name || "#1a1a1a") : c.color_btn_icon_off;
        const iconFilter = dead
          ? "drop-shadow(0 0 2px rgba(200,0,0,1.0)) drop-shadow(0 0 8px rgba(220,0,0,0.95)) drop-shadow(0 0 18px rgba(200,0,0,0.80)) drop-shadow(0 0 32px rgba(180,0,0,0.55))"
          : on
            ? "drop-shadow(1px 2px 2px rgba(0,0,0,0.55)) drop-shadow(3px 6px 8px rgba(0,0,0,0.30)) drop-shadow(6px 12px 16px rgba(0,0,0,0.15))"
            : "none";
        const bg = on ? paper : c.color_off_bg;
        const border = on ? c.color_on_border : c.color_off_border;
        const shadow = on
          ? "0 0 8px 2px rgba(0,0,0,0.28), 0 4px 10px rgba(0,0,0,0.14), inset 2px 2px 4px rgba(255,250,235,0.80), inset -2px -2px 4px rgba(0,0,0,0.08)"
          : "inset 2px 2px 5px rgba(0,0,0,0.35), inset -1px -1px 3px rgba(255,255,255,0.04)";
        const textColor = dead ? c.color_btn_dead
          : on ? (c.color_on_name || "#1a1a1a") : c.color_btn_name_off;

        // o rótulo tem duas fontes: o nome (opcional) e o valor do select, que
        // é a informação do botão — «LEVEL 3» num quadrado de 60 px vira «3»
        let label = "";
        if (sel && c.show_select_value !== false && !dead) {
          label = shortOption(state);
        } else if (c.show_button_names === true) {
          label = b.name || role.label ||
            (st?.attributes?.friendly_name || b.entity).split(" ").pop();
        }
        const deadName = dead && label
          ? "text-decoration:line-through;text-shadow:0 0 2px rgba(200,0,0,1.0), 0 0 8px rgba(220,0,0,0.95), 0 0 18px rgba(200,0,0,0.80);"
          : "";

        return `<div class="btn" data-i="${i}" data-entity="${esc(b.entity)}"
          style="background:${bg};border:1px solid ${border};box-shadow:${shadow};border-radius:${radius}px;color:${textColor};">
          <ha-icon icon="${esc(icon)}" style="width:${size}%;height:${size}%;--mdc-icon-size:100%;color:${iconColor};filter:${iconFilter};"></ha-icon>
          ${label ? `<span class="bn" style="${deadName}">${esc(label)}</span>` : ""}
        </div>`;
      }).join("");

      const cols = Math.max(1, Number(c.button_columns) || 2);
      const css = `
        .btns{display:grid;grid-template-columns:repeat(${cols},1fr);gap:${Number(c.gap) || 0}px;
          align-content:start;min-width:0;min-height:0;}
        /* container-type:size + aspect-ratio = o botão é quadrado e o rótulo
           não pode mais empurrá-lo; e cqw deixa o texto proporcional ao
           quadrado, então cabe em qualquer largura de card */
        .btn{position:relative;aspect-ratio:1 / 1;container-type:size;min-width:0;min-height:0;
          line-height:1.15;display:flex;flex-direction:column;
          align-items:center;justify-content:center;gap:2%;box-sizing:border-box;overflow:hidden;
          font-weight:600;cursor:pointer;-webkit-tap-highlight-color:transparent;
          touch-action:manipulation;transition:background .3s ease,box-shadow .3s ease,border-color .3s ease,color .3s ease;}
        .btn ha-icon{display:flex;align-items:center;justify-content:center;flex:none;
          transition:color .3s ease,filter .3s ease;}
        .btn .bn{font-size:10cqw;font-weight:600;line-height:1.1;max-width:92%;text-align:center;
          overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}`;

      return { css, html: `<div class="btns">${cells}</div>` };
    }

    /* ------------------------------ render ------------------------------ */

    _render() {
      const c = this._config;
      const mode = c.mode;
      const withPower = mode !== "only_humidifier";
      const withButtons = mode !== "only_power";

      const power = withPower ? this._powerBlock() : null;
      // aparelho sem energia só sabe dizer «unavailable»: uma fileira de
      // mdi:cancel não informa nada que o selo OFFLINE da tomada já não tenha
      // contado. Some com os botões e o card não muda de altura — a tomada
      // continua ocupando a mesma metade.
      const hideControls = withPower && withButtons &&
        c.hide_controls_when_off !== false && power && !power.isOn;
      const buttons = withButtons && !hideControls ? this._buttonsBlock() : null;

      const twoUp = withPower && withButtons;
      const heightCss = c.height ? `height:${esc(c.height)};` : "";
      // No modo com tomada a proporção 1:1 do bloco da esquerda é quem define a
      // altura do card — as duas colunas 1fr fazem os quatro botões fecharem
      // exatamente a mesma altura.
      //
      // `container-type:size` é o que TRAVA o quadrado: com contenção de
      // tamanho, o conteúdo não pode mais empurrar a altura. Sem ela, um card
      // estreito (o conteúdo pedindo mais do que o lado do quadrado) fazia o
      // tile esticar e desalinhar da grade de botões. `min-height:0` desarma o
      // tamanho mínimo automático que todo item de grade carrega.
      // Nos modos de bloco único não há com o que alinhar: o tile preenche o
      // que receber, e a contenção fica só no eixo horizontal.
      const tileShape = twoUp
        ? "aspect-ratio:1 / 1;container-type:size;min-width:0;min-height:0;align-self:start;"
        : `height:100%;container-type:${c.height ? "size" : "inline-size"};min-width:0;`;

      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      this.shadowRoot.innerHTML = `
        <style>
          /* o elemento custom nasce inline: num pai flex ele encolheria para o
             conteúdo. Card é bloco, e ocupa a largura que recebe. */
          :host{display:block;width:100%;box-sizing:border-box;}
          ha-card{font-family:'Graphik',sans-serif;background:none;border:none;box-shadow:none;
            padding:0;overflow:visible;${heightCss}}
          .wrap{display:grid;gap:${Number(c.gap) || 0}px;align-items:start;
            grid-template-columns:${twoUp ? "1fr 1fr" : "1fr"};height:100%;}
          .tile{${tileShape}}
          ${power ? power.css : ""}
          ${buttons ? buttons.css : ""}
        </style>
        <ha-card>
          <div class="wrap">
            ${power ? power.html : ""}
            ${buttons ? buttons.html : ""}
          </div>
        </ha-card>`;

      this._wire(power);
    }

    _wire(power) {
      const c = this._config;
      const buzz = c.haptic !== false;
      const fireMoreInfo = (entityId) => this.dispatchEvent(new CustomEvent("hass-more-info",
        { bubbles: true, composed: true, detail: { entityId } }));

      // --- tomada ---
      const tgl = this.shadowRoot.getElementById("mhc-toggle");
      if (tgl) tgl.addEventListener("click", async (ev) => {
        ev.stopPropagation();
        if (c.confirm === true) {
          const ent = this._st(c.entity);
          const nome = c.name || ent?.attributes?.friendly_name || c.entity;
          const ok = await confirmAction(c.confirm_text, nome, power?.isOn ? "desligar" : "ligar");
          if (!ok) return;
        }
        this._hass.callService("switch", "toggle", { entity_id: c.entity });
      });

      this.shadowRoot.querySelectorAll(".row.sensor").forEach((el) =>
        el.addEventListener("click", (ev) => { ev.stopPropagation(); fireMoreInfo(el.dataset.entity); }));

      const tile = this.shadowRoot.getElementById("mhc-tile");
      if (tile) this._pressable(tile, () => fireMoreInfo(c.entity), buzz);

      // --- botões do aparelho ---
      this.shadowRoot.querySelectorAll(".btn").forEach((el) => {
        const id = el.dataset.entity;
        this._pressable(el, () => fireMoreInfo(id), buzz, () => this._tapButton(id));
      });
    }

    // toque curto executa, toque longo abre o more-info. O timer mora aqui
    // para tomada e botões não divergirem no tempo de espera.
    _pressable(el, onHold, buzz, onTap) {
      let timer = null;
      let held = false;
      el.addEventListener("pointerdown", () => {
        held = false;
        if (buzz) haptic("light");
        timer = setTimeout(() => {
          timer = null; held = true;
          if (buzz) haptic("medium");
          onHold();
        }, 500);
      });
      const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };
      ["pointerleave", "pointercancel"].forEach((t) => el.addEventListener(t, cancel));
      el.addEventListener("pointerup", cancel);
      if (onTap) {
        el.addEventListener("click", (ev) => {
          ev.stopPropagation();
          if (held) { held = false; return; }
          onTap();
        });
      }
    }

    async _tapButton(entityId) {
      const c = this._config;
      const st = this._st(entityId);
      if (!st) return;
      const domain = entityId.split(".")[0];
      if (c.confirm_buttons === true) {
        const nome = c.buttons.find((b) => b.entity === entityId)?.name ||
          st.attributes?.friendly_name || entityId;
        const acao = isSelect(entityId) ? "mudar" : isMomentary(entityId) ? "acionar"
          : st.state === "on" ? "desligar" : "ligar";
        const ok = await confirmAction(c.confirm_text, nome, acao);
        if (!ok) return;
      }
      if (isSelect(entityId)) {
        // gira para a próxima opção; a lista vem da própria entidade
        const opts = st.attributes?.options || [];
        if (!opts.length) return this.dispatchEvent(new CustomEvent("hass-more-info",
          { bubbles: true, composed: true, detail: { entityId } }));
        const next = opts[(opts.indexOf(st.state) + 1) % opts.length];
        return this._hass.callService(domain, "select_option",
          { entity_id: entityId, option: next });
      }
      if (domain === "button" || domain === "input_button") {
        return this._hass.callService(domain, "press", { entity_id: entityId });
      }
      if (domain === "scene") {
        return this._hass.callService("scene", "turn_on", { entity_id: entityId });
      }
      if (domain === "script") {
        return this._hass.callService("script", "turn_on", { entity_id: entityId });
      }
      return this._hass.callService("homeassistant", "toggle", { entity_id: entityId });
    }
  }

  /* ------------------------------- EDITOR ------------------------------- */

  const LABELS = {
    mode: "Modo do card",
    entity: "Tomada inteligente (switch)",
    name: "Nome (vazio = nome da tomada)",
    device_icon: "Ícone do aparelho",
    image_url: "Imagem do aparelho (URL — substitui o ícone)",
    __bg_preset: "Marca d'água de fundo",
    background_image_url: "URL da marca d'água (Custom)",
    background_transparent: "Transparência da marca d'água",
    sensor_voltagem: "Sensor de Voltagem",
    sensor_corrente: "Sensor de Corrente",
    sensor_potencia: "Sensor de Potência",
    humidity_entity: "Sensor de umidade do ambiente (opcional)",
    power_big: "Potência em destaque (esconde corrente e tensão)",
    power_font_size: "Tamanho da potência",
    power_lift: "Subir o nome e a potência",
    animate: "Animar o ícone da tomada quando ligada (girar)",
    protocol_icon: "Protocolo",
    protocol_offset_x: "Protocolo: distância da borda direita",
    protocol_offset_y: "Protocolo: distância da borda inferior",
    device: "Dispositivo do umidificador",
    buttons: "Botões do aparelho (na ordem em que aparecem)",
    button_columns: "Colunas de botões",
    button_icon_size: "Tamanho do ícone dentro do botão",
    button_radius: "Arredondamento dos botões",
    show_button_names: "Mostrar o nome dentro do botão",
    show_select_value: "Mostrar o valor das listas (nível de névoa, timer)",
    hide_controls_when_off: "Esconder os botões com a tomada desligada",
    confirm_buttons: "Pedir confirmação nos botões do aparelho",
    gap: "Espaço entre os blocos e entre os botões",
    height: "Altura do card (vazio = automática)",
    control: "Permitir ligar/desligar a tomada",
    haptic: "Vibrar ao tocar (feedback táctil no celular)",
    confirm: "Pedir confirmação na tomada",
    confirm_text: "Mensagem da confirmação ({nome} e {acao} são substituídos)",
    paper_color: "Cor do papel (ligado)",
    color_power_on: "Potência em destaque: ligado",
    color_power_off: "Potência em destaque: desligado",
    color_on_border: "Ligado: borda",
    color_on_name: "Ligado: nome e ícone",
    color_on_subtext: "Ligado: subtexto",
    color_off_bg: "Desligado: fundo",
    color_off_border: "Desligado: borda",
    color_off_name: "Desligado: nome",
    color_off_subtext: "Desligado: subtexto",
    color_unavail_bg: "Indisponível: fundo",
    color_unavail_border: "Indisponível: borda",
    color_unknown_bg: "Desconhecido: fundo",
    color_unknown_border: "Desconhecido: borda",
    color_btn_icon_off: "Botão desligado: ícone",
    color_btn_name_off: "Botão desligado: nome",
    color_btn_dead: "Botão sem resposta: ícone e nome",
    protocol_color_on: "Cor do protocolo (ligado)",
    protocol_color_off: "Cor do protocolo (desligado)",
  };

  const COLOR_FIELDS = [
    "color_power_on", "color_power_off",
    "color_on_border", "color_on_name", "color_on_subtext",
    "color_off_bg", "color_off_border", "color_off_name", "color_off_subtext",
    "color_unavail_bg", "color_unavail_border", "color_unknown_bg", "color_unknown_border",
    "color_btn_icon_off", "color_btn_name_off", "color_btn_dead",
    "protocol_color_on", "protocol_color_off",
  ];

  const parseColor = (str) => {
    const s = String(str || "").trim();
    let m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    m = s.match(/^#([0-9a-f]{6})$/i);
    if (m) { const n = parseInt(m[1], 16); return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 }; }
    m = s.match(/^#([0-9a-f]{3})$/i);
    if (m) { const [r, g, b] = m[1].split("").map((ch) => parseInt(ch + ch, 16)); return { r, g, b, a: 1 }; }
    return { r: 128, g: 128, b: 128, a: 1 };
  };
  const toHex = ({ r, g, b }) =>
    "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  const toRgba = ({ r, g, b, a }) => `rgba(${r}, ${g}, ${b}, ${a})`;

  const ALL = "__all__";
  const HUMID_RE = /umidific|humidif|vaporiz|difusor|diffuser/i;

  const deviceOf = (hass, entityId) => hass?.entities?.[entityId]?.device_id || "";
  const entitiesOfDevice = (hass, devId) => (devId && hass?.entities
    ? Object.keys(hass.entities).filter((id) => hass.entities[id].device_id === devId)
    : []);

  // Dispositivos que podem ser o umidificador. Listar TODOS seria uma lista de
  // centenas; listar só o que casa com "umidific" perderia o aparelho batizado
  // de outro jeito. Daí a cascata: casados primeiro, e se não houver nenhum,
  // todo dispositivo com dois ou mais switches (a assinatura de um aparelho
  // com vários controles).
  const humidifierDevices = (hass, keep) => {
    if (!hass?.devices || !hass?.entities) return [];
    const byDev = {};
    for (const [id, meta] of Object.entries(hass.entities)) {
      if (!meta.device_id) continue;
      if (!BTN_DOMAINS.includes(id.split(".")[0])) continue;
      (byDev[meta.device_id] = byDev[meta.device_id] || []).push(id);
    }
    const label = (devId) => hass.devices[devId]?.name_by_user ||
      hass.devices[devId]?.name || devId;
    const matches = Object.keys(byDev).filter((devId) =>
      HUMID_RE.test(label(devId)) || byDev[devId].some((id) => HUMID_RE.test(id)));
    let list = matches;
    if (!list.length) {
      list = Object.keys(byDev).filter((devId) =>
        byDev[devId].filter((id) => id.startsWith("switch.")).length >= 2);
    }
    if (keep && !list.includes(keep) && hass.devices[keep]) list = list.concat([keep]);
    return [{ value: ALL, label: "— todos os dispositivos —" }].concat(
      list.map((devId) => ({ value: devId, label: label(devId) }))
        .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")));
  };

  // Candidatos a botão: as entidades controláveis do dispositivo escolhido.
  // Sem dispositivo, tudo que a casa tem nos domínios de botão.
  const buttonCandidates = (hass, devId) => {
    if (!hass?.states) return [];
    const inDomain = (id) => BTN_DOMAINS.includes(id.split(".")[0]);
    if (devId && devId !== ALL) {
      const list = entitiesOfDevice(hass, devId).filter((id) => inDomain(id) && hass.states[id]);
      if (list.length) return list;
    }
    return Object.keys(hass.states).filter(inDomain);
  };

  // Preenchimento automático ao escolher o dispositivo: só switches, na ordem
  // canônica (tomada, névoa, LED, mudo, sono…). É o que a foto mostra; select
  // de nível e countdown entram por escolha, não por padrão.
  const autofillButtons = (hass, devId) => entitiesOfDevice(hass, devId)
    .filter((id) => AUTOFILL_DOMAINS.includes(id.split(".")[0]) && hass.states[id])
    .sort((a, b) => roleOf(a).order - roleOf(b).order || a.localeCompare(b))
    .slice(0, 8);

  class MwHumidifierCardEditor extends HTMLElement {
    setConfig(config) {
      this._config = { ...config, buttons: normalizeButtons(config.buttons) };
      this._renderForm();
    }
    set hass(hass) {
      this._hass = hass;
      // o filtro dos selects depende do hass: sem reconstruir o esquema aqui,
      // um hass que chegue depois do setConfig deixaria a lista sem filtro
      if (this._form) { this._form.hass = hass; this._form.schema = this._schema(); }
    }

    _preset() {
      const url = this._config?.background_image_url || "";
      if (url === PRESET_URLS.tuya) return "tuya";
      if (url === PRESET_URLS.tapo) return "tapo";
      return url ? "custom" : "none";
    }

    // Sensores da tomada, em cascata — nunca devolve lista vazia:
    //   1) mesmo dispositivo do switch (registro de entidades do frontend)
    //   2) object_id parecido (switch.tomada_x_tomada → sensor.tomada_x_*)
    //   3) todos os sensores
    _sensorSel(classes) {
      const hass = this._hass;
      const ent = this._config?.entity;
      if (!hass || !ent) return { entity: { domain: "sensor" } };
      const isSensor = (id) => id.startsWith("sensor.") && hass.states[id];
      let list = entitiesOfDevice(hass, deviceOf(hass, ent)).filter(isSensor);
      if (!list.length) {
        const base = ent.split(".")[1];
        list = Object.keys(hass.states).filter((id) => isSensor(id) && id.split(".")[1].startsWith(base));
      }
      if (!list.length) return { entity: { domain: "sensor" } };
      const typed = classes
        ? list.filter((id) => classes.includes(hass.states[id]?.attributes?.device_class))
        : [];
      return { entity: { include_entities: typed.length ? typed : list } };
    }

    _schema() {
      const cfg = { ...DEFAULTS, ...(this._config || {}) };
      const hass = this._hass;
      const preset = this._preset();
      const num = (min, max, unit, step) => ({
        number: { min, max, step: step || 1, mode: "box", unit_of_measurement: unit },
      });
      const sel = (options) => ({ select: { mode: "dropdown", options } });
      const withPower = cfg.mode !== "only_humidifier";
      const withButtons = cfg.mode !== "only_power";

      const s = [{
        name: "mode",
        selector: sel([
          { value: "with_power", label: "Com tomada — tomada + botões do aparelho" },
          { value: "only_humidifier", label: "Só o umidificador — apenas os botões" },
          { value: "only_power", label: "Só a tomada — apenas o bloco de energia" },
        ]),
      }];

      if (withPower) {
        s.push(
          { name: "entity", required: true, selector: { entity: { domain: "switch" } } },
          { name: "name", selector: { text: {} } },
          { name: "sensor_potencia", selector: this._sensorSel(["power", "apparent_power"]) },
          { name: "power_big", selector: { boolean: {} } },
        );
        // com a potência em destaque, tensão e corrente não são desenhadas —
        // não faz sentido continuar oferecendo os dois selects
        if (cfg.power_big === false) {
          s.push(
            { name: "sensor_voltagem", selector: this._sensorSel(["voltage"]) },
            { name: "sensor_corrente", selector: this._sensorSel(["current"]) },
          );
        }
      }

      if (withButtons) {
        const devices = hass ? humidifierDevices(hass, cfg.device) : [];
        if (devices.length > 1) s.push({ name: "device", selector: sel(devices) });
        const candidates = hass ? buttonCandidates(hass, cfg.device) : [];
        s.push({
          name: "buttons",
          selector: candidates.length
            ? { entity: { include_entities: candidates, multiple: true } }
            : { entity: { domain: BTN_DOMAINS, multiple: true } },
        });
      }

      if (withPower) {
        s.push({
          name: "", type: "expandable", title: "Tomada — aparência", schema: [
            { name: "device_icon", selector: { icon: {} } },
            { name: "image_url", selector: { text: {} } },
            {
              name: "__bg_preset", selector: sel([
                { value: "none", label: "Nenhuma" },
                { value: "tuya", label: "Tuya" },
                { value: "tapo", label: "Tapo" },
                { value: "custom", label: "Custom" },
              ]),
            },
            ...(preset === "custom" ? [{ name: "background_image_url", selector: { text: {} } }] : []),
            { name: "background_transparent", selector: { number: { min: 0, max: 1, step: 0.005, mode: "box" } } },
            ...(cfg.power_big !== false ? [
              { name: "power_font_size", selector: num(12, 96, "px") },
              { name: "power_lift", selector: num(-20, 60, "px") },
            ] : []),
            { name: "humidity_entity", selector: { entity: { domain: "sensor", device_class: "humidity" } } },
            { name: "animate", selector: { boolean: {} } },
            {
              name: "protocol_icon", selector: sel([
                { value: "", label: "Nenhum" },
                { value: "mdi:wifi", label: "Wi-Fi" },
                { value: "mdi:zigbee", label: "Zigbee" },
                { value: "mdi:bluetooth", label: "Bluetooth" },
                { value: "mdi:z-wave", label: "Z-Wave" },
              ]),
            },
            // a posição do selinho só faz sentido com um protocolo escolhido
            ...(cfg.protocol_icon ? [
              { name: "protocol_offset_x", selector: num(-20, 80, "px") },
              { name: "protocol_offset_y", selector: num(-20, 80, "px") },
            ] : []),
          ],
        });
      }

      if (withButtons) {
        s.push({
          name: "", type: "expandable", title: "Botões — aparência e comportamento", schema: [
            { name: "button_columns", selector: num(1, 6, "") },
            { name: "button_icon_size", selector: num(10, 100, "%") },
            { name: "button_radius", selector: num(0, 40, "px") },
            { name: "show_button_names", selector: { boolean: {} } },
            { name: "show_select_value", selector: { boolean: {} } },
            ...(withPower ? [{ name: "hide_controls_when_off", selector: { boolean: {} } }] : []),
            { name: "confirm_buttons", selector: { boolean: {} } },
          ],
        });
      }

      s.push({
        name: "", type: "expandable", title: "Geral", schema: [
          { name: "paper_color", selector: sel(paperOptions()) },
          { name: "gap", selector: num(0, 40, "px") },
          { name: "height", selector: { text: {} } },
          ...(withPower ? [{ name: "control", selector: { boolean: {} } }] : []),
          { name: "haptic", selector: { boolean: {} } },
          ...(withPower ? [{ name: "confirm", selector: { boolean: {} } }] : []),
          ...(cfg.confirm === true || cfg.confirm_buttons === true
            ? [{ name: "confirm_text", selector: { text: {} } }] : []),
        ],
      });

      return s;
    }

    _renderForm() {
      if (!this._form) {
        this._form = document.createElement("ha-form");
        this._form.computeLabel = (f) => LABELS[f.name] || f.name;
        this._form.addEventListener("value-changed", (ev) => this._onChange(ev));
        this.appendChild(this._form);
      }
      this._form.hass = this._hass;
      this._form.schema = this._schema();
      const data = { ...DEFAULTS, ...this._config };
      // o ha-form fala em lista de entity_id; a forma longa {entity,icon,name}
      // volta a existir no _onChange, casando pelo entity_id
      data.buttons = normalizeButtons(this._config?.buttons).map((b) => b.entity);
      data.__bg_preset = this._preset();
      for (const k of Object.keys(data)) if (data[k] === "") delete data[k];
      this._form.data = data;
      this._renderColors();
    }

    _renderColors() {
      if (!this._colorsEl) {
        this._colorsEl = document.createElement("details");
        this._colorsEl.style.cssText =
          "margin-top:16px;border:1px solid var(--divider-color);border-radius:8px;padding:8px 12px;";
        this.appendChild(this._colorsEl);
      }
      const rows = COLOR_FIELDS.map((name) => {
        const cur = this._config[name] ?? DEFAULTS[name] ?? "";
        const c = parseColor(cur || "rgba(128,128,128,1)");
        return `<div class="mhc-crow" data-name="${name}">
          <span class="lbl">${LABELS[name] || name}</span>
          <input type="color" value="${toHex(c)}" title="cor">
          <input type="range" min="0" max="1" step="0.01" value="${c.a}" title="transparência (alfa)">
          <code>${cur || "—"}</code>
        </div>`;
      }).join("");
      this._colorsEl.innerHTML = `
        <summary style="cursor:pointer;font-weight:500;">Cores (cor + transparência)</summary>
        <style>
          .mhc-crow{display:grid;grid-template-columns:1fr 44px 110px minmax(120px,1fr);gap:10px;
            align-items:center;padding:6px 0;}
          .mhc-crow .lbl{font-size:13px;}
          .mhc-crow input[type=color]{width:40px;height:28px;border:none;background:none;cursor:pointer;padding:0;}
          .mhc-crow code{font-size:11px;opacity:.7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        </style>${rows}`;
      this._colorsEl.querySelectorAll(".mhc-crow").forEach((rowEl) => {
        const name = rowEl.dataset.name;
        const apply = () => {
          const hex = rowEl.querySelector("input[type=color]").value;
          const a = parseFloat(rowEl.querySelector("input[type=range]").value);
          const { r, g, b } = parseColor(hex);
          const value = a >= 1 ? hex : toRgba({ r, g, b, a });
          const clean = { ...this._config };
          if (value === DEFAULTS[name]) delete clean[name]; else clean[name] = value;
          this._config = clean;
          rowEl.querySelector("code").textContent = clean[name] || "—";
          this.dispatchEvent(new CustomEvent("config-changed",
            { bubbles: true, composed: true, detail: { config: clean } }));
        };
        rowEl.querySelector("input[type=color]").addEventListener("input", apply);
        rowEl.querySelector("input[type=range]").addEventListener("input", apply);
      });
    }

    // a lista do formulário perde ícone e nome escritos à mão no YAML —
    // reencontra pelo entity_id e devolve a forma longa só a quem tinha
    _mergeButtons(ids) {
      const prev = normalizeButtons(this._config?.buttons);
      return (Array.isArray(ids) ? ids : []).map((id) => {
        const old = prev.find((b) => b.entity === id);
        return old && (old.icon || old.name) ? old : id;
      });
    }

    _onChange(ev) {
      ev.stopPropagation();
      const v = { ...ev.detail.value };
      const preset = v.__bg_preset;
      delete v.__bg_preset; // campo virtual do editor — nunca vai para o YAML
      if (preset === "tuya") v.background_image_url = PRESET_URLS.tuya;
      else if (preset === "tapo") v.background_image_url = PRESET_URLS.tapo;
      else if (preset === "none") v.background_image_url = "";
      else if (preset === "custom" &&
        (v.background_image_url === PRESET_URLS.tuya || v.background_image_url === PRESET_URLS.tapo)) {
        v.background_image_url = "";
      }
      if ("buttons" in v) v.buttons = this._mergeButtons(v.buttons);

      const clean = {};
      for (const [k, val] of Object.entries(v)) {
        if (val === undefined || val === null || val === "") continue;
        if (k === "buttons") { if (val.length) clean.buttons = val; continue; }
        if (k === "entity" || k === "mode" || k === "device" || val !== DEFAULTS[k]) clean[k] = val;
      }
      // trocar de dispositivo invalida os botões do antigo — e já traz os do novo
      if (clean.device && clean.device !== this._config.device) {
        const keep = normalizeButtons(clean.buttons)
          .filter((b) => clean.device === ALL || deviceOf(this._hass, b.entity) === clean.device);
        if (!keep.length && clean.device !== ALL && this._hass) {
          const auto = autofillButtons(this._hass, clean.device);
          if (auto.length) clean.buttons = auto; else delete clean.buttons;
        } else if (keep.length !== normalizeButtons(clean.buttons).length) {
          clean.buttons = keep.map((b) => (b.icon || b.name ? b : b.entity));
        }
      }
      // campo que o esquema escondeu (ex.: sensor de corrente com a potência em
      // destaque) não vem no evento — sem isto ele sumiria do YAML
      for (const [k, val] of Object.entries(this._config)) {
        if (!(k in v) && !COLOR_FIELDS.includes(k) && clean[k] === undefined) clean[k] = val;
      }
      // cores vivem fora do ha-form — preservar as já configuradas
      for (const k of COLOR_FIELDS) {
        if (this._config[k] !== undefined) clean[k] = this._config[k];
      }
      this._config = clean;
      this.dispatchEvent(new CustomEvent("config-changed",
        { bubbles: true, composed: true, detail: { config: clean } }));
      this._renderForm();
    }
  }

  // guarda contra dupla definição: durante a troca de instalação manual para
  // HACS os dois recursos convivem por um instante no Lovelace, e um segundo
  // `define` do mesmo nome derruba o arquivo inteiro com NotSupportedError
  if (!customElements.get("mw-humidifier-card")) {
    customElements.define("mw-humidifier-card", MwHumidifierCard);
  }
  if (!customElements.get("mw-humidifier-card-editor")) {
    customElements.define("mw-humidifier-card-editor", MwHumidifierCardEditor);
  }

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "mw-humidifier-card",
    name: "MW Humidifier Card",
    description: "Umidificador inteligente e a tomada que o alimenta num card só: V/A/W em destaque e os botões do aparelho (LED, mudo, sono, névoa).",
    preview: true,
    documentationURL: "https://github.com/visaodeempresa/mw-ha-humidifier-card",
  });

  console.info("%c MW-HUMIDIFIER-CARD %c 0.1.2 ",
    "background:#1a1a1a;color:#fdfaf3;font-weight:700;",
    "background:#8e7cc3;color:#1a1a1a;font-weight:700;");
})();
