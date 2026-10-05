import { RoomServiceClient } from "livekit-server-sdk";

const {LIVEKIT_URL,LIVEKIT_API_KEY,LIVEKIT_API_SECRET} = process.env;

if(!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error("FALTANDO .ENV EM ROOMSERVICE");
}

const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

export {roomService};