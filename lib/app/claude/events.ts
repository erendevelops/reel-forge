export type ClaudeEvent =
  | { kind: 'session'; sessionId: string }
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; summary: string }
  | { kind: 'result'; ok: boolean; text: string; costNote?: string }
  | { kind: 'error'; code: 'auth' | 'limit' | 'transport' | 'timeout'; message: string; resetsAt?: string };

type Block = { type?: string; text?: string; name?: string; input?: Record<string, unknown> };

function toolSummary(name: string, input: Record<string, unknown> = {}): string {
  const detail = input.command ?? input.file_path ?? input.path ?? input.pattern ?? '';
  const text = String(detail).replace(/\s+/g, ' ').slice(0, 80);
  return text ? `${name}: ${text}` : name;
}

/**
 * Maps one line of `claude -p --output-format stream-json --verbose` to app events.
 * Shapes observed from a real run: system/init carries session_id, assistant messages
 * carry text and tool_use blocks, and the final line is type "result" with is_error.
 */
export function parseStreamLine(line: string): ClaudeEvent[] {
  if (!line.trim()) return [];
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(line);
  } catch {
    return [];
  }
  if (o.type === 'system' && o.subtype === 'init' && typeof o.session_id === 'string') {
    return [{ kind: 'session', sessionId: o.session_id }];
  }
  if (o.type === 'assistant') {
    const content = ((o.message as { content?: Block[] } | undefined)?.content ?? []) as Block[];
    return content.flatMap((b): ClaudeEvent[] => {
      if (b.type === 'text' && b.text) return [{ kind: 'text', text: b.text }];
      if (b.type === 'tool_use' && b.name) return [{ kind: 'tool', name: b.name, summary: toolSummary(b.name, b.input) }];
      return [];
    });
  }
  if (o.type === 'result') {
    return [{ kind: 'result', ok: o.is_error !== true, text: String(o.result ?? '') }];
  }
  return [];
}
