// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from "@tailwindcss/vite";
import rehypeFigure from "rehype-figure";

// https://astro.build/config
export default defineConfig({
  site: 'https://nohakhaled.com', 
  vite: {
    plugins: [tailwindcss()],
  },
  markdown: {
    rehypePlugins: [rehypeFigure],
  },
});