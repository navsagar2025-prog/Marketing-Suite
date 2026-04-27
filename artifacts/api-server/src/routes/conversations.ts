import { Router, type IRouter } from "express";
import { eq, asc, max, sql } from "drizzle-orm";
import { db, conversations, messages, leadsTable } from "@workspace/db";
import {
  CreateConversationBody,
  SendMessageBody,
  GetConversationMessagesParams,
  SendMessageParams,
  SummarizeConversationParams,
} from "@workspace/api-zod";
import { callAI } from "../lib/ai-provider.js";
import { checkAndIncrementUsage } from "../lib/ai-usage.js";

const router: IRouter = Router();

router.get("/conversations", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      leadId: conversations.leadId,
      createdAt: conversations.createdAt,
      leadName: leadsTable.name,
      lastMessageAt: max(messages.createdAt).as("lastMessageAt"),
    })
    .from(conversations)
    .leftJoin(leadsTable, eq(conversations.leadId, leadsTable.id))
    .leftJoin(messages, eq(messages.conversationId, conversations.id))
    .groupBy(
      conversations.id,
      conversations.title,
      conversations.leadId,
      conversations.createdAt,
      leadsTable.name,
    )
    .orderBy(asc(conversations.createdAt));

  res.json(rows.map(r => ({
    ...r,
    leadName: r.leadName ?? null,
    lastMessageAt: r.lastMessageAt ? r.lastMessageAt.toISOString() : null,
  })));
});

router.post("/conversations", async (req, res): Promise<void> => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (parsed.data.leadId != null) {
    const [existing] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.leadId, parsed.data.leadId))
      .limit(1);
    if (existing) {
      res.status(200).json({ ...existing, leadName: null, lastMessageAt: null });
      return;
    }
  }

  const [row] = await db.insert(conversations).values(parsed.data).returning();
  res.status(201).json({ ...row, leadName: null, lastMessageAt: null });
});

router.get("/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = GetConversationMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, params.data.id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(asc(messages.createdAt));
  res.json(msgs);
});

router.post("/conversations/:id/messages", async (req, res): Promise<void> => {
  const usageCheck = await checkAndIncrementUsage(req.user!.id, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly text generation limit reached", used: usageCheck.used, limit: usageCheck.limit, type: "text" });
    return;
  }

  const params = SendMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const bodyParsed = SendMessageBody.safeParse(req.body);
  if (!bodyParsed.success) {
    res.status(400).json({ error: bodyParsed.error.message });
    return;
  }

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, params.data.id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  let leadContext = "";
  if (conv.leadId) {
    const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, conv.leadId));
    if (lead) {
      leadContext = `\nLead context:\n- Name: ${lead.name}${lead.email ? `\n- Email: ${lead.email}` : ""}${lead.phone ? `\n- Phone: ${lead.phone}` : ""}\n- Source: ${lead.source}\n- Status: ${lead.status}${lead.value != null ? `\n- Value: $${lead.value}` : ""}${lead.score != null ? `\n- Score: ${lead.score}` : ""}${lead.notes ? `\n- Notes: ${lead.notes}` : ""}`;
    }
  }

  const systemPrompt = `You are a professional lead qualification assistant. Your job is to help qualify leads by asking relevant questions about their needs, budget, timeline, and decision-making process. Be conversational, friendly, and concise. Ask one question at a time. When you have enough information, provide a brief qualification summary.${leadContext}`;

  const history = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(asc(messages.createdAt));

  const [userMsg] = await db.insert(messages).values({
    conversationId: params.data.id,
    role: "user",
    content: bodyParsed.data.content,
  }).returning();

  try {
    const aiReply = await callAI(bodyParsed.data.content, {
      systemPrompt,
      maxTokens: 1024,
      history: history.map(h => ({ role: h.role, content: h.content })),
    });

    const [assistantMsg] = await db.insert(messages).values({
      conversationId: params.data.id,
      role: "assistant",
      content: aiReply,
    }).returning();

    res.status(201).json({ userMessage: userMsg, assistantMessage: assistantMsg });
  } catch (err) {
    await db.delete(messages).where(eq(messages.id, userMsg.id));
    const message = err instanceof Error ? err.message : "AI generation failed";
    res.status(503).json({ error: message });
  }
});

router.post("/conversations/:id/summarize", async (req, res): Promise<void> => {
  const usageCheck = await checkAndIncrementUsage(req.user!.id, "text");
  if (!usageCheck.allowed) {
    res.status(429).json({ error: "Monthly text generation limit reached", used: usageCheck.used, limit: usageCheck.limit, type: "text" });
    return;
  }

  const params = SummarizeConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, params.data.id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(asc(messages.createdAt));

  if (msgs.length === 0) {
    res.status(400).json({ error: "No messages to summarize" });
    return;
  }

  const transcript = msgs
    .map(m => `${m.role === "user" ? "Lead" : "AI"}: ${m.content}`)
    .join("\n");

  const prompt = `Summarize this lead qualification conversation in a concise, actionable format for a CRM note. Focus on: the lead's needs, budget/timeline mentioned, key objections or concerns, and overall qualification status.

Conversation:
${transcript}

Write 2-5 bullet points, each starting with "• ". Be specific and factual. Do not add markdown headers.`;

  try {
    const summary = await callAI(prompt, { maxTokens: 512 });

    let notesSaved = false;
    if (conv.leadId) {
      const [lead] = await db.select().from(leadsTable).where(eq(leadsTable.id, conv.leadId));
      if (lead) {
        const timestamp = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
        const noteEntry = `[AI Qualification Summary – ${timestamp}]\n${summary}`;
        const updatedNotes = lead.notes
          ? `${lead.notes}\n\n${noteEntry}`
          : noteEntry;
        await db.update(leadsTable)
          .set({ notes: updatedNotes })
          .where(eq(leadsTable.id, conv.leadId));
        notesSaved = true;
      }
    }

    res.json({ summary, notesSaved });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI summarization failed";
    res.status(503).json({ error: message });
  }
});

export default router;
