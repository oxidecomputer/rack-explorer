/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Copyright Oxide Computer Company
 */

import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

function analyticsPlugin(domain: string | undefined): Plugin {
  return {
    name: "inject-analytics",
    transformIndexHtml(html) {
      if (!domain) return html.replace("<!--analytics-->", "");
      const tag = `<script defer data-domain="${domain}" src="/js/viewscript.js"></script>`;
      return html.replace("<!--analytics-->", tag);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), tailwindcss(), analyticsPlugin(env.VITE_ANALYTICS_DOMAIN)],
  };
});
