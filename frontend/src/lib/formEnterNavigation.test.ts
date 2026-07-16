import { afterEach, describe, expect, it } from "vitest";
import {
  getFocusableElements,
  shouldSkipEnterNavigation,
  focusNextFormField,
  handleFormEnterNavigation,
} from "./formEnterNavigation";

afterEach(() => {
  document.body.innerHTML = "";
});

function setup(html: string) {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

describe("getFocusableElements", () => {
  it("retorna campos visíveis e habilitados", () => {
    const form = setup(`
      <form>
        <input id="a" />
        <input id="b" disabled />
        <input id="c" type="hidden" />
        <select id="d"><option>x</option></select>
        <textarea id="e"></textarea>
        <button id="f">ok</button>
      </form>
    `);
    const ids = getFocusableElements(form).map((el) => el.id);
    expect(ids).toEqual(["a", "d", "e", "f"]);
  });
});

describe("shouldSkipEnterNavigation", () => {
  it("pula textarea", () => {
    const el = setup(`<textarea></textarea>`);
    expect(shouldSkipEnterNavigation(el)).toBe(true);
  });
  it("pula elementos data-enter-nav=skip", () => {
    const el = setup(`<input data-enter-nav="skip" />`);
    expect(shouldSkipEnterNavigation(el)).toBe(true);
  });
  it("pula combobox aberto", () => {
    const el = setup(`<input role="combobox" aria-expanded="true" />`);
    expect(shouldSkipEnterNavigation(el)).toBe(true);
  });
  it("pula botão submit", () => {
    const el = setup(`<button type="submit">enviar</button>`);
    expect(shouldSkipEnterNavigation(el)).toBe(true);
  });
  it("não pula input de texto comum", () => {
    const el = setup(`<input type="text" />`);
    expect(shouldSkipEnterNavigation(el)).toBe(false);
  });
});

describe("focusNextFormField", () => {
  it("move o foco para o próximo campo e seleciona texto", () => {
    const form = setup(`
      <form>
        <input id="a" value="x" />
        <input id="b" value="y" />
      </form>
    `);
    const a = form.querySelector<HTMLInputElement>("#a")!;
    a.focus();
    focusNextFormField(form, a);
    expect(document.activeElement?.id).toBe("b");
  });

  it("foca no submit quando é o último campo", () => {
    const form = setup(`
      <form>
        <input id="a" />
        <button id="s" type="submit">ok</button>
      </form>
    `);
    const a = form.querySelector<HTMLInputElement>("#a")!;
    focusNextFormField(form, a);
    expect(document.activeElement?.id).toBe("s");
  });

  it("procura submit externo quando a seção não tem submit", () => {
    setup(`
      <div data-enter-nav-group>
        <div id="sec" data-enter-nav="container">
          <input id="a" />
        </div>
        <button id="outer" type="submit">enviar</button>
      </div>
    `);
    const sec = document.getElementById("sec")!;
    const a = document.getElementById("a") as HTMLInputElement;
    focusNextFormField(sec, a);
    expect(document.activeElement?.id).toBe("outer");
  });

  it("não falha quando não há próximo campo nem submit", () => {
    const sec = setup(`
      <div data-enter-nav="container">
        <input id="a" />
      </div>
    `);
    const a = document.getElementById("a") as HTMLInputElement;
    expect(() => focusNextFormField(sec, a)).not.toThrow();
  });
});

describe("handleFormEnterNavigation", () => {
  it("previne submit e avança o foco em Enter", () => {
    const form = setup(`
      <form>
        <input id="a" />
        <input id="b" />
      </form>
    `);
    const a = form.querySelector<HTMLInputElement>("#a")!;
    a.focus();
    const ev = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    Object.defineProperty(ev, "target", { value: a });
    handleFormEnterNavigation(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe("b");
  });

  it("ignora teclas diferentes de Enter", () => {
    const ev = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
    handleFormEnterNavigation(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("respeita form com data-enter-submit=true", () => {
    const form = setup(`
      <form data-enter-submit="true">
        <input id="a" />
        <input id="b" />
      </form>
    `);
    const a = form.querySelector<HTMLInputElement>("#a")!;
    const ev = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });
    Object.defineProperty(ev, "target", { value: a });
    handleFormEnterNavigation(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it("ignora quando não há container", () => {
    const el = setup(`<input id="solto" />`);
    const ev = new KeyboardEvent("keydown", { key: "Enter", cancelable: true });
    Object.defineProperty(ev, "target", { value: el });
    handleFormEnterNavigation(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
});
