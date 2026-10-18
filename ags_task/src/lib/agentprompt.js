import { GoogleGenAI } from "@google/genai";
import { tools } from "./tools";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
// When Google is overloaded (503) or rate-limits us (429), try these next.
const FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
const max_turns = 6;
// Limit for the whole investigation.
export const timeout_ms = 120_000;
// Limit for one Gemini request. Sometimes a request hangs instead of answering "busy";
// after this long we give up on it and try the next model.
const call_timeout_ms = 20_000;

// The last model that answered; tried first next time so we don't keep waiting on a busy one.
let workingModel = null;

// Calls Gemini. If the model is busy (503), rate-limits us (429) or doesn't answer within
// call_timeout_ms, it retries and then falls back to lighter models.
async function generate(request, signal) {
  const models = [...new Set([workingModel, MODEL, ...FALLBACK_MODELS].filter(Boolean))];
  let lastProblem;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const callSignal = AbortSignal.any([signal, AbortSignal.timeout(call_timeout_ms)]);
      try {
        const response = await ai.models.generateContent({ ...request, model, config: { ...request.config, abortSignal: callSignal } });
        workingModel = model;
        return { response, model };
      } catch (error) {
        if (signal.aborted) throw error;
        const hung = callSignal.aborted;
        if (!hung && ![429, 503].includes(error.status)) throw cleanError(error);

        lastProblem = hung ? `no answer from ${model} within ${call_timeout_ms / 1000}s` : `${model} returned ${error.status}`;
        console.warn(`gemini: ${lastProblem}, trying again`);
        if (hung) break; // a model that hangs usually keeps hanging: move straight to the next one
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  throw new Error(`The AI model is busy right now (${lastProblem}). Wait a minute and try again.`);
}

// Gemini errors arrive as a JSON string; pull out the readable message.
function cleanError(error) {
  try {
    return new Error(JSON.parse(error.message).error.message);
  } catch {
    return error;
  }
}

const instructions = `
    You are an on-call engineer. You were asked to investigate a service and find out what is wrong.

    You cannot see the service's code or configuration. You only know what your tools return.

    How to investigate:
    1. Check the health of the service and its dependencies.
    2. Read the logs for errors and warnings.
    3. Check the metrics for error rate and response time.
    4. Check the version to see if the problem started after a deploy.

    Rules:
    - Base every conclusion on what the tools showed. Never invent evidence.
    - Quote real details as evidence: status codes, error messages, response times, timestamps.
    - If the service does not answer at all, that is the fault.
    - The logs keep old entries. Judge the CURRENT state by the most recent entries and the current time
      you are given. If errors stopped and the newest requests succeed, the old errors are resolved:
      report the service as healthy and mention the past errors in the summary.
    - Check response times, not just errors. A healthy web request answers in well under 1000ms.
      If p50/p95 latency is above ~2000ms, or the logs show slow request warnings, the service is
      slow even when there are no errors: report it as a slow response problem (severity warning).
    - If everything looks normal (no recent errors AND normal response times), say the service is healthy.

    When you are done, answer with ONLY this JSON (no markdown, no extra text):
    {
      "verdict": "short_snake_case_fault_name, or healthy",
      "title": "Which fault it is, in one line",
      "severity": "critical | warning | ok",
      "summary": "1-2 sentences explaining the fault",
      "evidence": ["what the tools showed", "..."],
      "nextStep": "The next step the team should take"
    }
    `.trim();

// The model should answer with JSON, but sometimes wraps it in text or ```json fences.
function parseReport(text) {
  const match = text?.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }
  return {
    verdict: "unknown",
    title: "Could not read the agent's report",
    severity: "warning",
    summary: text ?? "",
    evidence: [],
    nextStep: "",
  };
}

export async function runInvestigation({ signal, onEvent }) {
  const contents = [
    { role: "user", parts: [{ text: `Investigate the cart service. The current time is ${new Date().toISOString()}.` }] },
  ];
  const toolResults = [];

  for (let turn = 0; turn < max_turns; turn++) {
    const { response, model } = await generate({
      contents,
      config: {
        systemInstruction: instructions,
        tools: [{ functionDeclarations: tools.map((t) => t.declaration) }],
      },
    }, signal);

    const calls = response.functionCalls ?? [];

    if (calls.length === 0) {
      const report = {
        ...parseReport(response.text),
        toolCalls: toolResults,
        model,
      };
      return { report, toolResults };
    }

    contents.push(response.candidates[0].content);

    const parts = [];
    for (const call of calls) {
      onEvent({ type: "tool_called", tool: call.name });

      const tool = tools.find((t) => t.declaration.name === call.name);
      const output = tool
        ? await tool.execute(call.args ?? {})
        : `unknown tool: ${call.name}`;

      onEvent({ type: "tool_output", tool: call.name, output });
      toolResults.push({ tool: call.name, result: output });

      parts.push({
        functionResponse: {
          id: call.id,
          name: call.name,
          response: { output: output ?? null },
        },
      });
    }
    contents.push({ role: "user", parts });
  }

  throw new Error(`agent didnt finish in time`);
}
