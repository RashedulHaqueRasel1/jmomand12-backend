import http from "http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import app from "./app";
import config from "./config";
import logger from "./logger";
import auctionService from "./modules/auction/auction.service";
import { initNotificationSocket } from "./socket/notification.service";

async function main() {
  try {
    await mongoose.connect(config.mongodbUrl as string);
    logger.info("MongoDB connected successfully");
    const httpServer = http.createServer(app);

    const io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    io.on("connection", (socket) => {
      logger.info(`Client connected: ${socket.id}`);
      socket.on("joinRoom", (userId) => socket.join(userId));
    });

    initNotificationSocket(io);

    setInterval(async () => {
      try {
        await auctionService.closeDueAuctions();
      } catch (error) {
        logger.error({ error }, "Auction scheduler failed");
      }
    }, 60 * 1000);

    httpServer.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });
  } catch (error: any) {
    logger.error({ error }, "Server failed to start");
  }
}

main();
