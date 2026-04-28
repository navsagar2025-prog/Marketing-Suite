import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, leadFormsTable, websitesTable } from "@workspace/db";
import type { LeadFormField } from "@workspace/db";

const router: IRouter = Router();

const VALID_FIELD_NAMES = ["name", "email", "phone", "message"] as const;

function parseFieldsJson(raw: unknown): LeadFormField[] {
  if (!Array.isArray(raw)) return defaultFields();
  return raw.filter((f): f is LeadFormField =>
    f !== null &&
    typeof f === "object" &&
    VALID_FIELD_NAMES.includes((f as LeadFormField).name) &&
    typeof (f as LeadFormField).enabled === "boolean" &&
    typeof (f as LeadFormField).required === "boolean"
  );
}

function defaultFields(): LeadFormField[] {
  return [
    { name: "name", enabled: true, required: true },
    { name: "email", enabled: true, required: true },
    { name: "phone", enabled: false, required: false },
    { name: "message", enabled: false, required: false },
  ];
}

router.get("/lead-forms", async (req, res): Promise<void> => {
  const forms = await db.select().from(leadFormsTable).orderBy(leadFormsTable.createdAt);
  res.json(forms);
});

router.post("/lead-forms", async (req, res): Promise<void> => {
  const body = req.body as { name?: unknown; websiteId?: unknown; fieldsJson?: unknown; active?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const websiteId = typeof body.websiteId === "number" ? body.websiteId : parseInt(String(body.websiteId));
  if (!name) { res.status(400).json({ error: "name is required" }); return; }
  if (isNaN(websiteId) || websiteId < 1) { res.status(400).json({ error: "websiteId is required" }); return; }
  const [site] = await db.select({ id: websitesTable.id }).from(websitesTable).where(eq(websitesTable.id, websiteId));
  if (!site) { res.status(400).json({ error: "Website not found" }); return; }
  const fieldsJson = parseFieldsJson(body.fieldsJson ?? null) || defaultFields();
  const active = body.active !== false;
  const [form] = await db.insert(leadFormsTable).values({ name, websiteId, fieldsJson, active }).returning();
  res.status(201).json(form);
});

router.patch("/lead-forms/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [existing] = await db.select().from(leadFormsTable).where(eq(leadFormsTable.id, id));
  if (!existing) { res.status(404).json({ error: "Form not found" }); return; }
  const body = req.body as { name?: unknown; fieldsJson?: unknown; active?: unknown };
  const updates: Partial<typeof leadFormsTable.$inferInsert> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (Array.isArray(body.fieldsJson)) updates.fieldsJson = parseFieldsJson(body.fieldsJson);
  if (typeof body.active === "boolean") updates.active = body.active;
  if (Object.keys(updates).length === 0) { res.json(existing); return; }
  const [updated] = await db.update(leadFormsTable).set(updates).where(eq(leadFormsTable.id, id)).returning();
  res.json(updated);
});

router.delete("/lead-forms/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [form] = await db.delete(leadFormsTable).where(eq(leadFormsTable.id, id)).returning();
  if (!form) { res.status(404).json({ error: "Form not found" }); return; }
  res.sendStatus(204);
});

router.get("/lead-forms/:id/embed", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [form] = await db.select().from(leadFormsTable).where(eq(leadFormsTable.id, id));
  if (!form) { res.status(404).json({ error: "Form not found" }); return; }

  const fields = (form.fieldsJson ?? []) as LeadFormField[];
  const enabledFields = fields.filter(f => f.enabled);

  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host || "YOUR_DOMAIN";
  const baseUrl = `${proto}://${host}`;

  const fieldsHtml = enabledFields.map(f => {
    const isTextarea = f.name === "message";
    const label = f.name.charAt(0).toUpperCase() + f.name.slice(1);
    const required = f.required ? "required" : "";
    if (isTextarea) {
      return `<div style="margin-bottom:12px"><label style="display:block;font-size:13px;font-weight:500;margin-bottom:4px;color:#374151">${label}${f.required ? " *" : ""}</label><textarea name="${f.name}" ${required} rows="3" style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;font-family:inherit;box-sizing:border-box;resize:vertical"></textarea></div>`;
    }
    const type = f.name === "email" ? "email" : f.name === "phone" ? "tel" : "text";
    return `<div style="margin-bottom:12px"><label style="display:block;font-size:13px;font-weight:500;margin-bottom:4px;color:#374151">${label}${f.required ? " *" : ""}</label><input type="${type}" name="${f.name}" ${required} style="width:100%;padding:8px 12px;border:1px solid #d1d5db;border-radius:6px;font-size:14px;font-family:inherit;box-sizing:border-box" /></div>`;
  }).join("");

  const script = `(function(){
  var containerId = "lf-form-${id}";
  var submitUrl = "${baseUrl}/api/public/forms/${id}/submit";
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<form id="lf-frm-${id}" style="font-family:system-ui,sans-serif;max-width:480px;padding:24px;border:1px solid #e5e7eb;border-radius:10px;background:#fff">' +
    '${fieldsHtml.replace(/\n/g, "").replace(/'/g, "\\'")}' +
    '<input name="_hp" style="display:none" tabindex="-1" autocomplete="off" />' +
    '<button type="submit" style="width:100%;padding:10px 16px;background:#2563eb;color:#fff;border:none;border-radius:6px;font-size:15px;font-weight:500;cursor:pointer">Submit</button>' +
    '<p id="lf-msg-${id}" style="margin-top:10px;font-size:13px;text-align:center"></p>' +
    '</form>';
  var frm = document.getElementById("lf-frm-${id}");
  frm.addEventListener("submit", function(e){
    e.preventDefault();
    var data = {};
    var els = frm.elements;
    for (var i=0;i<els.length;i++) { if (els[i].name) data[els[i].name] = els[i].value; }
    var msg = document.getElementById("lf-msg-${id}");
    msg.textContent = "Sending...";
    fetch(submitUrl, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)})
      .then(function(r){ return r.json().then(function(d){ return {ok:r.ok,data:d}; }); })
      .then(function(r){
        if (r.ok) { frm.style.display="none"; msg.style.color="#16a34a"; msg.textContent="Thank you! We\\'ll be in touch."; }
        else { msg.style.color="#dc2626"; msg.textContent = r.data.error || "Something went wrong. Please try again."; }
      })
      .catch(function(){ msg.style.color="#dc2626"; msg.textContent="Network error. Please try again."; });
  });
})();`;

  res.json({
    formId: form.id,
    name: form.name,
    snippet: `<div id="lf-form-${id}"></div>\n<script>\n${script}\n</script>`,
    scriptOnly: script,
  });
});

export default router;
