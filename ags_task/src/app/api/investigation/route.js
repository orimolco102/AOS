import { saveInvestigation } from "../../../lib/db_log";
import { runInvestigation, timeout_ms } from "../../../lib/agentprompt";

export async function POST(request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }
      const signal = AbortSignal.any([
        request.signal,
        AbortSignal.timeout(timeout_ms),
      ]);

      let saved = null;
      try {
        const { report, toolResults } = await runInvestigation({
          signal,
          onEvent: send,
        });
        send({ type: "report", report });
        saved = { createdAt: new Date(), toolResults, report };
      } catch (error) {
        const message = signal.aborted ? "the investigation closed. timeout or the browser has been closed" : error.message;
        send({ type: "error", message });
      }

      // Close first so the page shows the report right away; saving to the DB happens after.
      controller.close();

      if (saved) {
        try {
          await saveInvestigation(saved);
        } catch (error) {
          console.error("could not save investigation:", error.message);
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson" },
  });
}
