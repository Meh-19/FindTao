import { describe, expect, it } from "vitest";
import { albumPreviewTarget } from "./albumPreviewTarget";

const base = { title: "Baggy jeans", image: "photo.jpg" };
const always = () => true;
const never = () => false;

describe("albumPreviewTarget", () => {
  it("returns a target for an album item whose store is known", () => {
    const item = { ...base, id: "album:pengreps:246493039", storeId: "pengreps" };
    expect(albumPreviewTarget(item, always)).toEqual({
      storeId: "pengreps",
      yupooId: "246493039",
      name: "Baggy jeans",
      cover: "photo.jpg",
    });
  });

  it("returns null when the album's store isn't in the directory", () => {
    const item = { ...base, id: "album:pengreps:1", storeId: "pengreps" };
    expect(albumPreviewTarget(item, never)).toBeNull();
  });

  it("returns null for an album item with no storeId (pasted-url origin)", () => {
    const item = { ...base, id: "album:pengreps:1", storeId: "" };
    expect(albumPreviewTarget(item, always)).toBeNull();
  });

  it("returns null for catalog items — they keep their detail-page link", () => {
    const item = { ...base, id: "cat:some-item", storeId: "pengreps" };
    expect(albumPreviewTarget(item, always)).toBeNull();
  });

  it("returns null for a raw/external id", () => {
    const item = { ...base, id: "manual:whatever", storeId: "pengreps" };
    expect(albumPreviewTarget(item, always)).toBeNull();
  });
});
