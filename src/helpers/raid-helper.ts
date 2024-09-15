import axios from "axios";

export type PostedRaidHelperEvent = {
  color: string;
  description: string;
  title: string;
  templateId: string;
  signUpCount: string;
  leaderId: string;
  lastUpdated: number;
  leaderName: string;
  closeTime: number;
  startTime: number;
  endTime: number;
  id: string;
  channelId: string;
}

type RhMember = {
  id: number;
  userId: string;
  name: string;
  status: string;
}

type RhEventResponse = {
  id: string;
  signUps: RhMember[];
}

export async function fetchRaidHelperEventSignUps(rhEventId: string) {
  try {
    const response = await axios.get<RhEventResponse>(`https://raid-helper.dev/api/v2/events/${rhEventId}`, {
      headers: {
        'Authorization': `${process.env.RAID_HELPER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    const eventData = response.data;
    const signUps = eventData.signUps;
    return signUps;
  } catch (error) {
    console.error('Error fetching event data from Raid-Helper:', error);
    return [];
  }
}

type RhEventsResponse = {
  pages: number;
  currentPage: number;
  eventCountOverall: number;
  eventCountTransmitted: number;
  postedEvents: PostedRaidHelperEvent[];
}

export async function fetchRaidHelperPostedEvents() {
  try {
    const response = await axios.get<RhEventsResponse>(`https://raid-helper.dev/api/v3/servers/${process.env.GUILD_ID}/events`, {
      headers: {
        'Authorization': `${process.env.RAID_HELPER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    const events = response.data.postedEvents;
    return events;
  }
  catch (error) {
    console.error('Error fetching events from Raid-Helper:', error);
    return [];
  }
}
