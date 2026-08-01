// Registers @testing-library/jest-dom matchers (toBeInTheDocument, etc.) with
// Vitest's expect. Harmless for node-env logic tests — it only adds matchers.
import "@testing-library/jest-dom/vitest";
