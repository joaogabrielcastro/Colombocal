const FOCUSABLE_SELECTOR = [
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
].join(", ");

function isVisible(el: HTMLElement): boolean {
  if (el.closest("[hidden]")) return false;
  const style = window.getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden";
}

/** Campos focáveis do container, na ordem do DOM. */
export function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    isVisible,
  );
}

function findEnterNavContainer(target: HTMLElement): HTMLElement | null {
  const form = target.closest("form");
  if (form instanceof HTMLFormElement) return form;
  const section = target.closest('[data-enter-nav="container"]');
  return section instanceof HTMLElement ? section : null;
}

export function shouldSkipEnterNavigation(target: HTMLElement): boolean {
  if (target.dataset.enterNav === "skip") return true;
  if (target.closest('[data-enter-nav="skip"]')) return true;
  if (target.tagName === "TEXTAREA") return true;
  if (
    target.getAttribute("role") === "combobox" &&
    target.getAttribute("aria-expanded") === "true"
  ) {
    return true;
  }
  if (target.tagName === "BUTTON") {
    const type = (target as HTMLButtonElement).type;
    if (type === "submit") return true;
  }
  if (target instanceof HTMLInputElement && target.type === "submit") return true;
  return false;
}

export function focusNextFormField(
  container: HTMLElement,
  current: HTMLElement,
): void {
  const focusables = getFocusableElements(container);
  const idx = focusables.indexOf(current);

  if (idx >= 0 && idx < focusables.length - 1) {
    const next = focusables[idx + 1];
    next.focus();
    if (
      next instanceof HTMLInputElement &&
      !["checkbox", "radio", "button", "submit"].includes(next.type)
    ) {
      next.select();
    }
    return;
  }

  const submit = container.querySelector<HTMLElement>(
    'button[type="submit"]:not([disabled]), input[type="submit"]:not([disabled])',
  );
  if (submit && submit !== current) {
    submit.focus();
    return;
  }

  // Seção sem submit: tenta o primeiro botão submit do documento próximo (ex.: card → form)
  const outerSubmit = container
    .closest("[data-enter-nav-group]")
    ?.querySelector<HTMLElement>(
      'button[type="submit"]:not([disabled]), input[type="submit"]:not([disabled])',
    );
  outerSubmit?.focus();
}

/** Enter avança para o próximo campo; só envia se o foco estiver no botão de submit. */
export function handleFormEnterNavigation(event: KeyboardEvent): void {
  if (event.key !== "Enter") return;
  if (event.defaultPrevented) return;
  if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;

  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const container = findEnterNavContainer(target);
  if (!container) return;
  if (
    container instanceof HTMLFormElement &&
    container.dataset.enterSubmit === "true"
  ) {
    return;
  }

  if (shouldSkipEnterNavigation(target)) return;

  event.preventDefault();
  focusNextFormField(container, target);
}
