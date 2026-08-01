// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ItemLink } from "./ItemLink";

// Open-preview spy shared across tests.
const openPreview = vi.fn();

// Mock the preview module so we don't pull in AlbumModal's whole tree, but keep
// the *real* albumPreviewTarget logic (imported from its pure module).
vi.mock("@/lib/albumPreview", async () => {
  const { albumPreviewTarget } = await import("@/lib/albumPreviewTarget");
  return { albumPreviewTarget, useAlbumPreview: () => ({ openPreview }) };
});

// One known store, so album items resolve to a preview target.
vi.mock("@/lib/store", () => ({
  useStore: () => ({ allStores: [{ id: "pengreps" }] }),
}));

const album = {
  id: "album:pengreps:246493039",
  storeId: "pengreps",
  url: null,
  title: "Baggy jeans",
  image: "cover.jpg",
};

beforeEach(() => openPreview.mockClear());
afterEach(() => cleanup());

describe("ItemLink", () => {
  it("opens the preview modal (not navigation) for an album item with a known store", () => {
    const onNavigate = vi.fn();
    render(
      <ItemLink item={album} onNavigate={onNavigate}>
        <span>open me</span>
      </ItemLink>,
    );
    const btn = screen.getByRole("button", { name: /open me/i });
    fireEvent.click(btn);
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(openPreview).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: "pengreps", yupooId: "246493039" }),
    );
  });

  it("renders an in-app link (not a preview) for a catalog item", () => {
    render(
      <ItemLink item={{ id: "cat:some-item", storeId: "pengreps", url: null, title: "Tee", image: null }}>
        <span>catalog</span>
      </ItemLink>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/item/some-item");
  });

  it("renders an outbound link for a raw marketplace url", () => {
    render(
      <ItemLink
        item={{ id: "manual:1", storeId: "", url: "https://item.taobao.com/item.htm?id=1", title: "X", image: null }}
      >
        <span>external</span>
      </ItemLink>,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("href", "https://item.taobao.com/item.htm?id=1");
  });
});
