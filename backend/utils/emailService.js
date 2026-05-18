const { Resend } = require('resend');

let resendClient = null;

const getConfig = () => ({
  apiKey: process.env.RESEND_API_KEY,
  fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@example.com',
  fromName: process.env.RESEND_FROM_NAME || 'Coding Platform',
  frontendUrl: (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, ''),
});

const getClient = () => {
  const { apiKey } = getConfig();
  if (!apiKey || apiKey === 're_your_resend_api_key_here') {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
};

const isEmailConfigured = () => Boolean(getClient());

const buildPasswordResetHtml = ({ name, resetUrl, expireMinutes }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="height:4px;background:linear-gradient(to right,#ED0331,#87021C);"></td>
          </tr>
          <tr>
            <td style="padding:36px 32px;">
              <h1 style="margin:0 0 8px;font-size:22px;color:#111;">Reset your password</h1>
              <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.5;">
                Hi ${name || 'there'},<br />
                We received a request to reset the password for your account. Click the button below to choose a new password.
              </p>
              <a href="${resetUrl}" style="display:inline-block;padding:14px 28px;background:linear-gradient(to right,#ED0331,#87021C);color:#ffffff;text-decoration:none;font-weight:600;border-radius:8px;font-size:15px;">
                Reset password
              </a>
              <p style="margin:24px 0 0;color:#777;font-size:13px;line-height:1.5;">
                This link expires in <strong>${expireMinutes} minutes</strong>. If you did not request a password reset, you can safely ignore this email — your password will not change.
              </p>
              <p style="margin:16px 0 0;color:#999;font-size:12px;word-break:break-all;">
                Or copy this link:<br />
                <a href="${resetUrl}" style="color:#ED0331;">${resetUrl}</a>
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;color:#999;font-size:12px;">Coding Platform</p>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const sendPasswordResetEmail = async ({ to, name, resetToken, expireMinutes }) => {
  const client = getClient();
  const { fromEmail, fromName, frontendUrl } = getConfig();

  if (!client) {
    console.warn('⚠️ Resend not configured — password reset email not sent. Set RESEND_API_KEY in .env');
    return { sent: false, reason: 'not_configured' };
  }

  const resetUrl = `${frontendUrl}/reset-password?token=${encodeURIComponent(resetToken)}`;

  const { data, error } = await client.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [to],
    subject: 'Reset your password — Coding Platform',
    html: buildPasswordResetHtml({ name, resetUrl, expireMinutes }),
    text: [
      `Hi ${name || 'there'},`,
      '',
      'Reset your password using this link (expires soon):',
      resetUrl,
      '',
      'If you did not request this, ignore this email.',
    ].join('\n'),
  });

  if (error) {
    console.error('Resend error:', error);
    throw new Error(error.message || 'Failed to send email');
  }

  return { sent: true, id: data?.id, resetUrl };
};

module.exports = {
  isEmailConfigured,
  sendPasswordResetEmail,
  getConfig,
};
