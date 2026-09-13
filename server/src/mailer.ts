import nodemailer from 'nodemailer';

export interface Mailer {
  sendOtp(email: string, code: string): Promise<void>;
}

export class ConsoleMailer implements Mailer {
  async sendOtp(email: string, code: string): Promise<void> {
    console.log('=== mTracker OTP for ' + email + ': ' + code + ' ===');
  }
}

export class SmtpMailer implements Mailer {
  private transporter: ReturnType<typeof nodemailer.createTransport>;

  constructor(private mailFrom: string) {
    this.transporter = nodemailer.createTransport(process.env.SMTP_URL!);
  }

  async sendOtp(email: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.mailFrom,
      to: email,
      subject: 'کد ورود mTracker',
      text: code + ' کد ورود شماست. ۱۰ دقیقه اعتبار دارد.',
    });
  }
}

export class RelayMailer implements Mailer {
  constructor(
    private relayUrl: string,
    private relaySecret: string,
  ) {}

  async sendOtp(email: string, code: string): Promise<void> {
    const res = await fetch(this.relayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + this.relaySecret,
      },
      body: JSON.stringify({
        to: email,
        subject: 'کد ورود mTracker',
        text: code + ' کد ورود شماست. ۱۰ دقیقه اعتبار دارد.',
      }),
    });
    if (!res.ok) throw new Error('mail relay failed: ' + res.status);
  }
}

export function createMailer(): Mailer {
  if (process.env.MAIL_RELAY_URL) {
    return new RelayMailer(process.env.MAIL_RELAY_URL, process.env.MAIL_RELAY_SECRET ?? '');
  }
  return process.env.SMTP_URL ? new SmtpMailer(process.env.MAIL_FROM!) : new ConsoleMailer();
}
