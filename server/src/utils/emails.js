import env from "../config/env.js";

export const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#0D0D0D;font-family:Arial,Helvetica,sans-serif;color:#fff">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141414;border:1px solid #2a2a2a;border-radius:20px;overflow:hidden">
<tr><td style="padding:24px 28px;border-bottom:1px solid #2a2a2a"><b style="letter-spacing:.3em;font-size:12px;color:#E63946">VAREON MOTORS</b></td></tr>
<tr><td style="padding:28px"><h2 style="margin:0 0 14px;font-size:22px">${esc(title)}</h2>${bodyHtml}</td></tr>
<tr><td style="padding:18px 28px;border-top:1px solid #2a2a2a;color:#777;font-size:11px">You received this because of activity on ${esc(env.APP_URL)}.</td></tr>
</table></td></tr></table></body></html>`;
}
const p = (t) => `<p style="margin:0 0 14px;color:#bbb;font-size:14px;line-height:1.6">${t}</p>`;
const codeBox = (code) => `<div style="margin:18px 0;padding:18px;text-align:center;background:#0D0D0D;border:1px solid #2a2a2a;border-radius:14px;font-size:34px;letter-spacing:.35em;font-weight:bold">${esc(code)}</div>`;
const button = (href, label) => `<a href="${esc(href)}" style="display:inline-block;margin-top:8px;padding:12px 22px;background:#E63946;color:#fff;text-decoration:none;border-radius:12px;font-weight:bold;font-size:13px">${esc(label)}</a>`;

export const otpEmail = (name, code, purpose) => {
  const verify = purpose === "verify";
  const subject = verify ? "Confirm your email — Vareon Motors" : "Your password reset code — Vareon Motors";
  const intro = verify ? "Use this code to confirm your email address and finish creating your account." : "Use this code to reset your password.";
  return {
    subject,
    text: `Hi ${name},\n\n${intro}\n\nYour code: ${code}\n\nIt expires in 10 minutes. If you didn't ask for this, you can ignore this email.`,
    html: layout(verify ? "Confirm your email" : "Reset your password", p(`Hi ${esc(name)},`) + p(esc(intro)) + codeBox(code) + p("This code expires in 10 minutes. If you didn't request it, you can safely ignore this email.")),
  };
};

export const passwordChangedEmail = (name) => ({
  subject: "Your password was changed — Vareon Motors",
  text: `Hi ${name},\n\nYour password was just changed. If this wasn't you, reset it now at ${env.APP_URL} and contact us.`,
  html: layout("Password changed", p(`Hi ${esc(name)}, your password was just changed.`) + p("If this wasn't you, reset it straight away and contact us.") + button(env.APP_URL, "Open Vareon Motors")),
});

/** Generic alert mail: title + a few key/value lines + optional button. */
export const alertEmail = ({ title, lines = [], link, linkLabel = "Open" }) => ({
  subject: title,
  text: `${title}\n\n${lines.map(([k, v]) => `${k}: ${v}`).join("\n")}${link ? `\n\n${env.APP_URL}${link}` : ""}`,
  html: layout(
    title,
    `<table width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 10px">${lines
      .map(([k, v]) => `<tr><td style="padding:6px 0;color:#777;font-size:12px;width:120px">${esc(k)}</td><td style="padding:6px 0;color:#fff;font-size:14px">${esc(v)}</td></tr>`)
      .join("")}</table>${link ? button(`${env.APP_URL}${link}`, linkLabel) : ""}`,
  ),
});
