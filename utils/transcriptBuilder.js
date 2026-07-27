// ============================================================
//  GOJO BOT — HTML Transcript Builder
//  Generates a rich HTML file from ticket channel messages
// ============================================================

/**
 * Generates an HTML transcript string from an array of messages.
 * @param {Collection<string, Message>} messages - Discord.js message collection
 * @param {object} opts - { ticketName, guildName, createdAt, closedBy }
 * @returns {string} HTML string
 */
function buildTranscript(messages, opts = {}) {
    const { ticketName = 'ticket', guildName = 'Server', createdAt = new Date(), closedBy = 'Unknown' } = opts;

    const sortedMessages = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    const rows = sortedMessages.map(msg => {
        const avatar = msg.author.displayAvatarURL({ extension: 'png', size: 64 });
        const time = new Date(msg.createdTimestamp).toLocaleString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });

        const attachmentsHtml = msg.attachments.size
            ? [...msg.attachments.values()].map(att => {
                if (/\.(png|jpg|jpeg|gif|webp)$/i.test(att.name)) {
                    return `<img src="${att.url}" alt="${att.name}" class="attachment-img" />`;
                }
                return `<a href="${att.url}" class="attachment-link" target="_blank">${att.name}</a>`;
            }).join('\n')
            : '';

        const embedsHtml = msg.embeds.length
            ? msg.embeds.map(e => `
                <div class="embed">
                    ${e.title ? `<div class="embed-title">${escapeHtml(e.title)}</div>` : ''}
                    ${e.description ? `<div class="embed-desc">${escapeHtml(e.description)}</div>` : ''}
                </div>`).join('\n')
            : '';

        const contentHtml = msg.content
            ? `<div class="msg-content">${escapeHtml(msg.content)}</div>`
            : '';

        const isBot = msg.author.bot ? ' bot-badge' : '';

        return `
        <div class="message ${msg.author.bot ? 'bot-msg' : ''}">
            <img class="avatar" src="${avatar}" alt="${escapeHtml(msg.author.username)}" />
            <div class="msg-body">
                <div class="msg-header">
                    <span class="msg-author${isBot}">${escapeHtml(msg.author.tag)}</span>
                    ${msg.author.bot ? '<span class="bot-tag">BOT</span>' : ''}
                    <span class="msg-time">${time}</span>
                </div>
                ${contentHtml}
                ${attachmentsHtml}
                ${embedsHtml}
            </div>
        </div>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Transcript — ${escapeHtml(ticketName)}</title>
<style>
  :root {
    --bg:       #0e1117;
    --surface:  #161b22;
    --surface2: #21262d;
    --border:   #30363d;
    --accent:   #5865F2;
    --text:     #c9d1d9;
    --muted:    #8b949e;
    --bot:      #57abff;
    --success:  #57F287;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, sans-serif; font-size: 15px; }

  .header {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 20px 32px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .header-icon {
    width: 48px; height: 48px;
    background: var(--accent);
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 800; color: #fff;
  }
  .header h1 { font-size: 20px; font-weight: 700; }
  .header p  { font-size: 13px; color: var(--muted); margin-top: 2px; }

  .meta {
    background: var(--surface2);
    border-bottom: 1px solid var(--border);
    padding: 12px 32px;
    display: flex; gap: 32px; flex-wrap: wrap;
  }
  .meta-item { font-size: 13px; color: var(--muted); }
  .meta-item span { color: var(--text); font-weight: 600; }

  .messages { padding: 16px 32px; display: flex; flex-direction: column; gap: 2px; }

  .message {
    display: flex; gap: 12px; padding: 8px 10px; border-radius: 6px;
    transition: background 0.1s;
  }
  .message:hover { background: var(--surface2); }
  .bot-msg { background: rgba(88, 101, 242, 0.05); }

  .avatar { width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0; }
  .msg-body { flex: 1; min-width: 0; }
  .msg-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
  .msg-author { font-weight: 700; color: #fff; font-size: 15px; }
  .msg-author.bot-badge { color: var(--bot); }
  .bot-tag {
    background: var(--accent); color: #fff; font-size: 10px;
    font-weight: 700; padding: 1px 5px; border-radius: 3px; letter-spacing: 0.5px;
  }
  .msg-time { font-size: 12px; color: var(--muted); }
  .msg-content { color: var(--text); line-height: 1.6; white-space: pre-wrap; word-break: break-word; }

  .attachment-img  { max-width: 400px; max-height: 300px; border-radius: 6px; margin-top: 8px; display: block; }
  .attachment-link { color: var(--accent); text-decoration: none; display: inline-block; margin-top: 6px; }
  .attachment-link:hover { text-decoration: underline; }

  .embed {
    border-left: 4px solid var(--accent);
    background: var(--surface2);
    padding: 10px 14px; border-radius: 4px;
    margin-top: 8px; max-width: 520px;
  }
  .embed-title { font-weight: 700; color: #fff; margin-bottom: 4px; }
  .embed-desc  { font-size: 14px; color: var(--text); white-space: pre-wrap; }

  .footer {
    padding: 20px 32px;
    border-top: 1px solid var(--border);
    font-size: 12px; color: var(--muted); text-align: center;
  }
  .msg-count { color: var(--success); font-weight: 600; }
</style>
</head>
<body>

<div class="header">
  <div class="header-icon">G</div>
  <div>
    <h1>Ticket Transcript — #${escapeHtml(ticketName)}</h1>
    <p>${escapeHtml(guildName)}</p>
  </div>
</div>

<div class="meta">
  <div class="meta-item">Ticket: <span>#${escapeHtml(ticketName)}</span></div>
  <div class="meta-item">Created: <span>${new Date(createdAt).toLocaleString('en-US')}</span></div>
  <div class="meta-item">Closed by: <span>${escapeHtml(closedBy)}</span></div>
  <div class="meta-item">Messages: <span class="msg-count">${sortedMessages.length}</span></div>
  <div class="meta-item">Generated: <span>${new Date().toLocaleString('en-US')}</span></div>
</div>

<div class="messages">
${rows}
</div>

<div class="footer">
  Generated by GOJO Bot • ${new Date().getFullYear()}
</div>

</body>
</html>`;
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

module.exports = { buildTranscript };
