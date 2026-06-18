import config from "../../config";
import sendEmail from "../../utils/sendEmail";
import sendMessageTemplate from "../../utils/sendMessageTemplate";
import { IContact } from "./contact.interface";

const sendContact = async (payload: IContact) => {
  const { firstName, lastName, email, message } = payload;
  const fullName = `${firstName} ${lastName}`;
  const subject = `New Contact Us Message from ${fullName}`;
  const html = sendMessageTemplate({
    email,
    subject,
    message,
  });

  await sendEmail({
    to: config.email.emailAddress as string,
    subject,
    html,
  });
};

const contactService = {
  sendContact,
};

export default contactService;
