import { describe, it, expect } from "vitest";

// Tooltip positioning logic under test
function getTooltipStyle(
  spotlightRect: DOMRect | null,
  windowInnerHeight: number,
  windowInnerWidth: number
) {
  if (!spotlightRect) {
    return {
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '320px'
    };
  }
  const placeAbove = spotlightRect.bottom > windowInnerHeight - 240 && spotlightRect.top > 200;
  const topVal = placeAbove 
    ? `${spotlightRect.top - 16}px` 
    : `${spotlightRect.bottom + 16}px`;
  const leftVal = `${Math.max(16, Math.min(windowInnerWidth - 336, spotlightRect.left + spotlightRect.width / 2 - 160))}px`;
  return {
    top: topVal,
    left: leftVal,
    transform: placeAbove ? 'translateY(-100%)' : 'none',
    width: '320px',
    transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
  };
}

// Redirect target ID logic under test
function getTargetId(targetId: string, windowInnerWidth: number) {
  if (targetId === 'tour-header-nav' && windowInnerWidth <= 768) {
    return 'tour-mobile-nav';
  }
  return targetId;
}

describe("Walkthrough Tour Helper Logic", () => {
  describe("getTargetId", () => {
    it("redirects tour-header-nav to tour-mobile-nav on mobile viewports", () => {
      expect(getTargetId("tour-header-nav", 500)).toBe("tour-mobile-nav");
      expect(getTargetId("tour-header-nav", 768)).toBe("tour-mobile-nav");
    });

    it("keeps tour-header-nav on desktop viewports", () => {
      expect(getTargetId("tour-header-nav", 1024)).toBe("tour-header-nav");
    });

    it("keeps other target IDs unchanged", () => {
      expect(getTargetId("tour-record-btn", 500)).toBe("tour-record-btn");
      expect(getTargetId("tour-style-select", 1024)).toBe("tour-style-select");
    });
  });

  describe("getTooltipStyle", () => {
    it("centers tooltip when no spotlight rect is present", () => {
      const style = getTooltipStyle(null, 800, 1200);
      expect(style).toEqual({
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '320px'
      });
    });

    it("places tooltip below target when there is plenty of space below", () => {
      const rect = {
        top: 50,
        bottom: 100,
        left: 100,
        width: 200,
        height: 50,
        right: 300,
        x: 100,
        y: 50,
        toJSON: () => {}
      } as DOMRect;

      const style = getTooltipStyle(rect, 800, 1200);
      expect(style.top).toBe("116px"); // bottom (100) + 16
      expect(style.transform).toBe("none");
    });

    it("places tooltip above target when space below is tight", () => {
      const rect = {
        top: 600,
        bottom: 650,
        left: 100,
        width: 200,
        height: 50,
        right: 300,
        x: 100,
        y: 600,
        toJSON: () => {}
      } as DOMRect;

      const style = getTooltipStyle(rect, 800, 1200);
      expect(style.top).toBe("584px"); // top (600) - 16
      expect(style.transform).toBe("translateY(-100%)");
    });

    it("places tooltip below target when space below is tight but spotlight is too close to top of viewport", () => {
      const rect = {
        top: 150,
        bottom: 600, // bottom (600) > 800 - 240 (560) is tight
        left: 100,
        width: 200,
        height: 450,
        right: 300,
        x: 100,
        y: 150,
        toJSON: () => {}
      } as DOMRect;

      const style = getTooltipStyle(rect, 800, 1200);
      expect(style.top).toBe("616px"); // bottom (600) + 16 (placed below)
      expect(style.transform).toBe("none");
    });

    it("clamps tooltip horizontal alignment within left screen bounds", () => {
      const rect = {
        top: 100,
        bottom: 150,
        left: 0,
        width: 50,
        height: 50,
        right: 50,
        x: 0,
        y: 100,
        toJSON: () => {}
      } as DOMRect;

      const style = getTooltipStyle(rect, 800, 1200);
      expect(style.left).toBe("16px");
    });

    it("clamps tooltip horizontal alignment within right screen bounds", () => {
      const rect = {
        top: 100,
        bottom: 150,
        left: 1150,
        width: 50,
        height: 50,
        right: 1200,
        x: 1150,
        y: 100,
        toJSON: () => {}
      } as DOMRect;

      const style = getTooltipStyle(rect, 800, 1200);
      expect(style.left).toBe("864px");
    });
  });
});
