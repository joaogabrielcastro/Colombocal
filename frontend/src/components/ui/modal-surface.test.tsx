import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ModalSurface } from "./modal-surface";

describe("ModalSurface", () => {
  it("fecha com Escape e impede rolagem do fundo", async () => {
    const onClose = vi.fn();
    render(
      <ModalSurface open ariaLabel="Editar cadastro" onClose={onClose}>
        <button type="button">Salvar</button>
      </ModalSurface>,
    );

    expect(screen.getByRole("dialog", { name: "Editar cadastro" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("move o foco para o primeiro controle", () => {
    render(
      <ModalSurface open ariaLabel="Novo cadastro" onClose={vi.fn()}>
        <input aria-label="Nome" />
        <button type="button">Salvar</button>
      </ModalSurface>,
    );

    expect(screen.getByLabelText("Nome")).toHaveFocus();
  });
});
