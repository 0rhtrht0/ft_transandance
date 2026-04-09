import { describe, expect, it } from "vitest";
import {
  FILE_INPUT_ACCEPT,
  MAX_UPLOAD_SIZE_BYTES,
  formatFileSize,
  resolveClientPreviewKind,
  validateSelectedFiles,
} from "../routes/files/fileValidation.js";

describe("fileValidation", () => {
  it("formats sizes and exposes the accepted input list", () => {
    expect(FILE_INPUT_ACCEPT).toContain(".png");
    expect(FILE_INPUT_ACCEPT).toContain(".pdf");
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("accepts supported image and document files", () => {
    const { validFiles, errors } = validateSelectedFiles([
      { name: "avatar.png", type: "image/png", size: 1200 },
      { name: "notes.pdf", type: "application/pdf", size: 2400 },
      { name: "guide.md", type: "text/markdown", size: 450 },
    ]);

    expect(errors).toEqual([]);
    expect(validFiles).toHaveLength(3);
    expect(validFiles[0].previewKind).toBe("image");
    expect(validFiles[1].previewKind).toBe("pdf");
    expect(validFiles[2].previewKind).toBe("text");
  });

  it("rejects unsupported or oversized files", () => {
    const { validFiles, errors } = validateSelectedFiles([
      { name: "archive.zip", type: "application/zip", size: 500 },
      { name: "huge.png", type: "image/png", size: MAX_UPLOAD_SIZE_BYTES + 1 },
    ]);

    expect(validFiles).toHaveLength(0);
    expect(errors).toHaveLength(2);
  });

  it("resolves preview kinds from persisted file names", () => {
    expect(resolveClientPreviewKind({ original_name: "avatar.webp" })).toBe("image");
    expect(resolveClientPreviewKind({ original_name: "report.pdf" })).toBe("pdf");
    expect(resolveClientPreviewKind({ original_name: "notes.txt" })).toBe("text");
    expect(resolveClientPreviewKind({ original_name: "unknown.bin" })).toBe("generic");
  });
});
