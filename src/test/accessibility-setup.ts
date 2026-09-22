/**
 * Accessibility testing setup.
 * Provides utilities for accessibility validation.
 */

import { ReactElement } from "react";
import { render } from "@testing-library/react";

export interface AccessibilityCheckResult {
  container: HTMLElement;
  hasLabels: boolean;
  hasKeyboardSupport: boolean;
  hasAriaAttributes: boolean;
}

/**
 * Check if a component has proper accessibility attributes.
 */
export function checkAccessibility(component: ReactElement): AccessibilityCheckResult {
  const { container } = render(component);

  const inputs = container.querySelectorAll("input");
  const labels = container.querySelectorAll("label");
  const buttons = container.querySelectorAll("button");

  const hasLabels = inputs.length === 0 || labels.length >= inputs.length;
  const hasKeyboardSupport = Array.from(buttons).every(
    (btn) => btn.getAttribute("tabindex") !== "-1"
  );
  const hasAriaAttributes = container.querySelector("[aria-label], [aria-labelledby], [role]") !== null;

  return {
    container,
    hasLabels,
    hasKeyboardSupport,
    hasAriaAttributes,
  };
}

/**
 * Get all form inputs that are missing labels.
 */
export function getInputsWithoutLabels(container: HTMLElement): HTMLInputElement[] {
  const inputs = Array.from(container.querySelectorAll("input"));
  const missingLabels: HTMLInputElement[] = [];

  inputs.forEach((input) => {
    const id = input.getAttribute("id");
    const ariaLabel = input.getAttribute("aria-label");
    const ariaLabelledBy = input.getAttribute("aria-labelledby");

    if (!id && !ariaLabel && !ariaLabelledBy) {
      missingLabels.push(input);
    } else if (id) {
      const label = container.querySelector(`label[for="${id}"]`);
      if (!label && !ariaLabel && !ariaLabelledBy) {
        missingLabels.push(input);
      }
    }
  });

  return missingLabels;
}
