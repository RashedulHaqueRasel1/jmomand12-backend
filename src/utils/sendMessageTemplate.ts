import { companyName } from "../lib/globalType";

interface MessageTemplateProps {
  email: string;
  subject: string;
  message: string;
}

const sendMessageTemplate = ({
  email,
  subject,
  message,
}: MessageTemplateProps): string => {
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 640px; margin: auto; padding: 30px 16px; background-color: #f4f4f5;">
      <div style="background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06); overflow: hidden;">
        
        <header style="padding: 24px 32px; border-bottom: 1px solid #e5e7eb; background-color: #ffffff; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; color: #111827;">${companyName}</h1>
          <p style="margin-top: 6px; font-size: 14px; color: #6b7280;">New message received via contact form</p>
        </header>

        <section style="padding: 28px 32px;">
          <div style="margin-bottom: 16px;">
            <strong style="display: block; color: #374151; font-size: 14px; margin-bottom: 4px;">Sender Email:</strong>
            <span style="color: #111827; font-size: 15px;">${email}</span>
          </div>
          
          <div style="margin-bottom: 16px;">
            <strong style="display: block; color: #374151; font-size: 14px; margin-bottom: 4px;">Subject:</strong>
            <span style="color: #111827; font-size: 15px;">${subject}</span>
          </div>

          <div style="margin-top: 20px; padding: 16px 20px; background-color: #f9fafb; border-left: 4px solid #111827; border-radius: 6px;">
            <p style="margin: 0; font-size: 15px; color: #374151; white-space: pre-wrap;">${message}</p>
          </div>
        </section>

        <footer style="padding: 20px 32px; background-color: #fafafa; border-top: 1px solid #e5e7eb; text-align: center; font-size: 13px; color: #6b7280;">
          This message was sent via the <strong>${companyName}</strong> contact form.<br/>
          &copy; 2025 ${companyName}. All rights reserved.
        </footer>

      </div>
    </div>
  `;
};

export default sendMessageTemplate;
