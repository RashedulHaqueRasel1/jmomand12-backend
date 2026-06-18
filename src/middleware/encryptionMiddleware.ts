import { Schema } from "mongoose";
import { decrypt, encrypt } from "../utils/utils";


export const applyEncryption = (schema: Schema, fields: string[]) => {
  // Auto Encrypt before saving
  schema.pre("save", function (next) {
    fields.forEach((field) => {

      if (this[field]) {
        this[field] = encrypt(this[field].toString());
      }
    });
    next();
  });

  // Auto Encrypt before update
  schema.pre(["findOneAndUpdate", "updateOne"], function (next) {
    const update = this.getUpdate() as Record<string, any>;

    fields.forEach((field) => {
      if (update[field]) {
        update[field] = encrypt(update[field].toString());
      }
    });

    this.setUpdate(update);
    next();
  });

  // Auto Decrypt after find
  schema.post("find", function (docs) {
    docs.forEach((doc: any) => {
      fields.forEach((field) => {
        if (doc[field]) {
          doc[field] = decrypt(doc[field]);
        }
      });
    });
  });

  // Auto Decrypt after findOne
  schema.post("findOne", function (doc: any) {
    if (doc) {
      fields.forEach((field) => {
        if (doc[field]) {
          doc[field] = decrypt(doc[field]);
        }
      });
    }
  });
};
