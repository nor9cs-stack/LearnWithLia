import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "learnwithlia",
  eventKey: process.env.INNGEST_EVENT_KEY,
});
