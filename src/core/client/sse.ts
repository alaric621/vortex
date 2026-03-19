import { PreparedRequest, RequestExecution } from "./types";

export function executeSseRequest(request: PreparedRequest): RequestExecution {
  const controller = new AbortController();

  return {
    stop: () => controller.abort(),
    promise: (async () => {
      const response = await fetch(request.url, {
        method: "GET",
        headers: withSseHeaders(request.headers),
        signal: controller.signal
      });

      const events = await readSseEvents(response);
      return {
        id: request.id,
        status: response.status,
        ok: response.ok,
        headers: toHeadersRecord(response.headers),
        body: "",
        events
      };
    })()
  };
}

function withSseHeaders(headers: Record<string, string>): Record<string, string> {
  return {
    Accept: "text/event-stream",
    ...headers
  };
}

async function readSseEvents(response: Response): Promise<string[]> {
  if (!response.body) {
    return [];
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: string[] = [];
  let pending = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    pending += decoder.decode(chunk.value, { stream: true });
    pending = flushSseBlocks(pending, events);
  }

  flushSseBlock(pending, events);
  return events;
}

function flushSseBlocks(input: string, events: string[]): string {
  let pending = input;
  let boundary = pending.indexOf("\n\n");

  while (boundary !== -1) {
    flushSseBlock(pending.slice(0, boundary), events);
    pending = pending.slice(boundary + 2);
    boundary = pending.indexOf("\n\n");
  }

  return pending;
}

function flushSseBlock(block: string, events: string[]): void {
  const lines = block
    .split("\n")
    .map(line => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) {
    return;
  }

  const payload = lines
    .filter(line => line.startsWith("data:"))
    .map(line => line.slice(5).trim())
    .join("\n");

  events.push(payload || lines.join("\n"));
}

function toHeadersRecord(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key] = value;
  });
  return output;
}
