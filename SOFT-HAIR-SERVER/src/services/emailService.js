let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

// [P5-M9] Escapa caracteres HTML perigosos para evitar injection em templates de email.
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

class EmailService {
  static transporter;

  static getTransporter() {
    if (!nodemailer) {
      throw new Error('Dependencia opcional nodemailer nao instalada');
    }
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
    return this.transporter;
  }

  static async sendPasswordResetEmail(email, token, userName) {
    // [P4-M2] URL base agora vem de FRONTEND_URL — não mais hardcoded em localhost
    // (que quebraria o link de reset em produção). Token já é gerado server-side
    // como string segura; URL-encoded para evitar injection no link gerado.
    const base = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const safeToken = encodeURIComponent(token);
    const resetUrl = `${base}/reset-password/${safeToken}`;
    // [P5-M9] userName vem de usuarios.nome (admin-controlled) — escapar HTML
    const safeUserName = escapeHtml(userName);

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d63384;">Recuperação de Senha - Salão de Beleza</h2>
        <p>Olá, ${safeUserName}!</p>
        <p>Você solicitou a recuperação de senha para sua conta.</p>
        <p>Clique no botão abaixo para criar uma nova senha:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #d63384; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Redefinir Senha
          </a>
        </div>
        <p>Ou copie e cole este link no seu navegador:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p><strong>Este link expira em 1 hora.</strong></p>
        <p>Se você não solicitou esta recuperação, ignore este email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">Sistema de Administração de Salão de Beleza</p>
      </div>
    `;

    try {
      await this.getTransporter().sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: 'Recuperação de Senha - Salão de Beleza',
        html: htmlContent,
      });
      return true;
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      throw new Error('Falha ao enviar email de recuperação');
    }
  }

  static async sendWelcomeEmail(email, userName) {
    // [P5-M9] Escapar HTML do userName
    const safeUserName = escapeHtml(userName);
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d63384;">Bem-vindo ao Sistema!</h2>
        <p>Olá, ${safeUserName}!</p>
        <p>Seja bem-vindo ao Sistema de Administração de Salão de Beleza!</p>
        <p>Você já pode fazer login e começar a usar o sistema.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">Sistema de Administração de Salão de Beleza</p>
      </div>
    `;

    try {
      await this.getTransporter().sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: 'Bem-vindo ao Sistema de Salão de Beleza',
        html: htmlContent,
      });
      return true;
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      return false;
    }
  }
}

module.exports = EmailService;
