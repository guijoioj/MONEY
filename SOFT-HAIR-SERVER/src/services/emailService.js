const nodemailer = require('nodemailer');

class EmailService {
  static transporter;

  static getTransporter() {
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
    const resetUrl = `http://localhost:3000/reset-password/${token}`;
    
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d63384;">Recuperação de Senha - Salão de Beleza</h2>
        <p>Olá, ${userName}!</p>
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
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d63384;">Bem-vindo ao Sistema!</h2>
        <p>Olá, ${userName}!</p>
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
