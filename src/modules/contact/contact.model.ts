import { model, Schema } from "mongoose";
import { IContact } from "./contact.interface";

const contractSchema = new Schema<IContact>({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  message: { type: String, required: true },
});

const Contact = model<IContact>("Contact", contractSchema);

export default Contact;
