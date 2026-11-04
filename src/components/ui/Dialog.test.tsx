import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dialog } from "./Dialog";

describe("Dialog", () => {
  it("renders nothing when closed", () => {
    render(<Dialog open={false} title="T" onClose={() => undefined} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is labelled, focuses inside and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Dialog
        open
        title="Finalizar Firefox?"
        description="O processo será encerrado."
        confirmLabel="Finalizar"
        onConfirm={() => undefined}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole("dialog", { name: "Finalizar Firefox?" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("O processo será encerrado.");
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close while locked and calls confirm", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(
      <Dialog open locked title="Limpando" confirmLabel="OK" onConfirm={onConfirm} onClose={onClose} />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
