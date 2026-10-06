/**
 * Turn off one kind of email from the link in it:
 *   /api/unsubscribe?t=<token>                  message emails (the first links sent)
 *   /api/unsubscribe?for=messages&t=<token>     the same
 *   /api/unsubscribe?for=reminders&t=<token>    reminder emails
 *
 * The token belongs to one member and one kind of email, and does nothing but
 * turn that kind off. An unknown `for` is refused rather than guessed at. GET only asks
 * "stop these emails?" and shows a button: mail scanners open every link in
 * a message, and opening a link must not be what unsubscribes someone. POST
 * does it, both from that button and from a mail app's own Unsubscribe
 * button (List-Unsubscribe-Post, sent by send_message_emails in 0014 and
 * send_reminder_emails in 0015).
 *
 * Runs with the public anon key like the rest of the app; the database
 * functions behind it (unsubscribe_message_emails, unsubscribe_reminder_emails)
 * are callable without signing in and change nothing else.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type List = {
  /** The database function that turns this kind of email off. */
  rpc: string;
  ask: string;
  askBody: string;
  done: string;
  doneBody: string;
};

const LISTS: Record<'messages' | 'reminders', List> = {
  messages: {
    rpc: 'unsubscribe_message_emails',
    ask: 'Stop message emails?',
    askBody: 'You will still see your messages in Sonder. You can turn these emails back on in your profile.',
    done: 'You will not get these emails',
    doneBody: 'Your messages are still waiting in Sonder. You can turn the emails back on in your profile.',
  },
  reminders: {
    rpc: 'unsubscribe_reminder_emails',
    ask: 'Stop reminder emails?',
    askBody: 'You will still see your reminders in Sonder. You can turn these emails back on in your profile.',
    done: 'You will not get these emails',
    doneBody: 'Your reminders are still in Sonder. You can turn the emails back on in your profile.',
  },
};

async function unsubscribe(list: List, token: string): Promise<boolean | null> {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${list.rpc}`, {
      method: 'POST',
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) return null;
    return (await response.json()) === true;
  } catch {
    return null;
  }
}

/** A small page in the app's own colours: paper on the passport cover. */
function page(title: string, body: string, action?: { label: string; token: string; list: string }): Response {
  const form = action
    ? `<form method="post" action="/api/unsubscribe?for=${action.list}&amp;t=${action.token}">` +
      `<button type="submit">${action.label}</button></form>`
    : '';
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} · Sonder</title>
<style>
  body { margin: 0; min-height: 100vh; background: #16302A; color: #E8EDE5; color-scheme: dark;
         font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; display: flex;
         flex-direction: column; align-items: center; justify-content: center; padding: 24px; box-sizing: border-box; }
  main { width: 100%; max-width: 440px; }
  .mark { font-family: "Arial Narrow", Arial, sans-serif; font-size: 28px; font-weight: 700; color: #D4B46E; margin: 0 4px 16px; }
  .paper { background: #E3E9DF; color: #14201C; border-radius: 14px; padding: 26px 24px; }
  h1 { margin: 0 0 8px; font-size: 22px; line-height: 28px; }
  p { margin: 0 0 20px; font-size: 16px; line-height: 24px; color: #526159; }
  p:last-child { margin-bottom: 0; }
  button, a.back { display: inline-block; background: #D4B46E; color: #16302A; border: 0; border-radius: 10px;
         font: 600 16px/22px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; padding: 14px 22px;
         cursor: pointer; text-decoration: none; }
  button:focus-visible, a.back:focus-visible { outline: 2px solid #14201C; outline-offset: 2px; }
</style>
</head>
<body>
<main>
  <div class="mark">Sonder</div>
  <div class="paper">
    <h1>${title}</h1>
    <p>${body}</p>
    ${form}
  </div>
</main>
</body>
</html>`;
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}

function tokenOf(request: Request): string | null {
  const token = new URL(request.url).searchParams.get('t') ?? '';
  return UUID.test(token) ? token.toLowerCase() : null;
}

/** Which kind of email the link is for. No `for` means messages, so the links already sent keep working. */
function listOf(request: Request): ['messages' | 'reminders', List] | null {
  const name = new URL(request.url).searchParams.get('for') ?? 'messages';
  return name === 'messages' || name === 'reminders' ? [name, LISTS[name]] : null;
}

const INVALID = [
  "This link isn't valid",
  'It may have been cut short when it was copied. Open the email again and use its link.',
] as const;

export async function GET(request: Request): Promise<Response> {
  const token = tokenOf(request);
  const found = listOf(request);
  if (!token || !found) return page(...INVALID);
  const [name, list] = found;
  return page(list.ask, list.askBody, { label: 'Stop these emails', token, list: name });
}

export async function POST(request: Request): Promise<Response> {
  const token = tokenOf(request);
  const found = listOf(request);
  if (!token || !found) return page(...INVALID);
  const [name, list] = found;

  const done = await unsubscribe(list, token);
  if (done === null) {
    return page("That didn't work", 'Sonder could not be reached just now. Try the link again in a minute.', {
      label: 'Try again',
      token,
      list: name,
    });
  }
  if (!done) return page("This link isn't valid", 'It does not match anyone any more. If you still get these emails, turn them off in your profile.');
  return page(list.done, list.doneBody);
}
