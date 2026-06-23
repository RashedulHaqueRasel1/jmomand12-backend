import cookieParser from "cookie-parser";
import express, { Application } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./docs/openapi";
import globalErrorHandler from "./middleware/globalErrorHandler";
import notFound from "./middleware/notFound";

import { applySecurity } from "./middleware/security";
import router from "./router";

const app: Application = express();

app.use(express.static("public"));

app.use(express.json());
app.use(cookieParser());

applySecurity(app);

app.get("/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.use("/api/v1", router);

app.get("/", (_req, res) => {
  res.send("Hey there! Welcome to Jmomand API's.");
});

app.use(notFound);
app.use(globalErrorHandler);

export default app;
