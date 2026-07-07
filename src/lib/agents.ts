import type { AgentConfig } from "./links";

/**
 * Agent registry. Data, not code: adding/retiring an agent or fixing a URL
 * format is an edit here (or in a DB row later), never a logic change.
 *
 * ⚠ Template shapes are best-effort and drift over time — verify each one
 * against the live agent site before launch. See README "Verifying agents".
 */
export const AGENTS: AgentConfig[] = [
  {
    id: "kakobuy",
    name: "Kakobuy",
    homepage: "https://www.kakobuy.com",
    templates: { all: "https://www.kakobuy.com/item/details?url={encodedRawUrl}" },
    active: true,
  },
  {
    id: "superbuy",
    name: "Superbuy",
    homepage: "https://www.superbuy.com",
    templates: { all: "https://www.superbuy.com/en/page/buy/?url={encodedRawUrl}" },
    active: true,
  },
  {
    id: "wegobuy",
    name: "Wegobuy",
    homepage: "https://www.wegobuy.com",
    templates: { all: "https://www.wegobuy.com/en/page/buy/?url={encodedRawUrl}" },
    active: true,
  },
  {
    id: "sugargoo",
    name: "Sugargoo",
    homepage: "https://www.sugargoo.com",
    templates: { all: "https://www.sugargoo.com/#/home/productDetail?productLink={encodedRawUrl}" },
    active: true,
  },
  {
    id: "cnfans",
    name: "CNFans",
    homepage: "https://cnfans.com",
    templates: {
      taobao: "https://cnfans.com/product/?shop_type=taobao&id={itemId}",
      weidian: "https://cnfans.com/product/?shop_type=weidian&id={itemId}",
      "1688": "https://cnfans.com/product/?shop_type=ali_1688&id={itemId}",
    },
    active: true,
  },
  {
    id: "mulebuy",
    name: "Mulebuy",
    homepage: "https://mulebuy.com",
    templates: {
      taobao: "https://mulebuy.com/product/?shop_type=taobao&id={itemId}",
      weidian: "https://mulebuy.com/product/?shop_type=weidian&id={itemId}",
      "1688": "https://mulebuy.com/product/?shop_type=ali_1688&id={itemId}",
    },
    active: true,
  },
  {
    id: "cssbuy",
    name: "CSSBuy",
    homepage: "https://www.cssbuy.com",
    templates: {
      taobao: "https://www.cssbuy.com/item-{itemId}.html",
      weidian: "https://www.cssbuy.com/item-micro-{itemId}.html",
      "1688": "https://www.cssbuy.com/item-1688-{itemId}.html",
    },
    active: true,
  },
  {
    id: "basetao",
    name: "Basetao",
    homepage: "https://www.basetao.com",
    templates: {
      taobao: "https://www.basetao.com/best-taobao-agent-service/products/agent/taobao/{itemId}.html",
      weidian: "https://www.basetao.com/best-taobao-agent-service/products/agent/weidian/{itemId}.html",
      "1688": "https://www.basetao.com/best-taobao-agent-service/products/agent/1688/{itemId}.html",
    },
    active: true,
  },
  {
    id: "allchinabuy",
    name: "AllChinaBuy",
    homepage: "https://www.allchinabuy.com",
    templates: { all: "https://www.allchinabuy.com/en/page/buy/?url={encodedRawUrl}" },
    active: true,
  },
  {
    id: "loongbuy",
    name: "Loongbuy",
    homepage: "https://www.loongbuy.com",
    templates: { all: "https://www.loongbuy.com/product-details?url={encodedRawUrl}" },
    active: true,
    note: "Format unverified — confirm against a real Loongbuy product page.",
  },
  {
    id: "gtbuy",
    name: "GTBuy",
    homepage: "https://www.gtbuy.com",
    templates: { all: "https://www.gtbuy.com/goods/detail?url={encodedRawUrl}" },
    active: true,
    note: "Format unverified — confirm against a real GTBuy product page.",
  },
  {
    id: "pandabuy",
    name: "Pandabuy",
    homepage: "https://www.pandabuy.com",
    templates: { all: "https://www.pandabuy.com/product?url={encodedRawUrl}" },
    active: false,
    note: "Largely defunct since 2024 — flip active if it returns.",
  },
];

export const ACTIVE_AGENTS = AGENTS.filter((a) => a.active);

export const DEFAULT_AGENT_ID = ACTIVE_AGENTS[0].id;

export function getAgent(id: string): AgentConfig | undefined {
  return AGENTS.find((a) => a.id === id);
}
