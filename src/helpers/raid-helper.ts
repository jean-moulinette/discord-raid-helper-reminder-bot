import axios from 'axios';

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
};

type RhMember = {
  id: number;
  userId: string;
  name: string;
  status: string;
};

type RhEventResponse = {
  id: string;
  signUps: RhMember[];
};

export async function fetchRaidHelperEventSignUps(rhEventId: string) {
  try {
    const response = await axios.get<RhEventResponse>(
      `https://raid-helper.dev/api/v2/events/${rhEventId}`,
      {
        headers: {
          Authorization: `${process.env.RAID_HELPER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const eventData = response.data;
    const signUps = eventData.signUps;
    return signUps;
  } catch (error) {
    console.error('Error fetching event data from Raid-Helper:', error);
    console.log('Retrying in 1 minute...');

    // Retry after 1 minute if the first attempt fails
    try {
      const signups = await new Promise<RhMember[]>((resolve, reject) => {
        setTimeout(async () => {
          try {
            const response = await axios.get<RhEventResponse>(
              `https://raid-helper.dev/api/v2/events/${rhEventId}`,
              {
                headers: {
                  Authorization: `${process.env.RAID_HELPER_API_KEY}`,
                  'Content-Type': 'application/json',
                },
              },
            );

            const eventData = response.data;
            const signUps = eventData.signUps;
            resolve(signUps);
          } catch (e) {
            reject();
          }
        }, 60000);
      });
      return signups;
    } catch (e) {
      console.error('Second attempt to fetch event data from Raid-Helper failed. Exiting...');
      throw new Error('Error fetching event data from Raid-Helper');
    }
  }
}

type RhEventsResponse = {
  pages: number;
  currentPage: number;
  eventCountOverall: number;
  eventCountTransmitted: number;
  postedEvents: PostedRaidHelperEvent[];
};

export async function fetchRaidHelperPostedEvents() {
  try {
    const response = await axios.get<RhEventsResponse>(
      `https://raid-helper.dev/api/v3/servers/${process.env.GUILD_ID}/events`,
      {
        headers: {
          Authorization: `${process.env.RAID_HELPER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );
    const events = response.data.postedEvents;
    return events;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error fetching events from Raid-Helper ${e.message}`);
    }
    throw Error('Error fetching events from Raid-Helper');
  }
}

export async function deleteRaidHelperEvent(eventId: string) {
  try {
    const response = await axios.delete(`https://raid-helper.dev/api/v2/events/${eventId}`, {
      headers: {
        Authorization: `${process.env.RAID_HELPER_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    return response.status;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error deleting event from Raid-Helper ${e.message}`);
    }
    throw Error('Error deleting event from Raid-Helper');
  }
}

export async function createRaidHelperEvent(channelId: string, date: string, title?: string) {
  try {
    const response = await axios.post(
      `https://raid-helper.dev/api/v2/servers/${process.env.GUILD_ID}/channels/${channelId}/event`,
      {
        leaderId: process.env.RAID_LEAD_USER_ID,
        templateId: process.env.RAID_HELPER_TEMPLATE_ID,
        title,
        advancedSettings: {
          vacuum: true,
          tentative_emote: 'remove',
          bench_emote: 'remove',
        },
        date,
      },
      {
        headers: {
          Authorization: `${process.env.RAID_HELPER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.status;
  } catch (e) {
    if (e instanceof Error) {
      throw Error(`Error creating event in Raid-Helper ${e.message}`);
    }

    throw Error('Error creating event in Raid-Helper');
  }
}
