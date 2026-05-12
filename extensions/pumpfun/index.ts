import type { ClawdbotPluginApi } from "../../src/plugins/types.js";

import {
  createPumpFunLaunchTool,
  createPumpFunBuyTool,
  createPumpFunSellTool,
  createPumpFunPriceTool,
  createPumpFunInfoTool,
  createPumpFunQuoteTool,
} from "./src/pumpfun-tools.js";

export default function register(api: ClawdbotPluginApi) {
  // Token launch tool
  api.registerTool(
    (ctx) => {
      if (ctx.sandboxed) return null;
      return createPumpFunLaunchTool(api);
    },
    { optional: true }
  );

  // Buy tool
  api.registerTool(
    (ctx) => {
      if (ctx.sandboxed) return null;
      return createPumpFunBuyTool(api);
    },
    { optional: true }
  );

  // Sell tool
  api.registerTool(
    (ctx) => {
      if (ctx.sandboxed) return null;
      return createPumpFunSellTool(api);
    },
    { optional: true }
  );

  // Price tool
  api.registerTool(
    (ctx) => {
      if (ctx.sandboxed) return null;
      return createPumpFunPriceTool(api);
    },
    { optional: true }
  );

  // Info tool
  api.registerTool(
    (ctx) => {
      if (ctx.sandboxed) return null;
      return createPumpFunInfoTool(api);
    },
    { optional: true }
  );

  // Quote tool
  api.registerTool(
    (ctx) => {
      if (ctx.sandboxed) return null;
      return createPumpFunQuoteTool(api);
    },
    { optional: true }
  );
}
