import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CoverageScrollRegion } from "./coverage-scroll-region";

describe("Coverage scroll regions", () => {
  test("renders a focusable, labelled native scroll region", () => {
    const html = renderToStaticMarkup(
      <CoverageScrollRegion ariaLabel="已有讨论内容">
        <p>内容</p>
      </CoverageScrollRegion>
    );

    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="已有讨论内容"');
    expect(html).toContain('data-coverage-scroll-region="true"');
  });
});
