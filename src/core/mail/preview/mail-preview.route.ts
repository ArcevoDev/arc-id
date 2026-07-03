// src/core/mail/preview/mail-preview.route.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { compileMailTemplate } from "../mail.engine";
import { TEMPLATE_REGISTRY, TEMPLATE_NAMES } from "./template-registry";

/**
 * Development-only mail preview routes.
 * Registered only when NODE_ENV !== "production".
 *
 * GET /mail/preview
 * → HTML index listing all templates with clickable links
 *
 * GET /mail/preview/:template
 * → Rendered HTML of the template (view in browser)
 */
export async function mailPreviewRoute(fastify: FastifyInstance) {
  if (process.env.NODE_ENV === "production") return;

  // ── Index
  fastify.get(
    "/mail/preview",
    {
      schema: {
        hide: true, // Hides dev utility route from production swagger documents
      },
    },
    async (_req, reply) => {
      const links = TEMPLATE_NAMES.map(
        (name) =>
          `<li style="margin-bottom:8px">
           <a href="/mail/preview/${name}" target="_blank"
              style="color:#2563eb;font-family:monospace;font-size:14px">
             /mail/preview/${name}
           </a>
         </li>`,
      ).join("");

      return reply.type("text/html").send(`
        <!DOCTYPE html>
        <html>
          <head><title>ArcID Mail Preview</title></head>
          <body style="font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto">
            <h1 style="font-size:24px;font-weight:700;margin-bottom:4px">
              ArcID Mail Preview
            </h1>
            <p style="color:#6b7280;margin-bottom:24px">
              ${TEMPLATE_NAMES.length} templates available
            </p>
            <ul style="list-style:none;padding:0">${links}</ul>
          </body>
        </html>
      `);
    },
  );

  // ── Individual template
  fastify.get(
    "/mail/preview/:template",
    {
      schema: {
        hide: true,
        params: z.object({
          template: z.string(),
        }),
      },
    },
    async (req, reply) => {
      const { template } = req.params as { template: string };
      const element = TEMPLATE_REGISTRY[template];

      if (!element) {
        return reply.status(404).type("text/html").send(`
          <html><body style="font-family:sans-serif;padding:40px">
            <h2>Template not found: <code>${template}</code></h2>
            <p><a href="/mail/preview">← Back to index</a></p>
            <p>Available templates:</p>
            <ul>
              ${TEMPLATE_NAMES.map((n) => `<li><code>${n}</code></li>`).join("")}
            </ul>
          </body></html>
        `);
      }

      const html = await compileMailTemplate(element);

      // Inject a dev toolbar at the top of the preview
      const toolbar = `
        <div style="
          position:fixed;top:0;left:0;right:0;
          background:#111827;color:#f9fafb;
          padding:8px 16px;font-family:monospace;font-size:12px;
          display:flex;align-items:center;gap:16px;z-index:9999
        ">
          <span style="font-weight:700;color:#60a5fa">ArcID Mail Preview</span>
          <span style="color:#9ca3af">${template}</span>
          <a href="/mail/preview" style="color:#60a5fa;margin-left:auto">
            ← All templates
          </a>
        </div>
        <div style="height:36px"></div>
      `;

      return reply
        .type("text/html")
        .send(html.replace("<body", `<body`) + toolbar);
    },
  );
}
