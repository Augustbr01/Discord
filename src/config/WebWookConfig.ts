import { WebhookReceiver } from 'livekit-server-sdk';

const {LIVEKIT_API_KEY,LIVEKIT_API_SECRET} = process.env

if(!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error("WEBWOOK CONFIG SEM .ENV")
}

const receiver = new WebhookReceiver(LIVEKIT_API_KEY,LIVEKIT_API_SECRET);

export {receiver}