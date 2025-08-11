import OpenAI from "openai";

function allowCors(res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
}
function ensureAuth(req){
  const need = process.env.SERVER_KEY;
  if(!need) return true;
  const got = req.headers?.authorization || "";
  return got === `Bearer ${need}`;
}

// Lazy load prompts to avoid ESM path issues on Vercel's edge
import { SYSTEM_BASE, FLOW1_RULES, FLOW2_RULES, JSON_ONLY, CLASSIFIER_SYS } from "../lib/prompt.js";

export default async function handler(req, res){
  allowCors(res);
  if(req.method==="OPTIONS") return res.status(200).end();
  if(req.method!=="POST") return res.status(405).json({error:"Method not allowed"});
  if(!ensureAuth(req)) return res.status(401).json({error:"Unauthorized"});

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { flow:flowIn, user_input = "", history = [] } = body;

    if(!process.env.OPENAI_API_KEY){
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 0) Routing & safety classify
    let risk = { topic:"", level:"low" };
    let flow = Number(flowIn || 1);
    try {
      const clf = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: CLASSIFIER_SYS },
          { role: "user", content: user_input }
        ]
      });
      const parsed = JSON.parse(clf.choices?.[0]?.message?.content || "{}");
      risk = parsed?.risk || risk;
      flow = Number(flowIn || parsed?.flow || 1);
    } catch {}

    // 1) System prompt
    const sys = SYSTEM_BASE + "\n" + (flow===1?FLOW1_RULES:FLOW2_RULES) + "\n" + JSON_ONLY;

    // 2) Context messages with last 5 turns
    const msgs = [{ role:"system", content: sys }];
    (Array.isArray(history)?history.slice(-5):[]).forEach(t=>{
      if(t?.user) msgs.push({ role:"user", content: t.user });
      if(t?.assistant) msgs.push({ role:"assistant", content: t.assistant });
    });
    msgs.push({ role:"user", content: user_input });

    async function call(model){
      const r = await client.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: 650,
        response_format: { type:"json_object" },
        messages: msgs
      });
      const txt = r.choices?.[0]?.message?.content || "{}";
      return JSON.parse(txt);
    }

    let out;
    try {
      out = await call("gpt-4o-mini");
    } catch(e1){
      out = await call("gpt-4o");
    }
    out = out || {};
    out.cites ||= [];
    out.next_actions ||= [];
    out.risk ||= risk;
    return res.status(200).json(out);
  } catch (err){
    return res.status(200).json({
      answer: "죄송합니다. 일시적인 오류입니다. 잠시 후 다시 시도해 주세요.",
      cites: [],
      next_actions: ["다시 시도","담당자 연결"],
      risk: { topic:"", level:"unknown" }
    });
  }
}
