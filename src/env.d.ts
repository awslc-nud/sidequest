/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Attendee session id minted/read by middleware (attendee half). */
    sessionId?: string;
    /** Set by middleware for requests inside the marshal area. */
    isMarshal?: boolean;
    /** Optional human label of the authenticated marshal session. */
    marshalLabel?: string | null;
  }
}
