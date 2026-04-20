import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExportControls } from "@/components/ExportControls";

describe("ExportControls", () => {
  beforeEach(() => {
    cleanup();
  });

  it("defaults to JSON and calls onDownload with json", async () => {
    const onDownload = vi.fn();
    render(<ExportControls expand={{}} pubmed={null} clinvar={null} onDownload={onDownload} />);

    const select = screen.getByRole("combobox");
    expect((select as HTMLSelectElement).value).toBe("json");

    const button = screen.getByRole("button", { name: /download/i });
    await userEvent.click(button);
    expect(onDownload).toHaveBeenCalledWith("json");
  });

  it("selects CSV and calls onDownload with csv", async () => {
    const onDownload = vi.fn();
    render(<ExportControls expand={{}} pubmed={null} clinvar={null} onDownload={onDownload} />);

    const select = screen.getByRole("combobox");
    await userEvent.selectOptions(select, "csv");
    expect((select as HTMLSelectElement).value).toBe("csv");

    const button = screen.getByRole("button", { name: /download/i });
    await userEvent.click(button);
    expect(onDownload).toHaveBeenCalledWith("csv");
  });
});
