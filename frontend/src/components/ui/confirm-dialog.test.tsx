import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  it("oferece modo informativo com uma única ação", async () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Detalhes da cobrança"
        confirmText="Fechar"
        hideCancel
        onConfirm={onClose}
        onCancel={onClose}
      >
        <p>Conteúdo</p>
      </ConfirmDialog>,
    );

    expect(screen.getByRole("dialog", { name: "Detalhes da cobrança" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancelar" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("solicita fechamento com Escape", async () => {
    const onCancel = vi.fn();
    const { rerender } = render(
      <>
        <button type="button">Abrir</button>
        <ConfirmDialog open={false} title="Confirmação" onConfirm={vi.fn()} onCancel={onCancel} />
      </>,
    );
    const trigger = screen.getByRole("button", { name: "Abrir" });
    trigger.focus();
    rerender(
      <>
        <button type="button">Abrir</button>
        <ConfirmDialog open title="Confirmação" onConfirm={vi.fn()} onCancel={onCancel} />
      </>,
    );

    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
